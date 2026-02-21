package cli

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pelletier/go-toml/v2"
	"github.com/spf13/cobra"
)

type cairnConfig struct {
	Project   cairnProjectConfig   `toml:"project"`
	History   cairnHistoryConfig   `toml:"history"`
	PRComment cairnPRCommentConfig `toml:"pr_comment"`
	Checkers  []cairnCheckerConfig `toml:"checkers"`
}

type cairnProjectConfig struct {
	Name string `toml:"name"`
}

type cairnHistoryConfig struct {
	MaxDays int `toml:"max_days"`
	MaxRuns int `toml:"max_runs"`
}

type cairnPRCommentConfig struct {
	Enabled       *bool `toml:"enabled"`
	ShowCoverage  *bool `toml:"show_coverage"`
	ShowPerMatrix *bool `toml:"show_per_matrix"`
}

type cairnCheckerConfig struct {
	ID      string             `toml:"id"`
	Adapter string             `toml:"adapter"`
	Input   string             `toml:"input"`
	Mapping genericJSONMapping `toml:"mapping"`
}

type collectOptions struct {
	configPath       string
	outPath          string
	runID            string
	sha              string
	shaFull          string
	branch           string
	timestamp        string
	pr               *int
	matrix           map[string]string
	toolVersions     map[string]string
	dependencyHashes map[string]string
	requirementIDs   []string
	specIDs          []string
	riskIDs          []string
	commitMessage    string
	artifacts        []collectArtifactInput
	coverageEntries  []collectCoverageInput
	coverageFiles    []collectCoverageFileInput
}

type collectArtifactInput struct {
	role string
	path string
}

type collectCoverageInput struct {
	scope   string
	checkID string
	metric  string
	covered int
	total   int
}

type collectCoverageFileInput struct {
	scope   string
	checkID string
	path    string
}

func newCollectCommand() *cobra.Command {
	return &cobra.Command{
		Use:                "collect",
		Short:              "Collect checker outputs into a run-record JSON",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			opts, err := parseCollectCommandArgs(args)
			if err != nil {
				return err
			}

			cfg, err := loadCairnConfig(opts.configPath)
			if err != nil {
				return err
			}

			checks, err := collectChecks(cfg, opts.matrix)
			if err != nil {
				return err
			}

			run, err := buildCollectedRun(opts, checks)
			if err != nil {
				return err
			}

			raw, err := json.Marshal(run)
			if err != nil {
				return fmt.Errorf("marshal run record: %w", err)
			}

			if strings.TrimSpace(opts.outPath) == "" {
				_, err = fmt.Println(string(raw))
				return err
			}

			if err := os.MkdirAll(filepath.Dir(opts.outPath), 0o755); err != nil {
				return fmt.Errorf("create output directory: %w", err)
			}
			if err := os.WriteFile(opts.outPath, raw, 0o644); err != nil {
				return fmt.Errorf("write output run record: %w", err)
			}

			return nil
		},
	}
}

func parseCollectCommandArgs(args []string) (collectOptions, error) {
	opts := collectOptions{
		configPath:       "cairn.toml",
		matrix:           map[string]string{},
		toolVersions:     map[string]string{},
		dependencyHashes: map[string]string{},
	}

	for i := 0; i < len(args); i++ {
		arg := args[i]

		switch {
		case strings.HasPrefix(arg, "--config="):
			opts.configPath = strings.TrimPrefix(arg, "--config=")
		case arg == "--config":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --config")
			}
			i++
			opts.configPath = args[i]
		case strings.HasPrefix(arg, "--out="):
			opts.outPath = strings.TrimPrefix(arg, "--out=")
		case arg == "--out":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --out")
			}
			i++
			opts.outPath = args[i]
		case strings.HasPrefix(arg, "--run-id="):
			opts.runID = strings.TrimPrefix(arg, "--run-id=")
		case arg == "--run-id":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --run-id")
			}
			i++
			opts.runID = args[i]
		case strings.HasPrefix(arg, "--sha="):
			opts.sha = strings.TrimPrefix(arg, "--sha=")
		case arg == "--sha":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --sha")
			}
			i++
			opts.sha = args[i]
		case strings.HasPrefix(arg, "--sha-full="):
			opts.shaFull = strings.TrimPrefix(arg, "--sha-full=")
		case arg == "--sha-full":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --sha-full")
			}
			i++
			opts.shaFull = args[i]
		case strings.HasPrefix(arg, "--branch="):
			opts.branch = strings.TrimPrefix(arg, "--branch=")
		case arg == "--branch":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --branch")
			}
			i++
			opts.branch = args[i]
		case strings.HasPrefix(arg, "--timestamp="):
			opts.timestamp = strings.TrimPrefix(arg, "--timestamp=")
		case arg == "--timestamp":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --timestamp")
			}
			i++
			opts.timestamp = args[i]
		case strings.HasPrefix(arg, "--pr="):
			n, err := strconv.Atoi(strings.TrimPrefix(arg, "--pr="))
			if err != nil || n <= 0 {
				return collectOptions{}, fmt.Errorf("invalid value for --pr")
			}
			opts.pr = &n
		case arg == "--pr":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --pr")
			}
			i++
			n, err := strconv.Atoi(args[i])
			if err != nil || n <= 0 {
				return collectOptions{}, fmt.Errorf("invalid value for --pr")
			}
			opts.pr = &n
		case strings.HasPrefix(arg, "--matrix="):
			if err := parseMatrixKV(opts.matrix, strings.TrimPrefix(arg, "--matrix=")); err != nil {
				return collectOptions{}, err
			}
		case arg == "--matrix":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --matrix")
			}
			i++
			if err := parseMatrixKV(opts.matrix, args[i]); err != nil {
				return collectOptions{}, err
			}
		case strings.HasPrefix(arg, "--tool-version="):
			if err := parseNamedKVFlag(opts.toolVersions, strings.TrimPrefix(arg, "--tool-version="), "--tool-version"); err != nil {
				return collectOptions{}, err
			}
		case arg == "--tool-version":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --tool-version")
			}
			i++
			if err := parseNamedKVFlag(opts.toolVersions, args[i], "--tool-version"); err != nil {
				return collectOptions{}, err
			}
		case strings.HasPrefix(arg, "--dependency-hash="):
			if err := parseNamedKVFlag(opts.dependencyHashes, strings.TrimPrefix(arg, "--dependency-hash="), "--dependency-hash"); err != nil {
				return collectOptions{}, err
			}
		case arg == "--dependency-hash":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --dependency-hash")
			}
			i++
			if err := parseNamedKVFlag(opts.dependencyHashes, args[i], "--dependency-hash"); err != nil {
				return collectOptions{}, err
			}
		case strings.HasPrefix(arg, "--requirement-id="):
			id := strings.TrimSpace(strings.TrimPrefix(arg, "--requirement-id="))
			if id == "" {
				return collectOptions{}, fmt.Errorf("--requirement-id value must be non-empty")
			}
			opts.requirementIDs = append(opts.requirementIDs, id)
		case arg == "--requirement-id":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --requirement-id")
			}
			i++
			id := strings.TrimSpace(args[i])
			if id == "" {
				return collectOptions{}, fmt.Errorf("--requirement-id value must be non-empty")
			}
			opts.requirementIDs = append(opts.requirementIDs, id)
		case strings.HasPrefix(arg, "--spec-id="):
			id := strings.TrimSpace(strings.TrimPrefix(arg, "--spec-id="))
			if id == "" {
				return collectOptions{}, fmt.Errorf("--spec-id value must be non-empty")
			}
			opts.specIDs = append(opts.specIDs, id)
		case arg == "--spec-id":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --spec-id")
			}
			i++
			id := strings.TrimSpace(args[i])
			if id == "" {
				return collectOptions{}, fmt.Errorf("--spec-id value must be non-empty")
			}
			opts.specIDs = append(opts.specIDs, id)
		case strings.HasPrefix(arg, "--risk-id="):
			id := strings.TrimSpace(strings.TrimPrefix(arg, "--risk-id="))
			if id == "" {
				return collectOptions{}, fmt.Errorf("--risk-id value must be non-empty")
			}
			opts.riskIDs = append(opts.riskIDs, id)
		case arg == "--risk-id":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --risk-id")
			}
			i++
			id := strings.TrimSpace(args[i])
			if id == "" {
				return collectOptions{}, fmt.Errorf("--risk-id value must be non-empty")
			}
			opts.riskIDs = append(opts.riskIDs, id)
		case strings.HasPrefix(arg, "--commit-message="):
			opts.commitMessage = strings.TrimSpace(strings.TrimPrefix(arg, "--commit-message="))
		case arg == "--commit-message":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --commit-message")
			}
			i++
			opts.commitMessage = strings.TrimSpace(args[i])
		case strings.HasPrefix(arg, "--artifact="):
			artifact, err := parseArtifactFlag(strings.TrimPrefix(arg, "--artifact="))
			if err != nil {
				return collectOptions{}, err
			}
			opts.artifacts = append(opts.artifacts, artifact)
		case arg == "--artifact":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --artifact")
			}
			i++
			artifact, err := parseArtifactFlag(args[i])
			if err != nil {
				return collectOptions{}, err
			}
			opts.artifacts = append(opts.artifacts, artifact)
		case strings.HasPrefix(arg, "--coverage="):
			coverage, err := parseCoverageFlag(strings.TrimPrefix(arg, "--coverage="))
			if err != nil {
				return collectOptions{}, err
			}
			opts.coverageEntries = append(opts.coverageEntries, coverage)
		case arg == "--coverage":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --coverage")
			}
			i++
			coverage, err := parseCoverageFlag(args[i])
			if err != nil {
				return collectOptions{}, err
			}
			opts.coverageEntries = append(opts.coverageEntries, coverage)
		case strings.HasPrefix(arg, "--coverage-file="):
			coverageFile, err := parseCoverageFileFlag(strings.TrimPrefix(arg, "--coverage-file="))
			if err != nil {
				return collectOptions{}, err
			}
			opts.coverageFiles = append(opts.coverageFiles, coverageFile)
		case arg == "--coverage-file":
			if i+1 >= len(args) {
				return collectOptions{}, fmt.Errorf("missing value for --coverage-file")
			}
			i++
			coverageFile, err := parseCoverageFileFlag(args[i])
			if err != nil {
				return collectOptions{}, err
			}
			opts.coverageFiles = append(opts.coverageFiles, coverageFile)
		default:
			if strings.HasPrefix(arg, "--") {
				return collectOptions{}, fmt.Errorf("unknown flag %q", arg)
			}
			return collectOptions{}, fmt.Errorf("collect does not accept positional arguments")
		}
	}

	return opts, nil
}

func parseMatrixKV(matrix map[string]string, raw string) error {
	return parseNamedKVFlag(matrix, raw, "matrix")
}

func parseNamedKVFlag(values map[string]string, raw string, name string) error {
	key, value, ok := strings.Cut(raw, "=")
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if !ok || key == "" || value == "" {
		return fmt.Errorf("%s value must be key=value", name)
	}
	values[key] = value
	return nil
}

func parseArtifactFlag(raw string) (collectArtifactInput, error) {
	role, path, ok := strings.Cut(raw, "=")
	role = strings.TrimSpace(role)
	path = strings.TrimSpace(path)
	if !ok || role == "" || path == "" {
		return collectArtifactInput{}, fmt.Errorf("--artifact value must be role=path")
	}
	return collectArtifactInput{role: role, path: path}, nil
}

func parseCoverageFlag(raw string) (collectCoverageInput, error) {
	scopeMetric, counts, ok := strings.Cut(strings.TrimSpace(raw), "=")
	if !ok {
		return collectCoverageInput{}, fmt.Errorf("--coverage value must be <scope>:<metric>=<covered>/<total>")
	}

	scopeMetric = strings.TrimSpace(scopeMetric)
	delimiter := strings.LastIndex(scopeMetric, ":")
	if delimiter <= 0 || delimiter == len(scopeMetric)-1 {
		return collectCoverageInput{}, fmt.Errorf("--coverage value must be <scope>:<metric>=<covered>/<total>")
	}
	scopeRaw := strings.TrimSpace(scopeMetric[:delimiter])
	metric := strings.TrimSpace(scopeMetric[delimiter+1:])
	if metric != "line" && metric != "branch" && metric != "function" {
		return collectCoverageInput{}, fmt.Errorf("unsupported coverage metric %q", metric)
	}

	coveredRaw, totalRaw, ok := strings.Cut(strings.TrimSpace(counts), "/")
	if !ok {
		return collectCoverageInput{}, fmt.Errorf("--coverage value must be <scope>:<metric>=<covered>/<total>")
	}
	covered, err := strconv.Atoi(strings.TrimSpace(coveredRaw))
	if err != nil || covered < 0 {
		return collectCoverageInput{}, fmt.Errorf("coverage covered value must be a non-negative integer")
	}
	total, err := strconv.Atoi(strings.TrimSpace(totalRaw))
	if err != nil || total < 0 {
		return collectCoverageInput{}, fmt.Errorf("coverage total value must be a non-negative integer")
	}
	if covered > total {
		return collectCoverageInput{}, fmt.Errorf("coverage covered value cannot exceed total")
	}

	scope := strings.TrimSpace(scopeRaw)
	switch {
	case scope == "overall":
		return collectCoverageInput{
			scope:   "overall",
			metric:  metric,
			covered: covered,
			total:   total,
		}, nil
	case strings.HasPrefix(scope, "check:"):
		checkID := strings.TrimSpace(strings.TrimPrefix(scope, "check:"))
		if checkID == "" {
			return collectCoverageInput{}, fmt.Errorf("coverage check scope requires checker id")
		}
		return collectCoverageInput{
			scope:   "check",
			checkID: checkID,
			metric:  metric,
			covered: covered,
			total:   total,
		}, nil
	default:
		return collectCoverageInput{}, fmt.Errorf("unsupported coverage scope %q", scope)
	}
}

func parseCoverageFileFlag(raw string) (collectCoverageFileInput, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return collectCoverageFileInput{}, fmt.Errorf("--coverage-file value must be non-empty")
	}

	scope := "overall"
	checkID := ""
	path := value

	if left, right, ok := strings.Cut(value, "="); ok {
		scopeRaw := strings.TrimSpace(left)
		path = strings.TrimSpace(right)
		if scopeRaw == "" || path == "" {
			return collectCoverageFileInput{}, fmt.Errorf("--coverage-file value must be <path> or <scope>=<path>")
		}

		switch {
		case scopeRaw == "overall":
			scope = "overall"
		case strings.HasPrefix(scopeRaw, "check:"):
			scope = "check"
			checkID = strings.TrimSpace(strings.TrimPrefix(scopeRaw, "check:"))
			if checkID == "" {
				return collectCoverageFileInput{}, fmt.Errorf("coverage check scope requires checker id")
			}
		default:
			return collectCoverageFileInput{}, fmt.Errorf("unsupported coverage scope %q", scopeRaw)
		}
	}

	if path == "" {
		return collectCoverageFileInput{}, fmt.Errorf("--coverage-file path must be non-empty")
	}
	return collectCoverageFileInput{
		scope:   scope,
		checkID: checkID,
		path:    path,
	}, nil
}

func loadCairnConfig(path string) (cairnConfig, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return cairnConfig{}, fmt.Errorf("read config file: %w", err)
	}

	var cfg cairnConfig
	if err := toml.Unmarshal(raw, &cfg); err != nil {
		return cairnConfig{}, fmt.Errorf("parse config TOML: %w", err)
	}

	if strings.TrimSpace(cfg.Project.Name) == "" {
		return cairnConfig{}, fmt.Errorf("config project.name is required")
	}
	if cfg.History.MaxDays < 0 {
		return cairnConfig{}, fmt.Errorf("config history.max_days must be >= 0")
	}
	if cfg.History.MaxRuns < 0 {
		return cairnConfig{}, fmt.Errorf("config history.max_runs must be >= 0")
	}
	if len(cfg.Checkers) == 0 {
		return cairnConfig{}, fmt.Errorf("config must include at least one [[checkers]] entry")
	}

	for i, checker := range cfg.Checkers {
		if strings.TrimSpace(checker.ID) == "" {
			return cairnConfig{}, fmt.Errorf("config [[checkers]] entry %d is missing id", i+1)
		}
		if strings.TrimSpace(checker.Adapter) == "" {
			return cairnConfig{}, fmt.Errorf("config [[checkers]] entry %d is missing adapter", i+1)
		}
		if strings.TrimSpace(checker.Input) == "" {
			return cairnConfig{}, fmt.Errorf("config [[checkers]] entry %d is missing input", i+1)
		}
	}

	return cfg, nil
}

func (cfg cairnConfig) prCommentEnabled() bool {
	return boolPointerOrDefault(cfg.PRComment.Enabled, true)
}

func (cfg cairnConfig) prCommentShowCoverage() bool {
	return boolPointerOrDefault(cfg.PRComment.ShowCoverage, true)
}

func (cfg cairnConfig) prCommentShowPerMatrix() bool {
	return boolPointerOrDefault(cfg.PRComment.ShowPerMatrix, true)
}

func boolPointerOrDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func collectChecks(cfg cairnConfig, matrix map[string]string) ([]Check, error) {
	checks := make([]Check, 0, len(cfg.Checkers))

	for _, checker := range cfg.Checkers {
		adapter := strings.TrimSpace(checker.Adapter)
		var check Check
		var err error

		switch adapter {
		case "junit_xml":
			check, err = parsePytestJUnitXMLFile(checker.Input, matrix)
		case "ruff_json":
			check, err = parseJSONCheckFile(checker.Input, parseRuffCheckJSON)
		case "ty_json":
			check, err = parseJSONCheckFile(checker.Input, parseTyCheckJSON)
		case "go_test_json":
			check, err = parseJSONCheckFile(checker.Input, parseGoTestJSON)
		case "golangci_lint_json":
			check, err = parseJSONCheckFile(checker.Input, parseGolangCILintJSON)
		case "generic_json":
			check, err = parseGenericJSONCheckFile(checker.Input, checker.ID, checker.Mapping)
		default:
			return nil, fmt.Errorf("unsupported adapter %q for checker %q", adapter, checker.ID)
		}
		if err != nil {
			return nil, fmt.Errorf("collect checker %q: %w", checker.ID, err)
		}

		check.Tool = checker.ID
		checks = append(checks, check)
	}

	return checks, nil
}

func parseJSONCheckFile(path string, parse func([]byte) (Check, error)) (Check, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Check{}, fmt.Errorf("read json file %q: %w", path, err)
	}
	return parse(raw)
}

func parseGenericJSONCheckFile(path string, tool string, mapping genericJSONMapping) (Check, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Check{}, fmt.Errorf("read json file %q: %w", path, err)
	}
	return parseGenericCheckJSON(raw, tool, mapping)
}

func buildCollectedRun(opts collectOptions, checks []Check) (Run, error) {
	now := time.Now().UTC().Truncate(time.Second)
	if strings.TrimSpace(opts.timestamp) != "" {
		parsed, err := time.Parse(time.RFC3339, opts.timestamp)
		if err != nil {
			return Run{}, fmt.Errorf("parse --timestamp as RFC3339: %w", err)
		}
		now = parsed.UTC()
	}

	shaFull := firstNonEmpty(strings.TrimSpace(opts.shaFull), strings.TrimSpace(os.Getenv("GITHUB_SHA")))
	sha := strings.TrimSpace(opts.sha)
	if sha == "" && shaFull != "" {
		sha = shaFull
		if len(sha) > 7 {
			sha = sha[:7]
		}
	}
	if sha == "" {
		sha = "unknown"
	}

	branch := strings.TrimSpace(opts.branch)
	if branch == "" {
		branch = firstNonEmpty(
			strings.TrimSpace(os.Getenv("GITHUB_HEAD_REF")),
			strings.TrimSpace(os.Getenv("GITHUB_REF_NAME")),
		)
	}
	if branch == "" {
		branch = "unknown"
	}

	runID := strings.TrimSpace(opts.runID)
	if runID == "" {
		runID = strings.TrimSpace(os.Getenv("GITHUB_RUN_ID"))
	}
	if runID == "" {
		runID = fmt.Sprintf("local-%d", now.Unix())
	}

	pr := opts.pr
	if pr == nil {
		if parsedPR := parsePRFromGitHubRef(os.Getenv("GITHUB_REF")); parsedPR != nil {
			pr = parsedPR
		}
	}

	metadata, err := buildRunMetadata(opts)
	if err != nil {
		return Run{}, err
	}

	return Run{
		Version:   runSchemaVersion,
		RunID:     runID,
		SHA:       sha,
		SHAFull:   shaFull,
		PR:        pr,
		Branch:    branch,
		Timestamp: now,
		Matrix:    opts.matrix,
		Metadata:  metadata,
		Checks:    checks,
	}, nil
}

func buildRunMetadata(opts collectOptions) (*RunMetadata, error) {
	environment := buildRunEnvironmentMetadata()
	actor := buildRunActorMetadata()
	reproducibility, err := buildRunReproducibilityMetadata(opts)
	if err != nil {
		return nil, err
	}
	traceability := buildRunTraceabilityMetadata(opts)
	provenance, err := buildRunProvenanceMetadata(opts)
	if err != nil {
		return nil, err
	}
	coverage, err := buildRunCoverageMetadata(opts)
	if err != nil {
		return nil, err
	}

	if environment == nil &&
		actor == nil &&
		reproducibility == nil &&
		traceability == nil &&
		provenance == nil &&
		coverage == nil {
		return nil, nil
	}

	return &RunMetadata{
		Environment:     environment,
		Actor:           actor,
		Reproducibility: reproducibility,
		Traceability:    traceability,
		Provenance:      provenance,
		Coverage:        coverage,
	}, nil
}

func buildRunEnvironmentMetadata() *RunEnvironmentMetadata {
	var ci *bool
	if parsedCI, ok := parseEnvBool("CI"); ok {
		ci = &parsedCI
	}
	if githubActions, ok := parseEnvBool("GITHUB_ACTIONS"); ok {
		ci = &githubActions
	}

	provider := ""
	if githubActions, ok := parseEnvBool("GITHUB_ACTIONS"); ok && githubActions {
		provider = "github_actions"
	}

	environment := &RunEnvironmentMetadata{
		CI:         ci,
		Provider:   provider,
		Repository: strings.TrimSpace(os.Getenv("GITHUB_REPOSITORY")),
		Workflow:   strings.TrimSpace(os.Getenv("GITHUB_WORKFLOW")),
		Job:        strings.TrimSpace(os.Getenv("GITHUB_JOB")),
		RunnerOS:   strings.TrimSpace(os.Getenv("RUNNER_OS")),
		RunnerArch: strings.TrimSpace(os.Getenv("RUNNER_ARCH")),
	}
	if environment.CI == nil &&
		environment.Provider == "" &&
		environment.Repository == "" &&
		environment.Workflow == "" &&
		environment.Job == "" &&
		environment.RunnerOS == "" &&
		environment.RunnerArch == "" {
		return nil
	}
	return environment
}

func buildRunActorMetadata() *RunActorMetadata {
	actor := &RunActorMetadata{
		Login:           strings.TrimSpace(os.Getenv("GITHUB_ACTOR")),
		ID:              strings.TrimSpace(os.Getenv("GITHUB_ACTOR_ID")),
		TriggeringLogin: strings.TrimSpace(os.Getenv("GITHUB_TRIGGERING_ACTOR")),
	}
	if actor.Login == "" && actor.ID == "" && actor.TriggeringLogin == "" {
		return nil
	}
	return actor
}

func buildRunReproducibilityMetadata(opts collectOptions) (*RunReproducibilityMetadata, error) {
	configSHA256, err := fileSHA256IfExists(opts.configPath)
	if err != nil {
		return nil, err
	}

	reproducibility := &RunReproducibilityMetadata{
		ToolVersions:     cloneStringMap(opts.toolVersions),
		DependencyHashes: cloneStringMap(opts.dependencyHashes),
		ConfigSHA256:     configSHA256,
	}
	if len(reproducibility.ToolVersions) == 0 &&
		len(reproducibility.DependencyHashes) == 0 &&
		reproducibility.ConfigSHA256 == "" {
		return nil, nil
	}
	return reproducibility, nil
}

func buildRunTraceabilityMetadata(opts collectOptions) *RunTraceabilityMetadata {
	traceability := &RunTraceabilityMetadata{
		RequirementIDs: cloneStringSlice(opts.requirementIDs),
		SpecIDs:        cloneStringSlice(opts.specIDs),
		RiskIDs:        cloneStringSlice(opts.riskIDs),
		CommitMessage:  strings.TrimSpace(opts.commitMessage),
	}
	if len(traceability.RequirementIDs) == 0 &&
		len(traceability.SpecIDs) == 0 &&
		len(traceability.RiskIDs) == 0 &&
		traceability.CommitMessage == "" {
		return nil
	}
	return traceability
}

func buildRunProvenanceMetadata(opts collectOptions) (*RunProvenanceMetadata, error) {
	if len(opts.artifacts) == 0 {
		return nil, nil
	}

	artifacts := make([]RunProvenanceArtifact, 0, len(opts.artifacts))
	for _, input := range opts.artifacts {
		artifact, err := buildProvenanceArtifact(input)
		if err != nil {
			return nil, err
		}
		artifacts = append(artifacts, artifact)
	}

	return &RunProvenanceMetadata{Artifacts: artifacts}, nil
}

func buildProvenanceArtifact(input collectArtifactInput) (RunProvenanceArtifact, error) {
	path := strings.TrimSpace(input.path)
	sha, size, sniff, err := hashAndInspectFile(path)
	if err != nil {
		return RunProvenanceArtifact{}, fmt.Errorf("collect artifact %q: %w", path, err)
	}

	mimeType := detectMimeType(path, sniff)
	return RunProvenanceArtifact{
		Path:      path,
		Role:      strings.TrimSpace(input.role),
		SHA256:    sha,
		SizeBytes: size,
		MimeType:  mimeType,
	}, nil
}

func buildRunCoverageMetadata(opts collectOptions) (*RunCoverageMetadata, error) {
	entries := make([]collectCoverageInput, 0, len(opts.coverageEntries))

	reportEntries, err := collectCoverageEntriesFromFiles(opts.coverageFiles)
	if err != nil {
		return nil, err
	}
	entries = append(entries, reportEntries...)
	entries = append(entries, opts.coverageEntries...)

	if len(entries) == 0 {
		return nil, nil
	}

	coverage := &RunCoverageMetadata{
		PerCheck: map[string]RunCoverageMetricsMap{},
	}
	for _, entry := range entries {
		metric := &RunCoverageMetric{
			Covered: entry.covered,
			Total:   entry.total,
			Percent: percentFromCounts(entry.covered, entry.total),
		}
		if entry.scope == "overall" {
			if coverage.Overall == nil {
				coverage.Overall = &RunCoverageMetricsMap{}
			}
			assignCoverageMetric(coverage.Overall, entry.metric, metric)
			continue
		}

		checkMetrics := coverage.PerCheck[entry.checkID]
		assignCoverageMetric(&checkMetrics, entry.metric, metric)
		coverage.PerCheck[entry.checkID] = checkMetrics
	}

	if len(coverage.PerCheck) == 0 {
		coverage.PerCheck = nil
	}
	if coverage.Overall == nil && coverage.PerCheck == nil {
		return nil, nil
	}
	return coverage, nil
}

func assignCoverageMetric(target *RunCoverageMetricsMap, metricName string, metric *RunCoverageMetric) {
	switch metricName {
	case "line":
		target.Line = metric
	case "branch":
		target.Branch = metric
	case "function":
		target.Function = metric
	}
}

func percentFromCounts(covered int, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(covered) * 100 / float64(total)
}

func cloneStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}
	out := make(map[string]string, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func cloneStringSlice(input []string) []string {
	if len(input) == 0 {
		return nil
	}
	return append([]string(nil), input...)
}

func hashAndInspectFile(path string) (string, int64, []byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", 0, nil, err
	}
	defer file.Close()

	hasher := sha256.New()
	sniff := make([]byte, 0, 512)
	buf := make([]byte, 32*1024)
	var total int64

	for {
		n, readErr := file.Read(buf)
		if n > 0 {
			chunk := buf[:n]
			if _, err := hasher.Write(chunk); err != nil {
				return "", 0, nil, err
			}
			total += int64(n)
			if len(sniff) < cap(sniff) {
				remaining := cap(sniff) - len(sniff)
				if remaining > n {
					remaining = n
				}
				sniff = append(sniff, chunk[:remaining]...)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return "", 0, nil, readErr
		}
	}

	return hex.EncodeToString(hasher.Sum(nil)), total, sniff, nil
}

func detectMimeType(path string, sniff []byte) string {
	ext := strings.TrimSpace(filepath.Ext(path))
	if ext != "" {
		if guessed := strings.TrimSpace(mime.TypeByExtension(ext)); guessed != "" {
			return guessed
		}
	}
	if len(sniff) > 0 {
		return strings.TrimSpace(http.DetectContentType(sniff))
	}
	return ""
}

func fileSHA256IfExists(path string) (string, error) {
	trimmedPath := strings.TrimSpace(path)
	if trimmedPath == "" {
		return "", nil
	}

	raw, err := os.ReadFile(trimmedPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", fmt.Errorf("read config file for reproducibility metadata: %w", err)
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:]), nil
}

func parseEnvBool(name string) (bool, bool) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return false, false
	}
	parsed, err := strconv.ParseBool(raw)
	if err != nil {
		return false, false
	}
	return parsed, true
}

func parsePRFromGitHubRef(ref string) *int {
	parts := strings.Split(strings.TrimSpace(ref), "/")
	if len(parts) != 4 {
		return nil
	}
	if parts[0] != "refs" || parts[1] != "pull" || parts[3] != "merge" {
		return nil
	}
	n, err := strconv.Atoi(parts[2])
	if err != nil || n <= 0 {
		return nil
	}
	return &n
}
