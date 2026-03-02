# Cairn Collect + Ingest to gh-pages

Cairn is a composite GitHub Action that turns CI outputs into a historical report on `gh-pages`.

It can:
- collect check results from `cairn.toml`
- ingest run records into history
- build/publish static report assets
- deploy GitHub Pages
- post/update a PR summary comment

## Quickstart

```yaml
name: Cairn

on:
  push:
    branches: [main]
  pull_request:

jobs:
  cairn:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: iamgp/cairn@v0.2.1
        with:
          collect-config: cairn.toml
```

This is enough for the default flow: collect -> ingest -> build report -> push `gh-pages` -> deploy Pages.

## Common Usage

### 1) Collect from `cairn.toml`

```yaml
- uses: iamgp/cairn@v0.2.1
  with:
    collect-config: cairn.toml
    collect-args: >-
      --matrix python=3.12
```

### 2) Ingest a prebuilt run record

```yaml
- uses: iamgp/cairn@v0.2.1
  with:
    ingest-file: artifacts/cairn-run-record.json
```

### 3) Publish to a subdirectory (for previews)

```yaml
- uses: iamgp/cairn@v0.2.1
  with:
    collect-config: cairn.toml
    pages-subdir: previews/pr-${{ github.event.pull_request.number }}
```

### 4) Disable Pages deployment (ingest/build only)

```yaml
- uses: iamgp/cairn@v0.2.1
  with:
    collect-config: cairn.toml
    deploy-pages: "false"
```

### 5) Post PR comments as a bot/app account

```yaml
- uses: iamgp/cairn@v0.2.1
  with:
    collect-config: cairn.toml
    comment-token: ${{ secrets.CAIRN_COMMENT_TOKEN }}
```

Without `comment-token`, comments are posted as `github-actions[bot]`.

## Inputs

Primary inputs:

- `collect-config`: path to `cairn.toml` to run `cairn collect`
- `ingest-file`: path to an existing run record JSON
- `collect-args`: additional flags for `cairn collect`
- `collect-matrix-json`: JSON object to auto-append `--matrix` flags
- `pages-subdir`: publish under a subdirectory on `gh-pages`
- `deploy-pages`: `"true"` or `"false"` (default `"true"`)
- `post-pr-comment`: enable/disable PR comment step (default `"true"`)
- `comment-token`: optional token for PR comments

Advanced inputs:

- `gh-pages-branch` (default `gh-pages`)
- `cairn-version` (default `latest`)
- `cairn-path` (use a local/prebuilt binary instead of downloading release assets)
- `auto-tool-versions` and `auto-dependency-hashes` (both default `"true"`)
- `commit-message`
- `collect-out`

Full metadata and defaults: [action.yml](./action.yml)

## Required Permissions

Typical minimum permissions for full behavior:

```yaml
permissions:
  contents: write
  pages: write
  id-token: write
  pull-requests: write
```

If `deploy-pages: "false"`, `pages` and `id-token` are not required.
If `post-pr-comment: "false"`, `pull-requests` is not required.

## Configuration File

`collect-config` points to `cairn.toml`, which supports:

- `[project]` metadata
- `[history]` pruning policy (`max_days`, `max_runs`)
- `[pr_comment]` rendering toggles
- `[[checkers]]` adapter definitions

Adapter mappings/examples: [docs/adapters.md](./docs/adapters.md)

## Releases

Cairn release assets must be named `cairn-<os>-<arch>.tar.gz`.
The action downloads these assets when `cairn-path` is not provided.

## Marketplace Note

This repository intentionally keeps workflow examples in `docs/workflows/*.example.yml`.
GitHub Marketplace action repositories cannot contain active workflow files under `.github/workflows/`.
