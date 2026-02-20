package cli

import "github.com/spf13/cobra"

func newPruneCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "prune",
		Short: "Prune obsolete data",
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}
}
