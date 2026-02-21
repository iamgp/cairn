package cli

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type coverageCounts struct {
	covered int
	total   int
}

type coverageTotals struct {
	line     *coverageCounts
	branch   *coverageCounts
	function *coverageCounts
}

func collectCoverageEntriesFromFiles(inputs []collectCoverageFileInput) ([]collectCoverageInput, error) {
	if len(inputs) == 0 {
		return nil, nil
	}

	entries := make([]collectCoverageInput, 0, len(inputs)*3)
	for _, input := range inputs {
		raw, err := os.ReadFile(input.path)
		if err != nil {
			return nil, fmt.Errorf("read coverage file %q: %w", input.path, err)
		}

		totals, err := parseCoverageReport(raw, input.path)
		if err != nil {
			return nil, fmt.Errorf("parse coverage file %q: %w", input.path, err)
		}
		if totals.line != nil {
			entries = append(entries, collectCoverageInput{
				scope:   input.scope,
				checkID: input.checkID,
				metric:  "line",
				covered: totals.line.covered,
				total:   totals.line.total,
			})
		}
		if totals.branch != nil {
			entries = append(entries, collectCoverageInput{
				scope:   input.scope,
				checkID: input.checkID,
				metric:  "branch",
				covered: totals.branch.covered,
				total:   totals.branch.total,
			})
		}
		if totals.function != nil {
			entries = append(entries, collectCoverageInput{
				scope:   input.scope,
				checkID: input.checkID,
				metric:  "function",
				covered: totals.function.covered,
				total:   totals.function.total,
			})
		}
	}

	return entries, nil
}

func parseCoverageReport(raw []byte, path string) (coverageTotals, error) {
	format, err := detectCoverageReportFormat(raw, path)
	if err != nil {
		return coverageTotals{}, err
	}

	switch format {
	case "lcov":
		return parseLCOVCoverage(raw)
	case "cobertura":
		return parseCoberturaCoverage(raw)
	case "jacoco":
		return parseJaCoCoCoverage(raw)
	default:
		return coverageTotals{}, fmt.Errorf("unsupported coverage format %q", format)
	}
}

func detectCoverageReportFormat(raw []byte, path string) (string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return "", fmt.Errorf("empty coverage file")
	}

	if strings.HasPrefix(string(trimmed), "TN:") || strings.HasPrefix(string(trimmed), "SF:") {
		return "lcov", nil
	}

	root, err := xmlRootElementName(trimmed)
	if err == nil {
		switch root {
		case "coverage":
			return "cobertura", nil
		case "report":
			return "jacoco", nil
		}
	}

	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".info", ".lcov":
		return "lcov", nil
	}

	return "", fmt.Errorf("unable to detect coverage format")
}

func xmlRootElementName(raw []byte) (string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(raw))
	for {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}
		start, ok := token.(xml.StartElement)
		if ok {
			return strings.ToLower(start.Name.Local), nil
		}
	}
}

func parseLCOVCoverage(raw []byte) (coverageTotals, error) {
	var lineCovered, lineTotal int
	var branchCovered, branchTotal int
	var fnCovered, fnTotal int
	var hasLine, hasBranch, hasFunction bool

	lines := strings.Split(string(raw), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "LH:"):
			n, err := strconv.Atoi(strings.TrimPrefix(line, "LH:"))
			if err != nil {
				return coverageTotals{}, fmt.Errorf("invalid LH value")
			}
			lineCovered += n
			hasLine = true
		case strings.HasPrefix(line, "LF:"):
			n, err := strconv.Atoi(strings.TrimPrefix(line, "LF:"))
			if err != nil {
				return coverageTotals{}, fmt.Errorf("invalid LF value")
			}
			lineTotal += n
			hasLine = true
		case strings.HasPrefix(line, "BRH:"):
			n, err := strconv.Atoi(strings.TrimPrefix(line, "BRH:"))
			if err != nil {
				return coverageTotals{}, fmt.Errorf("invalid BRH value")
			}
			branchCovered += n
			hasBranch = true
		case strings.HasPrefix(line, "BRF:"):
			n, err := strconv.Atoi(strings.TrimPrefix(line, "BRF:"))
			if err != nil {
				return coverageTotals{}, fmt.Errorf("invalid BRF value")
			}
			branchTotal += n
			hasBranch = true
		case strings.HasPrefix(line, "FNH:"):
			n, err := strconv.Atoi(strings.TrimPrefix(line, "FNH:"))
			if err != nil {
				return coverageTotals{}, fmt.Errorf("invalid FNH value")
			}
			fnCovered += n
			hasFunction = true
		case strings.HasPrefix(line, "FNF:"):
			n, err := strconv.Atoi(strings.TrimPrefix(line, "FNF:"))
			if err != nil {
				return coverageTotals{}, fmt.Errorf("invalid FNF value")
			}
			fnTotal += n
			hasFunction = true
		}
	}

	totals := coverageTotals{}
	if hasLine {
		totals.line = &coverageCounts{covered: lineCovered, total: lineTotal}
	}
	if hasBranch {
		totals.branch = &coverageCounts{covered: branchCovered, total: branchTotal}
	}
	if hasFunction {
		totals.function = &coverageCounts{covered: fnCovered, total: fnTotal}
	}
	if totals.line == nil && totals.branch == nil && totals.function == nil {
		return coverageTotals{}, fmt.Errorf("no coverage totals found in LCOV report")
	}
	return totals, nil
}

type coberturaReport struct {
	LinesCovered    int `xml:"lines-covered,attr"`
	LinesValid      int `xml:"lines-valid,attr"`
	BranchesCovered int `xml:"branches-covered,attr"`
	BranchesValid   int `xml:"branches-valid,attr"`
}

func parseCoberturaCoverage(raw []byte) (coverageTotals, error) {
	var report coberturaReport
	if err := xml.Unmarshal(raw, &report); err != nil {
		return coverageTotals{}, err
	}

	totals := coverageTotals{}
	if report.LinesCovered > 0 || report.LinesValid > 0 {
		totals.line = &coverageCounts{covered: report.LinesCovered, total: report.LinesValid}
	}
	if report.BranchesCovered > 0 || report.BranchesValid > 0 {
		totals.branch = &coverageCounts{covered: report.BranchesCovered, total: report.BranchesValid}
	}
	if totals.line == nil && totals.branch == nil {
		return coverageTotals{}, fmt.Errorf("no coverage totals found in Cobertura report")
	}
	return totals, nil
}

type jacocoReport struct {
	Counters []jacocoCounter `xml:"counter"`
}

type jacocoCounter struct {
	Type    string `xml:"type,attr"`
	Missed  int    `xml:"missed,attr"`
	Covered int    `xml:"covered,attr"`
}

func parseJaCoCoCoverage(raw []byte) (coverageTotals, error) {
	var report jacocoReport
	if err := xml.Unmarshal(raw, &report); err != nil {
		return coverageTotals{}, err
	}

	totals := coverageTotals{}
	for _, counter := range report.Counters {
		total := counter.Missed + counter.Covered
		switch strings.ToUpper(strings.TrimSpace(counter.Type)) {
		case "LINE":
			totals.line = &coverageCounts{covered: counter.Covered, total: total}
		case "BRANCH":
			totals.branch = &coverageCounts{covered: counter.Covered, total: total}
		case "METHOD":
			totals.function = &coverageCounts{covered: counter.Covered, total: total}
		}
	}
	if totals.line == nil && totals.branch == nil && totals.function == nil {
		return coverageTotals{}, fmt.Errorf("no coverage totals found in JaCoCo report")
	}
	return totals, nil
}
