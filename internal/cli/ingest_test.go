package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
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
