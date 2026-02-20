package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

const defaultCairnToml = `[project]
name = "your-repo"

[history]
max_days = 0
max_runs = 0

[pr_comment]
enabled = true
show_coverage = true
show_per_matrix = true

[[checkers]]
id = "pytest"
adapter = "junit_xml"
input = "pytest-{matrix.python}.xml"

[[checkers]]
id = "ruff"
adapter = "ruff_json"
input = "ruff-results.json"

[[checkers]]
id = "ty"
adapter = "ty_json"
input = "ty-results.json"
`

const defaultCairnWorkflow = `name: Cairn

on:
  push:
    branches: [main]
  pull_request:

jobs:
  cairn:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Run Cairn Ingest
      # Replace with your published action when available.
        run: |
          echo "Install cairn binary here"
          echo "Run cairn ingest here"
`

func newInitCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Initialize cairn workspace state",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				return fmt.Errorf("init does not accept arguments")
			}

			if err := scaffoldFile("cairn.toml", defaultCairnToml); err != nil {
				return err
			}
			if err := scaffoldFile(filepath.Join(".github", "workflows", "cairn.yml"), defaultCairnWorkflow); err != nil {
				return err
			}

			return nil
		},
	}
}

func scaffoldFile(path string, content string) error {
	if _, err := os.Stat(path); err == nil {
		fmt.Fprintf(os.Stderr, "warning: %s already exists; skipping\n", path)
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat %s: %w", path, err)
	}

	dir := filepath.Dir(path)
	if dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create directory %s: %w", dir, err)
		}
	}

	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}

	return nil
}
