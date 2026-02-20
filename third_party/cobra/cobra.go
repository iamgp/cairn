package cobra

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// Command is a minimal offline-compatible subset of Cobra's command model.
type Command struct {
	Use   string
	Short string
	RunE  func(cmd *Command, args []string) error

	args []string
	out  io.Writer
	err  io.Writer

	parent      *Command
	subcommands []*Command
}

func (c *Command) SetOut(w io.Writer) {
	c.out = w
}

func (c *Command) SetErr(w io.Writer) {
	c.err = w
}

func (c *Command) SetArgs(args []string) {
	c.args = args
}

func (c *Command) AddCommand(cmds ...*Command) {
	for _, cmd := range cmds {
		if cmd == nil {
			continue
		}
		cmd.parent = c
		if cmd.out == nil && c.out != nil {
			cmd.out = c.out
		}
		if cmd.err == nil && c.err != nil {
			cmd.err = c.err
		}
		c.subcommands = append(c.subcommands, cmd)
	}
}

func (c *Command) Execute() error {
	if c == nil {
		return errors.New("nil command")
	}
	args := c.args
	if args == nil {
		args = os.Args[1:]
	}
	return c.execute(args)
}

func (c *Command) execute(args []string) error {
	if len(args) > 0 {
		for _, sub := range c.subcommands {
			if sub.Use == args[0] {
				if sub.out == nil {
					sub.out = c.out
				}
				if sub.err == nil {
					sub.err = c.err
				}
				return sub.execute(args[1:])
			}
		}
	}

	if c.RunE != nil {
		return c.RunE(c, args)
	}
	return c.Help()
}

func (c *Command) Find(args []string) (*Command, []string, error) {
	current := c
	remaining := args

	for len(remaining) > 0 {
		matched := false
		for _, sub := range current.subcommands {
			if sub.Use == remaining[0] {
				current = sub
				remaining = remaining[1:]
				matched = true
				break
			}
		}
		if !matched {
			return current, remaining, fmt.Errorf("unknown command %q", remaining[0])
		}
	}

	return current, remaining, nil
}

func (c *Command) Help() error {
	w := c.out
	if w == nil {
		w = os.Stdout
	}

	_, err := fmt.Fprintf(w, "Usage:\n  %s\n", c.commandPath())
	if err != nil {
		return err
	}

	if c.Short != "" {
		if _, err := fmt.Fprintf(w, "\n%s\n", c.Short); err != nil {
			return err
		}
	}

	if len(c.subcommands) > 0 {
		if _, err := fmt.Fprintln(w, "\nAvailable Commands:"); err != nil {
			return err
		}
		for _, sub := range c.subcommands {
			if _, err := fmt.Fprintf(w, "  %s\t%s\n", sub.Use, sub.Short); err != nil {
				return err
			}
		}
	}

	return nil
}

func (c *Command) commandPath() string {
	parts := []string{c.Use}
	for p := c.parent; p != nil; p = p.parent {
		parts = append([]string{p.Use}, parts...)
	}
	return strings.Join(parts, " ")
}
