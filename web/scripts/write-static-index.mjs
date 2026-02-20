import { promises as fs } from 'node:fs'
import path from 'node:path'

const publicDir = path.resolve(process.cwd(), '.output', 'public')

async function main() {
  const indexPath = path.join(publicDir, 'index.html')
  const html = await fs.readFile(indexPath, 'utf8')
  await fs.writeFile(path.join(publicDir, '404.html'), html, 'utf8')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
