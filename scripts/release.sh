#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/release.sh <tag>

Builds and uploads Cairn release assets for a git tag.
If the GitHub release does not exist yet, it is created.

Example:
  scripts/release.sh v0.2.3
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

detect_repo() {
  if [ -n "${GH_REPO:-}" ]; then
    printf '%s\n' "${GH_REPO}"
    return 0
  fi

  local remote
  remote="$(git remote get-url origin)"
  remote="${remote%.git}"
  remote="${remote#git@github.com:}"
  remote="${remote#https://github.com/}"

  if [[ "${remote}" != */* ]]; then
    echo "Unable to detect GitHub repo from origin remote: ${remote}" >&2
    exit 1
  fi

  printf '%s\n' "${remote}"
}

WORKDIR=""

cleanup() {
  if [ -n "${WORKDIR}" ] && [ -d "${WORKDIR}" ]; then
    rm -rf "${WORKDIR}"
  fi
}

main() {
  if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
  fi

  if [ "$#" -ne 1 ]; then
    usage
    exit 1
  fi

  local tag="$1"
  if [[ "${tag}" != v* ]]; then
    echo "Tag must start with 'v' (got: ${tag})" >&2
    exit 1
  fi

  require_cmd git
  require_cmd go
  require_cmd gh
  require_cmd tar
  require_cmd mktemp

  if ! git rev-parse -q --verify "${tag}^{commit}" >/dev/null 2>&1; then
    echo "Tag not found locally: ${tag}" >&2
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
    exit 1
  fi

  local repo
  repo="$(detect_repo)"

  WORKDIR="$(mktemp -d)"
  trap cleanup EXIT

  git archive "${tag}" | tar -x -C "${WORKDIR}"

  cd "${WORKDIR}"
  mkdir -p dist

  local targets=(
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
    "windows/amd64"
    "windows/arm64"
  )

  local target goos goarch bin out_dir
  for target in "${targets[@]}"; do
    goos="${target%/*}"
    goarch="${target#*/}"
    bin="cairn"
    if [ "${goos}" = "windows" ]; then
      bin="cairn.exe"
    fi

    out_dir="build/${goos}-${goarch}"
    mkdir -p "${out_dir}"

    echo "Building ${goos}/${goarch}"
    GOOS="${goos}" GOARCH="${goarch}" CGO_ENABLED=0 \
      go build -trimpath -ldflags='-s -w' -o "${out_dir}/${bin}" ./

    tar -czf "dist/cairn-${goos}-${goarch}.tar.gz" -C "${out_dir}" "${bin}"
  done

  if gh release view "${tag}" --repo "${repo}" >/dev/null 2>&1; then
    echo "Release ${tag} already exists in ${repo}; uploading assets with --clobber"
  else
    echo "Release ${tag} does not exist in ${repo}; creating release"
    gh release create "${tag}" --repo "${repo}" --verify-tag --title "${tag}" --generate-notes
  fi

  gh release upload "${tag}" dist/*.tar.gz --repo "${repo}" --clobber

  echo
  echo "Release updated:"
  gh release view "${tag}" --repo "${repo}" --json url,assets \
    --jq '.url, "", "Assets:", (.assets[] | "- \(.name) (\(.size) bytes)")'
}

main "$@"
