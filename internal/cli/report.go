package cli

import "github.com/spf13/cobra"

func newReportCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "report",
		Short: "Generate reports from stored data",
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}
}
