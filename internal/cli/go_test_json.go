package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

func parseGoTestJSON(raw []byte) (Check, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))

	items := make([]Item, 0)
	indexByID := map[string]int{}
	outputByID := map[string]*strings.Builder{}
	summary := map[string]int{
		"passed":  0,
		"failed":  0,
		"skipped": 0,
	}

	for {
		var event goTestEvent
		if err := decoder.Decode(&event); err != nil {
			if err == io.EOF {
				break
			}
			return Check{}, fmt.Errorf("decode go test json: %w", err)
		}

		itemID := goTestItemID(event.Package, event.Test)

		if event.Action == "output" && itemID != "" {
			buf, exists := outputByID[itemID]
			if !exists {
				buf = &strings.Builder{}
				outputByID[itemID] = buf
			}
			buf.WriteString(event.Output)
			continue
		}

		status, ok := goTestStatus(event.Action)
		if !ok {
			continue
		}

		if itemID == "" {
			continue
		}

		if index, exists := indexByID[itemID]; exists {
			items[index].Status = status
			if event.Elapsed > 0 {
				items[index].DurationS = event.Elapsed
			}
			continue
		}

		item := Item{
			ID:        itemID,
			Status:    status,
			DurationS: event.Elapsed,
			Suite:     strings.TrimSpace(event.Package),
		}
		if event.Test == "" {
			item.Tags = []string{"scope:package"}
		}
		items = append(items, item)
		indexByID[itemID] = len(items) - 1
	}

	for id, buf := range outputByID {
		index, exists := indexByID[id]
		if !exists {
			continue
		}
		output := strings.TrimSpace(buf.String())
		if output == "" {
			continue
		}
		s := (items[index].Status)
		if s == "failed" {
			items[index].Stderr = output
		} else {
			items[index].Stdout = output
		}
	}

	totalDuration := 0.0
	for _, item := range items {
		summary[item.Status]++
		totalDuration += item.DurationS
	}

	status := "passed"
	switch {
	case summary["failed"] > 0:
		status = "failed"
	case len(items) > 0 && summary["skipped"] == len(items):
		status = "skipped"
	}

	return Check{
		Tool:      "go test",
		Status:    status,
		DurationS: totalDuration,
		Summary:   summary,
		Items:     items,
	}, nil
}

func goTestStatus(action string) (string, bool) {
	switch strings.TrimSpace(action) {
	case "pass":
		return "passed", true
	case "fail":
		return "failed", true
	case "skip":
		return "skipped", true
	default:
		return "", false
	}
}

func goTestItemID(pkg string, test string) string {
	pkg = strings.TrimSpace(pkg)
	test = strings.TrimSpace(test)
	if pkg == "" && test == "" {
		return ""
	}
	if test == "" {
		return pkg
	}
	if pkg == "" {
		return test
	}
	return pkg + "::" + test
}

type goTestEvent struct {
	Action  string  `json:"Action"`
	Package string  `json:"Package"`
	Test    string  `json:"Test"`
	Elapsed float64 `json:"Elapsed"`
	Output  string  `json:"Output"`
}
