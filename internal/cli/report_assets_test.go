package cli

import (
	"embed"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

//go:embed testdata/report-assets/*
var testReportAssets embed.FS

func TestCopyEmbeddedReportAssetsCopiesFiles(t *testing.T) {
	t.Parallel()

	target := t.TempDir()
	err := copyEmbeddedReportAssets(testReportAssets, "testdata/report-assets", target)
	if err != nil {
		t.Fatalf("copy embedded report assets: %v", err)
	}

	raw, err := os.ReadFile(filepath.Join(target, "index.html"))
	if err != nil {
		t.Fatalf("read copied index.html: %v", err)
	}
	if !strings.Contains(string(raw), "Cairn test report asset") {
		t.Fatalf("copied index.html did not contain expected marker: %s", string(raw))
	}
}

func TestCopyEmbeddedReportAssetsRejectsEmptyTarget(t *testing.T) {
	t.Parallel()

	err := copyEmbeddedReportAssets(testReportAssets, "testdata/report-assets", "")
	if err == nil {
		t.Fatal("expected empty target directory to fail")
	}
	if !strings.Contains(err.Error(), "target directory is required") {
		t.Fatalf("expected target directory error, got %v", err)
	}
}

func TestCopyReportAssetsFallsBackToIndex(t *testing.T) {
	t.Parallel()

	target := t.TempDir()
	if err := copyReportAssets(target); err != nil {
		t.Fatalf("copy report assets: %v", err)
	}

	if _, err := os.Stat(filepath.Join(target, "index.html")); err != nil {
		t.Fatalf("expected fallback index.html: %v", err)
	}
}
