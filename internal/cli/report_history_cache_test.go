package cli

import (
	"strings"
	"testing"
)

func TestReportShellIncludesHistoryRangeCacheLoading(t *testing.T) {
	t.Parallel()

	content := buildReportShellHTML()

	needles := []string{
		`const historyCacheRawKey = "cairn:history:raw"`,
		`const historyCacheETagKey = "cairn:history:etag"`,
		`const historyCacheSizeKey = "cairn:history:size"`,
		`"If-Range": cached.etag`,
		`Range: "bytes=" + cached.size + "-"`,
		`if (incrementalResponse.status === 206)`,
		`if (incrementalResponse.ok)`,
		`writeHistoryCache(fullRaw, fullEtag)`,
	}
	for _, needle := range needles {
		if !strings.Contains(content, needle) {
			t.Fatalf("expected report shell to contain %q", needle)
		}
	}
}
