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

function useCamera (timeline, ms, fps) {
  const { steps } = timeline
  let i = steps.findIndex(st => ms < st.end)
  if (i === -1) i = steps.length - 1
  const to = stepCamera(steps[i], timeline)
  const from = i > 0 ? stepCamera(steps[i - 1], timeline) : to
  // Arrive just as the step's result lands, not while the action is running.
  const sinceMove = (ms - steps[i].ready) / 1000 * fps + MOVE_FRAMES
  const t = interpolate(sinceMove, [0, MOVE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)
  })
  const mix = (a, b) => a + (b - a) * t
  return { index: i, zoom: mix(from.zoom, to.zoom), cx: mix(from.cx, to.cx), cy: mix(from.cy, to.cy) }
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
