package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParseCommentCommandArgs(t *testing.T) {
	t.Parallel()

	opts, err := parseCommentCommandArgs([]string{"run.json", "--out", "comment.md", "--report-url", "https://example.test/report"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if opts.inputPath != "run.json" {
		t.Fatalf("unexpected input path %q", opts.inputPath)
	}
	if opts.outPath != "comment.md" {
		t.Fatalf("unexpected out path %q", opts.outPath)
	}
	if opts.reportURL != "https://example.test/report" {
		t.Fatalf("unexpected report URL %q", opts.reportURL)
	}
}

func TestCommentCommandWritesOutputFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "run.json")
	outPath := filepath.Join(dir, "nested", "comment.md")

	run := Run{
		Version:   runSchemaVersion,
		RunID:     "run-1",
		SHA:       "abc1234",
		SHAFull:   "abc1234def5678",
		Branch:    "main",
		Timestamp: time.Unix(0, 0).UTC(),
		Checks: []Check{
			{
				Tool:   "ruff",
				Status: "failed",
				Items: []Item{
					{ID: "src/app.py:1:1:F401", Status: "failed"},
				},
			},
		},
	}
	raw, err := json.Marshal(run)
	if err != nil {
		t.Fatalf("marshal run: %v", err)
	}
	if err := os.WriteFile(inputPath, raw, 0o644); err != nil {
		t.Fatalf("write run file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"comment", inputPath, "--out", outPath, "--report-url", "https://example.test/cairn"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute comment: %v", err)
	}

	outRaw, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("read comment output: %v", err)
	}
	content := string(outRaw)
	assertContains(t, content, "<!-- cairn:comment -->")
	assertContains(t, content, "### Cairn Quality Report")
	assertContains(t, content, "**Commit:** `abc1234`")
	assertContains(t, content, "[View full report](https://example.test/cairn)")
	assertContains(t, content, "| ruff | failed | 1 |")
}

func TestRenderPRCommentNoChecks(t *testing.T) {
	t.Parallel()

	content := renderPRComment(Run{RunID: "run-2", SHAFull: "abcdef1234567"}, "")

	if !strings.Contains(content, "#/run/run-2") {
		t.Fatalf("expected default run URL, got %q", content)
	}
	assertContains(t, content, "No checks were recorded for this run.")
}
