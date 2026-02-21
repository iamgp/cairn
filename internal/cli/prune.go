package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var errPruneNoPagesDir = errors.New("prune requires --pages-dir")

type pruneOptions struct {
	pagesDir string
	maxDays  int
	maxRuns  int
	dryRun   bool
}

type pruneResult struct {
	kept    int
	removed int
}

func newPruneCommand() *cobra.Command {
	return &cobra.Command{
		Use:                "prune",
		Short:              "Prune obsolete data",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			opts, err := parsePruneCommandArgs(args)
			if errors.Is(err, errPruneNoPagesDir) {
				return cmd.Help()
			}
			if err != nil {
				return err
			}

			result, err := pruneHistoryFile(opts, time.Now().UTC())
			if err != nil {
				return err
			}
			if opts.dryRun {
				fmt.Printf("dry-run: would remove %d runs, keep %d\n", result.removed, result.kept)
			}
			return nil
		},
	}
}

func parsePruneCommandArgs(args []string) (pruneOptions, error) {
	opts := pruneOptions{}
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case strings.HasPrefix(arg, "--pages-dir="):
			opts.pagesDir = strings.TrimPrefix(arg, "--pages-dir=")
		case arg == "--pages-dir":
			if i+1 >= len(args) {
				return pruneOptions{}, fmt.Errorf("missing value for --pages-dir")
			}
			i++
			opts.pagesDir = args[i]
		case strings.HasPrefix(arg, "--max-days="):
			value := strings.TrimPrefix(arg, "--max-days=")
			maxDays, err := parseNonNegativeIntFlag("--max-days", value)
			if err != nil {
				return pruneOptions{}, err
			}
			opts.maxDays = maxDays
		case arg == "--max-days":
			if i+1 >= len(args) {
				return pruneOptions{}, fmt.Errorf("missing value for --max-days")
			}
			i++
			maxDays, err := parseNonNegativeIntFlag("--max-days", args[i])
			if err != nil {
				return pruneOptions{}, err
			}
			opts.maxDays = maxDays
		case strings.HasPrefix(arg, "--max-runs="):
			value := strings.TrimPrefix(arg, "--max-runs=")
			maxRuns, err := parseNonNegativeIntFlag("--max-runs", value)
			if err != nil {
				return pruneOptions{}, err
			}
			opts.maxRuns = maxRuns
		case arg == "--max-runs":
			if i+1 >= len(args) {
				return pruneOptions{}, fmt.Errorf("missing value for --max-runs")
			}
			i++
			maxRuns, err := parseNonNegativeIntFlag("--max-runs", args[i])
			if err != nil {
				return pruneOptions{}, err
			}
			opts.maxRuns = maxRuns
		case arg == "--dry-run":
			opts.dryRun = true
		case strings.HasPrefix(arg, "--dry-run="):
			value := strings.TrimPrefix(arg, "--dry-run=")
			dryRun, err := strconv.ParseBool(value)
			if err != nil {
				return pruneOptions{}, fmt.Errorf("invalid --dry-run value %q", value)
			}
			opts.dryRun = dryRun
		case strings.HasPrefix(arg, "--"):
			return pruneOptions{}, fmt.Errorf("unknown flag %q", arg)
		default:
			positional = append(positional, arg)
		}
	}

	if len(positional) > 0 {
		return pruneOptions{}, fmt.Errorf("prune does not accept positional arguments")
	}
	if strings.TrimSpace(opts.pagesDir) == "" {
		return pruneOptions{}, errPruneNoPagesDir
	}

	return opts, nil
}

func parseNonNegativeIntFlag(flagName, value string) (int, error) {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("invalid %s value %q", flagName, value)
	}
	if parsed < 0 {
		return 0, fmt.Errorf("%s must be >= 0", flagName)
	}
	return parsed, nil
}

func pruneHistoryFile(opts pruneOptions, now time.Time) (pruneResult, error) {
	historyPath := filepath.Join(opts.pagesDir, "history.ndjson")
	raw, err := os.ReadFile(historyPath)
	if err != nil {
		if os.IsNotExist(err) {
			return pruneResult{}, nil
		}
		return pruneResult{}, fmt.Errorf("read history file: %w", err)
	}

	lines := strings.Split(string(raw), "\n")
	type historyRecord struct {
		run  Run
		line string
	}
	records := make([]historyRecord, 0, len(lines))
	for idx, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		var run Run
		if err := json.Unmarshal([]byte(trimmed), &run); err != nil {
			return pruneResult{}, fmt.Errorf("parse history record at line %d: %w", idx+1, err)
		}
		records = append(records, historyRecord{run: run, line: trimmed})
	}

	filtered := records
	if opts.maxDays > 0 {
		cutoff := now.AddDate(0, 0, -opts.maxDays)
		kept := make([]historyRecord, 0, len(records))
		for _, record := range filtered {
			if !record.run.Timestamp.Before(cutoff) {
				kept = append(kept, record)
			}
		}
		filtered = kept
	}
	if opts.maxRuns > 0 && len(filtered) > opts.maxRuns {
		filtered = filtered[len(filtered)-opts.maxRuns:]
	}

	result := pruneResult{
		kept:    len(filtered),
		removed: len(records) - len(filtered),
	}
	if opts.dryRun {
		return result, nil
	}

	var builder strings.Builder
	for _, record := range filtered {
		builder.WriteString(record.line)
		builder.WriteByte('\n')
	}
	if err := os.WriteFile(historyPath, []byte(builder.String()), 0o644); err != nil {
		return pruneResult{}, fmt.Errorf("rewrite history file: %w", err)
	}

	return result, nil
}
