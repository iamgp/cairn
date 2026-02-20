package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseReportCommandArgsRequiresPagesDir(t *testing.T) {
	t.Parallel()

	_, err := parseReportCommandArgs(nil)
	if err == nil {
		t.Fatal("expected error when --pages-dir is missing")
	}
	if !strings.Contains(err.Error(), "report requires --pages-dir") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseReportCommandArgsDefaultsOutPath(t *testing.T) {
	t.Parallel()

	opts, err := parseReportCommandArgs([]string{"--pages-dir", "/tmp/pages"})
	if err != nil {
		t.Fatalf("parse args: %v", err)
	}

	if opts.pagesDir != "/tmp/pages" {
		t.Fatalf("expected pages dir /tmp/pages, got %q", opts.pagesDir)
	}
	if opts.outPath != filepath.Join("/tmp/pages", "index.html") {
		t.Fatalf("unexpected default out path %q", opts.outPath)
	}
}

func TestWriteReportShell(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	outPath := filepath.Join(tmpDir, "nested", "index.html")

	if err := writeReportShell(reportOptions{
		pagesDir: tmpDir,
		outPath:  outPath,
	}); err != nil {
		t.Fatalf("write report shell: %v", err)
	}

	raw, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("read written file: %v", err)
	}
	content := string(raw)

	assertContains(t, content, "<!doctype html>")
	assertContains(t, content, "Cairn Report")
	assertContains(t, content, `"/dashboard"`)
	assertContains(t, content, "Dashboard")
	assertContains(t, content, "PR View")
	assertContains(t, content, "Run Detail")
	assertContains(t, content, "Trends")
	assertContains(t, content, "https://esm.sh/htm/preact/standalone?external=preact")
	assertContains(t, content, "const parseHashState = () =>")
	assertContains(t, content, "const serializeHashState = (route, filters) =>")
	assertContains(t, content, "const matchesFilters = (run, filters) =>")
	assertContains(t, content, "if (statusFilter && runStatus(run) !== statusFilter)")
	assertContains(t, content, "if (branchFilter && normalize(run.branch).toLowerCase() !== branchFilter)")
	assertContains(t, content, "if (prFilter)")
	assertContains(t, content, "if (shaFilter && !runSha.startsWith(shaFilter) && !runShaFull.startsWith(shaFilter))")
	assertContains(t, content, "if (!matrixMatches(run.matrix, filters.matrix))")
	assertContains(t, content, "if (!hasChecker(run.checks, filters.checker))")
	assertContains(t, content, "const computeSummary = (runs) =>")
	assertContains(t, content, "const buildDashboardTrends = (runs) =>")
	assertContains(t, content, "const buildFlakyItemRows = (runs) =>")
	assertContains(t, content, "const buildItemTrend = (runs, toolName, itemID) =>")
	assertContains(t, content, "const pickRunForDetail = (runs, runID) =>")
	assertContains(t, content, "const historyCacheRawKey = \"cairn:history:raw\"")
	assertContains(t, content, "const historyCacheETagKey = \"cairn:history:etag\"")
	assertContains(t, content, "const historyCacheSizeKey = \"cairn:history:size\"")
	assertContains(t, content, "const readHistoryCache = () =>")
	assertContains(t, content, "const writeHistoryCache = (raw, etag) =>")
	assertContains(t, content, "const parseRuns = (raw) =>")
	assertContains(t, content, "\"If-Range\": cached.etag")
	assertContains(t, content, "Range: \"bytes=\" + cached.size + \"-\"")
	assertContains(t, content, "if (incrementalResponse.status === 206)")
	assertContains(t, content, "if (incrementalResponse.ok)")
	assertContains(t, content, "writeHistoryCache(fullRaw, fullEtag)")
	assertContains(t, content, "function UPlotLineChart({ title, xValues, yValues, yLabel, color, valueSuffix })")
	assertContains(t, content, "function ItemSparkline({ values })")
	assertContains(t, content, "function RunDetail({ filters })")
	assertContains(t, content, "Summary cards")
	assertContains(t, content, "Pass Rate (7d)")
	assertContains(t, content, "Flaky Count")
	assertContains(t, content, "Avg Duration")
	assertContains(t, content, "Pass Rate Trend")
	assertContains(t, content, "Duration Trend")
	assertContains(t, content, "Flaky Tests (Filtered Window)")
	assertContains(t, content, "No flaky tests detected in the filtered window.")
	assertContains(t, content, "Recent Runs")
	assertContains(t, content, "Checkers")
	assertContains(t, content, "https://unpkg.com/uplot@1.6.31/dist/uPlot.min.css")
	assertContains(t, content, "import uPlot from \"https://esm.sh/uplot@1.6.31\"")
	assertContains(t, content, "sort((left, right) => {")
	assertContains(t, content, "if (right.flips !== left.flips)")
	assertContains(t, content, "return right.flips - left.flips;")
	assertContains(t, content, "status tiny")
	assertContains(t, content, "Checker")
	assertContains(t, content, "PR #")
	assertContains(t, content, "Matrix (key:value)")
	assertContains(t, content, "type=\"date\"")
	assertContains(t, content, "Per-check summary stats")
	assertContains(t, content, "Per-check item list")
	assertContains(t, content, "Last 20 results")
	assertContains(t, content, "<details class=\"item-panel\">")
	assertContains(t, content, "stdout")
	assertContains(t, content, "stderr")
}

func assertContains(t *testing.T, haystack string, needle string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Fatalf("expected content to contain %q", needle)
	}
}
