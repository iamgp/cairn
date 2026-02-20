package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

func newIngestCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "ingest",
		Short: "Ingest data into cairn",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return cmd.Help()
			}
			if len(args) > 1 {
				return fmt.Errorf("ingest accepts a single input path")
			}

			raw, err := os.ReadFile(args[0])
			if err != nil {
				return fmt.Errorf("read input file: %w", err)
			}

			_, err = parseIngestBlocks(string(raw))
			return err
		},
	}
}
