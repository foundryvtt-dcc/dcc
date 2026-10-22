/* global FontFace, document */
import {
  AbsoluteFill, Easing, OffthreadVideo, Sequence, continueRender, delayRender,
  interpolate, staticFile, useCurrentFrame, useVideoConfig
} from 'remotion'

const WIDTH = 1080
const STAGE = { top: 300, bottom: 1440, margin: 40 } // where the footage camera frames its subject
const MAX_ZOOM = 1.5 // footage pixels → output pixels; above this the 2x capture goes soft
const TITLE_MS = 2200
const MOVE_FRAMES = 18
const GOLD = '#f2c14e'

const fontHandle = delayRender('Loading fonts')
Promise.all([
  new FontFace('Duvall', `url(${staticFile('fonts/DuvallBold.otf')})`).load(),
  new FontFace('DuvallSmallCaps', `url(${staticFile('fonts/DuvallSmallCapsBold.otf')})`).load()
]).then(faces => {
  faces.forEach(f => document.fonts.add(f))
  continueRender(fontHandle)
}).catch(() => continueRender(fontHandle))

export function shortDuration (timeline) {
  const ms = TITLE_MS + timeline.durationMs + (timeline.endCard?.seconds ?? 0) * 1000
  return Math.ceil(ms / 1000 * timeline.fps)
}

/** Camera for one step: zoom and the footage point (px) to put at the stage centre. */
function stepCamera (step, timeline) {
  const s = timeline.scale
  const box = step.frameBox ?? { x: 0, y: 0, width: timeline.viewport.width, height: timeline.viewport.height }
  const pad = 12
  const w = (box.width + pad * 2) * s
  const h = (box.height + pad * 2) * s
  const fit = Math.min(MAX_ZOOM, (WIDTH - STAGE.margin * 2) / w, (STAGE.bottom - STAGE.top) / h)
  const cx = (box.x + box.width / 2) * s
  const cy = (box.y + box.height / 2) * s
  if (!step.zoom || !step.spotlightBox) return { zoom: fit, cx, cy }
  // Zoom past the fit: centre on the spotlight, but keep the crop inside the frame.
  const zoom = Math.min(MAX_ZOOM, step.zoom)
  const halfW = WIDTH / 2 / zoom
  const spotX = (step.spotlightBox.x + step.spotlightBox.width / 2) * s
  const lo = (box.x - pad) * s + halfW
  const hi = (box.x + box.width + pad) * s - halfW
  return { zoom, cx: lo > hi ? cx : Math.min(hi, Math.max(lo, spotX)), cy }
}

/**
 * Camera while a step's action runs: hold the previous shot, panned just
 * enough to bring the click target into view, so the cursor is seen clicking.
 */
function actionCamera (step, prev, timeline) {
  if (!step.clickBox) return prev
  const s = timeline.scale
  const px = (step.clickBox.x + step.clickBox.width / 2) * s
  const py = (step.clickBox.y + step.clickBox.height / 2) * s
  const margin = 140 / prev.zoom
  const halfW = WIDTH / 2 / prev.zoom - margin
  const halfH = (STAGE.bottom - STAGE.top) / 2 / prev.zoom - margin
  const clamp = (c, p, half) => Math.min(p + half, Math.max(p - half, c))
  return { zoom: prev.zoom, cx: clamp(prev.cx, px, halfW), cy: clamp(prev.cy, py, halfH) }
}

function useCamera (timeline, ms, fps) {
  const { steps } = timeline
  let i = steps.findIndex(st => ms < st.end)
  if (i === -1) i = steps.length - 1
  const step = steps[i]
  const result = stepCamera(step, timeline)
  const prev = i > 0 ? stepCamera(steps[i - 1], timeline) : result
  const action = actionCamera(step, prev, timeline)
  const ease = (from) => interpolate((ms - from) / 1000 * fps, [0, MOVE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)
  })
  // Long moves pull back mid-pan, so the viewer sees where the camera is going
  // instead of a whip across empty canvas.
  const mix = (a, b, t) => {
    const dip = Math.min(0.4, Math.hypot(b.cx - a.cx, b.cy - a.cy) / 5000) * Math.sin(Math.PI * t)
    return { zoom: (a.zoom + (b.zoom - a.zoom) * t) * (1 - dip), cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t }
  }
  // Pan to the click target as the step starts, then arrive on the result as it lands.
  const cam = mix(mix(prev, action, ease(step.start)), result, ease(step.ready - MOVE_FRAMES / fps * 1000))
  return { index: i, ...cam }
}

/** Cursor position (CSS px) at ms, interpolated along the recorded path. */
function pointerAt (samples, ms) {
  if (!samples?.length) return null
  if (ms <= samples[0].t) return samples[0]
  const j = samples.findIndex(p => p.t > ms)
  if (j === -1) return samples.at(-1)
  const a = samples[j - 1]
  const b = samples[j]
  const t = (ms - a.t) / (b.t - a.t || 1)
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

const CURSOR_PATH = 'M0 0 L0 23 L6 17.5 L10.5 27 L14.5 25.2 L10 16 L17.5 16 Z'

const Cursor = ({ timeline, ms, left, top, zoom }) => {
  const at = pointerAt(timeline.pointer?.samples, ms)
  if (!at) return null
  const k = timeline.scale * zoom
  const x = left + at.x * k
  const y = top + at.y * k
  const size = 1.15 * k // the cursor scales with the footage, like a real one
  const ripples = (timeline.pointer.clicks ?? []).filter(c => ms >= c.t && ms < c.t + 500)
  return (
    <>
      {ripples.map(c => {
        const p = (ms - c.t) / 500
        const r = 14 * k * (0.4 + p)
        return (
          <div
            key={c.t} style={{
              position: 'absolute',
              left: left + c.x * k - r,
              top: top + c.y * k - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `${4 * (1 - p) + 1}px solid ${GOLD}`,
              opacity: 1 - p
            }}
          />
        )
      })}
      <svg
        width={20 * size} height={30 * size} viewBox='-1 -1 20 30'
        style={{ position: 'absolute', left: x, top: y, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))' }}
      >
        <path d={CURSOR_PATH} fill='white' stroke='black' strokeWidth='1.4' strokeLinejoin='round' />
      </svg>
    </>
  )
}

const Footage = ({ timeline }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ms = frame / fps * 1000
  const cam = useCamera(timeline, ms, fps)
  const step = timeline.steps[cam.index]
  const fw = timeline.viewport.width * timeline.scale
  const centreY = (STAGE.top + STAGE.bottom) / 2
  const left = WIDTH / 2 - cam.cx * cam.zoom
  const top = centreY - cam.cy * cam.zoom

  const sinceStep = ms - step.ready
  const remaining = step.end - step.ready
  const spotOpacity = interpolate(sinceStep, [200, 500, remaining - 200, remaining], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const spot = step.spotlightBox && {
    left: left + step.spotlightBox.x * timeline.scale * cam.zoom - 10,
    top: top + step.spotlightBox.y * timeline.scale * cam.zoom - 10,
    width: step.spotlightBox.width * timeline.scale * cam.zoom + 20,
    height: step.spotlightBox.height * timeline.scale * cam.zoom + 20
  }

  return (
    <AbsoluteFill>
      {/* Blurred, dimmed copy fills the portrait frame behind the subject. */}
      <OffthreadVideo
        src={staticFile('footage.mp4')} muted
        style={{ position: 'absolute', height: '100%', left: '50%', transform: 'translateX(-50%) scale(1.15)', filter: 'blur(40px) brightness(0.35)' }}
      />
      <div style={{ position: 'absolute', left, top, width: fw * cam.zoom, borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>
        <OffthreadVideo src={staticFile('footage.mp4')} muted style={{ width: '100%', display: 'block' }} />
      </div>
      {/* Clip the footage to the stage so the sidebar and canvas don't leak in. */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <StageMask />
      </AbsoluteFill>
      {spot && (
        <div style={{
          position: 'absolute',
          ...spot,
          opacity: spotOpacity,
          borderRadius: 14,
          border: `5px solid ${GOLD}`,
          boxShadow: `0 0 30px ${GOLD}, 0 0 0 4000px rgba(0,0,0,0.35)`
        }}
        />
      )}
      <Cursor timeline={timeline} ms={ms} left={left} top={top} zoom={cam.zoom} />
      <Header title={timeline.title} />
      <Caption step={step} sinceStep={sinceStep} />
    </AbsoluteFill>
  )
}

const StageMask = () => (
  <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: STAGE.top - 20, background: 'linear-gradient(#0b0a0d 70%, rgba(11,10,13,0))' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: STAGE.bottom + 20, bottom: 0, background: 'linear-gradient(rgba(11,10,13,0), #0b0a0d 20%)' }} />
  </>
)

const Header = ({ title }) => (
  <div style={{ position: 'absolute', top: 130, width: '100%', textAlign: 'center', fontFamily: 'DuvallSmallCaps, serif', fontSize: 84, color: GOLD, letterSpacing: 2, textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
    {title}
  </div>
)

const Caption = ({ step, sinceStep }) => {
  const remaining = step.end - step.ready
  const appear = interpolate(sinceStep, [0, 300], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const leave = interpolate(sinceStep, [remaining - 250, remaining], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (!step.caption) return null
  return (
    <div style={{ position: 'absolute', top: STAGE.bottom + 90, left: 70, right: 70, display: 'flex', justifyContent: 'center', opacity: appear * leave, transform: `translateY(${(1 - appear) * 40}px)` }}>
      <div style={{ background: 'rgba(20,18,24,0.92)', border: `3px solid ${GOLD}`, borderRadius: 24, padding: '28px 40px', color: '#f5efe2', fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 800, fontSize: 64, lineHeight: 1.15, textAlign: 'center' }}>
        {step.caption}
      </div>
    </div>
  )
}

const Card = ({ children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #2a2230, #0b0a0d 70%)', alignItems: 'center', justifyContent: 'center', opacity }}>
      {children}
    </AbsoluteFill>
  )
}

export const Short = ({ timeline }) => {
  const { fps } = useVideoConfig()
  if (!timeline) return <Card><div style={{ color: 'white', fontSize: 60 }}>No timeline</div></Card>
  const titleFrames = Math.round(TITLE_MS / 1000 * fps)
  const footageFrames = Math.round(timeline.durationMs / 1000 * fps)
  const endFrames = Math.round((timeline.endCard?.seconds ?? 0) * fps)
  return (
    <AbsoluteFill style={{ background: '#0b0a0d' }}>
      <Sequence durationInFrames={titleFrames}>
        <Card>
          <div style={{ fontFamily: 'DuvallSmallCaps, serif', fontSize: 150, color: GOLD, textAlign: 'center', lineHeight: 1 }}>{timeline.title}</div>
          <div style={{ marginTop: 40, fontFamily: 'Duvall, serif', fontSize: 54, color: '#d8cfc0' }}>{timeline.subtitle}</div>
        </Card>
      </Sequence>
      <Sequence from={titleFrames} durationInFrames={footageFrames}>
        <Footage timeline={timeline} />
      </Sequence>
      {endFrames > 0 && (
        <Sequence from={titleFrames + footageFrames} durationInFrames={endFrames}>
          <Card>
            <div style={{ fontFamily: 'Duvall, serif', fontSize: 72, color: '#f5efe2', textAlign: 'center', padding: '0 90px', lineHeight: 1.2 }}>{timeline.endCard.text}</div>
          </Card>
        </Sequence>
      )}
    </AbsoluteFill>
  )
}

export { TITLE_MS }
