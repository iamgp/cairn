package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseRenderCommandArgs(t *testing.T) {
	t.Parallel()

	opts, err := parseRenderCommandArgs([]string{"--pages-dir", "public"})
	if err != nil {
		t.Fatalf("parse render args: %v", err)
	}
	if opts.pagesDir != "public" {
		t.Fatalf("expected pages dir public, got %q", opts.pagesDir)
	}
}

func TestParseRenderCommandArgsRequiresPagesDir(t *testing.T) {
	t.Parallel()

	_, err := parseRenderCommandArgs(nil)
	if err == nil {
		t.Fatal("expected missing pages-dir to fail")
	}
	if !strings.Contains(err.Error(), "--pages-dir") {
		t.Fatalf("expected pages-dir error, got %v", err)
	}
}

func TestRenderCommandCopiesReportAssets(t *testing.T) {
	target := t.TempDir()
	cmd := newRenderCommand()
	cmd.SetArgs([]string{"--pages-dir", target})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute render command: %v", err)
	}

	if _, err := os.Stat(filepath.Join(target, "index.html")); err != nil {
		t.Fatalf("expected index.html to be rendered: %v", err)
	}
}
