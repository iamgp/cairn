package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// DiffItem represents a single item difference between two runs.
type DiffItem struct {
	Checker string
	ItemID  string
	Status  string
}

func loadHistoryRuns(pagesDir string) ([]Run, error) {
	historyPath := filepath.Join(pagesDir, "history.ndjson")
	raw, err := os.ReadFile(historyPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read history file: %w", err)
	}

	lines := strings.Split(string(raw), "\n")
	var runs []Run
	for idx, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		var run Run
		if err := json.Unmarshal([]byte(trimmed), &run); err != nil {
			return nil, fmt.Errorf("parse history record at line %d: %w", idx+1, err)
		}
		runs = append(runs, run)
	}

	sort.Slice(runs, func(i, j int) bool {
		return runs[i].Timestamp.After(runs[j].Timestamp)
	})

	return runs, nil
}

func findBaselineRun(runs []Run, branch string) *Run {
	for i := range runs {
		if runs[i].Branch == branch {
			return &runs[i]
		}
	}
	return nil
}

func diffItems(current, baseline Run) (newFailures []DiffItem, fixed []DiffItem) {
	type itemKey struct {
		checker string
		id      string
	}

	baselineStatuses := make(map[itemKey]string)
	for _, check := range baseline.Checks {
		for _, item := range check.Items {
			baselineStatuses[itemKey{checker: check.Tool, id: item.ID}] = item.Status
		}
	}

	currentStatuses := make(map[itemKey]string)
	for _, check := range current.Checks {
		for _, item := range check.Items {
			key := itemKey{checker: check.Tool, id: item.ID}
			currentStatuses[key] = item.Status

			isFailing := item.Status == "failed" || item.Status == "error"
			baseStatus, existed := baselineStatuses[key]
			baseWasFailing := baseStatus == "failed" || baseStatus == "error"

			if isFailing && (!existed || !baseWasFailing) {
				newFailures = append(newFailures, DiffItem{
					Checker: check.Tool,
					ItemID:  item.ID,
					Status:  item.Status,
				})
			}
		}
	}

	for _, check := range baseline.Checks {
		for _, item := range check.Items {
			key := itemKey{checker: check.Tool, id: item.ID}
			baseWasFailing := item.Status == "failed" || item.Status == "error"
			curStatus, exists := currentStatuses[key]

			if baseWasFailing && exists && curStatus == "passed" {
				fixed = append(fixed, DiffItem{
					Checker: check.Tool,
					ItemID:  item.ID,
				})
			}
		}
	}

	return newFailures, fixed
}
