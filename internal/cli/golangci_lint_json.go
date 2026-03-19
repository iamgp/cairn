package cli

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func parseGolangCILintJSON(raw []byte) (Check, error) {
	var envelope golangCILintReport
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return Check{}, fmt.Errorf("decode golangci-lint json: %w", err)
	}

	items := make([]Item, 0, len(envelope.Issues))
	for _, issue := range envelope.Issues {
		item := Item{
			ID:      golangCILintIssueID(issue),
			Status:  "failed",
			Message: strings.TrimSpace(issue.Text),
		}

		tags := make([]string, 0, 2)
		if linter := strings.TrimSpace(issue.FromLinter); linter != "" {
			tags = append(tags, "linter:"+linter)
		}
		if severity := strings.TrimSpace(issue.Severity); severity != "" {
			tags = append(tags, "severity:"+severity)
		}
		if len(tags) > 0 {
			item.Tags = tags
		}

		filename := strings.TrimSpace(issue.Pos.Filename)
		if filename != "" || issue.Pos.Line > 0 {
			item.Source = &ItemSource{
				File:   filename,
				Line:   issue.Pos.Line,
				Column: issue.Pos.Column,
			}
		}

		items = append(items, item)
	}

	status := "passed"
	if len(items) > 0 {
		status = "failed"
	}

	return Check{
		Tool:      "golangci-lint",
		Status:    status,
		DurationS: 0,
		Summary: map[string]int{
			"failed": len(items),
		},
		Items: items,
	}, nil
}

func golangCILintIssueID(issue golangCILintIssue) string {
	parts := make([]string, 0, 3)

	filename := strings.TrimSpace(issue.Pos.Filename)
	if filename != "" {
		parts = append(parts, filename)
	}

	if issue.Pos.Line > 0 {
		location := strconv.Itoa(issue.Pos.Line)
		if issue.Pos.Column > 0 {
			location += ":" + strconv.Itoa(issue.Pos.Column)
		}
		parts = append(parts, location)
	}

	if linter := strings.TrimSpace(issue.FromLinter); linter != "" {
		parts = append(parts, linter)
	}

	if len(parts) == 0 {
		return "golangci-lint-issue"
	}
	return strings.Join(parts, ":")
}

type golangCILintReport struct {
	Issues []golangCILintIssue `json:"Issues"`
}

type golangCILintIssue struct {
	FromLinter string               `json:"FromLinter"`
	Text       string               `json:"Text"`
	Severity   string               `json:"Severity"`
	Pos        golangCILintIssuePos `json:"Pos"`
}

type golangCILintIssuePos struct {
	Filename string `json:"Filename"`
	Line     int    `json:"Line"`
	Column   int    `json:"Column"`
}
