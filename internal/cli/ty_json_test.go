package cli

import (
	"strings"
	"testing"
)

func TestParseTyCheckJSONV1(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"version": 1,
		"diagnostics": [
			{
				"code": "reportUnknownVariableType",
				"message": "Type of \"x\" is unknown",
				"severity": "error",
				"file": "src/app.py",
				"location": {"row": 12, "column": 3}
			},
			{
				"code": "reportGeneralTypeIssues",
				"message": "Incompatible return type",
				"severity": "warning",
				"path": "src/lib.py",
				"range": {"start": {"line": 20, "character": 8}}
			}
		]
	}`)

	check, err := parseTyCheckJSON(raw)
	if err != nil {
		t.Fatalf("parseTyCheckJSON() unexpected error: %v", err)
	}

	if check.Tool != "ty" {
		t.Fatalf("expected tool ty, got %q", check.Tool)
	}
	if check.Status != "failed" {
		t.Fatalf("expected failed status when diagnostics exist, got %q", check.Status)
	}
	if check.Summary["failed"] != 2 {
		t.Fatalf("expected failed summary count 2, got %#v", check.Summary)
	}
	if len(check.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(check.Items))
	}

	first := check.Items[0]
	if first.ID != "src/app.py:12:3:reportUnknownVariableType" {
		t.Fatalf("unexpected first item id: %q", first.ID)
	}
	if first.Message != `Type of "x" is unknown` {
		t.Fatalf("unexpected first item message: %q", first.Message)
	}
	if first.Status != "failed" {
		t.Fatalf("unexpected first item status: %q", first.Status)
	}

	second := check.Items[1]
	if second.ID != "src/lib.py:20:8:reportGeneralTypeIssues" {
		t.Fatalf("unexpected second item id: %q", second.ID)
	}
	if len(second.Tags) != 1 || second.Tags[0] != "severity:warning" {
		t.Fatalf("unexpected second item tags: %#v", second.Tags)
	}
}

func TestParseTyCheckJSONNoDiagnostics(t *testing.T) {
	t.Parallel()

	check, err := parseTyCheckJSON([]byte(`{"version":1,"diagnostics":[]}`))
	if err != nil {
		t.Fatalf("parseTyCheckJSON() unexpected error: %v", err)
	}

	if check.Status != "passed" {
		t.Fatalf("expected passed status for empty diagnostics, got %q", check.Status)
	}
	if check.Summary["failed"] != 0 {
		t.Fatalf("expected failed summary count 0, got %#v", check.Summary)
	}
	if len(check.Items) != 0 {
		t.Fatalf("expected no items, got %d", len(check.Items))
	}
}

func TestParseTyCheckJSONInvalid(t *testing.T) {
	t.Parallel()

	_, err := parseTyCheckJSON([]byte(`{`))
	if err == nil {
		t.Fatal("expected decode error")
	}
}

func TestParseTyCheckJSONUnsupportedVersion(t *testing.T) {
	t.Parallel()

	_, err := parseTyCheckJSON([]byte(`{"version":2,"diagnostics":[]}`))
	if err == nil {
		t.Fatal("expected unsupported version error")
	}
	if !strings.Contains(err.Error(), "unsupported ty json version 2") {
		t.Fatalf("unexpected error: %v", err)
	}
}
