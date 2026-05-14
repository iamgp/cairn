# Cairn Adapters

Each `[[checkers]]` entry in `cairn.toml` uses an `adapter` to convert tool output into Cairn's run schema.

## `junit_xml`

Use for pytest or any JUnit-compatible XML output.

```toml
[[checkers]]
id = "pytest"
adapter = "junit_xml"
input = "pytest-{matrix.python}.xml"
```

## `ruff_json`

Use for `ruff check --output-format json` output.

```toml
[[checkers]]
id = "ruff"
adapter = "ruff_json"
input = "ruff-results.json"
```

## `ty_json`

Use for Ty's JSON output.

```toml
[[checkers]]
id = "ty"
adapter = "ty_json"
input = "ty-results.json"
```

## `go_test_json`

Use for `go test -json` output streams (works for both tests and compile/typecheck-only runs).

```toml
[[checkers]]
id = "go-test"
adapter = "go_test_json"
input = "go-test-results.json"
```

## `golangci_lint_json`

Use for golangci-lint JSON output.

```toml
[[checkers]]
id = "go-lint"
adapter = "golangci_lint_json"
input = "golangci-lint-results.json"
```

## `generic_json`

Use when your tool emits JSON but there is no dedicated built-in adapter.

```toml
[[checkers]]
id = "custom-tool"
adapter = "generic_json"
input = "custom-results.json"

[checkers.mapping]
status = "summary.status"
duration_s = "summary.duration_seconds"
items = "results"

[checkers.mapping.item]
id = "id"
status = "status"
duration_s = "duration_seconds"
message = "message"
stdout = "stdout"
stderr = "stderr"
tags = "labels"
```

## Mapping Notes

- Paths use dot notation, for example `summary.total`.
- Arrays are supported, for example `results[0].status`.
- Missing item IDs fall back to generated IDs (`item-N`).
- Missing check duration is computed as sum of item durations.

## Optional Checker Inputs

By default, missing checker input files fail collection. For matrix jobs or artifacts that
may legitimately be absent, set `required = false`.

```toml
[[checkers]]
id = "pytest-3.13"
adapter = "junit_xml"
input = "cairn-artifacts/pytest-3.13.xml"
required = false
missing_status = "skipped"
```

Supported `missing_status` values are `skipped`, `failed`, and `error`.
