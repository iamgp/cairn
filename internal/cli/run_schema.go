package cli

import "time"

// Run is one CI workflow execution for a commit.
type Run struct {
	Version   int               `json:"v"`
	RunID     string            `json:"run_id"`
	SHA       string            `json:"sha"`
	SHAFull   string            `json:"sha_full"`
	PR        *int              `json:"pr,omitempty"`
	Branch    string            `json:"branch"`
	Timestamp time.Time         `json:"timestamp"`
	Matrix    map[string]string `json:"matrix,omitempty"`
	Checks    []Check           `json:"checks"`
}

// Check is one tool result inside a run.
type Check struct {
	Tool      string         `json:"tool"`
	Status    string         `json:"status"`
	DurationS float64        `json:"duration_s"`
	Summary   map[string]int `json:"summary,omitempty"`
	Items     []Item         `json:"items"`
}

// Item is the finest-grained result for a check.
type Item struct {
	ID        string   `json:"id"`
	Status    string   `json:"status"`
	DurationS float64  `json:"duration_s"`
	Stdout    string   `json:"stdout,omitempty"`
	Stderr    string   `json:"stderr,omitempty"`
	Message   string   `json:"message,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}
