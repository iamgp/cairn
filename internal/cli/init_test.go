package cli

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitCommandScaffoldsDefaults(t *testing.T) {
	dir := t.TempDir()
	originalWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("change to temp dir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(originalWD)
	})

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"init"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute init: %v", err)
	}

	cairnToml, err := os.ReadFile(filepath.Join(dir, "cairn.toml"))
	if err != nil {
		t.Fatalf("read cairn.toml: %v", err)
	}
	if string(cairnToml) != defaultCairnToml {
		t.Fatalf("unexpected cairn.toml contents:\n%s", string(cairnToml))
	}

	readme, err := os.ReadFile(filepath.Join(dir, "README.md"))
	if err != nil {
		t.Fatalf("read README.md: %v", err)
	}
	if string(readme) != defaultReadme {
		t.Fatalf("unexpected README.md contents:\n%s", string(readme))
	}
	if !strings.Contains(string(readme), "--requirement-id") {
		t.Fatalf("expected README.md to include --requirement-id example")
	}
	if !strings.Contains(string(readme), "--artifact") {
		t.Fatalf("expected README.md to include --artifact example")
	}
	if !strings.Contains(string(readme), "--coverage") {
		t.Fatalf("expected README.md to include --coverage example")
	}
	if !strings.Contains(string(readme), "--coverage-file") {
		t.Fatalf("expected README.md to include --coverage-file mention")
	}

	adapters, err := os.ReadFile(filepath.Join(dir, "docs", "adapters.md"))
	if err != nil {
		t.Fatalf("read docs/adapters.md: %v", err)
	}
	if string(adapters) != defaultAdaptersDoc {
		t.Fatalf("unexpected docs/adapters.md contents:\n%s", string(adapters))
	}

	workflow, err := os.ReadFile(filepath.Join(dir, ".github", "workflows", "cairn.yml"))
	if err != nil {
		t.Fatalf("read workflow: %v", err)
	}
	if string(workflow) != defaultCairnWorkflow {
		t.Fatalf("unexpected workflow contents:\n%s", string(workflow))
	}
	if !strings.Contains(string(workflow), "collect-config: cairn.toml") {
		t.Fatalf("expected workflow to use collect-config")
	}
	if !strings.Contains(string(workflow), "--matrix python=3.12") {
		t.Fatalf("expected workflow to include matrix collect args")
	}
}

func TestInitCommandWarnsAndSkipsExistingFiles(t *testing.T) {
	dir := t.TempDir()
	originalWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("change to temp dir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(originalWD)
	})

	existingToml := []byte("existing toml\n")
	if err := os.WriteFile("cairn.toml", existingToml, 0o644); err != nil {
		t.Fatalf("write existing cairn.toml: %v", err)
	}
	existingReadme := []byte("existing readme\n")
	if err := os.WriteFile("README.md", existingReadme, 0o644); err != nil {
		t.Fatalf("write existing README.md: %v", err)
	}
	if err := os.MkdirAll("docs", 0o755); err != nil {
		t.Fatalf("create docs dir: %v", err)
	}
	existingAdapters := []byte("existing adapters\n")
	adaptersPath := filepath.Join("docs", "adapters.md")
	if err := os.WriteFile(adaptersPath, existingAdapters, 0o644); err != nil {
		t.Fatalf("write existing docs/adapters.md: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(".github", "workflows"), 0o755); err != nil {
		t.Fatalf("create workflow dir: %v", err)
	}
	existingWorkflow := []byte("existing workflow\n")
	workflowPath := filepath.Join(".github", "workflows", "cairn.yml")
	if err := os.WriteFile(workflowPath, existingWorkflow, 0o644); err != nil {
		t.Fatalf("write existing workflow: %v", err)
	}

	stderr := captureStderr(t, func() {
		cmd := NewRootCommand()
		cmd.SetArgs([]string{"init"})
		if err := cmd.Execute(); err != nil {
			t.Fatalf("execute init: %v", err)
		}
	})

	if !strings.Contains(stderr, "warning: cairn.toml already exists; skipping") {
		t.Fatalf("missing existing cairn.toml warning: %q", stderr)
	}
	if !strings.Contains(stderr, "warning: README.md already exists; skipping") {
		t.Fatalf("missing existing README.md warning: %q", stderr)
	}
	if !strings.Contains(stderr, "warning: docs/adapters.md already exists; skipping") {
		t.Fatalf("missing existing docs/adapters.md warning: %q", stderr)
	}
	if !strings.Contains(stderr, "warning: .github/workflows/cairn.yml already exists; skipping") {
		t.Fatalf("missing existing workflow warning: %q", stderr)
	}

	gotToml, err := os.ReadFile("cairn.toml")
	if err != nil {
		t.Fatalf("read cairn.toml: %v", err)
	}
	if !bytes.Equal(gotToml, existingToml) {
		t.Fatalf("expected existing cairn.toml to be preserved")
	}

	gotReadme, err := os.ReadFile("README.md")
	if err != nil {
		t.Fatalf("read README.md: %v", err)
	}
	if !bytes.Equal(gotReadme, existingReadme) {
		t.Fatalf("expected existing README.md to be preserved")
	}

	gotAdapters, err := os.ReadFile(adaptersPath)
	if err != nil {
		t.Fatalf("read docs/adapters.md: %v", err)
	}
	if !bytes.Equal(gotAdapters, existingAdapters) {
		t.Fatalf("expected existing docs/adapters.md to be preserved")
	}

	gotWorkflow, err := os.ReadFile(workflowPath)
	if err != nil {
		t.Fatalf("read workflow: %v", err)
	}
	if !bytes.Equal(gotWorkflow, existingWorkflow) {
		t.Fatalf("expected existing workflow to be preserved")
	}
}

func TestInitCommandRejectsArguments(t *testing.T) {
	t.Parallel()

	cmd := NewRootCommand()
	cmd.SetArgs([]string{"init", "extra"})

	err := cmd.Execute()
	if err == nil {
		t.Fatal("expected init argument error")
	}
	if !strings.Contains(err.Error(), "init does not accept arguments") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func captureStderr(t *testing.T, fn func()) string {
	t.Helper()

	original := os.Stderr
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("create stderr pipe: %v", err)
	}
	os.Stderr = w

	done := make(chan string, 1)
	go func() {
		data, _ := io.ReadAll(r)
		done <- string(data)
	}()

	fn()

	_ = w.Close()
	os.Stderr = original
	return <-done
}
