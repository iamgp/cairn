package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveMatrixTemplate(t *testing.T) {
	t.Parallel()

	resolved, err := resolveMatrixTemplate("pytest-{matrix.python}.xml", map[string]string{"python": "3.12"})
	if err != nil {
		t.Fatalf("resolveMatrixTemplate() unexpected error: %v", err)
	}
	if resolved != "pytest-3.12.xml" {
		t.Fatalf("expected resolved filename, got %q", resolved)
	}
}

func TestResolveMatrixTemplateMissingKey(t *testing.T) {
	t.Parallel()

	_, err := resolveMatrixTemplate("pytest-{matrix.python}.xml", map[string]string{"os": "linux"})
	if err == nil {
		t.Fatal("expected missing key error")
	}
	if !strings.Contains(err.Error(), `matrix key "python" not provided`) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParsePytestJUnitXML(t *testing.T) {
	t.Parallel()

	raw := []byte(strings.Join([]string{
		`<testsuites>`,
		`  <testsuite name="pytest" tests="4">`,
		`    <testcase classname="tests.test_math" name="test_add" time="0.10"/>`,
		`    <testcase classname="tests.test_math" name="test_subtract" time="0.20">`,
		`      <failure message="assert failed">AssertionError: expected 3 got 4</failure>`,
		`      <system-out>captured stdout</system-out>`,
		`    </testcase>`,
		`    <testcase classname="tests.test_math" name="test_skip" time="0.30">`,
		`      <skipped message="not supported">Skip reason</skipped>`,
		`    </testcase>`,
		`    <testcase classname="tests.test_math" name="test_error" time="0.40">`,
		`      <error message="fixture broke">Traceback...</error>`,
		`      <system-err>captured stderr</system-err>`,
		`    </testcase>`,
		`  </testsuite>`,
		`</testsuites>`,
	}, "\n"))

	check, err := parsePytestJUnitXML(raw)
	if err != nil {
		t.Fatalf("parsePytestJUnitXML() unexpected error: %v", err)
	}

	if check.Tool != "pytest" {
		t.Fatalf("expected tool pytest, got %q", check.Tool)
	}
	if check.Status != "error" {
		t.Fatalf("expected status error due to testcase error, got %q", check.Status)
	}
	if len(check.Items) != 4 {
		t.Fatalf("expected 4 items, got %d", len(check.Items))
	}
	if check.Summary["passed"] != 1 || check.Summary["failed"] != 1 || check.Summary["skipped"] != 1 || check.Summary["errors"] != 1 {
		t.Fatalf("unexpected summary: %#v", check.Summary)
	}
	if check.Items[1].ID != "tests.test_math::test_subtract" {
		t.Fatalf("unexpected item id: %q", check.Items[1].ID)
	}
	if check.Items[1].Status != "failed" {
		t.Fatalf("expected failed item, got %q", check.Items[1].Status)
	}
	if check.Items[1].Stdout != "captured stdout" {
		t.Fatalf("expected item stdout, got %q", check.Items[1].Stdout)
	}
	if check.Items[3].Stderr != "captured stderr" {
		t.Fatalf("expected item stderr, got %q", check.Items[3].Stderr)
	}
}

func TestParsePytestJUnitXMLFileWithTemplate(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "pytest-3.11.xml")
	raw := `<testsuite><testcase classname="tests.test_ok" name="test_ok" time="0.05"/></testsuite>`
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatalf("write junit xml: %v", err)
	}

	check, err := parsePytestJUnitXMLFile(filepath.Join(dir, "pytest-{matrix.python}.xml"), map[string]string{"python": "3.11"})
	if err != nil {
		t.Fatalf("parsePytestJUnitXMLFile() unexpected error: %v", err)
	}

	if check.Status != "passed" {
		t.Fatalf("expected passed status, got %q", check.Status)
	}
	if len(check.Items) != 1 {
		t.Fatalf("expected one item, got %d", len(check.Items))
	}
}
