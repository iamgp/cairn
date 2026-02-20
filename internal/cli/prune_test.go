package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParsePruneCommandArgs(t *testing.T) {
	t.Parallel()

	opts, err := parsePruneCommandArgs([]string{
		"--pages-dir", "pages",
		"--max-days", "14",
		"--max-runs=20",
		"--dry-run",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if opts.pagesDir != "pages" {
		t.Fatalf("unexpected pages dir %q", opts.pagesDir)
	}
	if opts.maxDays != 14 {
		t.Fatalf("unexpected maxDays %d", opts.maxDays)
	}
	if opts.maxRuns != 20 {
		t.Fatalf("unexpected maxRuns %d", opts.maxRuns)
	}
	if !opts.dryRun {
		t.Fatal("expected dryRun=true")
	}
}

func TestParsePruneCommandArgsRequiresPagesDir(t *testing.T) {
	t.Parallel()

	_, err := parsePruneCommandArgs([]string{"--max-days", "7"})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "prune requires --pages-dir") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestPruneHistoryFileAppliesMaxDaysAndMaxRuns(t *testing.T) {
	t.Parallel()

	pagesDir := t.TempDir()
	now := time.Date(2026, 2, 20, 12, 0, 0, 0, time.UTC)
	runs := []Run{
		newRun("old", now.AddDate(0, 0, -10)),
		newRun("mid-1", now.AddDate(0, 0, -3)),
		newRun("mid-2", now.AddDate(0, 0, -2)),
		newRun("new", now.AddDate(0, 0, -1)),
	}
	writeHistoryFile(t, pagesDir, runs)

	result, err := pruneHistoryFile(pruneOptions{
		pagesDir: pagesDir,
		maxDays:  5,
		maxRuns:  2,
	}, now)
	if err != nil {
		t.Fatalf("pruneHistoryFile() unexpected error: %v", err)
	}
	if result.kept != 2 || result.removed != 2 {
		t.Fatalf("unexpected prune result: %+v", result)
	}

	kept := readHistoryRunIDs(t, pagesDir)
	if strings.Join(kept, ",") != "mid-2,new" {
		t.Fatalf("unexpected kept run ids: %v", kept)
	}
}

func TestPruneHistoryFileDryRunDoesNotRewrite(t *testing.T) {
	t.Parallel()

	pagesDir := t.TempDir()
	now := time.Date(2026, 2, 20, 12, 0, 0, 0, time.UTC)
	runs := []Run{
		newRun("old", now.AddDate(0, 0, -30)),
		newRun("new", now.AddDate(0, 0, -1)),
	}
	writeHistoryFile(t, pagesDir, runs)

	originalPath := filepath.Join(pagesDir, "history.ndjson")
	original, err := os.ReadFile(originalPath)
	if err != nil {
		t.Fatalf("read original history: %v", err)
	}

	result, err := pruneHistoryFile(pruneOptions{
		pagesDir: pagesDir,
		maxDays:  7,
		dryRun:   true,
	}, now)
	if err != nil {
		t.Fatalf("pruneHistoryFile() unexpected error: %v", err)
	}
	if result.kept != 1 || result.removed != 1 {
		t.Fatalf("unexpected prune result: %+v", result)
	}

	after, err := os.ReadFile(originalPath)
	if err != nil {
		t.Fatalf("read history after dry-run: %v", err)
	}
	if string(after) != string(original) {
		t.Fatal("dry-run modified history file")
	}
}

func newRun(runID string, ts time.Time) Run {
	return Run{
		Version:   runSchemaVersion,
		RunID:     runID,
		SHA:       runID,
		SHAFull:   runID,
		Branch:    "main",
		Timestamp: ts.UTC(),
		Checks:    []Check{},
	}
}

func writeHistoryFile(t *testing.T, pagesDir string, runs []Run) {
	t.Helper()

	lines := make([]string, 0, len(runs))
	for _, run := range runs {
		raw, err := json.Marshal(run)
		if err != nil {
			t.Fatalf("marshal run %q: %v", run.RunID, err)
		}
		lines = append(lines, string(raw))
	}

	historyPath := filepath.Join(pagesDir, "history.ndjson")
	content := strings.Join(lines, "\n")
	if len(lines) > 0 {
		content += "\n"
	}
	if err := os.WriteFile(historyPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write history file: %v", err)
	}
}

func readHistoryRunIDs(t *testing.T, pagesDir string) []string {
	t.Helper()

	historyPath := filepath.Join(pagesDir, "history.ndjson")
	raw, err := os.ReadFile(historyPath)
	if err != nil {
		t.Fatalf("read history file: %v", err)
	}

	var runIDs []string
	for _, line := range strings.Split(string(raw), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		var run Run
		if err := json.Unmarshal([]byte(trimmed), &run); err != nil {
			t.Fatalf("unmarshal run: %v", err)
		}
		runIDs = append(runIDs, run.RunID)
	}
	return runIDs
}
