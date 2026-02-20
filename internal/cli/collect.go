package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pelletier/go-toml/v2"
	"github.com/spf13/cobra"
)

type cairnConfig struct {
	Project  cairnProjectConfig   `toml:"project"`
	Checkers []cairnCheckerConfig `toml:"checkers"`
}

type cairnProjectConfig struct {
	Name string `toml:"name"`
}

type cairnCheckerConfig struct {
	ID      string             `toml:"id"`
	Adapter string             `toml:"adapter"`
	Input   string             `toml:"input"`
	Mapping genericJSONMapping `toml:"mapping"`
}

type collectOptions struct {
	configPath string
	outPath    string
	runID      string
	sha        string
	shaFull    string
	branch     string
	timestamp  string
	pr         *int
	matrix     map[string]string
}

func newCollectCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "collect",
		Short: "Collect checker outputs into a run-record JSON",
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
		configPath: "cairn.toml",
		matrix:     map[string]string{},
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
	key, value, ok := strings.Cut(raw, "=")
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if !ok || key == "" || value == "" {
		return fmt.Errorf("matrix value must be key=value")
	}
	matrix[key] = value
	return nil
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

	return Run{
		Version:   runSchemaVersion,
		RunID:     runID,
		SHA:       sha,
		SHAFull:   shaFull,
		PR:        pr,
		Branch:    branch,
		Timestamp: now,
		Matrix:    opts.matrix,
		Checks:    checks,
	}, nil
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
