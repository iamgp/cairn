package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCheckPassRateAboveThreshold(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "run.json")

	run := Run{
		Version:   runSchemaVersion,
		RunID:     "run-1",
		SHA:       "abc1234",
		Branch:    "feature",
		Timestamp: time.Now().UTC(),
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "passed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
					{ID: "test_b", Status: "passed"},
					{ID: "test_c", Status: "passed"},
				},
			},
		},
	}
	raw, _ := json.Marshal(run)
	if err := os.WriteFile(inputPath, raw, 0o644); err != nil {
		t.Fatalf("write run file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"check", inputPath, "--fail-under", "90"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("expected check to pass, got error: %v", err)
	}
}

func TestCheckPassRateBelowThreshold(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "run.json")

	run := Run{
		Version:   runSchemaVersion,
		RunID:     "run-2",
		SHA:       "def5678",
		Branch:    "feature",
		Timestamp: time.Now().UTC(),
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "failed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
					{ID: "test_b", Status: "failed"},
				},
			},
		},
	}
	raw, _ := json.Marshal(run)
	if err := os.WriteFile(inputPath, raw, 0o644); err != nil {
		t.Fatalf("write run file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"check", inputPath, "--fail-under", "90"})
	err := cmd.Execute()
	if err == nil {
		t.Fatal("expected check to fail, got nil error")
	}
}

func TestCheckWithBaseline(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "run.json")
	pagesDir := filepath.Join(dir, "pages")
	if err := os.MkdirAll(pagesDir, 0o755); err != nil {
		t.Fatalf("create pages dir: %v", err)
	}

	baseline := Run{
		Version:   runSchemaVersion,
		RunID:     "baseline-1",
		SHA:       "base123",
		Branch:    "main",
		Timestamp: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "passed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
					{ID: "test_b", Status: "passed"},
				},
			},
		},
	}
	baselineJSON, _ := json.Marshal(baseline)
	if err := os.WriteFile(filepath.Join(pagesDir, "history.ndjson"), append(baselineJSON, '\n'), 0o644); err != nil {
		t.Fatalf("write history: %v", err)
	}

	current := Run{
		Version:   runSchemaVersion,
		RunID:     "run-3",
		SHA:       "cur456",
		Branch:    "feature",
		Timestamp: time.Now().UTC(),
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "failed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
					{ID: "test_b", Status: "failed"},
				},
			},
		},
	}
	raw, _ := json.Marshal(current)
	if err := os.WriteFile(inputPath, raw, 0o644); err != nil {
		t.Fatalf("write run file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"check", inputPath, "--pages-dir", pagesDir, "--fail-under", "90"})
	err := cmd.Execute()
	if err == nil {
		t.Fatal("expected check to fail with new failures")
	}
}
