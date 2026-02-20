package cli

import (
	"strings"
	"testing"
)

func assertContains(t *testing.T, haystack string, needle string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Fatalf("expected content to contain %q", needle)
	}
}
