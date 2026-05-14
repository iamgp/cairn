package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParseCommentCommandArgs(t *testing.T) {
	t.Parallel()

	opts, err := parseCommentCommandArgs([]string{
		"run.json",
		"--out", "comment.md",
		"--report-url", "https://example.test/report",
		"--config", "cairn.toml",
		"--show-coverage=false",
		"--show-per-matrix=false",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if opts.inputPath != "run.json" {
		t.Fatalf("unexpected input path %q", opts.inputPath)
	}
	if opts.outPath != "comment.md" {
		t.Fatalf("unexpected out path %q", opts.outPath)
	}
	if opts.reportURL != "https://example.test/report" {
		t.Fatalf("unexpected report URL %q", opts.reportURL)
	}
	if opts.configPath != "cairn.toml" {
		t.Fatalf("unexpected config path %q", opts.configPath)
	}
	if opts.showCoverage == nil || *opts.showCoverage {
		t.Fatalf("unexpected showCoverage %#v", opts.showCoverage)
	}
	if opts.showPerMatrix == nil || *opts.showPerMatrix {
		t.Fatalf("unexpected showPerMatrix %#v", opts.showPerMatrix)
	}
}

func TestNormalizeCommentStatus(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"pass":       "passed",
		"passed":     "passed",
		"success":    "passed",
		"fail":       "failed",
		"failed":     "failed",
		"failure":    "failed",
		"error":      "error",
		"skip":       "skipped",
		"skipped":    "skipped",
		"cancelled":  "cancelled",
		"":           "unknown",
		"  custom  ": "custom",
	}

	for input, want := range cases {
		if got := normalizeCommentStatus(input); got != want {
			t.Fatalf("normalizeCommentStatus(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestBuildCommentSummaryCountsNormalizedStatuses(t *testing.T) {
	t.Parallel()

	run := Run{
		Checks: []Check{
			{
				Tool:      "pytest",
				Status:    "success",
				DurationS: 2.5,
				Items: []Item{
					{ID: "test_a", Status: "pass"},
					{ID: "test_b", Status: "skipped"},
				},
			},
			{
				Tool:      "ruff",
				Status:    "failed",
				DurationS: 1.25,
				Items: []Item{
					{ID: "F401", Status: "fail"},
					{ID: "F821", Status: "error"},
				},
			},
		},
	}

	summary := buildCommentSummary(run)
	if summary.Status != "failed" {
		t.Fatalf("unexpected overall status %q", summary.Status)
	}
	if summary.Total != 4 || summary.Passed != 1 || summary.Failed != 2 || summary.Skipped != 1 {
		t.Fatalf("unexpected totals: %#v", summary)
	}
	if summary.DurationS != 3.75 {
		t.Fatalf("unexpected duration: %f", summary.DurationS)
	}
}

func TestMarkdownTableCellEscapesUnsafeContent(t *testing.T) {
	t.Parallel()

	got := markdownTableCell("a | b\n`c`")
	want := "a \\| b<br>`c`"
	if got != want {
		t.Fatalf("markdownTableCell() = %q, want %q", got, want)
	}
}

func TestCommentCommandWritesOutputFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "run.json")
	outPath := filepath.Join(dir, "nested", "comment.md")

	run := Run{
		Version:   runSchemaVersion,
		RunID:     "run-1",
		SHA:       "abc1234",
		SHAFull:   "abc1234def5678",
		Branch:    "main",
		Timestamp: time.Unix(0, 0).UTC(),
		Checks: []Check{
			{
				Tool:   "ruff",
				Status: "failed",
				Items: []Item{
					{ID: "src/app.py:1:1:F401", Status: "failed"},
				},
			},
		},
	}
	raw, err := json.Marshal(run)
	if err != nil {
		t.Fatalf("marshal run: %v", err)
	}
	if err := os.WriteFile(inputPath, raw, 0o644); err != nil {
		t.Fatalf("write run file: %v", err)
	}

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"comment", inputPath, "--out", outPath, "--report-url", "https://example.test/cairn"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute comment: %v", err)
	}

	outRaw, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("read comment output: %v", err)
	}
	content := string(outRaw)
	assertContains(t, content, "<!-- cairn:comment -->")
	assertContains(t, content, "## Cairn Quality Report")
	assertContains(t, content, "Commit: `abc1234`")
	assertContains(t, content, "[View full report](https://example.test/cairn)")
	assertContains(t, content, "Overall: failed")
	assertContains(t, content, "https://img.shields.io/badge/ruff-failed-red?style=flat-square")
	assertContains(t, content, "| ruff | failed | 0 | 1 | 0 | 1 | - |")
}

func TestRenderPRCommentWithRichSummary(t *testing.T) {
	t.Parallel()

	run := Run{
		RunID:   "run-counts",
		SHAFull: "abcdef1234567",
		Checks: []Check{
			{
				Tool:      "pytest|3.12",
				Status:    "failure",
				DurationS: 66.4,
				Items: []Item{
					{ID: "test_a", Status: "pass"},
					{ID: "test_b", Status: "passed"},
					{ID: "test_c|param", Status: "fail", Message: "expected true\nactual false"},
					{ID: "test_d", Status: "skip"},
				},
			},
		},
	}

	content := renderPRComment(run, "", nil, commentRenderOptions{
		showCoverage:  true,
		showPerMatrix: true,
	})
	assertContains(t, content, "## Cairn Quality Report")
	assertContains(t, content, "Overall: failed")
	assertContains(t, content, "https://img.shields.io/badge/pytest%7C3.12-failed-red?style=flat-square")
	assertContains(t, content, "### Checker Summary")
	assertContains(t, content, "| Checker | Status | Passed | Failed | Skipped | Items | Time |")
	assertContains(t, content, "| pytest\\|3.12 | failed | 2 | 1 | 1 | 4 | 66s |")
	assertContains(t, content, "### Failures")
	assertContains(t, content, "| pytest\\|3.12 | test_c\\|param | failed | expected true<br>actual false |")
	assertNoEmoji(t, content)
}

func TestRenderPRCommentWithBaseline(t *testing.T) {
	t.Parallel()

	baseline := Run{
		Branch: "main",
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

	run := Run{
		RunID:   "run-baseline",
		SHAFull: "abcdef1234567",
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "failed",
				Items: []Item{
					{ID: "test_a", Status: "failed"},
					{ID: "test_b", Status: "passed"},
					{ID: "test_c", Status: "passed"},
				},
			},
		},
	}

	content := renderPRComment(run, "", &baseline, commentRenderOptions{
		showCoverage:  true,
		showPerMatrix: true,
	})
	assertContains(t, content, "### Baseline Changes")
	assertContains(t, content, "Compared with `main`: 1 new failure, 1 fixed.")
	assertContains(t, content, "#### New Failures (vs `main`)")
	assertContains(t, content, "| pytest | test_a | failed |")
	assertContains(t, content, "#### Fixed (vs `main`)")
	assertContains(t, content, "| pytest | test_b |")
	assertNoEmoji(t, content)
}

func TestRenderPRCommentNoChecks(t *testing.T) {
	t.Parallel()

	content := renderPRComment(Run{RunID: "run-2", SHAFull: "abcdef1234567"}, "", nil, commentRenderOptions{
		showCoverage:  true,
		showPerMatrix: true,
	})

	if !strings.Contains(content, "#/run/run-2") {
		t.Fatalf("expected default run URL, got %q", content)
	}
	assertContains(t, content, "No checks were recorded for this run.")
}

func TestRenderPRCommentWithRegulatedMetadata(t *testing.T) {
	t.Parallel()

	run := Run{
		RunID:   "run-metadata",
		SHAFull: "abcdef1234567",
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "passed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
				},
			},
		},
		Metadata: &RunMetadata{
			Traceability: &RunTraceabilityMetadata{
				RequirementIDs: []string{"REQ-1"},
				SpecIDs:        []string{"SPEC-7"},
				RiskIDs:        []string{"RISK-2"},
				CommitMessage:  "feat: regulated metadata",
			},
			Provenance: &RunProvenanceMetadata{
				Artifacts: []RunProvenanceArtifact{
					{
						Role:      "pytest",
						Path:      "demo-artifacts/pytest-junit.xml",
						SHA256:    "abc123",
						SizeBytes: 1234,
					},
				},
			},
			Coverage: &RunCoverageMetadata{
				Overall: &RunCoverageMetricsMap{
					Line: &RunCoverageMetric{Covered: 90, Total: 100, Percent: 90},
				},
				PerCheck: map[string]RunCoverageMetricsMap{
					"pytest": {
						Function: &RunCoverageMetric{Covered: 5, Total: 10, Percent: 50},
					},
				},
			},
		},
	}

	content := renderPRComment(run, "", nil, commentRenderOptions{
		showCoverage:  true,
		showPerMatrix: true,
	})
	assertContains(t, content, "#### Traceability")
	assertContains(t, content, "- Requirements: `REQ-1`")
	assertContains(t, content, "- Specs: `SPEC-7`")
	assertContains(t, content, "- Risks: `RISK-2`")
	assertContains(t, content, "- Commit message: feat: regulated metadata")
	assertContains(t, content, "#### Artifact Provenance")
	assertContains(t, content, "| pytest | demo-artifacts/pytest-junit.xml | abc123 | 1234 bytes |")
	assertContains(t, content, "#### Coverage")
	assertContains(t, content, "| overall | 90/100 (90.0%) | - | - |")
	assertContains(t, content, "| pytest | - | - | 5/10 (50.0%) |")
}

func TestRenderPRCommentRespectsMatrixAndCoverageToggles(t *testing.T) {
	t.Parallel()

	run := Run{
		RunID: "run-options",
		SHA:   "abc1234",
		Matrix: map[string]string{
			"os":     "ubuntu-latest",
			"python": "3.12",
		},
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "passed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
				},
			},
		},
		Metadata: &RunMetadata{
			Coverage: &RunCoverageMetadata{
				Overall: &RunCoverageMetricsMap{
					Line: &RunCoverageMetric{Covered: 9, Total: 10, Percent: 90},
				},
			},
		},
	}

	content := renderPRComment(run, "", nil, commentRenderOptions{
		showCoverage:  false,
		showPerMatrix: false,
	})
	assertNotContains(t, content, "#### Coverage")
	assertNotContains(t, content, "#### Matrix")
}
