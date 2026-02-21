package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

const defaultCairnToml = `[project]
name = "your-repo"

[history]
max_days = 0
max_runs = 0

[pr_comment]
enabled = true
show_coverage = true
show_per_matrix = true

[[checkers]]
id = "pytest"
adapter = "junit_xml"
input = "pytest-{matrix.python}.xml"

[[checkers]]
id = "ruff"
adapter = "ruff_json"
input = "ruff-results.json"

[[checkers]]
id = "ty"
adapter = "ty_json"
input = "ty-results.json"
`

const defaultReadme = `# Cairn

Cairn keeps a long-running quality history for your repository and publishes a report to GitHub Pages.

## Quickstart

1. Scaffold the default files:

       cairn init

2. Adjust checker inputs in ` + "`cairn.toml`" + ` to match your CI artifact names.
3. Commit the scaffolded files.
4. Run your CI workflow and invoke the Cairn GitHub Action.
   The action can run ` + "`cairn collect`" + ` internally with ` + "`collect-config`" + ` and optional ` + "`collect-args`" + `.
5. Keep regulated provenance/evidence in ` + "`collect-args`" + ` when needed (` + "`--requirement-id`" + `, ` + "`--coverage`" + `, ` + "`--coverage-file`" + `, ` + "`--artifact`" + `). Tool versions and common lockfile hashes are auto-detected by default.

## cairn.toml Reference

` + "`[project]`" + `
- ` + "`name`" + `: Display name used in reports.

` + "`[history]`" + `
- ` + "`max_days`" + `: Drop runs older than N days (` + "`0`" + ` keeps all history). Used by ` + "`cairn prune`" + ` and applied automatically by the Cairn composite action after ingest.
- ` + "`max_runs`" + `: Keep only the latest N runs (` + "`0`" + ` keeps all runs). Used by ` + "`cairn prune`" + ` and applied automatically by the Cairn composite action after ingest.

` + "`[pr_comment]`" + `
- ` + "`enabled`" + `: Enable/disable PR comment upserts in the Cairn composite action.
- ` + "`show_coverage`" + `: Show or hide coverage tables in PR comments.
- ` + "`show_per_matrix`" + `: Show or hide matrix metadata in PR comments.

` + "`[[checkers]]`" + ` (repeat per tool)
- ` + "`id`" + `: Logical checker id.
- ` + "`adapter`" + `: One of ` + "`junit_xml`" + `, ` + "`ruff_json`" + `, ` + "`ty_json`" + `, or ` + "`generic_json`" + `.
- ` + "`input`" + `: Input file path (supports matrix placeholders like ` + "`{matrix.python}`" + `).

For adapter-specific mapping details, see ` + "`docs/adapters.md`" + `.

## Adapters

Cairn ships with:
- ` + "`junit_xml`" + ` for pytest and other JUnit-compatible outputs.
- ` + "`ruff_json`" + ` for Ruff JSON output.
- ` + "`ty_json`" + ` for Ty JSON output.
- ` + "`generic_json`" + ` for custom JSON formats via mapping paths.

## Full Example Workflow

Copy and adapt this workflow for your repository:

    name: CI

    on:
      push:
        branches: [main]
      pull_request:

    jobs:
      checks:
        runs-on: ubuntu-latest
        permissions:
          contents: write
          pages: write
          id-token: write
          pull-requests: write
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-python@v5
            with:
              python-version: "3.12"
          - run: pip install -e ".[dev]"
          - run: pytest --junitxml pytest.xml
          - run: ruff check --output-format json --output-file ruff-results.json
          - run: ty check --output json > ty-results.json
          - uses: iamgp/cairn@v0.1.0
            with:
              collect-config: cairn.toml
              collect-args: >-
                --matrix python=3.12
`

const defaultAdaptersDoc = `# Cairn Adapters

Use ` + "`adapter`" + ` in each ` + "`[[checkers]]`" + ` block to map tool output into Cairn's run schema.

## Built-in adapters

### junit_xml

Best for pytest and any tool that emits JUnit XML.

Example:

    [[checkers]]
    id = "pytest"
    adapter = "junit_xml"
    input = "pytest-{matrix.python}.xml"

### ruff_json

Parses Ruff JSON output.

Example:

    [[checkers]]
    id = "ruff"
    adapter = "ruff_json"
    input = "ruff-results.json"

### ty_json

Parses Ty JSON output.

Example:

    [[checkers]]
    id = "ty"
    adapter = "ty_json"
    input = "ty-results.json"

## generic_json adapter

Use this when a tool emits JSON but no dedicated adapter exists.

Example:

    [[checkers]]
    id = "custom-tool"
    adapter = "generic_json"
    input = "custom-results.json"

    [checkers.mapping]
    status = "summary.status"
    duration_s = "summary.duration_seconds"
    items = "results"

    [checkers.mapping.item]
    id = "id"
    status = "status"
    duration_s = "duration_seconds"
    message = "message"
    stdout = "stdout"
    stderr = "stderr"
    tags = "labels"

Mapping rules:
- Paths use dot notation (for example: ` + "`summary.total`" + `).
- Array indexes are supported (for example: ` + "`results[0].status`" + `).
- If item id is missing, Cairn assigns ` + "`item-N`" + `.
- If check duration is missing, Cairn sums item durations.
`

const defaultCairnWorkflow = `name: Cairn

on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - run: pytest --junitxml pytest.xml
      - run: ruff check --output-format json --output-file ruff-results.json
      - run: ty check --output json > ty-results.json
      - uses: iamgp/cairn@v0.1.0
        with:
          collect-config: cairn.toml
          collect-args: >-
            --matrix python=3.12
`

func newInitCommand() *cobra.Command {
	return &cobra.Command{
		Use:                "init",
		Short:              "Initialize cairn workspace state",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				return fmt.Errorf("init does not accept arguments")
			}

			if err := scaffoldFile("cairn.toml", defaultCairnToml); err != nil {
				return err
			}
			if err := scaffoldFile("README.md", defaultReadme); err != nil {
				return err
			}
			if err := scaffoldFile(filepath.Join("docs", "adapters.md"), defaultAdaptersDoc); err != nil {
				return err
			}
			if err := scaffoldFile(filepath.Join(".github", "workflows", "cairn.yml"), defaultCairnWorkflow); err != nil {
				return err
			}

			return nil
		},
	}
}

func scaffoldFile(path string, content string) error {
	if _, err := os.Stat(path); err == nil {
		fmt.Fprintf(os.Stderr, "warning: %s already exists; skipping\n", path)
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat %s: %w", path, err)
	}

	dir := filepath.Dir(path)
	if dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create directory %s: %w", dir, err)
		}
	}

	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}

	return nil
}
