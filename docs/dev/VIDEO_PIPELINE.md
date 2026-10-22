# Tutorial Video Pipeline

Design brief for producing short tutorial videos (YouTube Shorts / TikTok /
Reels, 9:16, 30–60 s) for the DCC system from code, so they can be
regenerated when the UI changes. Written to hand off to a Claude Code
session: it records the decisions already made, what was verified, and the
pilot to build first. A no-audio proof of concept is in `tools/video/`; see
[Proof of concept](#proof-of-concept-no-audio).

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
| Dice | Pin `CONFIG.Dice.randomUniform` inside the page for the step that needs a specific result, restore after. A die's natural is `ceil((1 - u) * faces)`. | Already used across the E2E specs; `browser-tests/e2e/attack-crit-confirm.spec.js` documents the formula and `rollPinnedDeed` in `mighty-deeds.spec.js` pins a whole attack. |
| Location | `tools/video/` in this repo, as its own package (like `browser-tests/e2e/`) so Remotion and its dependencies stay out of the root `package.json`; pnpm's `minimumReleaseAge` applies. Rendered output and audio outside git. | Storyboards change in the same PR as the UI they show; the runner imports the E2E fixtures. Split to a sibling repo only if tooling gets heavy. |
| Pilot | One 45 s **Mighty Deeds** short. | `browser-tests/e2e/mighty-deeds.spec.js` already builds a deed warrior, weapon, deed table and target token, and pins a whole attack. A core warrior mechanic that shows on both sheet and chat card. |

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
      "spotlight": "input[name='system.details.attackBonus']", // selector; runner exports its bounding box
      "frame": "sheet"                  // crop region hint for the compositor: sheet | chat | full
    },
    {
      "id": "roll-attack",
      "action": { "type": "click", "selector": "[data-action=rollWeaponAttack]" },
      "dice": { "randomUniform": 0.25 }, // pinned for this step only: d20 → 15, d3 deed → 3
      "narration": "Roll three or higher and the deed succeeds.",
      "caption": "3+ = deed succeeds",
      "spotlight": "#chat .message:last-child .deed-result",
      "frame": "chat"
    }
  ],
  "music": { "track": "assets/music/dungeon-loop.ogg", "duckUnderSpeech": -18 },
  "endCard": { "text": "More at dcc-rpg-foundry docs", "seconds": 3 }
}
```

`dice.randomUniform` pins every die in the step to the same `u`, which
couples the results: a d3 deed of 3 needs `u < 1/3`, which forces the d20 to
14 or higher. That covers most shots. When a step needs dice set
independently (a deed success on a natural 2, say), add a `dice.uniforms`
array consumed one value per die in evaluation order, falling back to the
real generator once it runs out; confirm the evaluation order in the
runner rather than assuming it.

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
- Licence: `e2e:env` already runs isolated servers on a copy of the live
  licence alongside the live server, so a video server is no new exposure.
  Check Foundry's licence terms for concurrent servers before running this
  on shared or hosted infrastructure.

Locally, `pnpm run e2e:env up` gives an isolated world and prints the URL;
the runner should honour `FOUNDRY_URL` exactly as the specs do.

## Capture details that matter

- **Login reuse.** Use the worker-scoped session pattern from
  `browser-tests/e2e/fixtures.js`; a fresh login per short costs 6–13 s.
- **CI client settings.** `prepareClientSettings` caps the canvas at
  `core.maxFPS: 10` and LOW performance mode when `CI` is set. A container
  derived from the E2E runner inherits that, and a 60 fps capture would
  record a 10 fps canvas. Unset `CI` for capture or override those settings.
- **Welcome tour / banners.** `prepareClientSettings` in fixtures already
  suppresses the tour. Also pin the sidebar to a known open/collapsed state
  per storyboard, set a plain scene background, and name actors for the
  camera (no "E2E Deed Target").
- **Cleanup.** Spec cleanup deletes documents whose names start with `E2E `
  (e.g. `mighty-deeds.spec.js` `beforeEach`). Camera-named actors escape
  that, so the runner tracks what it creates (a `flags.dcc.videoFixture`
  flag or an id list) and deletes it after the take. The PoC records each
  document, setting and the pause state as setup goes, so a setup that fails
  partway is still undone, and every teardown step runs even if one fails.
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

## Proof of concept (no audio)

`tools/video/` (its own workspace package) renders a 33 s 9:16 Mighty Deeds
short with title card, camera moves, cursor, spotlights, captions and end
card, but no narration or music. Against a running `pnpm run e2e:env up`:

```sh
cd tools/video
FOUNDRY_URL=http://localhost:30343 node capture.mjs storyboards/mighty-deeds.json
node contact-sheet.mjs mighty-deeds              # stills of the raw footage
node compose.mjs mighty-deeds                    # out/mighty-deeds/short.mp4
node contact-sheet.mjs mighty-deeds short.mp4    # stills of the short
```

Capture clears the world's chat log for a clean stage, so it refuses to run
without `FOUNDRY_URL` or against the live world on port 30000.

What it differs on, and what it taught:

- **Capture is the CDP screencast, not x11grab,** so it runs on macOS (no
  Xvfb). 1440x810 at deviceScaleFactor 2 gives 2880x1620 frames, sharp
  enough to zoom to 1.5x.
- **The cursor is drawn in compose, not captured.** The runner glides the
  real mouse along eased paths (so hover states and tooltips are real) and
  records the path and clicks in the timeline's `pointer`; Remotion draws an
  arrow that scales with the footage plus a click ripple. Like the
  spotlights, it can be restyled without recapturing. With x11grab this
  could switch to the real cursor, but the drawn one is arguably better.
- **Click steps get an action shot.** A click on something off-camera (the
  sheet, while the chat card is framed) pans to bring it into view, pauses
  for the click, then moves to the result. Long moves pull back mid-pan
  instead of whipping across empty canvas. The pan runs with the cursor's
  glide (timeline `actionAt`) and the move to the result starts once the
  result is on screen; starting either early (an earlier version panned at
  step start, then waited for the glide) reads as a hiccup. After each step the cursor drifts
  beside its spotlight. A click with `"glide": false` skips the cursor trip,
  so the camera stays put (the second roll stays on the chat card).
- **Native `<select>` popups are invisible to the screencast** (drawn
  outside the page). `openSelect` shows the options in-page as an inline
  listbox; `selectOption` glides to an option, picks it and fires `change`.
- **The e2e world's `mightyDeedsCompendium` is empty,** so the card offered
  only a leftover spec table. The setup points it at the core book's deed
  tables (the setting is restored afterwards, though other connected clients
  keep the tables registered until they reload); the card captures the list at roll time.
- **The screencast only emits on repaint.** A still UI gave 31 frames for
  16 s and dropped every animation in between. A 1px near-transparent
  element repainted each animation frame keeps it at display rate; x11grab
  would not need it.
- **Foundry's stage needs setting.** Below 1024x768 Foundry shows a size
  warning banner; the e2e world starts paused (animated overlay); the
  default emote card has no `.deed-result`, so the setup turns on enhanced
  attack cards and targets a token so the card reports the hit.
- **Steps record `ready`,** the moment the action's result is on screen.
  The camera, caption and spotlight key off it, not the step start, or
  captions arrive while a roll is still in flight. The footage is trimmed to
  start at the first step's `ready`, so it never opens on an empty stage.
- **`frame` takes a CSS selector** as well as `sheet` / `chat` / `full`, and
  a step can set `zoom` to crop past the fit, centred on the spotlight and
  clamped to the frame. Whole sheets fit at ~0.9x and read small on a phone;
  frame a block of the sheet instead.
- The system's Duvall fonts are in `styles/fonts/`, so captures render them
  without installing anything; `compose.mjs` copies two into Remotion's
  public dir for the title and cards.

Not done yet: narration/TTS, music, `dice.uniforms`, storyboard
validation and its unit tests, a Linux/x11grab capture path.

## Pilot: Mighty Deeds

Done means: `tools/video/storyboards/mighty-deeds.json` renders a 45 s 9:16
mp4 with narration, captions, title and end card, from one command, against
`pnpm run e2e:env up`, and the step-boundary contact sheet has been reviewed.

Suggested order of work:

1. `tools/video/` skeleton: runner CLI, storyboard loader, named setup for
   Mighty Deeds lifted from the spec's helpers (`createDeedFixtures` for the
   warrior, weapon and deed table; `rollPinnedDeed` for the scene, target
   token and pinned attack). The spec's `beforeAll` is only a server probe.
   The spec mostly tests deed-table prompts; the short covers the basic Deed
   Die flow, so expect to trim, not copy.
2. Capture stage against a static HTML page first (no Foundry) to prove
   Xvfb + x11grab + timeline sync, then against Foundry.
3. Remotion project: crop/zoom from `frame` hints and spotlight boxes,
   captions from storyboard, title/end cards using the system's heading font.
4. TTS stage with a local engine; swap-in point for ElevenLabs.
5. Contact-sheet QA script.
6. Only then: second storyboard (Fleeting Luck or Death Clock) to shake out
   what was pilot-specific.

Topics with ready-made spec setup to borrow from: Mighty Deeds, Fleeting
Luck, Death Clock, Spell Duels (`spell-duel-exchange.spec.js`), Roll
Requests, Party Sheet, Charged Magic Items, and the Ctrl-click roll modifier
(no spec of its own; see `adapter-dispatch.spec.js` and
`ability-score-log.spec.js`).

## Rules that still apply

- Nothing here touches `version.txt` or ships in a release; it is tooling.
- Storyboards that quote rules text must stay out of
  `module/vendor/dcc-core-lib/` and any lib PR; the lib repo is public.
- Published videos may quote rules text within fair use: less than a few
  paragraphs per video, cited by table and page, with the rest in our own
  words explaining the system's UI.
- Keep rendered media, TTS audio and music out of git.
- New runner code gets unit tests at the cheapest layer that can see the
  behaviour (storyboard validation, timeline math), per `docs/dev/TESTING.md`.

## Prompt to start a local session

> Read `docs/dev/VIDEO_PIPELINE.md`. Build the Mighty Deeds pilot described
> there, in the suggested order, starting with the capture stage against a
> static page. Reuse `browser-tests/e2e/fixtures.js` and the setup from
> `browser-tests/e2e/mighty-deeds.spec.js`. Stop and show me the contact
> sheet before the Remotion work.
