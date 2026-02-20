package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

var errCheckNoInput = errors.New("check requires an input path")

type checkOptions struct {
	inputPath      string
	failUnder      float64
	pagesDir       string
	baselineBranch string
}

func newCheckCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "check",
		Short: "Check pass rate against a threshold",
		RunE: func(cmd *cobra.Command, args []string) error {
			opts, err := parseCheckCommandArgs(args)
			if errors.Is(err, errCheckNoInput) {
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

			return runCheck(run, opts)
		},
	}
}

func parseCheckCommandArgs(args []string) (checkOptions, error) {
	opts := checkOptions{
		baselineBranch: "main",
	}
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case strings.HasPrefix(arg, "--fail-under="):
			value := strings.TrimPrefix(arg, "--fail-under=")
			f, err := strconv.ParseFloat(value, 64)
			if err != nil {
				return checkOptions{}, fmt.Errorf("invalid --fail-under value %q", value)
			}
			opts.failUnder = f
		case arg == "--fail-under":
			if i+1 >= len(args) {
				return checkOptions{}, fmt.Errorf("missing value for --fail-under")
			}
			i++
			f, err := strconv.ParseFloat(args[i], 64)
			if err != nil {
				return checkOptions{}, fmt.Errorf("invalid --fail-under value %q", args[i])
			}
			opts.failUnder = f
		case strings.HasPrefix(arg, "--pages-dir="):
			opts.pagesDir = strings.TrimPrefix(arg, "--pages-dir=")
		case arg == "--pages-dir":
			if i+1 >= len(args) {
				return checkOptions{}, fmt.Errorf("missing value for --pages-dir")
			}
			i++
			opts.pagesDir = args[i]
		case strings.HasPrefix(arg, "--baseline-branch="):
			opts.baselineBranch = strings.TrimPrefix(arg, "--baseline-branch=")
		case arg == "--baseline-branch":
			if i+1 >= len(args) {
				return checkOptions{}, fmt.Errorf("missing value for --baseline-branch")
			}
			i++
			opts.baselineBranch = args[i]
		case strings.HasPrefix(arg, "--"):
			return checkOptions{}, fmt.Errorf("unknown flag %q", arg)
		default:
			positional = append(positional, arg)
		}
	}

	if len(positional) == 0 {
		return checkOptions{}, errCheckNoInput
	}
	if len(positional) > 1 {
		return checkOptions{}, fmt.Errorf("check accepts a single input path")
	}

	opts.inputPath = positional[0]
	return opts, nil
}

func runCheck(run Run, opts checkOptions) error {
	var total, passed int
	for _, check := range run.Checks {
		for _, item := range check.Items {
			total++
			if item.Status == "passed" {
				passed++
			}
		}
	}

	var passRate float64
	if total > 0 {
		passRate = float64(passed) / float64(total) * 100
	}

	var newFailureCount int
	if opts.pagesDir != "" {
		runs, err := loadHistoryRuns(opts.pagesDir)
		if err != nil {
			return fmt.Errorf("load history: %w", err)
		}
		baseline := findBaselineRun(runs, opts.baselineBranch)
		if baseline != nil {
			newFailures, _ := diffItems(run, *baseline)
			newFailureCount = len(newFailures)
		}
	}

	if opts.pagesDir != "" {
		fmt.Printf("pass-rate: %.1f%% (%d/%d) — %d new failures vs %s\n", passRate, passed, total, newFailureCount, opts.baselineBranch)
	} else {
		fmt.Printf("pass-rate: %.1f%% (%d/%d)\n", passRate, passed, total)
	}

	if opts.failUnder > 0 && passRate < opts.failUnder {
		return fmt.Errorf("pass rate %.1f%% is below threshold %.1f%%", passRate, opts.failUnder)
	}

	return nil
}
