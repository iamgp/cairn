package cli

import "time"

const runSchemaVersion = 1

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
	Metadata  *RunMetadata      `json:"metadata,omitempty"`
	Checks    []Check           `json:"checks"`
}

type RunMetadata struct {
	Environment     *RunEnvironmentMetadata     `json:"environment,omitempty"`
	Actor           *RunActorMetadata           `json:"actor,omitempty"`
	Reproducibility *RunReproducibilityMetadata `json:"reproducibility,omitempty"`
	Traceability    *RunTraceabilityMetadata    `json:"traceability,omitempty"`
	Provenance      *RunProvenanceMetadata      `json:"provenance,omitempty"`
	Coverage        *RunCoverageMetadata        `json:"coverage,omitempty"`
}

type RunEnvironmentMetadata struct {
	CI         *bool  `json:"ci,omitempty"`
	Provider   string `json:"provider,omitempty"`
	Repository string `json:"repository,omitempty"`
	Workflow   string `json:"workflow,omitempty"`
	Job        string `json:"job,omitempty"`
	RunnerOS   string `json:"runner_os,omitempty"`
	RunnerArch string `json:"runner_arch,omitempty"`
}

type RunActorMetadata struct {
	Login           string `json:"login,omitempty"`
	ID              string `json:"id,omitempty"`
	TriggeringLogin string `json:"triggering_login,omitempty"`
}

type RunReproducibilityMetadata struct {
	ToolVersions     map[string]string `json:"tool_versions,omitempty"`
	DependencyHashes map[string]string `json:"dependency_hashes,omitempty"`
	ConfigSHA256     string            `json:"config_sha256,omitempty"`
}

type RunTraceabilityMetadata struct {
	RequirementIDs []string `json:"requirement_ids,omitempty"`
	SpecIDs        []string `json:"spec_ids,omitempty"`
	RiskIDs        []string `json:"risk_ids,omitempty"`
	CommitMessage  string   `json:"commit_message,omitempty"`
}

type RunProvenanceMetadata struct {
	Artifacts []RunProvenanceArtifact `json:"artifacts,omitempty"`
}

type RunProvenanceArtifact struct {
	Path      string `json:"path,omitempty"`
	Role      string `json:"role,omitempty"`
	SHA256    string `json:"sha256,omitempty"`
	SizeBytes int64  `json:"size_bytes,omitempty"`
	MimeType  string `json:"mime_type,omitempty"`
}

type RunCoverageMetadata struct {
	Overall  *RunCoverageMetricsMap           `json:"overall,omitempty"`
	PerCheck map[string]RunCoverageMetricsMap `json:"per_check,omitempty"`
}

type RunCoverageMetricsMap struct {
	Line     *RunCoverageMetric `json:"line,omitempty"`
	Branch   *RunCoverageMetric `json:"branch,omitempty"`
	Function *RunCoverageMetric `json:"function,omitempty"`
}

type RunCoverageMetric struct {
	Covered int     `json:"covered"`
	Total   int     `json:"total"`
	Percent float64 `json:"percent"`
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
	ID        string        `json:"id"`
	Status    string        `json:"status"`
	DurationS float64       `json:"duration_s"`
	Stdout    string        `json:"stdout,omitempty"`
	Stderr    string        `json:"stderr,omitempty"`
	Message   string        `json:"message,omitempty"`
	Trace     string        `json:"trace,omitempty"`
	Tags      []string      `json:"tags,omitempty"`
	Source    *ItemSource   `json:"source,omitempty"`
	Suite     string        `json:"suite,omitempty"`
}

// ItemSource is the file location associated with a test or diagnostic.
type ItemSource struct {
	File   string `json:"file,omitempty"`
	Line   int    `json:"line,omitempty"`
	Column int    `json:"column,omitempty"`
}
