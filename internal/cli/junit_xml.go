package cli

import (
	"encoding/xml"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func parsePytestJUnitXMLFile(inputTemplate string, matrix map[string]string) (Check, error) {
	path, err := resolveMatrixTemplate(inputTemplate, matrix)
	if err != nil {
		return Check{}, fmt.Errorf("resolve junit input filename: %w", err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return Check{}, fmt.Errorf("read junit xml file %q: %w", path, err)
	}

	return parsePytestJUnitXML(raw)
}

func resolveMatrixTemplate(input string, matrix map[string]string) (string, error) {
	if !strings.Contains(input, "{matrix.") {
		return input, nil
	}

	var b strings.Builder
	for {
		start := strings.Index(input, "{matrix.")
		if start < 0 {
			b.WriteString(input)
			return b.String(), nil
		}

		b.WriteString(input[:start])
		input = input[start+len("{matrix."):]

		end := strings.IndexByte(input, '}')
		if end < 0 {
			return "", fmt.Errorf("unclosed matrix placeholder in %q", input)
		}

		key := strings.TrimSpace(input[:end])
		if key == "" {
			return "", fmt.Errorf("matrix placeholder key is empty")
		}

		value, ok := matrix[key]
		if !ok {
			return "", fmt.Errorf("matrix key %q not provided", key)
		}
		b.WriteString(value)
		input = input[end+1:]
	}
}

func parsePytestJUnitXML(raw []byte) (Check, error) {
	var root junitSuite
	if err := xml.Unmarshal(raw, &root); err != nil {
		return Check{}, fmt.Errorf("decode junit xml: %w", err)
	}

	cases := root.allTestCases()
	items := make([]Item, 0, len(cases))

	summary := map[string]int{
		"passed":  0,
		"failed":  0,
		"skipped": 0,
		"errors":  0,
	}

	totalDuration := 0.0
	for _, tc := range cases {
		item := Item{
			ID:        testcaseID(tc.ClassName, tc.Name),
			DurationS: parseSeconds(tc.Time),
			Stdout:    strings.TrimSpace(tc.SystemOut),
			Stderr:    strings.TrimSpace(tc.SystemErr),
		}

		switch {
		case tc.Error != nil:
			item.Status = "error"
			item.Message = firstNonEmpty(tc.Error.Message, tc.Error.Text)
			summary["errors"]++
		case tc.Failure != nil:
			item.Status = "failed"
			item.Message = firstNonEmpty(tc.Failure.Message, tc.Failure.Text)
			summary["failed"]++
		case tc.Skipped != nil:
			item.Status = "skipped"
			item.Message = firstNonEmpty(tc.Skipped.Message, tc.Skipped.Text)
			summary["skipped"]++
		default:
			item.Status = "passed"
			summary["passed"]++
		}

		totalDuration += item.DurationS
		items = append(items, item)
	}

	status := "passed"
	switch {
	case summary["errors"] > 0:
		status = "error"
	case summary["failed"] > 0:
		status = "failed"
	case len(items) > 0 && summary["skipped"] == len(items):
		status = "skipped"
	}

	return Check{
		Tool:      "pytest",
		Status:    status,
		DurationS: totalDuration,
		Summary:   summary,
		Items:     items,
	}, nil
}

func testcaseID(className string, name string) string {
	className = strings.TrimSpace(className)
	name = strings.TrimSpace(name)
	if className == "" {
		return name
	}
	if name == "" {
		return className
	}
	return className + "::" + name
}

func parseSeconds(raw string) float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return 0
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

type junitSuite struct {
	Suites   []junitSuite `xml:"testsuite"`
	TestCase []junitCase  `xml:"testcase"`
}

func (s junitSuite) allTestCases() []junitCase {
	cases := make([]junitCase, 0, len(s.TestCase))
	cases = append(cases, s.TestCase...)
	for _, nested := range s.Suites {
		cases = append(cases, nested.allTestCases()...)
	}
	return cases
}

type junitCase struct {
	ClassName string       `xml:"classname,attr"`
	Name      string       `xml:"name,attr"`
	Time      string       `xml:"time,attr"`
	Failure   *junitResult `xml:"failure"`
	Error     *junitResult `xml:"error"`
	Skipped   *junitResult `xml:"skipped"`
	SystemOut string       `xml:"system-out"`
	SystemErr string       `xml:"system-err"`
}

type junitResult struct {
	Message string `xml:"message,attr"`
	Text    string `xml:",chardata"`
}
