package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type genericJSONMapping struct {
	Status    string                 `toml:"status"`
	DurationS string                 `toml:"duration_s"`
	Items     string                 `toml:"items"`
	Item      genericJSONItemMapping `toml:"item"`
}

type genericJSONItemMapping struct {
	ID        string `toml:"id"`
	Status    string `toml:"status"`
	DurationS string `toml:"duration_s"`
	Stdout    string `toml:"stdout"`
	Stderr    string `toml:"stderr"`
	Message   string `toml:"message"`
	Trace     string `toml:"trace"`
	Tags      string `toml:"tags"`
	Suite     string `toml:"suite"`
	File      string `toml:"file"`
	Line      string `toml:"line"`
	Column    string `toml:"column"`
}

func parseGenericCheckJSON(raw []byte, tool string, mapping genericJSONMapping) (Check, error) {
	var root any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&root); err != nil {
		return Check{}, fmt.Errorf("decode generic json: %w", err)
	}

	itemsPath := strings.TrimSpace(mapping.Items)
	if itemsPath == "" {
		return Check{}, fmt.Errorf("generic_json mapping.items is required")
	}

	rawItems, ok := lookupJSONPath(root, itemsPath)
	if !ok {
		return Check{}, fmt.Errorf("generic_json mapping.items path %q not found", itemsPath)
	}

	itemList, ok := rawItems.([]any)
	if !ok {
		return Check{}, fmt.Errorf("generic_json mapping.items path %q must point to an array", itemsPath)
	}

	items := make([]Item, 0, len(itemList))
	summary := map[string]int{}
	for i, rawItem := range itemList {
		item := parseGenericItem(rawItem, mapping.Item, i)
		items = append(items, item)
		summary[item.Status]++
	}

	duration := extractFloatPath(root, mapping.DurationS)
	if strings.TrimSpace(mapping.DurationS) == "" {
		for _, item := range items {
			duration += item.DurationS
		}
	}

	status := deriveCheckStatus(summary, len(items))
	if mappedStatus := extractStringPath(root, mapping.Status); mappedStatus != "" {
		status = mappedStatus
	}

	return Check{
		Tool:      tool,
		Status:    status,
		DurationS: duration,
		Summary:   summary,
		Items:     items,
	}, nil
}

func parseGenericItem(rawItem any, mapping genericJSONItemMapping, index int) Item {
	item := Item{
		ID:        extractStringPath(rawItem, mapping.ID),
		Status:    firstNonEmpty(extractStringPath(rawItem, mapping.Status), "passed"),
		DurationS: extractFloatPath(rawItem, mapping.DurationS),
		Stdout:    extractStringPath(rawItem, mapping.Stdout),
		Stderr:    extractStringPath(rawItem, mapping.Stderr),
		Message:   extractStringPath(rawItem, mapping.Message),
		Trace:     extractStringPath(rawItem, mapping.Trace),
		Tags:      extractStringSlicePath(rawItem, mapping.Tags),
		Suite:     extractStringPath(rawItem, mapping.Suite),
	}
	if item.ID == "" {
		item.ID = fmt.Sprintf("item-%d", index+1)
	}

	file := extractStringPath(rawItem, mapping.File)
	line := int(extractFloatPath(rawItem, mapping.Line))
	column := int(extractFloatPath(rawItem, mapping.Column))
	if file != "" || line > 0 {
		item.Source = &ItemSource{
			File:   file,
			Line:   line,
			Column: column,
		}
	}

	return item
}

func deriveCheckStatus(summary map[string]int, total int) string {
	switch {
	case total == 0:
		return "passed"
	case summary["error"] > 0 || summary["errors"] > 0:
		return "error"
	case summary["failed"] > 0:
		return "failed"
	case summary["skipped"] == total:
		return "skipped"
	default:
		return "passed"
	}
}

func extractStringPath(root any, path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	value, ok := lookupJSONPath(root, path)
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case json.Number:
		return strings.TrimSpace(typed.String())
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func extractFloatPath(root any, path string) float64 {
	path = strings.TrimSpace(path)
	if path == "" {
		return 0
	}
	value, ok := lookupJSONPath(root, path)
	if !ok || value == nil {
		return 0
	}
	return toFloat(value)
}

func extractStringSlicePath(root any, path string) []string {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	value, ok := lookupJSONPath(root, path)
	if !ok || value == nil {
		return nil
	}

	switch typed := value.(type) {
	case []any:
		tags := make([]string, 0, len(typed))
		for _, v := range typed {
			s := strings.TrimSpace(fmt.Sprint(v))
			if s != "" {
				tags = append(tags, s)
			}
		}
		if len(tags) == 0 {
			return nil
		}
		return tags
	case []string:
		tags := make([]string, 0, len(typed))
		for _, v := range typed {
			s := strings.TrimSpace(v)
			if s != "" {
				tags = append(tags, s)
			}
		}
		if len(tags) == 0 {
			return nil
		}
		return tags
	default:
		s := strings.TrimSpace(fmt.Sprint(typed))
		if s == "" {
			return nil
		}
		return []string{s}
	}
}

func toFloat(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case json.Number:
		v, err := typed.Float64()
		if err != nil {
			return 0
		}
		return v
	case string:
		v, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0
		}
		return v
	default:
		return 0
	}
}

func lookupJSONPath(root any, path string) (any, bool) {
	current := root
	for _, step := range parseJSONPath(path) {
		switch {
		case step.key != "":
			object, ok := current.(map[string]any)
			if !ok {
				return nil, false
			}
			value, ok := object[step.key]
			if !ok {
				return nil, false
			}
			current = value
		default:
			array, ok := current.([]any)
			if !ok || step.index < 0 || step.index >= len(array) {
				return nil, false
			}
			current = array[step.index]
		}
	}
	return current, true
}

type jsonPathStep struct {
	key   string
	index int
}

func parseJSONPath(path string) []jsonPathStep {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}

	steps := make([]jsonPathStep, 0, strings.Count(path, ".")+1)
	for i := 0; i < len(path); {
		if path[i] == '.' {
			i++
			continue
		}

		if path[i] == '[' {
			end := strings.IndexByte(path[i:], ']')
			if end < 0 {
				return nil
			}
			index, err := strconv.Atoi(strings.TrimSpace(path[i+1 : i+end]))
			if err != nil {
				return nil
			}
			steps = append(steps, jsonPathStep{index: index})
			i += end + 1
			continue
		}

		start := i
		for i < len(path) && path[i] != '.' && path[i] != '[' {
			i++
		}
		key := strings.TrimSpace(path[start:i])
		if key != "" {
			steps = append(steps, jsonPathStep{key: key})
		}
	}
	return steps
}
