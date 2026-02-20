import { promises as fs } from 'node:fs'
import path from 'node:path'

const publicDir = path.resolve(process.cwd(), '.output', 'public')
const assetsDir = path.join(publicDir, 'assets')

async function main() {
  const assets = await fs.readdir(assetsDir)

  const mainJs = assets.find((name) => /^main-.*\.js$/.test(name))
  const stylesCss = assets.find((name) => /^styles-.*\.css$/.test(name))

  if (!mainJs) {
    throw new Error('Unable to locate main-*.js in .output/public/assets')
  }

  if (!stylesCss) {
    throw new Error('Unable to locate styles-*.css in .output/public/assets')
  }

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>Cairn Report</title>',
    `  <link rel="stylesheet" href="./assets/${stylesCss}" />`,
    '</head>',
    '<body>',
    '  <noscript>Cairn report requires JavaScript to run.</noscript>',
    `  <script type="module" src="./assets/${mainJs}"></script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')

  await fs.writeFile(path.join(publicDir, 'index.html'), html, 'utf8')
  await fs.writeFile(path.join(publicDir, '404.html'), html, 'utf8')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
