# Cairn

Cairn is a Go CLI and reusable GitHub Action for ingesting check results, preserving long-term run history, and publishing report data to `gh-pages`.

## What It Includes

- CLI commands: `collect`, `ingest`, `comment`, `prune`, `init`
- Built-in adapters: `junit_xml`, `ruff_json`, `ty_json`, `go_test_json`, `golangci_lint_json`, `generic_json`
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

To post PR comments as a dedicated bot/app account (for example `Cairn`), pass `comment-token` with that account's token. Without it, comments are posted as `github-actions[bot]`.

Phase-2 evidence flags (`--requirement-id`, `--artifact`, `--coverage`) and Phase-1 provenance flags (`--tool-version`, `--dependency-hash`) can be captured directly in `collect`.
Coverage can also be ingested from reports with `--coverage-file` (LCOV, Cobertura XML, or JaCoCo XML).

## Configuration

`cairn.toml` supports:

- `[project]` metadata
- `[history]` retention policy (`max_days`, `max_runs`) consumed by `cairn prune` and applied automatically by the composite action after ingest
- `[pr_comment]` PR summary toggles (`enabled`, `show_coverage`, `show_per_matrix`) used by the composite action comment step
- `[[checkers]]` adapter configuration

Adapter details and mapping examples are in `docs/adapters.md`.

## Release Process

1. Build release archives:

   ```bash
   mkdir -p dist
   for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64; do
     GOOS="${target%/*}"
     GOARCH="${target#*/}"
     bin_name="cairn"
     [ "${GOOS}" = "windows" ] && bin_name="cairn.exe"
     out_dir="build/${GOOS}-${GOARCH}"
     mkdir -p "${out_dir}"
     GOOS="${GOOS}" GOARCH="${GOARCH}" CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o "${out_dir}/${bin_name}" ./
     tar -czf "dist/cairn-${GOOS}-${GOARCH}.tar.gz" -C "${out_dir}" "${bin_name}"
   done
   ```

2. Tag and publish:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   gh release create v0.2.0 dist/*.tar.gz --generate-notes
   ```

Release assets must be named `cairn-<os>-<arch>.tar.gz` to match what `action.yml` downloads.

## Marketplace Publishing

GitHub Marketplace requires action repositories to not contain workflow files under `.github/workflows/`.
For this reason, this repository keeps workflow examples in `docs/workflows/*.example.yml` instead of active workflow files.

## Rich UI Development

```bash
cd web
npm install
npm run dev
```

For publishing, the composite action builds `web/.output/public` and copies it to the target `gh-pages` branch.
