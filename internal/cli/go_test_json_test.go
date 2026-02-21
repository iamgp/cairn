package cli

import (
	"strings"
	"testing"
)

func TestParseGoTestJSON(t *testing.T) {
	t.Parallel()

	raw := []byte(strings.Join([]string{
		`{"Action":"run","Package":"example.com/repo/internal/cli","Test":"TestCollect"}`,
		`{"Action":"pass","Package":"example.com/repo/internal/cli","Test":"TestCollect","Elapsed":0.01}`,
		`{"Action":"run","Package":"example.com/repo/internal/cli","Test":"TestParse"}`,
		`{"Action":"fail","Package":"example.com/repo/internal/cli","Test":"TestParse","Elapsed":0.02}`,
		`{"Action":"pass","Package":"example.com/repo/internal/cli","Elapsed":0.03}`,
	}, "\n"))

	check, err := parseGoTestJSON(raw)
	if err != nil {
		t.Fatalf("parseGoTestJSON() unexpected error: %v", err)
	}

	if check.Tool != "go test" {
		t.Fatalf("expected tool go test, got %q", check.Tool)
	}
	if check.Status != "failed" {
		t.Fatalf("expected failed status, got %q", check.Status)
	}
	if check.Summary["passed"] != 2 || check.Summary["failed"] != 1 {
		t.Fatalf("unexpected summary: %#v", check.Summary)
	}
	if len(check.Items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(check.Items))
	}
	if check.Items[0].ID != "example.com/repo/internal/cli::TestCollect" || check.Items[0].Status != "passed" {
		t.Fatalf("unexpected first item: %#v", check.Items[0])
	}
	if check.Items[1].ID != "example.com/repo/internal/cli::TestParse" || check.Items[1].Status != "failed" {
		t.Fatalf("unexpected second item: %#v", check.Items[1])
	}
	if check.Items[2].ID != "example.com/repo/internal/cli" || check.Items[2].Status != "passed" {
		t.Fatalf("unexpected third item: %#v", check.Items[2])
	}
	if len(check.Items[2].Tags) != 1 || check.Items[2].Tags[0] != "scope:package" {
		t.Fatalf("unexpected third item tags: %#v", check.Items[2].Tags)
	}
}

func TestParseGoTestJSONAllSkipped(t *testing.T) {
	t.Parallel()

	raw := []byte(`{"Action":"skip","Package":"example.com/repo/internal/cli","Test":"TestSkipped","Elapsed":0.01}`)

	check, err := parseGoTestJSON(raw)
	if err != nil {
		t.Fatalf("parseGoTestJSON() unexpected error: %v", err)
	}
	if check.Status != "skipped" {
		t.Fatalf("expected skipped status, got %q", check.Status)
	}
	if check.Summary["skipped"] != 1 {
		t.Fatalf("unexpected summary: %#v", check.Summary)
	}
}

func TestParseGoTestJSONInvalid(t *testing.T) {
	t.Parallel()

	_, err := parseGoTestJSON([]byte("{"))
	if err == nil {
		t.Fatal("expected decode error")
	}
}
