package cli

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed web-assets/* fallback-assets/*
var reportAssets embed.FS

func copyReportAssets(targetDir string) error {
	if err := copyEmbeddedReportAssets(reportAssets, "web-assets", targetDir); err != nil {
		return err
	}

	indexPath := filepath.Join(strings.TrimSpace(targetDir), "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat report index: %w", err)
	}

	return copyEmbeddedReportAssets(reportAssets, "fallback-assets", targetDir)
}

func copyEmbeddedReportAssets(source fs.FS, sourceRoot string, targetDir string) error {
	targetDir = strings.TrimSpace(targetDir)
	if targetDir == "" {
		return fmt.Errorf("target directory is required")
	}

	return fs.WalkDir(source, sourceRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relative, err := filepath.Rel(sourceRoot, path)
		if err != nil {
			return fmt.Errorf("resolve asset path %q: %w", path, err)
		}
		if relative == "." {
			return nil
		}
		if relative == "keep.txt" {
			return nil
		}

		targetPath := filepath.Join(targetDir, relative)
		if entry.IsDir() {
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return fmt.Errorf("create asset directory %q: %w", targetPath, err)
			}
			return nil
		}

		raw, err := fs.ReadFile(source, path)
		if err != nil {
			return fmt.Errorf("read embedded asset %q: %w", path, err)
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return fmt.Errorf("create asset parent %q: %w", filepath.Dir(targetPath), err)
		}
		if err := os.WriteFile(targetPath, raw, 0o644); err != nil {
			return fmt.Errorf("write report asset %q: %w", targetPath, err)
		}

		return nil
	})
}
