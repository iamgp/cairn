# Cairn

Cairn is a Go CLI and reusable GitHub Action for ingesting check results, preserving long-term run history, and publishing report data to `gh-pages`.

## What It Includes

- CLI commands: `collect`, `ingest`, `comment`, `prune`, `init`
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
   jobs:
     cairn:
       runs-on: ubuntu-latest
       permissions:
         contents: write
         pages: write
         id-token: write
       steps:
         - uses: iamgp/cairn@v0.1.0
           with:
             collect-config: cairn.toml
             collect-args: >-
               --matrix python=3.12
   ```

By default, the action collects the run record, ingests history, builds the web report, pushes `gh-pages`, and deploys Pages in one step. It also auto-detects common tool versions and hashes common lockfiles. Set `deploy-pages: "false"` if you only want collect/ingest/build/push behavior.

Phase-2 evidence flags (`--requirement-id`, `--artifact`, `--coverage`) and Phase-1 provenance flags (`--tool-version`, `--dependency-hash`) can be captured directly in `collect`.
Coverage can also be ingested from reports with `--coverage-file` (LCOV, Cobertura XML, or JaCoCo XML).

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
