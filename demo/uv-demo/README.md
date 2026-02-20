# UV Demo Project

This is a minimal Python demo project used to dogfood Cairn in this repository.

## Local run

```bash
uv sync --project demo/uv-demo --group dev
PYTHONPATH=demo/uv-demo/src uv run --project demo/uv-demo pytest --junitxml demo/uv-demo/pytest-junit.xml
PYTHONPATH=demo/uv-demo/src uv run --project demo/uv-demo ruff check demo/uv-demo/src --output-format json --output-file demo/uv-demo/ruff-results.json
go build -o ./bin/cairn ./
./bin/cairn collect --config demo/uv-demo/cairn.toml --out demo/uv-demo/run-record.json --matrix python=3.12
```
