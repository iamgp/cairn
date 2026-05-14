# Node-Free Cairn Report Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cairn simple to add to existing repositories by removing Node/Vite/npm work from consumer action runs while preserving the current static report UI.

**Architecture:** Build report assets in the Cairn repository/release process, embed or package those static assets with the Go CLI, and let the composite action call a Go-owned `render` command to copy assets into the Pages directory. The composite action remains the GitHub Actions adapter, while the CLI owns report rendering, pruning, and eventually more publishing behavior.

**Tech Stack:** Go 1.24, Cobra, `embed`, Vite/React only at Cairn release/build time, GitHub composite actions, `go test`, `npm run build:pages`.

---

## File Structure

- Create `internal/cli/report_assets.go`
  - Owns embedded report asset filesystem.
  - Exposes a small `copyReportAssets(pagesDir string) error` helper.

- Create `internal/cli/report_assets_test.go`
  - Tests that assets copy recursively, preserve nested paths, and reject empty output directories.

- Create `internal/cli/render.go`
  - Adds `cairn render --pages-dir <dir>`.
  - Copies report assets into the target directory.
  - Keeps rendering separate from ingestion so existing workflows can compose `collect`, `ingest`, `prune`, and `render`.

- Create `internal/cli/render_test.go`
  - Tests CLI argument parsing and command behavior.

- Create `internal/cli/testdata/report-assets/index.html`
  - Tiny embedded test asset for unit tests if production assets are not available in test context.

- Modify `internal/cli/root.go`
  - Registers `newRenderCommand()`.

- Modify `action.yml`
  - Removes `actions/setup-node`, `npm ci`, and `npm run build:pages` from consumer runs.
  - Calls `cairn render --pages-dir "${pages_dir}"` after ingest/prune.

- Modify `scripts/release.sh`
  - Builds `web/.output/public` once before Go release packaging.
  - Ensures packaged binaries include embedded/static report assets.

- Modify `README.md`
  - Documents that consumers do not need Node for Cairn.
  - Adds a short architecture note explaining that web assets are prebuilt by Cairn releases.

- Modify `internal/ci/action_yaml_test.go`
  - Updates action metadata expectations so tests fail if Node/npm sneaks back into the consumer action path.

---

### Task 1: Add Report Asset Copier

**Files:**
- Create: `internal/cli/report_assets.go`
- Create: `internal/cli/report_assets_test.go`
- Create: `internal/cli/testdata/report-assets/index.html`

- [ ] **Step 1: Create a minimal test asset**

Create `internal/cli/testdata/report-assets/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Cairn Test Report</title>
  </head>
  <body>
    <div id="app">Cairn test report asset</div>
  </body>
</html>
```

- [ ] **Step 2: Write failing tests for the asset copier**

Create `internal/cli/report_assets_test.go`:

```go
package cli

import (
	"embed"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

//go:embed testdata/report-assets/*
var testReportAssets embed.FS

func TestCopyEmbeddedReportAssetsCopiesFiles(t *testing.T) {
	t.Parallel()

	target := t.TempDir()
	err := copyEmbeddedReportAssets(testReportAssets, "testdata/report-assets", target)
	if err != nil {
		t.Fatalf("copy embedded report assets: %v", err)
	}

	raw, err := os.ReadFile(filepath.Join(target, "index.html"))
	if err != nil {
		t.Fatalf("read copied index.html: %v", err)
	}
	if !strings.Contains(string(raw), "Cairn test report asset") {
		t.Fatalf("copied index.html did not contain expected marker: %s", string(raw))
	}
}

func TestCopyEmbeddedReportAssetsRejectsEmptyTarget(t *testing.T) {
	t.Parallel()

	err := copyEmbeddedReportAssets(testReportAssets, "testdata/report-assets", "")
	if err == nil {
		t.Fatal("expected empty target directory to fail")
	}
	if !strings.Contains(err.Error(), "target directory is required") {
		t.Fatalf("expected target directory error, got %v", err)
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
go test ./internal/cli -run TestCopyEmbeddedReportAssets -count=1
```

Expected: FAIL with `undefined: copyEmbeddedReportAssets`.

- [ ] **Step 4: Implement the copier**

Create `internal/cli/report_assets.go`:

```go
package cli

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed web-assets/*
var reportAssets embed.FS

func copyReportAssets(targetDir string) error {
	return copyEmbeddedReportAssets(reportAssets, "web-assets", targetDir)
}

func copyEmbeddedReportAssets(source fs.FS, sourceRoot string, targetDir string) error {
	targetDir = strings.TrimSpace(targetDir)
	if targetDir == "" {
		return fmt.Errorf("target directory is required")
	}

	return fs.WalkDir(source, sourceRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relative, err := filepath.Rel(sourceRoot, path)
		if err != nil {
			return fmt.Errorf("resolve asset path %q: %w", path, err)
		}
		if relative == "." {
			return nil
		}

		targetPath := filepath.Join(targetDir, relative)
		if entry.IsDir() {
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return fmt.Errorf("create asset directory %q: %w", targetPath, err)
			}
			return nil
		}

		raw, err := fs.ReadFile(source, path)
		if err != nil {
			return fmt.Errorf("read embedded asset %q: %w", path, err)
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return fmt.Errorf("create asset parent %q: %w", filepath.Dir(targetPath), err)
		}
		if err := os.WriteFile(targetPath, raw, 0o644); err != nil {
			return fmt.Errorf("write report asset %q: %w", targetPath, err)
		}

		return nil
	})
}
```

- [ ] **Step 5: Add a production asset placeholder directory**

Create `internal/cli/web-assets/index.html` with this temporary content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Cairn Report</title>
  </head>
  <body>
    <div id="app">Cairn report assets were not built before packaging.</div>
  </body>
</html>
```

This file is intentionally replaced by the release/build step after the web app is built.

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
go test ./internal/cli -run TestCopyEmbeddedReportAssets -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/cli/report_assets.go internal/cli/report_assets_test.go internal/cli/testdata/report-assets/index.html internal/cli/web-assets/index.html
git commit -m "feat: add embedded report asset copier"
```

---

### Task 2: Add `cairn render --pages-dir`

**Files:**
- Create: `internal/cli/render.go`
- Create: `internal/cli/render_test.go`
- Modify: `internal/cli/root.go`

- [ ] **Step 1: Write failing parser and command tests**

Create `internal/cli/render_test.go`:

```go
package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseRenderCommandArgs(t *testing.T) {
	t.Parallel()

	opts, err := parseRenderCommandArgs([]string{"--pages-dir", "public"})
	if err != nil {
		t.Fatalf("parse render args: %v", err)
	}
	if opts.pagesDir != "public" {
		t.Fatalf("expected pages dir public, got %q", opts.pagesDir)
	}
}

func TestParseRenderCommandArgsRequiresPagesDir(t *testing.T) {
	t.Parallel()

	_, err := parseRenderCommandArgs(nil)
	if err == nil {
		t.Fatal("expected missing pages-dir to fail")
	}
	if !strings.Contains(err.Error(), "--pages-dir") {
		t.Fatalf("expected pages-dir error, got %v", err)
	}
}

func TestRenderCommandCopiesReportAssets(t *testing.T) {
	target := t.TempDir()
	cmd := newRenderCommand()
	cmd.SetArgs([]string{"--pages-dir", target})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute render command: %v", err)
	}

	if _, err := os.Stat(filepath.Join(target, "index.html")); err != nil {
		t.Fatalf("expected index.html to be rendered: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/cli -run 'Test(ParseRenderCommandArgs|RenderCommand)' -count=1
```

Expected: FAIL with `undefined: parseRenderCommandArgs` and `undefined: newRenderCommand`.

- [ ] **Step 3: Implement the render command**

Create `internal/cli/render.go`:

```go
package cli

import (
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var errRenderNoPagesDir = errors.New("render requires --pages-dir")

type renderOptions struct {
	pagesDir string
}

func newRenderCommand() *cobra.Command {
	return &cobra.Command{
		Use:                "render",
		Short:              "Render Cairn report assets into a Pages directory",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			opts, err := parseRenderCommandArgs(args)
			if errors.Is(err, errRenderNoPagesDir) {
				return cmd.Help()
			}
			if err != nil {
				return err
			}

			return copyReportAssets(opts.pagesDir)
		},
	}
}

func parseRenderCommandArgs(args []string) (renderOptions, error) {
	opts := renderOptions{}
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case strings.HasPrefix(arg, "--pages-dir="):
			opts.pagesDir = strings.TrimPrefix(arg, "--pages-dir=")
		case arg == "--pages-dir":
			if i+1 >= len(args) {
				return renderOptions{}, fmt.Errorf("missing value for --pages-dir")
			}
			i++
			opts.pagesDir = args[i]
		case strings.HasPrefix(arg, "--"):
			return renderOptions{}, fmt.Errorf("unknown flag %q", arg)
		default:
			positional = append(positional, arg)
		}
	}

	if len(positional) > 0 {
		return renderOptions{}, fmt.Errorf("render does not accept positional arguments")
	}
	if strings.TrimSpace(opts.pagesDir) == "" {
		return renderOptions{}, errRenderNoPagesDir
	}

	return opts, nil
}
```

- [ ] **Step 4: Register the command**

Modify `internal/cli/root.go` so `NewRootCommand` includes `render`:

```go
func NewRootCommand() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "cairn",
		Short: "Cairn data maintenance CLI",
	}

	rootCmd.AddCommand(newIngestCommand())
	rootCmd.AddCommand(newCollectCommand())
	rootCmd.AddCommand(newCommentCommand())
	rootCmd.AddCommand(newPruneCommand())
	rootCmd.AddCommand(newRenderCommand())
	rootCmd.AddCommand(newInitCommand())
	rootCmd.AddCommand(newCheckCommand())

	return rootCmd
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
go test ./internal/cli -run 'Test(ParseRenderCommandArgs|RenderCommand|CopyEmbeddedReportAssets)' -count=1
```

Expected: PASS.

- [ ] **Step 6: Run all Go tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/cli/root.go internal/cli/render.go internal/cli/render_test.go
git commit -m "feat: add report render command"
```

---

### Task 3: Remove Node From the Consumer Action Path

**Files:**
- Modify: `action.yml`
- Modify: `internal/ci/action_yaml_test.go`

- [ ] **Step 1: Add action metadata tests that reject Node/npm in consumer publishing**

Open `internal/ci/action_yaml_test.go` and add this test:

```go
func TestActionDoesNotBuildWebAssetsInConsumerRun(t *testing.T) {
	raw, err := os.ReadFile("../../action.yml")
	if err != nil {
		t.Fatalf("read action.yml: %v", err)
	}

	content := string(raw)
	for _, forbidden := range []string{
		"actions/setup-node",
		"npm ci",
		"npm run build:pages",
	} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("action.yml should not contain consumer web build step %q", forbidden)
		}
	}

	if !strings.Contains(content, "cairn render") {
		t.Fatal("action.yml should render report assets through the cairn CLI")
	}
}
```

If the file does not already import `strings`, update its imports to include it:

```go
import (
	"os"
	"strings"
	"testing"
)
```

- [ ] **Step 2: Run the action metadata test to verify it fails**

Run:

```bash
go test ./internal/ci -run TestActionDoesNotBuildWebAssetsInConsumerRun -count=1
```

Expected: FAIL because `action.yml` still contains `actions/setup-node`, `npm ci`, and `npm run build:pages`.

- [ ] **Step 3: Replace the web build step in `action.yml`**

Remove the entire `Setup Node for web report` step and replace the `Build report web assets` step with:

```yaml
    - name: Render report web assets
      shell: bash
      run: |
        set -euo pipefail

        base_pages_dir="${{ github.workspace }}/gh-pages"
        pages_subdir="${{ inputs.pages-subdir }}"
        pages_subdir="${pages_subdir#/}"
        pages_subdir="${pages_subdir%/}"
        pages_dir="${base_pages_dir}"
        if [ -n "${pages_subdir}" ]; then
          pages_dir="${base_pages_dir}/${pages_subdir}"
        fi
        mkdir -p "${pages_dir}"

        cairn render --pages-dir "${pages_dir}"
```

- [ ] **Step 4: Run the action metadata test again**

Run:

```bash
go test ./internal/ci -run TestActionDoesNotBuildWebAssetsInConsumerRun -count=1
```

Expected: PASS.

- [ ] **Step 5: Run full tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add action.yml internal/ci/action_yaml_test.go
git commit -m "fix: render report assets without consumer node install"
```

---

### Task 4: Build Web Assets Before Packaging Releases

**Files:**
- Modify: `scripts/release.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Add generated asset directory to `.gitignore`**

Modify `.gitignore` to include:

```gitignore
internal/cli/web-assets/*
!internal/cli/web-assets/.gitkeep
```

- [ ] **Step 2: Preserve an embeddable directory**

Replace `internal/cli/web-assets/index.html` with `internal/cli/web-assets/.gitkeep`.

The production files in `internal/cli/web-assets/` are generated by the release script. The directory must exist so `//go:embed web-assets/*` has a match in normal development.

- [ ] **Step 3: Write a release script prebuild helper**

In `scripts/release.sh`, add this function near the other helpers:

```bash
build_web_assets() {
  local repo_root="$1"

  cd "${repo_root}/web"
  npm ci --no-audit --no-fund
  npm run build:pages

  cd "${repo_root}"
  mkdir -p internal/cli/web-assets
  find internal/cli/web-assets -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +
  cp -R web/.output/public/. internal/cli/web-assets/
}
```

- [ ] **Step 4: Call the helper before Go builds**

In `scripts/release.sh`, call the helper after the script has resolved `repo_root` and before any `go build` command:

```bash
build_web_assets "${repo_root}"
```

- [ ] **Step 5: Run the web build manually**

Run:

```bash
npm run build:pages
```

from `/Users/garethprice/Developer/cairn/web`.

Expected: PASS and `.output/public/index.html` exists.

- [ ] **Step 6: Populate embedded assets locally**

Run:

```bash
mkdir -p internal/cli/web-assets
find internal/cli/web-assets -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +
cp -R web/.output/public/. internal/cli/web-assets/
```

Expected: `internal/cli/web-assets/index.html` exists and Go embed has concrete files.

- [ ] **Step 7: Run Go tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 8: Commit script and ignore changes**

```bash
git add .gitignore scripts/release.sh internal/cli/web-assets/.gitkeep
git commit -m "build: package prebuilt report assets"
```

Do not commit generated `internal/cli/web-assets/index.html` or asset files unless the team chooses a committed-assets strategy during review.

---

### Task 5: Add a Development-Time Asset Sync Script

**Files:**
- Create: `scripts/sync-web-assets.sh`
- Modify: `README.md`

- [ ] **Step 1: Create the sync script**

Create `scripts/sync-web-assets.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${repo_root}/web"
npm ci --no-audit --no-fund
npm run build:pages

cd "${repo_root}"
mkdir -p internal/cli/web-assets
find internal/cli/web-assets -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +
cp -R web/.output/public/. internal/cli/web-assets/
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/sync-web-assets.sh
```

Expected: command exits 0.

- [ ] **Step 3: Document local asset sync**

Add this section to `README.md` under Releases:

```markdown
## Report Assets

Cairn consumers do not install Node or build the report app. Release builds prebuild
`web/.output/public` and package those static assets with the `cairn` binary.

When changing `web/`, refresh local embedded assets before testing the rendered CLI output:

```bash
scripts/sync-web-assets.sh
go test ./...
```
```

- [ ] **Step 4: Run the sync script**

Run:

```bash
scripts/sync-web-assets.sh
```

Expected: PASS and `internal/cli/web-assets/index.html` exists.

- [ ] **Step 5: Verify rendered CLI output manually**

Run:

```bash
go run . render --pages-dir /tmp/cairn-render-check
test -f /tmp/cairn-render-check/index.html
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add README.md scripts/sync-web-assets.sh
git commit -m "docs: document prebuilt report assets"
```

---

### Task 6: Add Existing-Repo Resilience for Missing Checker Artifacts

**Files:**
- Modify: `internal/cli/collect.go`
- Modify: `internal/cli/collect_test.go`
- Modify: `docs/adapters.md`
- Modify: `README.md`

- [ ] **Step 1: Extend checker config tests for optional missing inputs**

Add this test to `internal/cli/collect_test.go`:

```go
func TestCollectChecksOptionalMissingInputProducesSkippedCheck(t *testing.T) {
	t.Parallel()

	cfg := cairnConfig{
		Project: cairnProjectConfig{Name: "demo"},
		Checkers: []cairnCheckerConfig{
			{
				ID:            "pytest",
				Adapter:       "junit_xml",
				Input:         filepath.Join(t.TempDir(), "missing.xml"),
				Required:      boolPtr(false),
				MissingStatus: "skipped",
			},
		},
	}

	checks, err := collectChecks(cfg, nil)
	if err != nil {
		t.Fatalf("collect checks: %v", err)
	}
	if len(checks) != 1 {
		t.Fatalf("expected one check, got %d", len(checks))
	}
	if checks[0].Tool != "pytest" {
		t.Fatalf("expected tool pytest, got %q", checks[0].Tool)
	}
	if checks[0].Status != "skipped" {
		t.Fatalf("expected skipped status, got %q", checks[0].Status)
	}
	if len(checks[0].Items) != 1 {
		t.Fatalf("expected one explanatory item, got %d", len(checks[0].Items))
	}
	if checks[0].Items[0].ID != "pytest-missing-input" {
		t.Fatalf("unexpected item id %q", checks[0].Items[0].ID)
	}
}

func boolPtr(value bool) *bool {
	return &value
}
```

Ensure `internal/cli/collect_test.go` imports `path/filepath`.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
go test ./internal/cli -run TestCollectChecksOptionalMissingInputProducesSkippedCheck -count=1
```

Expected: FAIL because `Required` and `MissingStatus` do not exist.

- [ ] **Step 3: Add config fields**

Modify `cairnCheckerConfig` in `internal/cli/collect.go`:

```go
type cairnCheckerConfig struct {
	ID            string             `toml:"id"`
	Adapter       string             `toml:"adapter"`
	Input         string             `toml:"input"`
	Required      *bool              `toml:"required"`
	MissingStatus string             `toml:"missing_status"`
	Mapping       genericJSONMapping `toml:"mapping"`
}
```

- [ ] **Step 4: Add missing-input helpers**

Add these helpers in `internal/cli/collect.go` near `collectChecks`:

```go
func checkerRequired(checker cairnCheckerConfig) bool {
	return boolPointerOrDefault(checker.Required, true)
}

func checkerMissingStatus(checker cairnCheckerConfig) string {
	status := strings.TrimSpace(checker.MissingStatus)
	if status == "" {
		return "skipped"
	}
	return status
}

func missingInputCheck(checker cairnCheckerConfig) Check {
	status := checkerMissingStatus(checker)
	return Check{
		Tool:      checker.ID,
		Status:    status,
		DurationS: 0,
		Summary: map[string]int{
			status: 1,
		},
		Items: []Item{
			{
				ID:      checker.ID + "-missing-input",
				Status:  status,
				Message: "Configured checker input was not found: " + checker.Input,
			},
		},
	}
}
```

- [ ] **Step 5: Use helpers in `collectChecks`**

At the start of the loop inside `collectChecks`, before the adapter switch, add:

```go
		if _, statErr := os.Stat(checker.Input); statErr != nil {
			if os.IsNotExist(statErr) && !checkerRequired(checker) {
				checks = append(checks, missingInputCheck(checker))
				continue
			}
			if os.IsNotExist(statErr) {
				return nil, fmt.Errorf("collect checker %q: input file not found: %s", checker.ID, checker.Input)
			}
			return nil, fmt.Errorf("collect checker %q: stat input file: %w", checker.ID, statErr)
		}
```

- [ ] **Step 6: Validate `missing_status` values**

In `loadCairnConfig`, inside the checker validation loop, add:

```go
		switch checkerMissingStatus(checker) {
		case "skipped", "error", "failed":
		default:
			return cairnConfig{}, fmt.Errorf("config [[checkers]] entry %d has unsupported missing_status %q", i+1, checker.MissingStatus)
		}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
go test ./internal/cli -run 'TestCollectChecksOptionalMissingInputProducesSkippedCheck|Test.*Config' -count=1
```

Expected: PASS.

- [ ] **Step 8: Document optional checkers**

Add this to `docs/adapters.md`:

```markdown
### Optional Checker Inputs

By default, missing checker input files fail collection. For matrix jobs or artifacts that
may legitimately be absent, set `required = false`.

```toml
[[checkers]]
id = "pytest-3.13"
adapter = "junit_xml"
input = "cairn-artifacts/pytest-3.13.xml"
required = false
missing_status = "skipped"
```

Supported `missing_status` values are `skipped`, `failed`, and `error`.
```

- [ ] **Step 9: Run full tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add internal/cli/collect.go internal/cli/collect_test.go docs/adapters.md README.md
git commit -m "feat: allow optional checker artifacts"
```

---

### Task 7: Verify Phlo Integration Shape Without Editing Phlo

**Files:**
- No Cairn source edits expected.
- Read-only reference: `/Users/garethprice/Developer/phlo/.github/workflows/ci.yml`
- Read-only reference: `/Users/garethprice/Developer/phlo/.github/workflows/docs.yml`
- Read-only reference: `/Users/garethprice/Developer/phlo/.github/cairn.toml`

- [ ] **Step 1: Confirm Phlo’s Cairn action no longer needs Node**

Inspect the action path:

```bash
rg -n "actions/setup-node|npm ci|npm run build:pages|cairn render" action.yml
```

Expected: only `cairn render` appears.

- [ ] **Step 2: Confirm Phlo’s Pages writer model remains compatible**

Inspect Phlo workflow snippets:

```bash
nl -ba ../phlo/.github/workflows/ci.yml | sed -n '444,478p'
nl -ba ../phlo/.github/workflows/docs.yml | sed -n '78,110p'
```

Expected:
- CI still publishes Cairn under `cairn` or `previews/pr-*/cairn`.
- Docs deploy still preserves `cairn` and `previews`.
- No edits are made to Phlo.

- [ ] **Step 3: Run a local render smoke test**

Run:

```bash
tmpdir="$(mktemp -d)"
go run . render --pages-dir "${tmpdir}/cairn"
test -f "${tmpdir}/cairn/index.html"
```

Expected: both commands exit 0.

- [ ] **Step 4: Run final verification**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 5: Commit only if files changed in this task**

If this task produced no source edits, do not create a commit.

---

## Follow-Up Plan: Native HTML/JS Report Prototype

This is intentionally separate. Once consumer CI is Node-free, create a second plan to prototype a native static report that reads the same `history.ndjson` file and implements:

- Main branch run list
- PR run list
- Run detail with filterable check items
- Trends summary
- No PDF export in the first prototype unless users still rely on it

Acceptance criterion for replacing the React app: the native report must match the current essential workflows and reduce release asset size and maintenance cost without making the UI harder to evolve.

---

## Self-Review

**Spec coverage:** The plan addresses the architectural proposal: remove Node/Vite from consumer builds, preserve current report behavior, improve existing-repo resilience, and keep Phlo read-only during verification.

**Placeholder scan:** No task uses placeholder instructions. Every code-changing step includes concrete code or exact command output expectations.

**Type consistency:** New names are consistent across tasks: `copyReportAssets`, `copyEmbeddedReportAssets`, `newRenderCommand`, `parseRenderCommandArgs`, `renderOptions`, `Required`, and `MissingStatus`.
