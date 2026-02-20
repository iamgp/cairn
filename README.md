# Cairn

Cairn is a Go CLI and reusable GitHub Action for ingesting check results, preserving long-term run history, and publishing report data to `gh-pages`.

## What It Includes

- CLI commands: `collect`, `ingest`, `report`, `comment`, `prune`, `init`
- Built-in adapters: `junit_xml`, `ruff_json`, `ty_json`, `generic_json`
- Composite action in `action.yml` for CI ingestion into `gh-pages`
- Rich report frontend in `web/` (TanStack Start + shadcn-style components)

## Quickstart

1. Install the CLI locally:

   ```bash
   go install github.com/iamgp/cairn@latest
   ```

2. Scaffold project files:

   ```bash
   cairn init
   ```

3. Commit generated files (`cairn.toml`, `README.md`, `docs/adapters.md`, `.github/workflows/cairn.yml`) and adapt checker inputs to your repository.

4. Use the reusable action in your workflow:

   ```yaml
   - run: cairn collect --config cairn.toml --out run-record.json
   - uses: iamgp/cairn@v0.1.0
     with:
       ingest-file: run-record.json
   ```

## Configuration

`cairn.toml` supports:

- `[project]` metadata
- `[history]` pruning policy
- `[pr_comment]` PR summary rendering toggles
- `[[checkers]]` adapter configuration

Adapter details and mapping examples are in `docs/adapters.md`.

## Release Process

This repo includes `.github/workflows/release.yml`.

1. Tag a release:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. The workflow cross-compiles and uploads release assets named `cairn-<os>-<arch>.tar.gz`.

Those asset names match what `action.yml` downloads.

## Rich UI Development

```bash
cd web
npm install
npm run dev
```

For publishing, the composite action builds `web/.output/public` and copies it to the target `gh-pages` branch.
