package cli

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func parseRuffCheckJSON(raw []byte) (Check, error) {
	var violations []ruffViolation
	if err := json.Unmarshal(raw, &violations); err != nil {
		return Check{}, fmt.Errorf("decode ruff json: %w", err)
	}

	items := make([]Item, 0, len(violations))
	for _, violation := range violations {
		item := Item{
			ID:      violationItemID(violation),
			Status:  "failed",
			Message: strings.TrimSpace(violation.Message),
		}
		filename := strings.TrimSpace(violation.Filename)
		if filename != "" || violation.Location.Row > 0 {
			item.Source = &ItemSource{
				File:   filename,
				Line:   violation.Location.Row,
				Column: violation.Location.Column,
			}
		}
		code := strings.TrimSpace(violation.Code)
		if code != "" {
			item.Tags = []string{"rule:" + code}
		}
		items = append(items, item)
	}

	status := "passed"
	if len(items) > 0 {
		status = "failed"
	}

	return Check{
		Tool:      "ruff",
		Status:    status,
		DurationS: 0,
		Summary: map[string]int{
			"failed": len(items),
		},
		Items: items,
	}, nil
}

func violationItemID(violation ruffViolation) string {
	var parts []string

	filename := strings.TrimSpace(violation.Filename)
	if filename != "" {
		parts = append(parts, filename)
	}

	row := violation.Location.Row
	if row > 0 {
		location := strconv.Itoa(row)
		if violation.Location.Column > 0 {
			location += ":" + strconv.Itoa(violation.Location.Column)
		}
		parts = append(parts, location)
	}

	code := strings.TrimSpace(violation.Code)
	if code != "" {
		parts = append(parts, code)
	}

	if len(parts) == 0 {
		return "ruff-violation"
	}
	return strings.Join(parts, ":")
}

type ruffViolation struct {
	Code     string       `json:"code"`
	Filename string       `json:"filename"`
	Location ruffLocation `json:"location"`
	Message  string       `json:"message"`
}

type ruffLocation struct {
	Row    int `json:"row"`
	Column int `json:"column"`
}
