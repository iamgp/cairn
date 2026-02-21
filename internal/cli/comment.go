package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

var errCommentNoInput = errors.New("comment requires an input path")

type commentOptions struct {
	inputPath      string
	outPath        string
	reportURL      string
	pagesDir       string
	baselineBranch string
}

func newCommentCommand() *cobra.Command {
	return &cobra.Command{
		Use:                "comment",
		Short:              "Render a PR comment from a run record",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			opts, err := parseCommentCommandArgs(args)
			if errors.Is(err, errCommentNoInput) {
				return cmd.Help()
			}
			if err != nil {
				return err
			}

			raw, err := os.ReadFile(opts.inputPath)
			if err != nil {
				return fmt.Errorf("read run record: %w", err)
			}

			var run Run
			if err := json.Unmarshal(raw, &run); err != nil {
				return fmt.Errorf("parse run record JSON: %w", err)
			}

			var baseline *Run
			if opts.pagesDir != "" {
				baseline, err = loadBaselineRun(opts.pagesDir, opts.baselineBranch)
				if err != nil {
					return err
				}
			}

			comment := renderPRComment(run, opts.reportURL, baseline)
			if opts.outPath == "" {
				_, err = fmt.Print(comment)
				return err
			}

			if err := os.MkdirAll(filepath.Dir(opts.outPath), 0o755); err != nil {
				return fmt.Errorf("create output directory: %w", err)
			}
			if err := os.WriteFile(opts.outPath, []byte(comment), 0o644); err != nil {
				return fmt.Errorf("write comment file: %w", err)
			}

			return nil
		},
	}
}

func parseCommentCommandArgs(args []string) (commentOptions, error) {
	opts := commentOptions{
		baselineBranch: "main",
	}
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]

		switch {
		case strings.HasPrefix(arg, "--out="):
			opts.outPath = strings.TrimPrefix(arg, "--out=")
		case arg == "--out":
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --out")
			}
			i++
			opts.outPath = args[i]
		case strings.HasPrefix(arg, "--report-url="):
			opts.reportURL = strings.TrimPrefix(arg, "--report-url=")
		case arg == "--report-url":
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --report-url")
			}
			i++
			opts.reportURL = args[i]
		case strings.HasPrefix(arg, "--pages-dir="):
			opts.pagesDir = strings.TrimPrefix(arg, "--pages-dir=")
		case arg == "--pages-dir":
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --pages-dir")
			}
			i++
			opts.pagesDir = args[i]
		case strings.HasPrefix(arg, "--baseline-branch="):
			opts.baselineBranch = strings.TrimPrefix(arg, "--baseline-branch=")
		case arg == "--baseline-branch":
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --baseline-branch")
			}
			i++
			opts.baselineBranch = args[i]
		case strings.HasPrefix(arg, "--"):
			return commentOptions{}, fmt.Errorf("unknown flag %q", arg)
		default:
			positional = append(positional, arg)
		}
	}

	if len(positional) == 0 {
		return commentOptions{}, errCommentNoInput
	}
	if len(positional) > 1 {
		return commentOptions{}, fmt.Errorf("comment accepts a single input path")
	}

	opts.inputPath = positional[0]
	return opts, nil
}

func loadBaselineRun(pagesDir, branch string) (*Run, error) {
	runs, err := loadHistoryRuns(pagesDir)
	if err != nil {
		return nil, fmt.Errorf("load baseline: %w", err)
	}
	return findBaselineRun(runs, branch), nil
}

func renderPRComment(run Run, reportURL string, baseline *Run) string {
	shortSHA := strings.TrimSpace(run.SHA)
	if shortSHA == "" {
		full := strings.TrimSpace(run.SHAFull)
		if len(full) > 7 {
			shortSHA = full[:7]
		} else {
			shortSHA = full
		}
	}
	if shortSHA == "" {
		shortSHA = "unknown"
	}

	resolvedURL := strings.TrimSpace(reportURL)
	if resolvedURL == "" {
		resolvedURL = "#/run/" + run.RunID
	}

	var b strings.Builder
	b.WriteString("<!-- cairn:comment -->\n")
	b.WriteString("### Cairn Quality Report\n\n")
	b.WriteString("**Commit:** `")
	b.WriteString(shortSHA)
	b.WriteString("` · [View full report](")
	b.WriteString(resolvedURL)
	b.WriteString(")\n\n")

	if len(run.Checks) == 0 {
		b.WriteString("No checks were recorded for this run.\n")
		return b.String()
	}

	b.WriteString("| Checker | Status | ✅ Passed | ❌ Failed | Items |\n")
	b.WriteString("| --- | --- | ---: | ---: | ---: |\n")
	for _, check := range run.Checks {
		var passCount, failCount int
		for _, item := range check.Items {
			switch item.Status {
			case "passed":
				passCount++
			case "failed", "error":
				failCount++
			}
		}
		b.WriteString("| ")
		b.WriteString(strings.TrimSpace(check.Tool))
		b.WriteString(" | ")
		b.WriteString(strings.TrimSpace(check.Status))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", passCount))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", failCount))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", len(check.Items)))
		b.WriteString(" |\n")
	}

	if run.Metadata != nil {
		if traceability := run.Metadata.Traceability; traceability != nil {
			hasTraceability := len(traceability.RequirementIDs) > 0 ||
				len(traceability.SpecIDs) > 0 ||
				len(traceability.RiskIDs) > 0 ||
				strings.TrimSpace(traceability.CommitMessage) != ""
			if hasTraceability {
				b.WriteString("\n#### Traceability\n\n")
				if len(traceability.RequirementIDs) > 0 {
					b.WriteString("- Requirements: `")
					b.WriteString(strings.Join(traceability.RequirementIDs, "`, `"))
					b.WriteString("`\n")
				}
				if len(traceability.SpecIDs) > 0 {
					b.WriteString("- Specs: `")
					b.WriteString(strings.Join(traceability.SpecIDs, "`, `"))
					b.WriteString("`\n")
				}
				if len(traceability.RiskIDs) > 0 {
					b.WriteString("- Risks: `")
					b.WriteString(strings.Join(traceability.RiskIDs, "`, `"))
					b.WriteString("`\n")
				}
				if msg := strings.TrimSpace(traceability.CommitMessage); msg != "" {
					b.WriteString("- Commit message: ")
					b.WriteString(msg)
					b.WriteString("\n")
				}
			}
		}

		if provenance := run.Metadata.Provenance; provenance != nil && len(provenance.Artifacts) > 0 {
			b.WriteString("\n#### Artifact Provenance\n\n")
			b.WriteString("| Role | Path | SHA256 | Size |\n")
			b.WriteString("| --- | --- | --- | ---: |\n")
			for _, artifact := range provenance.Artifacts {
				b.WriteString("| ")
				b.WriteString(strings.TrimSpace(artifact.Role))
				b.WriteString(" | ")
				b.WriteString(strings.TrimSpace(artifact.Path))
				b.WriteString(" | ")
				b.WriteString(strings.TrimSpace(artifact.SHA256))
				b.WriteString(" | ")
				if artifact.SizeBytes > 0 {
					b.WriteString(fmt.Sprintf("%d bytes", artifact.SizeBytes))
				} else {
					b.WriteString("-")
				}
				b.WriteString(" |\n")
			}
		}

		if coverage := run.Metadata.Coverage; coverage != nil {
			hasCoverage := coverage.Overall != nil || len(coverage.PerCheck) > 0
			if hasCoverage {
				b.WriteString("\n#### Coverage\n\n")
				b.WriteString("| Scope | Line | Branch | Function |\n")
				b.WriteString("| --- | --- | --- | --- |\n")
				if coverage.Overall != nil {
					b.WriteString("| overall | ")
					b.WriteString(renderCoverageMetric(coverage.Overall.Line))
					b.WriteString(" | ")
					b.WriteString(renderCoverageMetric(coverage.Overall.Branch))
					b.WriteString(" | ")
					b.WriteString(renderCoverageMetric(coverage.Overall.Function))
					b.WriteString(" |\n")
				}
				checkIDs := make([]string, 0, len(coverage.PerCheck))
				for checkID := range coverage.PerCheck {
					checkIDs = append(checkIDs, checkID)
				}
				sort.Strings(checkIDs)
				for _, checkID := range checkIDs {
					metrics := coverage.PerCheck[checkID]
					b.WriteString("| ")
					b.WriteString(checkID)
					b.WriteString(" | ")
					b.WriteString(renderCoverageMetric(metrics.Line))
					b.WriteString(" | ")
					b.WriteString(renderCoverageMetric(metrics.Branch))
					b.WriteString(" | ")
					b.WriteString(renderCoverageMetric(metrics.Function))
					b.WriteString(" |\n")
				}
			}
		}
	}

	if baseline != nil {
		newFailures, fixed := diffItems(run, *baseline)

		if len(newFailures) > 0 {
			b.WriteString("\n#### 🆕 New Failures (vs `")
			b.WriteString(baseline.Branch)
			b.WriteString("`)\n\n")
			b.WriteString("| Checker | Test | Status |\n")
			b.WriteString("| --- | --- | --- |\n")
			for _, nf := range newFailures {
				b.WriteString("| ")
				b.WriteString(nf.Checker)
				b.WriteString(" | ")
				b.WriteString(nf.ItemID)
				b.WriteString(" | ")
				b.WriteString(nf.Status)
				b.WriteString(" |\n")
			}
		}

		if len(fixed) > 0 {
			b.WriteString("\n#### ✅ Fixed (vs `")
			b.WriteString(baseline.Branch)
			b.WriteString("`)\n\n")
			b.WriteString("| Checker | Test |\n")
			b.WriteString("| --- | --- |\n")
			for _, f := range fixed {
				b.WriteString("| ")
				b.WriteString(f.Checker)
				b.WriteString(" | ")
				b.WriteString(f.ItemID)
				b.WriteString(" |\n")
			}
		}
	}

	return b.String()
}

func renderCoverageMetric(metric *RunCoverageMetric) string {
	if metric == nil {
		return "-"
	}
	return fmt.Sprintf("%d/%d (%.1f%%)", metric.Covered, metric.Total, metric.Percent)
}
