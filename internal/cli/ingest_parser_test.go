package cli

import (
	"strings"
	"testing"
)

func TestParseIngestBlocksSuccess(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"```project",
		`name = "cairn"`,
		"```",
		"```history",
		`entries = ["created project", "added cli"]`,
		"```",
		"```pr_comment",
		`body = "LGTM with minor follow-ups."`,
		"```",
		"```checkers",
		"[[checker]]",
		`name = "go test ./..."`,
		"```",
	}, "\n")

	got, err := parseIngestBlocks(input)
	if err != nil {
		t.Fatalf("parseIngestBlocks() unexpected error: %v", err)
	}

	if got.Project.Name != "cairn" {
		t.Fatalf("expected project.name to be cairn, got %q", got.Project.Name)
	}
	if len(got.History.Entries) != 2 {
		t.Fatalf("expected two history entries, got %d", len(got.History.Entries))
	}
	if got.PRComment.Body == "" {
		t.Fatal("expected pr_comment.body to be parsed")
	}
	if len(got.Checkers.Checker) != 1 {
		t.Fatalf("expected one checker entry, got %d", len(got.Checkers.Checker))
	}
}

func TestParseIngestBlocksMissingBlock(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"```project",
		`name = "cairn"`,
		"```",
		"```history",
		`notes = "first pass"`,
		"```",
		"```checkers",
		`names = ["go test ./..."]`,
		"```",
	}, "\n")

	_, err := parseIngestBlocks(input)
	if err == nil {
		t.Fatal("expected missing block error")
	}
	if !strings.Contains(err.Error(), "missing required block(s): pr_comment") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseIngestBlocksInvalidTOML(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"```project",
		`name = "cairn`,
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

	_, err := parseIngestBlocks(input)
	if err == nil {
		t.Fatal("expected invalid TOML error")
	}
	if !strings.Contains(err.Error(), `invalid TOML in "project" block`) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseIngestBlocksMissingRequiredFields(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"```project",
		`name = "cairn"`,
		"```",
		"```history",
		`notes = "ok"`,
		"```",
		"```pr_comment",
		`body = "ok"`,
		"```",
		"```checkers",
		"[[checker]]",
		`name = ""`,
		"```",
	}, "\n")

	_, err := parseIngestBlocks(input)
	if err == nil {
		t.Fatal("expected missing required field error")
	}
	if !strings.Contains(err.Error(), `checkers block has [[checker]] entry 1 missing required field "name"`) {
		t.Fatalf("unexpected error: %v", err)
	}
}
