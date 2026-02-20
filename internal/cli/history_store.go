package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func appendRunRecord(pagesDir string, run Run) error {
	if strings.TrimSpace(pagesDir) == "" {
		return fmt.Errorf("pages-dir is required")
	}
	if err := validateRunSchemaVersion(run.Version); err != nil {
		return err
	}

	historyPath := filepath.Join(pagesDir, "history.ndjson")
	file, err := os.OpenFile(historyPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open history file: %w", err)
	}
	defer file.Close()

	line, err := json.Marshal(run)
	if err != nil {
		return fmt.Errorf("marshal run record: %w", err)
	}

	line = append(line, '\n')
	if _, err := file.Write(line); err != nil {
		return fmt.Errorf("append run record: %w", err)
	}

	return nil
}

func validateRunSchemaVersion(version int) error {
	if version != runSchemaVersion {
		return fmt.Errorf("unsupported run schema version %d, expected %d", version, runSchemaVersion)
	}
	return nil
}
