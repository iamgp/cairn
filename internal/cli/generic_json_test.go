package cli

import (
	"strings"
	"testing"
)

func TestParseGenericCheckJSON(t *testing.T) {
	t.Parallel()

	raw := []byte(strings.Join([]string{
		`{`,
		`  "meta": {"status": "failed", "duration": 1.5},`,
		`  "results": [`,
		`    {`,
		`      "case": {"id": "case-1"},`,
		`      "outcome": "passed",`,
		`      "msg": "ok",`,
		`      "timing": {"seconds": "0.4"},`,
		`      "io": {"out": "stdout-1", "err": ""},`,
		`      "labels": ["unit", "fast"]`,
		`    },`,
		`    {`,
		`      "case": {"id": "case-2"},`,
		`      "outcome": "failed",`,
		`      "msg": "broken",`,
		`      "timing": {"seconds": 1.1},`,
		`      "io": {"err": "traceback"},`,
		`      "labels": ["integration"]`,
		`    }`,
		`  ]`,
		`}`,
	}, "\n"))

	check, err := parseGenericCheckJSON(raw, "custom", genericJSONMapping{
		Status:    "meta.status",
		DurationS: "meta.duration",
		Items:     "results",
		Item: genericJSONItemMapping{
			ID:        "case.id",
			Status:    "outcome",
			DurationS: "timing.seconds",
			Stdout:    "io.out",
			Stderr:    "io.err",
			Message:   "msg",
			Tags:      "labels",
		},
	})
	if err != nil {
		t.Fatalf("parseGenericCheckJSON() unexpected error: %v", err)
	}

	if check.Tool != "custom" {
		t.Fatalf("expected tool custom, got %q", check.Tool)
	}
	if check.Status != "failed" {
		t.Fatalf("expected mapped check status failed, got %q", check.Status)
	}
	if check.DurationS != 1.5 {
		t.Fatalf("expected mapped duration 1.5, got %v", check.DurationS)
	}
	if check.Summary["passed"] != 1 || check.Summary["failed"] != 1 {
		t.Fatalf("unexpected summary: %#v", check.Summary)
	}
	if len(check.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(check.Items))
	}
	if check.Items[0].ID != "case-1" || check.Items[0].Status != "passed" {
		t.Fatalf("unexpected first item: %#v", check.Items[0])
	}
	if check.Items[0].Tags[0] != "unit" {
		t.Fatalf("expected first tag unit, got %#v", check.Items[0].Tags)
	}
	if check.Items[1].Stderr != "traceback" {
		t.Fatalf("unexpected second item stderr: %q", check.Items[1].Stderr)
	}
}

func TestParseGenericCheckJSONDerivesStatusAndDuration(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"runs": [{
			"checks": [
				{"id": "a", "status": "skipped", "duration": 0.2},
				{"id": "b", "status": "error", "duration": "0.3"}
			]
		}]
	}`)

	check, err := parseGenericCheckJSON(raw, "derived", genericJSONMapping{
		Items: "runs[0].checks",
		Item: genericJSONItemMapping{
			ID:        "id",
			Status:    "status",
			DurationS: "duration",
		},
	})
	if err != nil {
		t.Fatalf("parseGenericCheckJSON() unexpected error: %v", err)
	}

	if check.Status != "error" {
		t.Fatalf("expected derived status error, got %q", check.Status)
	}
	if check.DurationS != 0.5 {
		t.Fatalf("expected derived duration 0.5, got %v", check.DurationS)
	}
}

func TestParseGenericCheckJSONMissingItemsPath(t *testing.T) {
	t.Parallel()

	_, err := parseGenericCheckJSON([]byte(`{"results":[]}`), "custom", genericJSONMapping{})
	if err == nil {
		t.Fatal("expected missing mapping.items error")
	}
	if !strings.Contains(err.Error(), "mapping.items is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseGenericCheckJSONMissingMappedArray(t *testing.T) {
	t.Parallel()

	_, err := parseGenericCheckJSON([]byte(`{"results":[]}`), "custom", genericJSONMapping{
		Items: "missing.path",
	})
	if err == nil {
		t.Fatal("expected missing mapped path error")
	}
	if !strings.Contains(err.Error(), `path "missing.path" not found`) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseGenericCheckJSONInvalidJSON(t *testing.T) {
	t.Parallel()

	_, err := parseGenericCheckJSON([]byte("{"), "custom", genericJSONMapping{
		Items: "results",
	})
	if err == nil {
		t.Fatal("expected decode error")
	}
}
