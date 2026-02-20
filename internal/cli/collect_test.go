package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseCollectCommandArgs(t *testing.T) {
	t.Parallel()

	opts, err := parseCollectCommandArgs([]string{
		"--config", "demo/cairn.toml",
		"--out", "out/run.json",
		"--run-id", "run-1",
		"--sha", "abc1234",
		"--sha-full", "abc123456789",
		"--branch", "main",
		"--timestamp", "2026-02-20T16:00:00Z",
		"--pr", "42",
		"--matrix", "python=3.12",
		"--matrix", "os=ubuntu",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if opts.configPath != "demo/cairn.toml" {
		t.Fatalf("unexpected configPath %q", opts.configPath)
	}
	if opts.outPath != "out/run.json" {
		t.Fatalf("unexpected outPath %q", opts.outPath)
	}
	if opts.runID != "run-1" {
		t.Fatalf("unexpected runID %q", opts.runID)
	}
	if opts.matrix["python"] != "3.12" || opts.matrix["os"] != "ubuntu" {
		t.Fatalf("unexpected matrix %#v", opts.matrix)
	}
	if opts.pr == nil || *opts.pr != 42 {
		t.Fatalf("unexpected pr %#v", opts.pr)
	}
}

func TestParseCollectCommandArgsRejectsBadMatrix(t *testing.T) {
	t.Parallel()

	_, err := parseCollectCommandArgs([]string{"--matrix", "python"})
	if err == nil {
		t.Fatal("expected invalid matrix error")
	}
	if !strings.Contains(err.Error(), "matrix value must be key=value") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCollectCommandBuildsRunRecordFromConfig(t *testing.T) {
	dir := t.TempDir()
	pages := filepath.Join(dir, "inputs")
	if err := os.MkdirAll(pages, 0o755); err != nil {
		t.Fatalf("mkdir inputs: %v", err)
	}

	junitRaw, err := os.ReadFile(filepath.Join("testdata", "flow", "pytest-junit.xml"))
	if err != nil {
		t.Fatalf("read junit fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(pages, "pytest-3.12.xml"), junitRaw, 0o644); err != nil {
		t.Fatalf("write junit fixture: %v", err)
	}

	ruffRaw, err := os.ReadFile(filepath.Join("testdata", "flow", "ruff-results.json"))
	if err != nil {
		t.Fatalf("read ruff fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(pages, "ruff-results.json"), ruffRaw, 0o644); err != nil {
		t.Fatalf("write ruff fixture: %v", err)
	}

	configPath := filepath.Join(dir, "cairn.toml")
	config := strings.Join([]string{
		"[project]",
		`name = "demo"`,
		"",
		"[[checkers]]",
		`id = "pytest"`,
		`adapter = "junit_xml"`,
		`input = "` + filepath.Join(pages, "pytest-{matrix.python}.xml") + `"`,
		"",
		"[[checkers]]",
		`id = "ruff"`,
		`adapter = "ruff_json"`,
		`input = "` + filepath.Join(pages, "ruff-results.json") + `"`,
	}, "\n")
	if err := os.WriteFile(configPath, []byte(config), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	outPath := filepath.Join(dir, "run-record.json")

	cmd := NewRootCommand()
	cmd.SetArgs([]string{
		"collect",
		"--config", configPath,
		"--out", outPath,
		"--run-id", "run-123",
		"--sha-full", "fa21f92d5bcd7890ee11aa22bb33cc44dd55ee66",
		"--branch", "main",
		"--timestamp", "2026-02-20T12:00:00Z",
		"--matrix", "python=3.12",
	})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute collect: %v", err)
	}

	raw, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("read output: %v", err)
	}

	var run Run
	if err := json.Unmarshal(raw, &run); err != nil {
		t.Fatalf("decode output: %v", err)
	}

	if run.Version != runSchemaVersion {
		t.Fatalf("unexpected run version: %d", run.Version)
	}
	if run.RunID != "run-123" {
		t.Fatalf("unexpected run id: %q", run.RunID)
	}
	if run.SHA != "fa21f92" {
		t.Fatalf("unexpected sha: %q", run.SHA)
	}
	if run.Branch != "main" {
		t.Fatalf("unexpected branch: %q", run.Branch)
	}
	if run.Matrix["python"] != "3.12" {
		t.Fatalf("unexpected matrix: %#v", run.Matrix)
	}
	if len(run.Checks) != 2 {
		t.Fatalf("expected 2 checks, got %d", len(run.Checks))
	}
	if run.Checks[0].Tool != "pytest" || run.Checks[1].Tool != "ruff" {
		t.Fatalf("unexpected check tools: %#v", run.Checks)
	}
}
