/**
 * Compose stage: render out/<id>/footage.mp4 + timeline.json into a 9:16
 * short with Remotion (remotion/Short.jsx).
 *
 * Usage: node compose.mjs <id>
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TITLE_MS = 2200 // keep in step with remotion/Short.jsx

const here = path.dirname(fileURLToPath(import.meta.url))
const id = process.argv[2]
if (!id) {
  console.error('Usage: node compose.mjs <id>')
  process.exit(1)
}
const outDir = path.join(here, 'out', id)
const timelinePath = path.join(outDir, 'timeline.json')
const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'))

// The contact sheet uses this to find step boundaries in the composed short.
timeline.composeOffsetMs = TITLE_MS
fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2))

// The system's own fonts, served from the Remotion public dir.
const fontsDir = path.join(outDir, 'fonts')
fs.mkdirSync(fontsDir, { recursive: true })
for (const font of ['DuvallBold.otf', 'DuvallSmallCapsBold.otf']) {
  fs.copyFileSync(path.join(here, '../../styles/fonts', font), path.join(fontsDir, font))
}

const propsPath = path.join(outDir, 'props.json')
fs.writeFileSync(propsPath, JSON.stringify({ timeline }))
execFileSync('pnpm', ['exec', 'remotion', 'render', 'remotion/index.jsx', 'Short', path.join(outDir, 'short.mp4'),
  `--props=${propsPath}`, `--public-dir=${outDir}`, '--codec=h264', '--crf=18'],
{ cwd: here, stdio: 'inherit' })
console.log(path.join(outDir, 'short.mp4'))
