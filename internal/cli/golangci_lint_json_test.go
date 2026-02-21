package cli

import "testing"

func TestParseGolangCILintJSON(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"Issues": [
			{
				"FromLinter": "gosec",
				"Text": "Potential hardcoded credentials",
				"Severity": "warning",
				"Pos": {
					"Filename": "internal/app/config.go",
					"Line": 21,
					"Column": 10
				}
			}
		]
	}`)

	check, err := parseGolangCILintJSON(raw)
	if err != nil {
		t.Fatalf("parseGolangCILintJSON() unexpected error: %v", err)
	}

	if check.Tool != "golangci-lint" {
		t.Fatalf("expected tool golangci-lint, got %q", check.Tool)
	}
	if check.Status != "failed" {
		t.Fatalf("expected failed status, got %q", check.Status)
	}
	if check.Summary["failed"] != 1 {
		t.Fatalf("unexpected summary: %#v", check.Summary)
	}
	if len(check.Items) != 1 {
		t.Fatalf("expected 1 issue item, got %d", len(check.Items))
	}
	if check.Items[0].ID != "internal/app/config.go:21:10:gosec" {
		t.Fatalf("unexpected item id: %q", check.Items[0].ID)
	}
	if len(check.Items[0].Tags) != 2 ||
		check.Items[0].Tags[0] != "linter:gosec" ||
		check.Items[0].Tags[1] != "severity:warning" {
		t.Fatalf("unexpected tags: %#v", check.Items[0].Tags)
	}
}

func TestParseGolangCILintJSONNoIssues(t *testing.T) {
	t.Parallel()

	check, err := parseGolangCILintJSON([]byte(`{"Issues":[]}`))
	if err != nil {
		t.Fatalf("parseGolangCILintJSON() unexpected error: %v", err)
	}

	if check.Status != "passed" {
		t.Fatalf("expected passed status, got %q", check.Status)
	}
	if check.Summary["failed"] != 0 {
		t.Fatalf("unexpected summary: %#v", check.Summary)
	}
}

func TestParseGolangCILintJSONInvalid(t *testing.T) {
	t.Parallel()

	_, err := parseGolangCILintJSON([]byte(`{`))
	if err == nil {
		t.Fatal("expected decode error")
	}
}
