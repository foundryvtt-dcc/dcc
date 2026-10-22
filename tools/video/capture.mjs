/* global game, CONFIG, document, window, requestAnimationFrame, Event, ui */
/**
 * Capture stage (docs/dev/VIDEO_PIPELINE.md): drive live Foundry through a
 * storyboard, record it with the CDP screencast, and write
 *   out/<id>/footage.mp4   constant-frame-rate footage
 *   out/<id>/timeline.json step times (ms from footage start) + boxes (CSS px)
 *
 * Usage: FOUNDRY_URL=http://localhost:30343 node capture.mjs storyboards/mighty-deeds.json
 *
 * Proof of concept: CDP screencast instead of Xvfb + x11grab, so it runs on
 * macOS. The screencast has no cursor, so the runner moves the real mouse
 * along eased paths and records them (timeline `pointer`); the compositor
 * draws the cursor.
 */
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setups, teardown, prepareStage } from './setups.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { login } = require('../../browser-tests/e2e/fixtures.js')

// prepareStage deletes every chat message, so never fall back to the live
// world on 30000 the way the specs do.
const foundryUrl = process.env.FOUNDRY_URL
if (!foundryUrl || new URL(foundryUrl).port === '30000') {
  console.error('Set FOUNDRY_URL to an isolated e2e:env server (pnpm run e2e:env status), not the live world on 30000.')
  process.exit(1)
}

// Foundry warns below 1024x768; 16:9 above that.
const VIEWPORT = { width: 1440, height: 810 }
const SCALE = 2
const FPS = 30
const MOVE_MS = 550 // one cursor glide

const storyboardPath = process.argv[2]
if (!storyboardPath) {
  console.error('Usage: node capture.mjs <storyboard.json>')
  process.exit(1)
}
const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'))
const outDir = path.join(here, 'out', storyboard.id)
const framesDir = path.join(outDir, 'frames')
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

const browser = await chromium.launch({
  args: process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: storyboard.theme ?? 'dark' })
const page = await context.newPage()
// Cursor path and clicks, in CSS px and wall-clock ms (rebased to the footage below).
const pointer = { samples: [], clicks: [] }
let mouse = { x: VIEWPORT.width * 0.42, y: VIEWPORT.height * 0.55 }
// When the current step's click glide began; the composed camera pans with it.
let actionAt = null

try {
  await login(page)
  await prepareStage(page)
  await setups[storyboard.setup](page)
  // Let the sidebar and chat settle before the first frame.
  await page.waitForFunction(() => document.querySelector('#chat')?.offsetParent !== null)

  const frames = []
  const cdp = await context.newCDPSession(page)
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `${String(frames.length).padStart(5, '0')}.jpg`
    frames.push({ file, ts: metadata.timestamp * 1000 })
    fs.writeFileSync(path.join(framesDir, file), Buffer.from(data, 'base64'))
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
  // The screencast only emits frames on repaint, so a still UI yields a
  // handful of frames and animations between them are lost. A 1px,
  // near-transparent ticker repainted every animation frame keeps it at the
  // display rate (x11grab capture would not need this).
  await page.evaluate(() => {
    const tick = document.createElement('div')
    tick.id = 'video-repaint-ticker'
    tick.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;z-index:99999;pointer-events:none'
    document.body.append(tick)
    let n = 0
    const loop = () => { tick.style.background = `rgba(0,0,0,${(n++ % 2) ? 0.01 : 0.02})`; requestAnimationFrame(loop) }
    loop()
  })
  await page.mouse.move(mouse.x, mouse.y)
  pointer.samples.push({ t: Date.now(), ...mouse })
  await page.waitForTimeout(300)

  const steps = []
  for (const step of storyboard.steps) {
    const start = Date.now()
    actionAt = null
    const clickBox = await runAction(page, step)
    await page.waitForTimeout(400) // let close/open animations finish before measuring
    const ready = Date.now() // the step's result is on screen; captions and camera key off this
    const boxes = await measure(page, step)
    const holdUntil = Date.now() + (step.hold ?? 3000)
    // Then point at what the step is about, beside it so the cursor doesn't
    // cover it (a click can leave it on top of the result it produced).
    if (boxes.spotlightBox) {
      await page.waitForTimeout(300)
      const b = boxes.spotlightBox
      await glide(page, b.x + b.width + 14, b.y + b.height * 0.7)
    }
    await page.waitForTimeout(Math.max(0, holdUntil - Date.now()))
    steps.push({ id: step.id, start, ready, end: Date.now(), caption: step.caption, frame: step.frame, zoom: step.zoom, clickBox, actionAt, ...boxes })
    console.log(`  ${step.id}: ${Date.now() - start} ms`)
  }

  await cdp.send('Page.stopScreencast')
  const endTs = Date.now()
  if (!frames.length) throw new Error('Screencast produced no frames')

  // Start the footage when the first step is ready (no empty stage while the
  // first sheet renders): drop earlier frames, pull the last one forward.
  const t0 = steps[0].ready
  const firstKept = Math.max(0, frames.findLastIndex(f => f.ts <= t0))
  frames.splice(0, firstKept)
  frames[0].ts = t0
  // Concat demuxer with per-frame durations → CFR mp4.
  const lines = frames.map((f, i) => {
    const next = frames[i + 1]?.ts ?? endTs
    return `file 'frames/${f.file}'\nduration ${((next - f.ts) / 1000).toFixed(4)}`
  })
  lines.push(`file 'frames/${frames.at(-1).file}'`)
  fs.writeFileSync(path.join(outDir, 'frames.txt'), lines.join('\n') + '\n')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
    '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', 'footage.mp4'],
  { cwd: outDir, stdio: 'inherit' })

  const timeline = {
    id: storyboard.id,
    title: storyboard.title,
    subtitle: storyboard.subtitle,
    endCard: storyboard.endCard,
    fps: FPS,
    viewport: VIEWPORT,
    scale: SCALE,
    durationMs: endTs - t0,
    steps: steps.map(s => ({ ...s, start: Math.max(0, s.start - t0), actionAt: s.actionAt && s.actionAt - t0, ready: s.ready - t0, end: s.end - t0 })),
    pointer: {
      samples: pointer.samples.map(p => ({ ...p, t: p.t - t0 })),
      clicks: pointer.clicks.map(c => ({ ...c, t: c.t - t0 }))
    }
  }
  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2))
  console.log(`Wrote ${frames.length} frames, ${(timeline.durationMs / 1000).toFixed(1)} s → ${path.relative(process.cwd(), outDir)}`)
} finally {
  await teardown(page).catch(e => {
    console.error(e.message)
    process.exitCode = 1
  })
  await browser.close()
}

/** Move the real mouse along an eased path, recording where it was and when. */
async function glide (page, x, y, ms = MOVE_MS) {
  const from = { ...mouse }
  const begin = Date.now()
  for (;;) {
    const t = Math.min(1, (Date.now() - begin) / ms)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    mouse = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e }
    await page.mouse.move(mouse.x, mouse.y)
    pointer.samples.push({ t: Date.now(), ...mouse })
    if (t === 1) return
    await new Promise(resolve => setTimeout(resolve, 12))
  }
}

/** Glide to the middle of a box and record a click there (the caller performs it). */
async function clickAt (page, box) {
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  actionAt ??= Date.now()
  await glide(page, x, y)
  await page.waitForTimeout(150)
  pointer.clicks.push({ t: Date.now(), x, y })
}

/** Run a step's action; returns the clicked element's box (CSS px), if it clicked. */
async function runAction (page, step) {
  const { action } = step
  const pinned = step.dice?.randomUniform
  if (pinned !== undefined) {
    await page.evaluate((u) => {
      window.__videoUniform = CONFIG.Dice.randomUniform
      CONFIG.Dice.randomUniform = () => u
    }, pinned)
  }
  const messagesBefore = await page.evaluate(() => game.messages.size)
  let clickBox = null
  try {
    switch (action.type) {
      case 'openActorSheet':
        await page.evaluate(async (name) => {
          const actor = game.actors.getName(name)
          await actor.sheet.render({ force: true })
          // Park the sheet left of the chat sidebar, where the compositor expects it.
          actor.sheet.setPosition({ left: 40, top: 30 })
        }, action.actor)
        await page.waitForSelector('.dcc.actor.sheet nav [data-tab]')
        break
      case 'click': {
        const target = page.locator(action.selector).first()
        await target.waitFor({ state: 'visible' })
        if (action.glide === false) {
          // Off-camera click: no cursor trip, so the composed camera stays put.
          await target.evaluate(el => el.click())
          break
        }
        clickBox = await target.boundingBox()
        await clickAt(page, clickBox)
        // In-page click: pointer clicks can hang on Foundry overlays (see TESTING.md).
        await target.evaluate(el => el.click())
        break
      }
      case 'none': // a beat that only points at what is already on screen
        break
      case 'openSelect': {
        // A native <select> popup is drawn outside the page, where the
        // screencast can't see it. Show its options in-page instead, as an
        // inline listbox (the card grows while it is open; floating it gets
        // clipped by the chat message).
        const target = page.locator(action.selector).first()
        await target.waitFor({ state: 'visible' })
        clickBox = await target.boundingBox()
        await clickAt(page, clickBox)
        await target.evaluate(sel => {
          game.tooltip.deactivate() // the select's hover hint would cover the list
          sel.dataset.videoTooltip = sel.dataset.tooltip ?? ''
          delete sel.dataset.tooltip
          sel.style.height = 'auto'
          sel.size = Math.min(sel.options.length, 8)
        })
        break
      }
      case 'selectOption': {
        const target = page.locator(action.selector).first()
        const optionBox = await target.evaluate((sel, label) => {
          const option = [...sel.options].find(o => o.textContent.trim() === label)
          const r = option.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        }, action.label)
        clickBox = optionBox
        await clickAt(page, optionBox)
        await target.evaluate((sel, label) => {
          sel.value = [...sel.options].find(o => o.textContent.trim() === label).value
          if (sel.size > 1) {
            sel.size = 0
            sel.style.height = ''
            sel.dataset.tooltip = sel.dataset.videoTooltip
          }
          sel.dispatchEvent(new Event('change', { bubbles: true }))
        }, action.label)
        if (action.awaitSelector) await page.waitForSelector(action.awaitSelector)
        break
      }
      case 'evaluate':
        await page.evaluate(action.script)
        break
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
    if (action.awaitChatMessage) {
      await page.waitForFunction((n) => game.messages.size > n && !!document.querySelector('#chat .chat-message:last-child .message-content'), messagesBefore, { timeout: 10000 })
      await page.evaluate(() => ui.chat.scrollBottom({ waitImages: true }))
    }
  } finally {
    if (pinned !== undefined) {
      await page.evaluate(() => { CONFIG.Dice.randomUniform = window.__videoUniform })
    }
  }
  return clickBox
}

/** Bounding boxes in CSS px: the step's frame region and its spotlight target. */
async function measure (page, step) {
  return page.evaluate(({ spotlight, frame }) => {
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const named = { sheet: '.dcc.actor.sheet', chat: '#chat .chat-message:last-child' }
    const frameEl = frame && frame !== 'full' ? document.querySelector(named[frame] ?? frame) : null
    return {
      frameBox: rect(frameEl),
      spotlightBox: spotlight ? rect(document.querySelector(spotlight)) : null
    }
  }, { spotlight: step.spotlight, frame: step.frame })
}
