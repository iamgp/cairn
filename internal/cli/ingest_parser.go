package cli

import (
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

var requiredIngestBlocks = []string{"project", "history", "pr_comment", "checkers"}

type parsedIngestBlocks struct {
	Project   projectBlock
	History   historyBlock
	PRComment prCommentBlock
	Checkers  checkersBlock
}

type projectBlock struct {
	Name string `toml:"name"`
}

type historyBlock struct {
	Entries []string `toml:"entries"`
	Notes   string   `toml:"notes"`
}

type prCommentBlock struct {
	Body string `toml:"body"`
}

type checkersBlock struct {
	Names   []string      `toml:"names"`
	Checker []checkerSpec `toml:"checker"`
}

type checkerSpec struct {
	Name string `toml:"name"`
}

func parseIngestBlocks(input string) (parsedIngestBlocks, error) {
	blocks, err := extractIngestBlocks(input)
	if err != nil {
		return parsedIngestBlocks{}, err
	}

	var parsed parsedIngestBlocks

	if err := decodeBlock(blocks["project"], "project", &parsed.Project); err != nil {
		return parsedIngestBlocks{}, err
	}
	if strings.TrimSpace(parsed.Project.Name) == "" {
		return parsedIngestBlocks{}, fmt.Errorf("project block is missing required field \"name\"")
	}

	if err := decodeBlock(blocks["history"], "history", &parsed.History); err != nil {
		return parsedIngestBlocks{}, err
	}
	if len(parsed.History.Entries) == 0 && strings.TrimSpace(parsed.History.Notes) == "" {
		return parsedIngestBlocks{}, fmt.Errorf("history block must include non-empty \"entries\" or \"notes\"")
	}

	if err := decodeBlock(blocks["pr_comment"], "pr_comment", &parsed.PRComment); err != nil {
		return parsedIngestBlocks{}, err
	}
	if strings.TrimSpace(parsed.PRComment.Body) == "" {
		return parsedIngestBlocks{}, fmt.Errorf("pr_comment block is missing required field \"body\"")
	}

	if err := decodeBlock(blocks["checkers"], "checkers", &parsed.Checkers); err != nil {
		return parsedIngestBlocks{}, err
	}
	if len(parsed.Checkers.Names) == 0 && len(parsed.Checkers.Checker) == 0 {
		return parsedIngestBlocks{}, fmt.Errorf("checkers block must include at least one checker via \"names\" or [[checker]]")
	}
	for i, checker := range parsed.Checkers.Checker {
		if strings.TrimSpace(checker.Name) == "" {
			return parsedIngestBlocks{}, fmt.Errorf("checkers block has [[checker]] entry %d missing required field \"name\"", i+1)
		}
	}

	return parsed, nil
}

func decodeBlock(raw string, blockName string, out any) error {
	if err := toml.Unmarshal([]byte(raw), out); err != nil {
		return fmt.Errorf("invalid TOML in %q block: %w", blockName, err)
	}
	return nil
}

func extractIngestBlocks(input string) (map[string]string, error) {
	blocks := make(map[string]string, len(requiredIngestBlocks))
	var blockName string
	var blockLines []string
	var blockStart int

	lines := strings.Split(input, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if blockName == "" {
			name, ok := parseFenceStart(trimmed)
			if !ok || !slices.Contains(requiredIngestBlocks, name) {
				continue
			}
			if _, exists := blocks[name]; exists {
				return nil, fmt.Errorf("duplicate %q block", name)
			}
			blockName = name
			blockStart = i + 1
			blockLines = blockLines[:0]
			continue
		}

		if strings.HasPrefix(trimmed, "```") {
			blocks[blockName] = strings.Join(blockLines, "\n")
			blockName = ""
			blockLines = blockLines[:0]
			continue
		}

		blockLines = append(blockLines, line)
	}

	if blockName != "" {
		return nil, fmt.Errorf("block %q is not closed (started at line %d)", blockName, blockStart)
	}

	var missing []string
	for _, name := range requiredIngestBlocks {
		if _, ok := blocks[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return nil, fmt.Errorf("missing required block(s): %s", strings.Join(missing, ", "))
	}

	return blocks, nil
}

func parseFenceStart(line string) (string, bool) {
	if !strings.HasPrefix(line, "```") {
		return "", false
	}
	name := strings.TrimSpace(strings.TrimPrefix(line, "```"))
	if name == "" {
		return "", false
	}
	return name, true
}
