package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var errIngestNoInput = errors.New("ingest requires an input path")

func newIngestCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "ingest",
		Short: "Ingest data into cairn",
		RunE: func(cmd *cobra.Command, args []string) error {
			inputPath, pagesDir, err := parseIngestCommandArgs(args)
			if errors.Is(err, errIngestNoInput) {
				return cmd.Help()
			}
			if err != nil {
				return err
			}

			raw, err := os.ReadFile(inputPath)
			if err != nil {
				return fmt.Errorf("read input file: %w", err)
			}

			if pagesDir == "" {
				_, err = parseIngestBlocks(string(raw))
				return err
			}

			var run Run
			if err := json.Unmarshal(raw, &run); err != nil {
				return fmt.Errorf("parse run record JSON: %w", err)
			}
			return appendRunRecord(pagesDir, run)
		},
	}
}

func parseIngestCommandArgs(args []string) (inputPath string, pagesDir string, err error) {
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]

		if strings.HasPrefix(arg, "--pages-dir=") {
			pagesDir = strings.TrimPrefix(arg, "--pages-dir=")
			continue
		}
		if arg == "--pages-dir" {
			if i+1 >= len(args) {
				return "", "", fmt.Errorf("missing value for --pages-dir")
			}
			i++
			pagesDir = args[i]
			continue
		}
		if strings.HasPrefix(arg, "--") {
			return "", "", fmt.Errorf("unknown flag %q", arg)
		}

		positional = append(positional, arg)
	}

	if len(positional) == 0 {
		return "", "", errIngestNoInput
	}
	if len(positional) > 1 {
		return "", "", fmt.Errorf("ingest accepts a single input path")
	}

	return positional[0], pagesDir, nil
}
