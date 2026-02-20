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
