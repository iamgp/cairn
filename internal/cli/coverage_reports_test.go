package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCollectCoverageEntriesFromFilesLCOV(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "coverage.info")
	raw := "TN:\nSF:src/app.py\nFNF:4\nFNH:3\nBRF:10\nBRH:7\nLF:20\nLH:18\nend_of_record\n"
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatalf("write lcov file: %v", err)
	}

	entries, err := collectCoverageEntriesFromFiles([]collectCoverageFileInput{
		{scope: "overall", path: path},
	})
	if err != nil {
		t.Fatalf("collectCoverageEntriesFromFiles() unexpected error: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 coverage entries, got %d", len(entries))
	}
}

func TestCollectCoverageEntriesFromFilesCobertura(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "coverage.xml")
	raw := `<?xml version="1.0"?><coverage lines-covered="90" lines-valid="100" branches-covered="30" branches-valid="40"></coverage>`
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatalf("write cobertura file: %v", err)
	}

	entries, err := collectCoverageEntriesFromFiles([]collectCoverageFileInput{
		{scope: "check", checkID: "pytest", path: path},
	})
	if err != nil {
		t.Fatalf("collectCoverageEntriesFromFiles() unexpected error: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 coverage entries, got %d", len(entries))
	}
	for _, entry := range entries {
		if entry.scope != "check" || entry.checkID != "pytest" {
			t.Fatalf("unexpected scope mapping: %#v", entry)
		}
	}
}

func TestCollectCoverageEntriesFromFilesJaCoCo(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "jacoco.xml")
	raw := `<?xml version="1.0"?><report name="demo"><counter type="LINE" missed="10" covered="90"/><counter type="BRANCH" missed="4" covered="16"/><counter type="METHOD" missed="2" covered="8"/></report>`
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatalf("write jacoco file: %v", err)
	}

	entries, err := collectCoverageEntriesFromFiles([]collectCoverageFileInput{
		{scope: "overall", path: path},
	})
	if err != nil {
		t.Fatalf("collectCoverageEntriesFromFiles() unexpected error: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 coverage entries, got %d", len(entries))
	}
}
