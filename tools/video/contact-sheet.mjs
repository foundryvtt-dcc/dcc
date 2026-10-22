/**
 * QA stage: one still per step (just before the step ends) from a video,
 * tiled into contact-sheet.png for review before anyone watches the video.
 *
 * Usage: node contact-sheet.mjs <id> [video]   (video defaults to footage.mp4)
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [id, videoName = 'footage.mp4'] = process.argv.slice(2)
const outDir = path.join(here, 'out', id)
const timeline = JSON.parse(fs.readFileSync(path.join(outDir, 'timeline.json'), 'utf8'))
const video = path.join(outDir, videoName)
// A composed short is offset by its title card; the timeline records that.
const offsetMs = videoName === 'footage.mp4' ? 0 : (timeline.composeOffsetMs ?? 0)

const stillsDir = path.join(outDir, 'stills')
fs.rmSync(stillsDir, { recursive: true, force: true })
fs.mkdirSync(stillsDir)

const stills = timeline.steps.map((step, i) => {
  const file = path.join(stillsDir, `${String(i).padStart(2, '0')}-${step.id}.png`)
  const at = (offsetMs + step.end - 300) / 1000
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', at.toFixed(3), '-i', video, '-frames:v', '1', '-vf', 'scale=-2:720', file])
  return file
})

const name = videoName === 'footage.mp4' ? 'contact-sheet.png' : `contact-sheet-${path.parse(videoName).name}.png`
const inputs = stills.flatMap(f => ['-i', f])
const cols = Math.min(stills.length, videoName === 'footage.mp4' ? 2 : 4)
const layout = stills.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, (_, k) => `w${k}`).join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, k) => `h${k}`).join('+') : '0'}`).join('|')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `xstack=inputs=${stills.length}:layout=${layout}:fill=black`, path.join(outDir, name)])
console.log(path.join(outDir, name))
