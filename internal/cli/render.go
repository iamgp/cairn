package cli

import (
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var errRenderNoPagesDir = errors.New("render requires --pages-dir")

type renderOptions struct {
	pagesDir string
}

func newRenderCommand() *cobra.Command {
	return &cobra.Command{
		Use:                "render",
		Short:              "Render Cairn report assets into a Pages directory",
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			opts, err := parseRenderCommandArgs(args)
			if errors.Is(err, errRenderNoPagesDir) {
				return cmd.Help()
			}
			if err != nil {
				return err
			}

			return copyReportAssets(opts.pagesDir)
		},
	}
}

func parseRenderCommandArgs(args []string) (renderOptions, error) {
	opts := renderOptions{}
	var positional []string

	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case strings.HasPrefix(arg, "--pages-dir="):
			opts.pagesDir = strings.TrimPrefix(arg, "--pages-dir=")
		case arg == "--pages-dir":
			if i+1 >= len(args) {
				return renderOptions{}, fmt.Errorf("missing value for --pages-dir")
			}
			i++
			opts.pagesDir = args[i]
		case strings.HasPrefix(arg, "--"):
			return renderOptions{}, fmt.Errorf("unknown flag %q", arg)
		default:
			positional = append(positional, arg)
		}
	}

	if len(positional) > 0 {
		return renderOptions{}, fmt.Errorf("render does not accept positional arguments")
	}
	if strings.TrimSpace(opts.pagesDir) == "" {
		return renderOptions{}, errRenderNoPagesDir
	}

	return opts, nil
}
