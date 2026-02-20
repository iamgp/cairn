package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestIngestCommandParsesFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "input.md")
	input := strings.Join([]string{
		"```project",
		`name = "cairn"`,
		"```",
		"```history",
		`entries = ["hello"]`,
		"```",
		"```pr_comment",
		`body = "ok"`,
		"```",
		"```checkers",
		`names = ["go test ./..."]`,
		"```",
	}, "\n")
	if err := os.WriteFile(path, []byte(input), 0o644); err != nil {
		t.Fatalf("write input file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"ingest", path})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute ingest: %v", err)
	}
}

func TestIngestCommandShowsFriendlyValidationError(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "input.md")
	input := strings.Join([]string{
		"```project",
		`name = ""`,
		"```",
		"```history",
		`notes = "ok"`,
		"```",
		"```pr_comment",
		`body = "ok"`,
		"```",
		"```checkers",
		`names = ["go test ./..."]`,
		"```",
	}, "\n")
	if err := os.WriteFile(path, []byte(input), 0o644); err != nil {
		t.Fatalf("write input file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"ingest", path})
	err := cmd.Execute()
	if err == nil {
		t.Fatal("expected ingest validation error")
	}
	if !strings.Contains(err.Error(), `project block is missing required field "name"`) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestIngestCommandAppendsRunRecordToPagesDir(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "run.json")
	pagesDir := filepath.Join(dir, "pages")
	if err := os.MkdirAll(pagesDir, 0o755); err != nil {
		t.Fatalf("create pages dir: %v", err)
	}

	run := Run{
		Version:   runSchemaVersion,
		RunID:     "abc123-py312",
		SHA:       "abc1234",
		SHAFull:   "abc1234567890",
		Branch:    "main",
		Timestamp: time.Unix(0, 0).UTC(),
		Checks:    []Check{},
	}
	raw, err := json.Marshal(run)
	if err != nil {
		t.Fatalf("marshal run json: %v", err)
	}
	if err := os.WriteFile(inputPath, raw, 0o644); err != nil {
		t.Fatalf("write input file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"ingest", inputPath, "--pages-dir", pagesDir})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute ingest: %v", err)
	}

	content, err := os.ReadFile(filepath.Join(pagesDir, "history.ndjson"))
	if err != nil {
		t.Fatalf("read history file: %v", err)
	}
	if strings.TrimSpace(string(content)) == "" {
		t.Fatal("expected appended run record, got empty history.ndjson")
	}
}

func TestParseIngestCommandArgs(t *testing.T) {
	t.Parallel()

	inputPath, pagesDir, err := parseIngestCommandArgs([]string{"input.md", "--pages-dir", "pages"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inputPath != "input.md" {
		t.Fatalf("unexpected input path %q", inputPath)
	}
	if pagesDir != "pages" {
		t.Fatalf("unexpected pages dir %q", pagesDir)
	}
}

func TestParseIngestCommandArgsMissingPagesDirValue(t *testing.T) {
	t.Parallel()

	_, _, err := parseIngestCommandArgs([]string{"input.md", "--pages-dir"})
	if err == nil {
		t.Fatal("expected missing pages-dir value error")
	}
	if !strings.Contains(err.Error(), "missing value for --pages-dir") {
		t.Fatalf("unexpected error: %v", err)
	}
}
