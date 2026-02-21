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
	assertContains(t, content, "### Cairn Quality Report")
	assertContains(t, content, "**Commit:** `abc1234`")
	assertContains(t, content, "[View full report](https://example.test/cairn)")
	assertContains(t, content, "| ruff | failed | 0 | 1 | 1 |")
}

func TestRenderPRCommentWithCounts(t *testing.T) {
	t.Parallel()

	run := Run{
		RunID:   "run-counts",
		SHAFull: "abcdef1234567",
		Checks: []Check{
			{
				Tool:   "pytest",
				Status: "failed",
				Items: []Item{
					{ID: "test_a", Status: "passed"},
					{ID: "test_b", Status: "passed"},
					{ID: "test_c", Status: "failed"},
				},
			},
		},
	}

	content := renderPRComment(run, "", nil, commentRenderOptions{
		showCoverage:  true,
		showPerMatrix: true,
	})
	assertContains(t, content, "| pytest | failed | 2 | 1 | 3 |")
	assertContains(t, content, "✅ Passed")
	assertContains(t, content, "❌ Failed")
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
	assertContains(t, content, "#### 🆕 New Failures (vs `main`)")
	assertContains(t, content, "| pytest | test_a | failed |")
	assertContains(t, content, "#### ✅ Fixed (vs `main`)")
	assertContains(t, content, "| pytest | test_b |")
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
