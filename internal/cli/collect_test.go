package cli

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
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
		"--tool-version", "go=1.23.4",
		"--tool-version", "ruff=0.9.6",
		"--dependency-hash", "go.mod=111aaa",
		"--dependency-hash", "uv.lock=222bbb",
		"--requirement-id", "REQ-1",
		"--requirement-id", "REQ-2",
		"--spec-id", "SPEC-9",
		"--risk-id", "RISK-2",
		"--commit-message", "feat: track metadata",
		"--artifact", "report=out/report.json",
		"--coverage", "overall:line=80/100",
		"--coverage", "check:pytest:function=10/10",
		"--coverage-file", "coverage/lcov.info",
		"--coverage-file", "check:pytest=coverage/pytest.xml",
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
	if opts.toolVersions["go"] != "1.23.4" || opts.toolVersions["ruff"] != "0.9.6" {
		t.Fatalf("unexpected toolVersions %#v", opts.toolVersions)
	}
	if opts.dependencyHashes["go.mod"] != "111aaa" || opts.dependencyHashes["uv.lock"] != "222bbb" {
		t.Fatalf("unexpected dependencyHashes %#v", opts.dependencyHashes)
	}
	if opts.pr == nil || *opts.pr != 42 {
		t.Fatalf("unexpected pr %#v", opts.pr)
	}
	if len(opts.requirementIDs) != 2 || opts.requirementIDs[0] != "REQ-1" || opts.requirementIDs[1] != "REQ-2" {
		t.Fatalf("unexpected requirementIDs %#v", opts.requirementIDs)
	}
	if len(opts.specIDs) != 1 || opts.specIDs[0] != "SPEC-9" {
		t.Fatalf("unexpected specIDs %#v", opts.specIDs)
	}
	if len(opts.riskIDs) != 1 || opts.riskIDs[0] != "RISK-2" {
		t.Fatalf("unexpected riskIDs %#v", opts.riskIDs)
	}
	if opts.commitMessage != "feat: track metadata" {
		t.Fatalf("unexpected commitMessage %q", opts.commitMessage)
	}
	if len(opts.artifacts) != 1 || opts.artifacts[0].role != "report" || opts.artifacts[0].path != "out/report.json" {
		t.Fatalf("unexpected artifacts %#v", opts.artifacts)
	}
	if len(opts.coverageEntries) != 2 {
		t.Fatalf("unexpected coverageEntries %#v", opts.coverageEntries)
	}
	if len(opts.coverageFiles) != 2 {
		t.Fatalf("unexpected coverageFiles %#v", opts.coverageFiles)
	}
	if opts.coverageFiles[0].scope != "overall" || opts.coverageFiles[0].path != "coverage/lcov.info" {
		t.Fatalf("unexpected first coverageFile %#v", opts.coverageFiles[0])
	}
	if opts.coverageFiles[1].scope != "check" || opts.coverageFiles[1].checkID != "pytest" {
		t.Fatalf("unexpected second coverageFile %#v", opts.coverageFiles[1])
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

func TestParseCollectCommandArgsRejectsBadToolVersion(t *testing.T) {
	t.Parallel()

	_, err := parseCollectCommandArgs([]string{"--tool-version", "go"})
	if err == nil {
		t.Fatal("expected invalid tool-version error")
	}
	if !strings.Contains(err.Error(), "--tool-version value must be key=value") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseCollectCommandArgsRejectsBadCoverageFileScope(t *testing.T) {
	t.Parallel()

	_, err := parseCollectCommandArgs([]string{"--coverage-file", "suite:pytest=coverage.xml"})
	if err == nil {
		t.Fatal("expected invalid coverage-file scope error")
	}
	if !strings.Contains(err.Error(), "unsupported coverage scope") {
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
	configDigest := sha256.Sum256([]byte(config))
	expectedConfigSHA256 := hex.EncodeToString(configDigest[:])

	outPath := filepath.Join(dir, "run-record.json")
	artifactPath := filepath.Join(dir, "report.json")
	artifactContent := []byte(`{"status":"ok"}`)
	if err := os.WriteFile(artifactPath, artifactContent, 0o644); err != nil {
		t.Fatalf("write artifact fixture: %v", err)
	}
	artifactDigest := sha256.Sum256(artifactContent)
	expectedArtifactSHA256 := hex.EncodeToString(artifactDigest[:])

	t.Setenv("CI", "true")
	t.Setenv("GITHUB_ACTIONS", "true")
	t.Setenv("GITHUB_REPOSITORY", "acme/cairn")
	t.Setenv("GITHUB_WORKFLOW", "ci")
	t.Setenv("GITHUB_JOB", "test")
	t.Setenv("RUNNER_OS", "Linux")
	t.Setenv("RUNNER_ARCH", "X64")
	t.Setenv("GITHUB_ACTOR", "octocat")
	t.Setenv("GITHUB_ACTOR_ID", "12345")
	t.Setenv("GITHUB_TRIGGERING_ACTOR", "dependabot[bot]")

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
		"--tool-version", "go=1.23.4",
		"--tool-version", "ruff=0.9.6",
		"--dependency-hash", "go.mod=111aaa",
		"--dependency-hash", "uv.lock=222bbb",
		"--requirement-id", "REQ-100",
		"--spec-id", "SPEC-200",
		"--risk-id", "RISK-7",
		"--commit-message", "feat: add provenance metadata",
		"--artifact", "report=" + artifactPath,
		"--coverage", "overall:line=90/100",
		"--coverage", "check:pytest:function=5/10",
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
	if run.Metadata == nil {
		t.Fatalf("expected run metadata")
	}
	if run.Metadata.Environment == nil {
		t.Fatalf("expected environment metadata")
	}
	if run.Metadata.Environment.CI == nil || !*run.Metadata.Environment.CI {
		t.Fatalf("unexpected environment ci value: %#v", run.Metadata.Environment.CI)
	}
	if run.Metadata.Environment.Provider != "github_actions" {
		t.Fatalf("unexpected environment provider: %q", run.Metadata.Environment.Provider)
	}
	if run.Metadata.Actor == nil || run.Metadata.Actor.Login != "octocat" || run.Metadata.Actor.ID != "12345" {
		t.Fatalf("unexpected actor metadata: %#v", run.Metadata.Actor)
	}
	if run.Metadata.Reproducibility == nil {
		t.Fatalf("expected reproducibility metadata")
	}
	if run.Metadata.Reproducibility.ToolVersions["go"] != "1.23.4" ||
		run.Metadata.Reproducibility.ToolVersions["ruff"] != "0.9.6" {
		t.Fatalf("unexpected tool versions: %#v", run.Metadata.Reproducibility.ToolVersions)
	}
	if run.Metadata.Reproducibility.DependencyHashes["go.mod"] != "111aaa" ||
		run.Metadata.Reproducibility.DependencyHashes["uv.lock"] != "222bbb" {
		t.Fatalf("unexpected dependency hashes: %#v", run.Metadata.Reproducibility.DependencyHashes)
	}
	if run.Metadata.Reproducibility.ConfigSHA256 != expectedConfigSHA256 {
		t.Fatalf("unexpected config SHA256: got %q want %q", run.Metadata.Reproducibility.ConfigSHA256, expectedConfigSHA256)
	}
	if run.Metadata.Traceability == nil {
		t.Fatalf("expected traceability metadata")
	}
	if len(run.Metadata.Traceability.RequirementIDs) != 1 || run.Metadata.Traceability.RequirementIDs[0] != "REQ-100" {
		t.Fatalf("unexpected requirement ids: %#v", run.Metadata.Traceability.RequirementIDs)
	}
	if len(run.Metadata.Traceability.SpecIDs) != 1 || run.Metadata.Traceability.SpecIDs[0] != "SPEC-200" {
		t.Fatalf("unexpected spec ids: %#v", run.Metadata.Traceability.SpecIDs)
	}
	if len(run.Metadata.Traceability.RiskIDs) != 1 || run.Metadata.Traceability.RiskIDs[0] != "RISK-7" {
		t.Fatalf("unexpected risk ids: %#v", run.Metadata.Traceability.RiskIDs)
	}
	if run.Metadata.Traceability.CommitMessage != "feat: add provenance metadata" {
		t.Fatalf("unexpected commit message: %q", run.Metadata.Traceability.CommitMessage)
	}
	if run.Metadata.Provenance == nil || len(run.Metadata.Provenance.Artifacts) != 1 {
		t.Fatalf("expected provenance artifact metadata: %#v", run.Metadata.Provenance)
	}
	artifact := run.Metadata.Provenance.Artifacts[0]
	if artifact.Path != artifactPath || artifact.Role != "report" {
		t.Fatalf("unexpected artifact identity: %#v", artifact)
	}
	if artifact.SHA256 != expectedArtifactSHA256 {
		t.Fatalf("unexpected artifact SHA256: got %q want %q", artifact.SHA256, expectedArtifactSHA256)
	}
	if artifact.SizeBytes != int64(len(artifactContent)) {
		t.Fatalf("unexpected artifact size: got %d want %d", artifact.SizeBytes, len(artifactContent))
	}
	if artifact.MimeType == "" {
		t.Fatalf("expected artifact mime type")
	}
	if run.Metadata.Coverage == nil || run.Metadata.Coverage.Overall == nil || run.Metadata.Coverage.Overall.Line == nil {
		t.Fatalf("expected overall coverage metadata: %#v", run.Metadata.Coverage)
	}
	if run.Metadata.Coverage.Overall.Line.Covered != 90 ||
		run.Metadata.Coverage.Overall.Line.Total != 100 ||
		math.Abs(run.Metadata.Coverage.Overall.Line.Percent-90.0) > 0.0001 {
		t.Fatalf("unexpected overall line coverage: %#v", run.Metadata.Coverage.Overall.Line)
	}
	pytestCoverage, ok := run.Metadata.Coverage.PerCheck["pytest"]
	if !ok || pytestCoverage.Function == nil {
		t.Fatalf("expected pytest function coverage: %#v", run.Metadata.Coverage.PerCheck)
	}
	if pytestCoverage.Function.Covered != 5 ||
		pytestCoverage.Function.Total != 10 ||
		math.Abs(pytestCoverage.Function.Percent-50.0) > 0.0001 {
		t.Fatalf("unexpected pytest function coverage: %#v", pytestCoverage.Function)
	}
	if len(run.Checks) != 2 {
		t.Fatalf("expected 2 checks, got %d", len(run.Checks))
	}
	if run.Checks[0].Tool != "pytest" || run.Checks[1].Tool != "ruff" {
		t.Fatalf("unexpected check tools: %#v", run.Checks)
	}
}
