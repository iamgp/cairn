package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var errCommentNoInput = errors.New("comment requires an input path")

type commentOptions struct {
	inputPath string
	outPath   string
	reportURL string
}

func newCommentCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "comment",
		Short: "Render a PR comment from a run record",
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

			comment := renderPRComment(run, opts.reportURL)
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
	opts := commentOptions{}
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]

		if strings.HasPrefix(arg, "--out=") {
			opts.outPath = strings.TrimPrefix(arg, "--out=")
			continue
		}
		if arg == "--out" {
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --out")
			}
			i++
			opts.outPath = args[i]
			continue
		}
		if strings.HasPrefix(arg, "--report-url=") {
			opts.reportURL = strings.TrimPrefix(arg, "--report-url=")
			continue
		}
		if arg == "--report-url" {
			if i+1 >= len(args) {
				return commentOptions{}, fmt.Errorf("missing value for --report-url")
			}
			i++
			opts.reportURL = args[i]
			continue
		}
		if strings.HasPrefix(arg, "--") {
			return commentOptions{}, fmt.Errorf("unknown flag %q", arg)
		}

		positional = append(positional, arg)
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

func renderPRComment(run Run, reportURL string) string {
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

	b.WriteString("| Checker | Status | Items |\n")
	b.WriteString("| --- | --- | ---: |\n")
	for _, check := range run.Checks {
		b.WriteString("| ")
		b.WriteString(strings.TrimSpace(check.Tool))
		b.WriteString(" | ")
		b.WriteString(strings.TrimSpace(check.Status))
		b.WriteString(" | ")
		b.WriteString(fmt.Sprintf("%d", len(check.Items)))
		b.WriteString(" |\n")
	}

	return b.String()
}
