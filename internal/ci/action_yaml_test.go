package ci

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestActionYMLIncludesRequiredIngestWorkflow(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve current test file")
	}

	actionPath := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "action.yml"))
	raw, err := os.ReadFile(actionPath)
	if err != nil {
		t.Fatalf("read %s: %v", actionPath, err)
	}

	content := string(raw)
	required := []string{
		"using: \"composite\"",
		"uses: actions/checkout@v4",
		"ref: ${{ inputs.gh-pages-branch }}",
		"continue-on-error: true",
		"Bootstrap missing gh-pages branch",
		"RUNNER_OS",
		"RUNNER_ARCH",
		"cairn-path:",
		"release_repo=\"iamgp/cairn\"",
		"Use provided cairn binary",
		"pages-subdir:",
		"collect-config:",
		"collect-args:",
		"Either ingest-file or collect-config must be provided.",
		"cairn collect --config \"${collect_config}\" --out \"${collect_out}\"",
		"cairn ingest \"${{ steps.prepare-run-record.outputs.path }}\" --pages-dir \"${publish_dir}\"",
		"uses: actions/setup-node@v4",
		"node-version: \"24\"",
		"cache-dependency-path:",
		"npm ci --no-audit --no-fund",
		"npm run build:pages",
		"pages_subdir=\"${{ inputs.pages-subdir }}\"",
		"cp -R .output/public/. \"${pages_dir}/\"",
		"cannot build TanStack report assets",
		"prune_args=(prune --pages-dir \"${publish_dir}\")",
		"git add -A",
		"git push origin \"HEAD:${{ inputs.gh-pages-branch }}\"",
		"post-pr-comment:",
		"comment_enabled=\"true\"",
		"--show-coverage=\"${show_coverage}\"",
		"--show-per-matrix=\"${show_per_matrix}\"",
		"--pages-dir \"${publish_dir}\"",
		"uses: actions/github-script@v7",
		"<!-- cairn:comment -->",
	}

	for _, needle := range required {
		if !strings.Contains(content, needle) {
			t.Fatalf("action.yml missing expected content: %q", needle)
		}
	}
}
