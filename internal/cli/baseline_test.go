package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadHistoryRuns(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	r1 := Run{
		Version:   runSchemaVersion,
		RunID:     "run-1",
		Branch:    "main",
		Timestamp: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		Checks:    []Check{{Tool: "pytest", Status: "passed"}},
	}
	r2 := Run{
		Version:   runSchemaVersion,
		RunID:     "run-2",
		Branch:    "feature",
		Timestamp: time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC),
		Checks:    []Check{{Tool: "pytest", Status: "failed"}},
	}

	line1, _ := json.Marshal(r1)
	line2, _ := json.Marshal(r2)
	content := string(line1) + "\n" + string(line2) + "\n"
	if err := os.WriteFile(filepath.Join(dir, "history.ndjson"), []byte(content), 0o644); err != nil {
		t.Fatalf("write history: %v", err)
	}

	runs, err := loadHistoryRuns(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(runs) != 2 {
		t.Fatalf("expected 2 runs, got %d", len(runs))
	}
	if runs[0].RunID != "run-2" {
		t.Fatalf("expected most recent run first, got %q", runs[0].RunID)
	}
	if runs[1].RunID != "run-1" {
		t.Fatalf("expected oldest run last, got %q", runs[1].RunID)
	}
}

func TestLoadHistoryRunsMissingFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	runs, err := loadHistoryRuns(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(runs) != 0 {
		t.Fatalf("expected 0 runs, got %d", len(runs))
	}
}

func TestFindBaselineRun(t *testing.T) {
	t.Parallel()

	runs := []Run{
		{RunID: "run-3", Branch: "feature", Timestamp: time.Date(2025, 1, 3, 0, 0, 0, 0, time.UTC)},
		{RunID: "run-2", Branch: "main", Timestamp: time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC)},
		{RunID: "run-1", Branch: "main", Timestamp: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)},
	}

	baseline := findBaselineRun(runs, "main")
	if baseline == nil {
		t.Fatal("expected a baseline run")
	}
	if baseline.RunID != "run-2" {
		t.Fatalf("expected run-2, got %q", baseline.RunID)
	}

	missing := findBaselineRun(runs, "nonexistent")
	if missing != nil {
		t.Fatalf("expected nil for missing branch, got %q", missing.RunID)
	}
}

func TestDiffItems(t *testing.T) {
	t.Parallel()

	baseline := Run{
		Checks: []Check{
			{
				Tool: "pytest",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
					{ID: "test_b", Status: "failed"},
					{ID: "test_c", Status: "passed"},
				},
			},
		},
	}

	current := Run{
		Checks: []Check{
			{
				Tool: "pytest",
				Items: []Item{
					{ID: "test_a", Status: "failed"},
					{ID: "test_b", Status: "passed"},
					{ID: "test_c", Status: "passed"},
					{ID: "test_d", Status: "failed"},
				},
			},
		},
	}

	newFailures, fixed := diffItems(current, baseline)

	if len(newFailures) != 2 {
		t.Fatalf("expected 2 new failures, got %d", len(newFailures))
	}
	foundA := false
	foundD := false
	for _, nf := range newFailures {
		if nf.ItemID == "test_a" {
			foundA = true
		}
		if nf.ItemID == "test_d" {
			foundD = true
		}
	}
	if !foundA {
		t.Fatal("expected test_a in new failures")
	}
	if !foundD {
		t.Fatal("expected test_d in new failures")
	}

	if len(fixed) != 1 {
		t.Fatalf("expected 1 fixed, got %d", len(fixed))
	}
	if fixed[0].ItemID != "test_b" {
		t.Fatalf("expected test_b in fixed, got %q", fixed[0].ItemID)
	}
}
