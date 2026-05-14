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

func assertNotContains(t *testing.T, haystack string, needle string) {
	t.Helper()
	if strings.Contains(haystack, needle) {
		t.Fatalf("expected content to not contain %q", needle)
	}
}

func assertNoEmoji(t *testing.T, content string) {
	t.Helper()
	for _, r := range content {
		if r >= 0x1F000 && r <= 0x1FAFF {
			t.Fatalf("expected content to contain no emoji codepoints, found %q", r)
		}
	}
}
