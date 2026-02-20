package cli

import "testing"

func TestParseRuffCheckJSON(t *testing.T) {
	t.Parallel()

	raw := []byte(`[
		{
			"code": "F401",
			"filename": "src/app.py",
			"location": {"row": 12, "column": 3},
			"message": "` + "unused import: os" + `"
		},
		{
			"code": "E501",
			"filename": "src/app.py",
			"location": {"row": 25, "column": 89},
			"message": "` + "line too long (120 > 88)" + `"
		}
	]`)

	check, err := parseRuffCheckJSON(raw)
	if err != nil {
		t.Fatalf("parseRuffCheckJSON() unexpected error: %v", err)
	}

	if check.Tool != "ruff" {
		t.Fatalf("expected tool ruff, got %q", check.Tool)
	}
	if check.Status != "failed" {
		t.Fatalf("expected failed status when violations exist, got %q", check.Status)
	}
	if check.Summary["failed"] != 2 {
		t.Fatalf("expected failed summary count 2, got %#v", check.Summary)
	}
	if len(check.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(check.Items))
	}

	first := check.Items[0]
	if first.ID != "src/app.py:12:3:F401" {
		t.Fatalf("unexpected item id: %q", first.ID)
	}
	if first.Message != "unused import: os" {
		t.Fatalf("unexpected item message: %q", first.Message)
	}
	if first.Status != "failed" {
		t.Fatalf("unexpected item status: %q", first.Status)
	}
}

func TestParseRuffCheckJSONNoViolations(t *testing.T) {
	t.Parallel()

	check, err := parseRuffCheckJSON([]byte(`[]`))
	if err != nil {
		t.Fatalf("parseRuffCheckJSON() unexpected error: %v", err)
	}

	if check.Status != "passed" {
		t.Fatalf("expected passed status for empty violations, got %q", check.Status)
	}
	if check.Summary["failed"] != 0 {
		t.Fatalf("expected failed summary count 0, got %#v", check.Summary)
	}
	if len(check.Items) != 0 {
		t.Fatalf("expected no items, got %d", len(check.Items))
	}
}

func TestParseRuffCheckJSONInvalid(t *testing.T) {
	t.Parallel()

	_, err := parseRuffCheckJSON([]byte(`{`))
	if err == nil {
		t.Fatal("expected decode error")
	}
}
