# Cairn Web Report

TanStack Start + shadcn-style UI for Cairn report pages.

## Local dev

```bash
cd web
npm install
npm run dev
```

The app expects `history.ndjson` at the site root.

## Build

```bash
cd web
npm run build:pages
```

Build output for static hosting is written to `web/.output/public`.
`build:pages` also writes `index.html` and `404.html` so the result is deployable directly to `gh-pages`.
The Cairn GitHub Action copies this output into the target `gh-pages` branch.
