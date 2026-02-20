package cli

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestIngestReportCommentFlowWithFixtures(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	pagesDir := filepath.Join(tmpDir, "pages")
	if err := os.MkdirAll(pagesDir, 0o755); err != nil {
		t.Fatalf("create pages dir: %v", err)
	}

	junitCheck, err := parsePytestJUnitXMLFile(filepath.Join("testdata", "flow", "pytest-junit.xml"), nil)
	if err != nil {
		t.Fatalf("parse junit fixture: %v", err)
	}

	ruffRaw, err := os.ReadFile(filepath.Join("testdata", "flow", "ruff-results.json"))
	if err != nil {
		t.Fatalf("read ruff fixture: %v", err)
	}
	ruffCheck, err := parseRuffCheckJSON(ruffRaw)
	if err != nil {
		t.Fatalf("parse ruff fixture: %v", err)
	}

	tyRaw, err := os.ReadFile(filepath.Join("testdata", "flow", "ty-results.json"))
	if err != nil {
		t.Fatalf("read ty fixture: %v", err)
	}
	tyCheck, err := parseTyCheckJSON(tyRaw)
	if err != nil {
		t.Fatalf("parse ty fixture: %v", err)
	}

	run := Run{
		Version:   runSchemaVersion,
		RunID:     "fixture-run-py312",
		SHA:       "fa21f92",
		SHAFull:   "fa21f92d5bcd7890ee11aa22bb33cc44dd55ee66",
		PR:        intPtr(42),
		Branch:    "feature/fixtures",
		Timestamp: time.Date(2026, 2, 20, 12, 0, 0, 0, time.UTC),
		Matrix: map[string]string{
			"python": "3.12",
		},
		Checks: []Check{junitCheck, ruffCheck, tyCheck},
	}

	runRaw, err := json.Marshal(run)
	if err != nil {
		t.Fatalf("marshal run: %v", err)
	}
	runPath := filepath.Join(tmpDir, "run.json")
	if err := os.WriteFile(runPath, runRaw, 0o644); err != nil {
		t.Fatalf("write run fixture: %v", err)
	}

	ingest := NewRootCommand()
	ingest.SetArgs([]string{"ingest", runPath, "--pages-dir", pagesDir})
	if err := ingest.Execute(); err != nil {
		t.Fatalf("execute ingest: %v", err)
	}

	historyRaw, err := os.ReadFile(filepath.Join(pagesDir, "history.ndjson"))
	if err != nil {
		t.Fatalf("read history.ndjson: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(historyRaw)), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected one ndjson line, got %d", len(lines))
	}
	var decoded Run
	if err := json.Unmarshal([]byte(lines[0]), &decoded); err != nil {
		t.Fatalf("decode ndjson line as run: %v", err)
	}
	if len(decoded.Checks) != 3 {
		t.Fatalf("expected 3 checks in decoded ndjson run, got %d", len(decoded.Checks))
	}

	report := NewRootCommand()
	report.SetArgs([]string{"report", "--pages-dir", pagesDir})
	if err := report.Execute(); err != nil {
		t.Fatalf("execute report: %v", err)
	}

	htmlRaw, err := os.ReadFile(filepath.Join(pagesDir, "index.html"))
	if err != nil {
		t.Fatalf("read report html: %v", err)
	}
	htmlContent := string(htmlRaw)
	assertContains(t, htmlContent, "<!doctype html>")
	assertContains(t, htmlContent, "<html lang=\"en\">")
	assertContains(t, htmlContent, "<title>Cairn Report</title>")
	assertContains(t, htmlContent, "<div id=\"app\"></div>")

	commentPath := filepath.Join(tmpDir, "comment.md")
	comment := NewRootCommand()
	commentOut := &bytes.Buffer{}
	comment.SetOut(commentOut)
	comment.SetErr(commentOut)
	comment.SetArgs([]string{"comment", runPath, "--out", commentPath, "--report-url", "https://example.test/cairn/#/run/fixture-run-py312"})
	if err := comment.Execute(); err != nil {
		t.Fatalf("execute comment: %v", err)
	}

	commentRaw, err := os.ReadFile(commentPath)
	if err != nil {
		t.Fatalf("read comment output: %v", err)
	}
	commentContent := string(commentRaw)
	assertContains(t, commentContent, "<!-- cairn:comment -->")
	assertContains(t, commentContent, "[View full report](https://example.test/cairn/#/run/fixture-run-py312)")
	assertContains(t, commentContent, "| pytest |")
	assertContains(t, commentContent, "| ruff |")
	assertContains(t, commentContent, "| ty |")
}

func intPtr(v int) *int {
	return &v
}
