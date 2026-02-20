package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestRootIncludesExpectedSubcommands(t *testing.T) {
	t.Parallel()

	cmd := NewRootCommand()

	expected := []string{"ingest", "collect", "comment", "prune", "init"}
	for _, name := range expected {
		if _, _, err := cmd.Find([]string{name}); err != nil {
			t.Fatalf("expected subcommand %q to exist: %v", name, err)
		}
	}
}

func TestStubSubcommandsShowHelp(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		args []string
	}{
		{name: "ingest", args: []string{"ingest"}},
		{name: "comment", args: []string{"comment"}},
		{name: "prune", args: []string{"prune"}},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			cmd := NewRootCommand()
			buf := &bytes.Buffer{}
			cmd.SetOut(buf)
			cmd.SetErr(buf)
			cmd.SetArgs(tc.args)

			if err := cmd.Execute(); err != nil {
				t.Fatalf("execute command %q: %v", tc.name, err)
			}

			if !strings.Contains(buf.String(), "Usage:") {
				t.Fatalf("expected help output for %q, got %q", tc.name, buf.String())
			}
		})
	}
}
