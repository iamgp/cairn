package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAppendRunRecordCreatesHistoryFileOnFirstRun(t *testing.T) {
	t.Parallel()

	pagesDir := t.TempDir()
	run := Run{
		Version:   runSchemaVersion,
		RunID:     "abc123-py312",
		SHA:       "abc1234",
		SHAFull:   "abc1234567890",
		Branch:    "main",
		Timestamp: time.Unix(0, 0).UTC(),
		Checks:    []Check{},
	}

	if err := appendRunRecord(pagesDir, run); err != nil {
		t.Fatalf("appendRunRecord() unexpected error: %v", err)
	}

	content, err := os.ReadFile(filepath.Join(pagesDir, "history.ndjson"))
	if err != nil {
		t.Fatalf("read history file: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected one NDJSON line, got %d", len(lines))
	}

	var got Run
	if err := json.Unmarshal([]byte(lines[0]), &got); err != nil {
		t.Fatalf("unmarshal stored run: %v", err)
	}
	if got.RunID != run.RunID {
		t.Fatalf("expected run_id %q, got %q", run.RunID, got.RunID)
	}
}

func TestAppendRunRecordAcceptsLegacySchemaVersion(t *testing.T) {
	t.Parallel()

	pagesDir := t.TempDir()
	run := Run{
		Version: 1,
	}

	if err := appendRunRecord(pagesDir, run); err != nil {
		t.Fatalf("appendRunRecord() unexpected error for legacy version: %v", err)
	}
}

func TestAppendRunRecordRejectsUnsupportedSchemaVersion(t *testing.T) {
	t.Parallel()

	pagesDir := t.TempDir()
	run := Run{
		Version: 0,
	}

	err := appendRunRecord(pagesDir, run)
	if err == nil {
		t.Fatal("expected schema validation error")
	}
	if !strings.Contains(err.Error(), "unsupported run schema version") {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, statErr := os.Stat(filepath.Join(pagesDir, "history.ndjson")); !os.IsNotExist(statErr) {
		t.Fatalf("expected no history file created, got stat err: %v", statErr)
	}
}
