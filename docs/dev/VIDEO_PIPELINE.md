# Tutorial Video Pipeline

Design brief for producing short tutorial videos (YouTube Shorts / TikTok /
Reels, 9:16, 30–60 s) for the DCC system from code, so they can be
regenerated when the UI changes. Written to hand off to a Claude Code
session: it records the decisions already made, what was verified, and the
pilot to build first. Nothing described here exists in the repo yet.

## Goals

- **Footage is the real system.** Record live Foundry driven by Playwright,
  using the existing E2E world and fixtures, not mock-ups.
- **Regenerable.** A short is a storyboard file plus a runner. When a sheet
  or chat card changes in a release, rerun the storyboards.
- **Deterministic.** Scripted dice, pinned theme, seeded world. Every take
  is identical.
- **Localizable.** Narration lines live beside i18n keys; a second-language
  cut is one TTS pass and one render.
- **Cheap to extend.** After the pilot, a new short is a storyboard, not code.

## Decisions already made

| Area | Decision | Why |
|------|----------|-----|
| Capture | Headed Chromium under Xvfb, recorded with `ffmpeg -f x11grab -draw_mouse 1` at 1920x1080, 60 fps. PulseAudio optional for Foundry's own dice sounds. | Constant frame rate, real cursor, reuses every Playwright fixture. Headless CDP screencast is repaint-driven and has no cursor (verified: it works, but needs timestamp handling). Playwright's own `recordVideo` was not usable in the cloud container (bundled-ffmpeg version mismatch); don't depend on it. |
| Compositing | [Remotion](https://www.remotion.dev/) | React in headless Chromium. Animated 9:16 crop/zoom keyed to a timeline, word-synced captions, spotlight overlays, title/end cards, music ducking, parallel CPU render, studio preview. Motion Canvas (weak headless story), Manim (wrong aesthetic), moviepy (slow) were considered and rejected. |
| Portrait | Record landscape, produce 9:16 in post by cropping/zoom-panning to the active window per step. | Foundry is a landscape app. `app.setPosition` can park sheets in a known rectangle. |
| Callouts | Runner exports each spotlighted element's bounding box into the timeline; Remotion draws the callout. Nothing injected into the footage except the cursor. | Footage stays clean; restyle every video without recapturing. |
| Narration | Generate TTS **before** capture; each step holds for its narration length. Local engine (Kokoro or Piper) by default, ElevenLabs as the quality option (returns character timestamps). | Natural pacing. Voice is nearly free once scripted; see research notes for why to ship voice at all. |
| Captions | From the storyboard text, never from transcription. Short keyword phrases, not a transcript. Forced alignment (WhisperX) only if the TTS engine gives no timestamps. | Redundancy principle: on-screen text must be shorter than narration. |
| Music | Ducked hard or absent under speech. Fine at normal level over caption-only segments. | See research notes. |
| Dice | Pin `CONFIG.Dice.randomUniform` inside the page for the step that needs a specific result, restore after. | Already used in `browser-tests/e2e/adapter-dispatch.spec.js` (~line 1300). |
| Location | `tools/video/` in this repo; rendered output and audio outside git. | Storyboards change in the same PR as the UI they show; the runner imports the E2E fixtures. Split to a sibling repo only if tooling gets heavy. |
| Pilot | One 45 s **Mighty Deeds** short. | Richest existing spec setup (`browser-tests/e2e/mighty-deeds.spec.js`), and the feature new players ask about most. |

## Pipeline

```
storyboard.json ─► 1 narrate ─► 2 capture ─► 3 compose ─► 4 QA ─► 5 publish
                    (TTS per      (Playwright    (Remotion:     (contact     (YouTube
                     step, store   + Xvfb +       footage +      sheet of     Data API,
                     durations)    x11grab;       timeline +     step-edge    optional)
                                   writes         audio +        frames,
                                   timeline.json) captions →     reviewed
                                                  9:16 mp4,      by Claude)
                                                  16:9 mp4)
```

1. **Narrate.** TTS every `narration` line. Store audio and duration per step.
2. **Capture.** Runner starts Xvfb and ffmpeg, logs into the e2e world with
   the shared-session login from `browser-tests/e2e/fixtures.js`, performs each
   step, holds for that step's narration duration, and appends to
   `timeline.json`: step id, start/end ms relative to ffmpeg start, and the
   bounding boxes of any `spotlight` targets. Record wall-clock at ffmpeg
   spawn and at each step; that is the sync source.
3. **Compose.** Remotion composition reads footage + timeline + audio +
   captions. Outputs the 9:16 short and, if wanted, a 16:9 cut for the
   `docs/user-guide/` pages.
4. **QA.** Dump one frame at every step boundary into a contact sheet. Claude
   reads the stills and flags clipped tooltips, misplaced spotlights, caption
   collisions, before anyone watches the video.
5. **Publish.** Optional. Title, description, chapters from the storyboard.

## Storyboard schema (proposed)

```jsonc
{
  "id": "mighty-deeds",
  "title": "Mighty Deeds in 45 seconds",
  "aspect": "9:16",
  "setup": "mighty-deeds",            // named setup routine in the runner (actor, weapon, target token)
  "theme": "dark",
  "steps": [
    {
      "id": "open-sheet",
      "action": { "type": "openActorSheet", "actor": "Warrior" },
      "narration": "Warriors get a Deed Die on every attack.",
      "caption": "Deed Die: every attack",
      "spotlight": ".deed-die",         // selector; runner exports its bounding box
      "frame": "sheet"                  // crop region hint for the compositor: sheet | chat | full
    },
    {
      "id": "roll-attack",
      "action": { "type": "click", "selector": "[data-action=rollWeaponAttack]" },
      "dice": { "randomUniform": 0.55 }, // pinned for this step only
      "narration": "Roll three or higher and the deed succeeds.",
      "caption": "3+ = deed succeeds",
      "spotlight": ".chat-message:last-child .deed-result",
      "frame": "chat"
    }
  ],
  "music": { "track": "assets/music/dungeon-loop.ogg", "duckUnderSpeech": -18 },
  "endCard": { "text": "More at dcc-rpg-foundry docs", "seconds": 3 }
}
```

Actions should map to a small verb set (`openActorSheet`, `click`, `hover`,
`type`, `drag`, `setSetting`, `evaluate`, `wait`). Reuse the actor/item/token
creation code from the matching E2E spec in named `setup` routines rather
than inventing new world state.

## Environment

The self-hosted E2E runner (`deploy/e2e-runner/`) already holds the Foundry
license and the paid `dcc-core-book` module and has Playwright Chromium. A
video job is a sibling container derived from it, adding:

- Node 24, pnpm (same as the repo).
- Xvfb, PulseAudio (optional), full ffmpeg with libx264, libass, AAC.
- Playwright Chromium run **headed** under Xvfb. Keep the SwiftShader flags
  from `browser-tests/e2e/playwright.config.js` if there is no GPU.
- Remotion and its Chromium dependencies.
- Python with Kokoro or Piper. WhisperX only if needed for alignment.
- Fonts: the system's own (`styles/variables.css` uses Duvall for headings,
  Cooper Black for labels, Book Antiqua / Palatino for data) plus a clean
  caption face such as Inter. Install the Duvall/Cooper files the sheets use
  so captured text renders like a real client.
- GPU optional, strongly recommended for canvas or Dice So Nice shots. DOM
  shots (sheets, chat) are fine on SwiftShader.
- Foundry's licence permits one active server per key: do not run the video
  container and a local dev server on the same key at once.

Locally, `pnpm run e2e:env up` gives an isolated world and prints the URL;
the runner should honour `FOUNDRY_URL` exactly as the specs do.

## Capture details that matter

- **Login reuse.** Use the worker-scoped session pattern from
  `browser-tests/e2e/fixtures.js`; a fresh login per short costs 6–13 s.
- **Welcome tour / banners.** `prepareClientSettings` in fixtures already
  suppresses the tour. Also hide the sidebar collapse state, set a plain
  scene background, and name actors for the camera (no "E2E Deed Target").
- **Cursor.** x11grab draws the real cursor. Ease mouse moves over 300–500 ms
  with `page.mouse.move(x, y, { steps })`; a teleporting cursor reads as a
  bug.
- **Dice pinning.** Set `CONFIG.Dice.randomUniform` in `page.evaluate` right
  before the roll and restore it right after. Document creation also consumes
  randomness, so never leave it pinned across a step.
- **Sync.** Timeline times are relative to the ffmpeg spawn timestamp. Verify
  once by flashing a full-screen white frame at t=0 and locating it in the
  footage; the offset is stable per machine.

## Research notes: narration vs captions-only

Checked October 2026. Two bodies of evidence, neither tests this exact case.

- **Platform data favours captions but is weak.** Verizon Media / Publicis
  Media 2019 survey (n = 5,616): 92% of mobile viewers regularly watch with
  sound off; 80% say captions make them more likely to finish. Self-report,
  primary document not located. TikTok's Kantar study (2021, commissioned)
  says 88% of users consider sound essential. Vendor "voiceover lifts
  completion X%" figures have no method and contradict each other. No
  controlled study compares voiceover vs captions-plus-music on short-form
  retention.
- **Learning science favours narration and is strong but on longer
  material.** Mayer's modality principle: graphics + speech beats graphics +
  text. Redundancy principle: verbatim on-screen text over narration hurts. A
  2024 eye-tracking study (n = 168, PMC11458047): subtitled video with sound
  off raised cognitive load and lowered comprehension, immersion and
  enjoyment versus sound on.
- **Boundary conditions that apply to us.** Redundant text helps when pacing
  is learner-controlled, when narration has unfamiliar technical terms, and
  when the text is shorter than the narration (Clark & Mayer). A 45 s clip
  about "Deed Die" and "disapproval range", on a platform where people pause
  and rewatch, hits all three. Non-native readers also benefit from text.
- **Music.** Moreno & Mayer found background music hurt retention; a newer
  meta-analysis (not fully verified) confines the penalty to music under
  concurrent narration (g ≈ -0.46) and finds near zero without competing
  speech (g ≈ -0.13).

**Conclusion adopted:** ship narration + short keyword captions + music
ducked under speech. Captions-and-music-only is defensible, not optimal.
Because both variants render from one storyboard, A/B them on channel
analytics across four or five shorts each; that will say more about this
audience than any source above. Open question: whether a synthetic voice
reads as cheap to a hobby audience. A human voice recorded against the
generated script is a small extra step per short.

## Pilot: Mighty Deeds

Done means: `tools/video/storyboards/mighty-deeds.json` renders a 45 s 9:16
mp4 with narration, captions, title and end card, from one command, against
`pnpm run e2e:env up`, and the step-boundary contact sheet has been reviewed.

Suggested order of work:

1. `tools/video/` skeleton: runner CLI, storyboard loader, named setup for
   Mighty Deeds lifted from the spec's `beforeAll`.
2. Capture stage against a static HTML page first (no Foundry) to prove
   Xvfb + x11grab + timeline sync, then against Foundry.
3. Remotion project: crop/zoom from `frame` hints and spotlight boxes,
   captions from storyboard, title/end cards using the system's heading font.
4. TTS stage with a local engine; swap-in point for ElevenLabs.
5. Contact-sheet QA script.
6. Only then: second storyboard (Fleeting Luck or Death Clock) to shake out
   what was pilot-specific.

Topics with ready-made spec setup to borrow from: Mighty Deeds, Fleeting
Luck, Death Clock, Spell Duels, Roll Requests, Party Sheet, Ctrl-click roll
modifier, Charged Magic Items.

## Rules that still apply

- Nothing here touches `version.txt` or ships in a release; it is tooling.
- Storyboards that quote rules text must stay out of
  `module/vendor/dcc-core-lib/` and any lib PR; the lib repo is public.
- Keep rendered media, TTS audio and music out of git.
- New runner code gets unit tests at the cheapest layer that can see the
  behaviour (storyboard validation, timeline math), per `docs/dev/TESTING.md`.

## Prompt to start a local session

> Read `docs/dev/VIDEO_PIPELINE.md`. Build the Mighty Deeds pilot described
> there, in the suggested order, starting with the capture stage against a
> static page. Reuse `browser-tests/e2e/fixtures.js` and the setup from
> `browser-tests/e2e/mighty-deeds.spec.js`. Stop and show me the contact
> sheet before the Remotion work.
