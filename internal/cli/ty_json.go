package cli

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func parseTyCheckJSON(raw []byte) (Check, error) {
	var envelope tyJSONEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return Check{}, fmt.Errorf("decode ty json: %w", err)
	}

	switch envelope.Version {
	case 1:
		return parseTyCheckJSONV1(envelope.Diagnostics)
	default:
		return Check{}, fmt.Errorf("unsupported ty json version %d", envelope.Version)
	}
}

func parseTyCheckJSONV1(diagnostics []json.RawMessage) (Check, error) {
	items := make([]Item, 0, len(diagnostics))
	for index, raw := range diagnostics {
		item, err := parseTyDiagnosticV1(raw, index)
		if err != nil {
			return Check{}, err
		}
		items = append(items, item)
	}

	status := "passed"
	if len(items) > 0 {
		status = "failed"
	}

	return Check{
		Tool:      "ty",
		Status:    status,
		DurationS: 0,
		Summary: map[string]int{
			"failed": len(items),
		},
		Items: items,
	}, nil
}

func parseTyDiagnosticV1(raw []byte, index int) (Item, error) {
	var diagnostic tyDiagnosticV1
	if err := json.Unmarshal(raw, &diagnostic); err != nil {
		return Item{}, fmt.Errorf("decode ty diagnostic %d: %w", index+1, err)
	}

	filename := firstNonEmpty(
		diagnostic.File,
		diagnostic.Filename,
		diagnostic.Path,
	)

	line, column := diagnosticLineColumn(diagnostic)
	message := strings.TrimSpace(diagnostic.Message)
	severity := strings.TrimSpace(diagnostic.Severity)

	item := Item{
		ID:      tyDiagnosticItemID(filename, line, column, diagnostic.Code, index),
		Status:  "failed",
		Message: message,
	}

	if severity != "" {
		item.Tags = []string{"severity:" + severity}
	}

	if filename != "" || line > 0 {
		item.Source = &ItemSource{
			File:   filename,
			Line:   line,
			Column: column,
		}
	}

	return item, nil
}

func diagnosticLineColumn(diagnostic tyDiagnosticV1) (int, int) {
	if diagnostic.Location.Row > 0 {
		return diagnostic.Location.Row, diagnostic.Location.Column
	}
	if diagnostic.Range.Start.Line > 0 {
		column := diagnostic.Range.Start.Column
		if column <= 0 {
			column = diagnostic.Range.Start.Character
		}
		return diagnostic.Range.Start.Line, column
	}
	if diagnostic.Span.Start.Line > 0 {
		return diagnostic.Span.Start.Line, diagnostic.Span.Start.Column
	}
	return 0, 0
}

func tyDiagnosticItemID(filename string, line int, column int, code string, index int) string {
	var parts []string

	filename = strings.TrimSpace(filename)
	if filename != "" {
		parts = append(parts, filename)
	}

	if line > 0 {
		location := strconv.Itoa(line)
		if column > 0 {
			location += ":" + strconv.Itoa(column)
		}
		parts = append(parts, location)
	}

	code = strings.TrimSpace(code)
	if code != "" {
		parts = append(parts, code)
	}

	if len(parts) == 0 {
		return "ty-diagnostic-" + strconv.Itoa(index+1)
	}

	return strings.Join(parts, ":")
}

type tyJSONEnvelope struct {
	Version     int               `json:"version"`
	Diagnostics []json.RawMessage `json:"diagnostics"`
}

type tyDiagnosticV1 struct {
	Code     string       `json:"code"`
	Message  string       `json:"message"`
	Severity string       `json:"severity"`
	File     string       `json:"file"`
	Filename string       `json:"filename"`
	Path     string       `json:"path"`
	Location tyLocationV1 `json:"location"`
	Range    tyRangeV1    `json:"range"`
	Span     tyRangeV1    `json:"span"`
}

type tyLocationV1 struct {
	Row    int `json:"row"`
	Column int `json:"column"`
}

type tyRangeV1 struct {
	Start tyPositionV1 `json:"start"`
}

type tyPositionV1 struct {
	Line      int `json:"line"`
	Column    int `json:"column"`
	Character int `json:"character"`
}
