package cli

import "github.com/spf13/cobra"

func NewRootCommand() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "cairn",
		Short: "Cairn data maintenance CLI",
	}

	rootCmd.AddCommand(newIngestCommand())
	rootCmd.AddCommand(newReportCommand())
	rootCmd.AddCommand(newPruneCommand())
	rootCmd.AddCommand(newInitCommand())

	return rootCmd
}
