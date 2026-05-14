package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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
	configPath     string
	showCoverage   *bool
	showPerMatrix  *bool
}

type commentRenderOptions struct {
	showCoverage  bool
	showPerMatrix bool
}

type commentSummary struct {
	Status    string
	Total     int
	Passed    int
	Failed    int
	Skipped   int
	DurationS float64
}

type checkerCommentSummary struct {
	Tool      string
	Status    string
	Passed    int
	Failed    int
	Skipped   int
	Total     int
	DurationS float64
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

			var cfg *cairnConfig
			if strings.TrimSpace(opts.configPath) != "" {
				loaded, err := loadCairnConfig(opts.configPath)
				if err != nil {
					return err
				}
				cfg = &loaded
			}

			renderOpts := resolveCommentRenderOptions(opts, cfg)
			comment := renderPRComment(run, opts.reportURL, baseline, renderOpts)
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
		case strings.HasPrefix(arg, "--config="):
			opts.configPath = strings.TrimPrefix(arg, "--config=")
		case arg == "--config":
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --config")
			}
			i++
			opts.configPath = args[i]
		case strings.HasPrefix(arg, "--show-coverage="):
			value := strings.TrimPrefix(arg, "--show-coverage=")
			parsed, err := strconv.ParseBool(value)
			if err != nil {
				return commentOptions{}, fmt.Errorf("invalid --show-coverage value %q", value)
			}
			opts.showCoverage = &parsed
		case arg == "--show-coverage":
			parsed := true
			opts.showCoverage = &parsed
		case strings.HasPrefix(arg, "--show-per-matrix="):
			value := strings.TrimPrefix(arg, "--show-per-matrix=")
			parsed, err := strconv.ParseBool(value)
			if err != nil {
				return commentOptions{}, fmt.Errorf("invalid --show-per-matrix value %q", value)
			}
			opts.showPerMatrix = &parsed
		case arg == "--show-per-matrix":
			parsed := true
			opts.showPerMatrix = &parsed
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

func resolveCommentRenderOptions(opts commentOptions, cfg *cairnConfig) commentRenderOptions {
	resolved := commentRenderOptions{
		showCoverage:  true,
		showPerMatrix: true,
	}
	if cfg != nil {
		resolved.showCoverage = cfg.prCommentShowCoverage()
		resolved.showPerMatrix = cfg.prCommentShowPerMatrix()
	}
	if opts.showCoverage != nil {
		resolved.showCoverage = *opts.showCoverage
	}
	if opts.showPerMatrix != nil {
		resolved.showPerMatrix = *opts.showPerMatrix
	}
	return resolved
}

func loadBaselineRun(pagesDir, branch string) (*Run, error) {
	runs, err := loadHistoryRuns(pagesDir)
	if err != nil {
		return nil, fmt.Errorf("load baseline: %w", err)
	}
	return findBaselineRun(runs, branch), nil
}

func normalizeCommentStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pass", "passed", "success", "successful":
		return "passed"
	case "fail", "failed", "failure":
		return "failed"
	case "error", "errored":
		return "error"
	case "skip", "skipped":
		return "skipped"
	case "cancel", "cancelled", "canceled":
		return "cancelled"
	default:
		if strings.TrimSpace(status) == "" {
			return "unknown"
		}
		return strings.ToLower(strings.TrimSpace(status))
	}
}

func buildCommentSummary(run Run) commentSummary {
	summary := commentSummary{Status: "passed"}
	for _, check := range run.Checks {
		checkSummary := buildCheckerCommentSummary(check)
		summary.Total += checkSummary.Total
		summary.Passed += checkSummary.Passed
		summary.Failed += checkSummary.Failed
		summary.Skipped += checkSummary.Skipped
		summary.DurationS += checkSummary.DurationS
		summary.Status = worstCommentStatus(summary.Status, checkSummary.Status)
	}
	if len(run.Checks) == 0 {
		summary.Status = "unknown"
	}
	return summary
}

func buildCheckerCommentSummary(check Check) checkerCommentSummary {
	summary := checkerCommentSummary{
		Tool:      strings.TrimSpace(check.Tool),
		Status:    normalizeCommentStatus(check.Status),
		DurationS: check.DurationS,
		Total:     len(check.Items),
	}
	if summary.Tool == "" {
		summary.Tool = "unknown"
	}
	if summary.Status == "unknown" && len(check.Items) > 0 {
		summary.Status = "passed"
	}
	for _, item := range check.Items {
		itemStatus := normalizeCommentStatus(item.Status)
		switch itemStatus {
		case "passed":
			summary.Passed++
		case "failed", "error":
			summary.Failed++
		case "skipped":
			summary.Skipped++
		}
		summary.Status = worstCommentStatus(summary.Status, itemStatus)
	}
	return summary
}

func worstCommentStatus(current, next string) string {
	current = normalizeCommentStatus(current)
	next = normalizeCommentStatus(next)
	rank := map[string]int{
		"unknown":   0,
		"passed":    1,
		"skipped":   2,
		"cancelled": 3,
		"error":     4,
		"failed":    5,
	}
	if rank[next] > rank[current] {
		return next
	}
	return current
}

func renderPRComment(run Run, reportURL string, baseline *Run, options commentRenderOptions) string {
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

	summary := buildCommentSummary(run)

	var b strings.Builder
	b.WriteString("<!-- cairn:comment -->\n")
	b.WriteString("## Cairn Quality Report\n\n")
	b.WriteString("Commit: `")
	b.WriteString(shortSHA)
	b.WriteString("` - [View full report](")
	b.WriteString(resolvedURL)
	b.WriteString(")\n\n")
	b.WriteString("Overall: ")
	b.WriteString(summary.Status)
	b.WriteString("\n\n")

	if len(run.Checks) == 0 {
		b.WriteString("No checks were recorded for this run.\n")
		return b.String()
	}

	renderCheckerBadges(&b, run.Checks)

	b.WriteString("### Checker Summary\n\n")
	b.WriteString("| Checker | Status | Passed | Failed | Skipped | Items | Time |\n")
	b.WriteString("| --- | --- | ---: | ---: | ---: | ---: | ---: |\n")
	for _, check := range run.Checks {
		checkSummary := buildCheckerCommentSummary(check)
		b.WriteString("| ")
		b.WriteString(markdownTableCell(checkSummary.Tool))
		b.WriteString(" | ")
		b.WriteString(markdownTableCell(checkSummary.Status))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", checkSummary.Passed))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", checkSummary.Failed))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", checkSummary.Skipped))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", checkSummary.Total))
		b.WriteString(" | ")
		b.WriteString(formatCommentDuration(checkSummary.DurationS))
		b.WriteString(" |\n")
	}

	renderFailureDetails(&b, run.Checks)

	if options.showPerMatrix && len(run.Matrix) > 0 {
		keys := make([]string, 0, len(run.Matrix))
		for key := range run.Matrix {
			keys = append(keys, key)
		}
		sort.Strings(keys)

		b.WriteString("\n#### Matrix\n\n")
		for _, key := range keys {
			b.WriteString("- ")
			b.WriteString(key)
			b.WriteString(": `")
			b.WriteString(markdownInlineCode(run.Matrix[key]))
			b.WriteString("`\n")
		}
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
					b.WriteString(strings.Join(markdownInlineCodeValues(traceability.RequirementIDs), "`, `"))
					b.WriteString("`\n")
				}
				if len(traceability.SpecIDs) > 0 {
					b.WriteString("- Specs: `")
					b.WriteString(strings.Join(markdownInlineCodeValues(traceability.SpecIDs), "`, `"))
					b.WriteString("`\n")
				}
				if len(traceability.RiskIDs) > 0 {
					b.WriteString("- Risks: `")
					b.WriteString(strings.Join(markdownInlineCodeValues(traceability.RiskIDs), "`, `"))
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
				b.WriteString(markdownTableCell(artifact.Role))
				b.WriteString(" | ")
				b.WriteString(markdownTableCell(artifact.Path))
				b.WriteString(" | ")
				b.WriteString(markdownTableCell(artifact.SHA256))
				b.WriteString(" | ")
				if artifact.SizeBytes > 0 {
					b.WriteString(fmt.Sprintf("%d bytes", artifact.SizeBytes))
				} else {
					b.WriteString("-")
				}
				b.WriteString(" |\n")
			}
		}

		if options.showCoverage {
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
						b.WriteString(markdownTableCell(checkID))
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
	}

	if baseline != nil {
		newFailures, fixed := diffItems(run, *baseline)

		b.WriteString("\n### Baseline Changes\n\n")
		b.WriteString("Compared with `")
		b.WriteString(markdownInlineCode(baseline.Branch))
		b.WriteString("`: ")
		b.WriteString(pluralizeCount(len(newFailures), "new failure", "new failures"))
		b.WriteString(", ")
		b.WriteString(pluralizeCount(len(fixed), "fixed", "fixed"))
		b.WriteString(".\n")

		if len(newFailures) > 0 {
			b.WriteString("\n#### New Failures (vs `")
			b.WriteString(markdownInlineCode(baseline.Branch))
			b.WriteString("`)\n\n")
			b.WriteString("| Checker | Test | Status |\n")
			b.WriteString("| --- | --- | --- |\n")
			for _, nf := range newFailures {
				b.WriteString("| ")
				b.WriteString(markdownTableCell(nf.Checker))
				b.WriteString(" | ")
				b.WriteString(markdownTableCell(nf.ItemID))
				b.WriteString(" | ")
				b.WriteString(markdownTableCell(normalizeCommentStatus(nf.Status)))
				b.WriteString(" |\n")
			}
		}

		if len(fixed) > 0 {
			b.WriteString("\n#### Fixed (vs `")
			b.WriteString(markdownInlineCode(baseline.Branch))
			b.WriteString("`)\n\n")
			b.WriteString("| Checker | Test |\n")
			b.WriteString("| --- | --- |\n")
			for _, f := range fixed {
				b.WriteString("| ")
				b.WriteString(markdownTableCell(f.Checker))
				b.WriteString(" | ")
				b.WriteString(markdownTableCell(f.ItemID))
				b.WriteString(" |\n")
			}
		}
	}

	return b.String()
}

func renderCheckerBadges(b *strings.Builder, checks []Check) {
	for i, check := range checks {
		if i > 0 {
			b.WriteString(" ")
		}
		checkSummary := buildCheckerCommentSummary(check)
		label := url.PathEscape(checkSummary.Tool)
		value := url.PathEscape(checkSummary.Status)
		b.WriteString("![")
		b.WriteString(checkSummary.Tool)
		b.WriteString("](https://img.shields.io/badge/")
		b.WriteString(label)
		b.WriteString("-")
		b.WriteString(value)
		b.WriteString("-")
		b.WriteString(commentBadgeColor(checkSummary.Status))
		b.WriteString("?style=flat-square)")
	}
	b.WriteString("\n\n")
}

func commentBadgeColor(status string) string {
	switch normalizeCommentStatus(status) {
	case "passed":
		return "brightgreen"
	case "failed", "error":
		return "red"
	case "cancelled":
		return "orange"
	case "skipped":
		return "lightgrey"
	default:
		return "blue"
	}
}

func renderFailureDetails(b *strings.Builder, checks []Check) {
	type failure struct {
		checker string
		item    Item
		status  string
	}
	var failures []failure
	for _, check := range checks {
		for _, item := range check.Items {
			status := normalizeCommentStatus(item.Status)
			if status == "failed" || status == "error" {
				failures = append(failures, failure{
					checker: strings.TrimSpace(check.Tool),
					item:    item,
					status:  status,
				})
			}
		}
	}
	if len(failures) == 0 {
		return
	}

	const maxFailures = 20
	b.WriteString("\n### Failures\n\n")
	b.WriteString("| Checker | Item | Status | Message |\n")
	b.WriteString("| --- | --- | --- | --- |\n")
	for i, failure := range failures {
		if i >= maxFailures {
			break
		}
		b.WriteString("| ")
		b.WriteString(markdownTableCell(failure.checker))
		b.WriteString(" | ")
		b.WriteString(markdownTableCell(failure.item.ID))
		b.WriteString(" | ")
		b.WriteString(markdownTableCell(failure.status))
		b.WriteString(" | ")
		b.WriteString(markdownTableCell(commentFailureMessage(failure.item)))
		b.WriteString(" |\n")
	}
	if len(failures) > maxFailures {
		b.WriteString("\n")
		b.WriteString(fmt.Sprintf("_Showing first %d of %d failing items._\n", maxFailures, len(failures)))
	}
}

func commentFailureMessage(item Item) string {
	for _, candidate := range []string{item.Message, item.Stderr, item.Stdout, item.Trace} {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" {
			return candidate
		}
	}
	if item.Source != nil && strings.TrimSpace(item.Source.File) != "" {
		if item.Source.Line > 0 {
			return fmt.Sprintf("%s:%d", item.Source.File, item.Source.Line)
		}
		return item.Source.File
	}
	return "-"
}

func markdownTableCell(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "-"
	}
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	value = strings.ReplaceAll(value, "|", `\|`)
	value = strings.ReplaceAll(value, "\n", "<br>")
	return value
}

func markdownInlineCode(value string) string {
	return strings.ReplaceAll(strings.TrimSpace(value), "`", "'")
}

func markdownInlineCodeValues(values []string) []string {
	escaped := make([]string, 0, len(values))
	for _, value := range values {
		escaped = append(escaped, markdownInlineCode(value))
	}
	return escaped
}

func formatCommentDuration(seconds float64) string {
	if seconds <= 0 {
		return "-"
	}
	return fmt.Sprintf("%.0fs", seconds)
}

func pluralizeCount(count int, singular, plural string) string {
	if count == 1 {
		return fmt.Sprintf("%d %s", count, singular)
	}
	return fmt.Sprintf("%d %s", count, plural)
}

func renderCoverageMetric(metric *RunCoverageMetric) string {
	if metric == nil {
		return "-"
	}
	return fmt.Sprintf("%d/%d (%.1f%%)", metric.Covered, metric.Total, metric.Percent)
}
