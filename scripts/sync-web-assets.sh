#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${repo_root}/web"
npm ci --no-audit --no-fund
npm run build:pages

cd "${repo_root}"
mkdir -p internal/cli/web-assets
find internal/cli/web-assets -mindepth 1 ! -name 'keep.txt' -exec rm -rf {} +
cp -R web/.output/public/. internal/cli/web-assets/
