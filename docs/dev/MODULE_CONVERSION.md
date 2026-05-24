# Converting an Adventure Module for FoundryVTT

End-to-end guide for converting a published Goodman Games adventure (or any
source book) into a FoundryVTT module: extracting content, building the pack
in Foundry, packaging for release, submitting to the Foundry store, and
coordinating release with Goodman and the Foundry team.

This guide assumes the DCC system is already installed and that you're
producing an **adventure module** (content) — not a system. If you're
unsure of the distinction, see
[System Vs Module](../user-guide/System-Vs-Module.md).

## Overview

The process has four phases:

1. **Extract** — pull text, art, and maps out of the source PDF/InDesign
2. **Build** — create scenes, journals, actors, items, and spells in Foundry
3. **Package** — wire up `module.json`, compile packs, render store assets
4. **Release** — submit to Foundry, configure GitHub Actions, ship

Each phase has a checklist below. Work top-to-bottom; later phases assume
earlier ones are complete.

---

## Phase 1: Extract Source Content

### Extract Text

Goal: get every paragraph of adventure text into editable form so it can be
pasted into journal entries.

- Get the source PDF (or InDesign export) from Goodman.
- Use a PDF text extraction tool (Adobe Acrobat **Export to Word**,
  `pdftotext`, or InDesign's **Export → HTML/RTF**). HTML preserves
  bold/italic/headings, which saves a lot of cleanup later.
- Split the extracted text into one file per adventure section
  (introduction, area 1-1, area 1-2, etc.). This matches the journal
  structure you'll build in Phase 2.
- Strip page headers, footers, and page numbers. Leave stat blocks intact
  for now — you'll harvest those into actors in Phase 2.
- **Remove line-break hyphens.** PDFs hyphenate words that wrap across a
  line (`adven-\nture`), and extraction tools keep that hyphen and the
  break, leaving `adven-ture` or `adven- ture` in the output. Find-and-replace
  these so words rejoin (`adventure`). Be careful not to strip *real*
  hyphens in compound words (`half-elf`, `+1`) or em-dashes — a regex
  like "hyphen followed by a newline/space then a lowercase letter"
  (`-\s*\n\s*` → ``) targets only the wrap-hyphens. Always proofread the
  result, since the safe pattern can still miss edge cases.
- **Keep "un-dead" hyphenated.** Goodman's house style is **un-dead**, not
  "undead". Watch for this during hyphen cleanup and autocorrect — if
  "un-dead" wraps across a line it will look exactly like a wrap-hyphen and
  get joined into "undead". Preserve the hyphen, and do a final
  find-and-replace to catch any that slipped through.

### Extract Images

Goal: get clean PNGs of every illustration, handout, and map.

- Open the PDF in Acrobat or a similar tool and **Export All Images**
  (PDF → Tools → Export PDF → Image). Alternately Goodman can usually
  provide the print-resolution source art directly — ask first, it
  saves a lot of cleanup.
- Sort exported images into:
  - `art/illustrations/` — interior art, handouts, NPC portraits
  - `art/maps/` — battle maps (these get further treatment below)
  - `art/tokens/` — token art for actors (you may need to crop these
    from illustrations or commission new ones)
- Strip page artifacts and recompress as PNG. Target ≤ 2048px on the
  longest edge for illustrations; maps have their own sizing rules below.

### Maps — Special Handling

Maps need to be **gridded battle maps**, not the printed page layout:

- Get the un-keyed, un-labeled version of each map from Goodman if at all
  possible. Numbers and labels printed on the map become part of the
  scene background and can't be hidden from players.
- Confirm grid size. DCC's default is 5 ft / 70 px square. If the source
  map uses a different scale, you'll set that per-scene in Foundry.
- Save as PNG (lossless) or WebP. JPEG compression artifacts are visible
  at table-zoom.

---

## Phase 2: Build the Adventure in Foundry

This phase happens **inside FoundryVTT** with the module loaded. See
[LEVELDB_WORKFLOW.md](LEVELDB_WORKFLOW.md) for the lower-level mechanics
of the JSON ↔ LevelDB round-trip. Quick version: develop in Foundry's UI,
then `npm run tojson` to capture changes to git.

### Set Up the Module Skeleton

Before you can build content, you need a working module skeleton that
Foundry recognizes. Copy the structure from an existing adventure module
(e.g. `dcc-the-portal-under-the-stars` or similar) and update:

- `module.json` — id, title, authors, version (see [Phase 3](#phase-3-package-the-module))
- `packs/` directories — one per content type (scenes, journals, actors,
  items, tables, adventures)
- `lang/en.json` — any UI strings the module adds

Run `npm run todb` to compile the (empty) packs, then start Foundry.

### Make Journals

Journals are the spine of the adventure — every area, NPC, and handout
should be a journal entry that the GM can read at the table.

- Create a top-level folder named after the adventure
  (e.g. `DCC #100 — Music of the Spheres is Chaos`).
- Build subfolders for each chapter / section / level.
- For each adventure area, create one journal entry with multiple pages:
  - **Read-Aloud** — boxed text for the GM to read to players
  - **GM Notes** — mechanics, secrets, traps
  - **Stat Blocks** — link to actors (set up in the next step)
  - **Handouts** — embedded images for player-facing content
- Use Foundry's `@UUID[...]` syntax to link between journals, but don't
  link to actors/items yet — those don't exist. Come back in the
  "Link Everything" step.

### Make Actors

- Folders mirror your journal structure
  (`Adventure → Chapter 1 → Area 1-1` etc.).
- For each statblock in the adventure text, create an **NPC** actor:
  - Set HD, HP, AC, attacks, special abilities
  - Drag in a portrait image from `art/illustrations/`
  - Set a token image from `art/tokens/`
  - Configure token defaults: name, disposition (hostile/neutral/friendly),
    vision, light emission if applicable
- Spell-casting NPCs need their spells made first (see "Make Spells" below).
- Use the DCC system's NPC sheet — don't try to shoehorn data into the
  generic Foundry NPC sheet.

### Make Items

- Magic items, mundane gear, treasure, story items — anything the players
  can pick up gets an item.
- For each item:
  - Pick the right type (weapon, armor, equipment, treasure)
  - Fill description with the text from the source
  - Set mechanical properties (damage dice, AC bonus, etc.)
  - If the item has a related journal entry (e.g. a magic sword with
    detailed lore), link it via `@UUID[...]` after journals are finalized.
- Group items into folders by area or type, whichever makes more sense
  for the GM running the adventure.

### Make Spells

- DCC spells are complex — each spell has a full spell-check table.
- Either:
  - Drag spells from the DCC core book compendium and customize per NPC
    (much faster, recommended for standard spells)
  - Or build new spells from scratch following
    [Creating a Spell](../user-guide/Creating-a-Spell.md) and
    [Creating Spell Tables](../user-guide/Creating-Spell-Tables.md)
- Attach spells to the relevant NPCs by dragging them onto the NPC sheet.

### Link Items / Actors / Spells to Journals

Now that all entities exist, go back through journals and replace
placeholder text with `@UUID[...]` links:

- "The room contains a **+1 longsword**" → `The room contains a @UUID[Item.xxx]{+1 longsword}`
- Stat blocks → `@UUID[Actor.xxx]{Goblin Chieftain}` (the actor sheet
  opens when the GM clicks it)
- Cross-reference between adventure areas: `See @UUID[JournalEntry.xxx]{Area 2-3}`

Use **Drag-and-drop into the editor** rather than hand-typing UUIDs —
Foundry inserts the correct UUID and a sensible label automatically.

### Make Maps (Scenes)

For each map in the adventure:

- Create a new scene.
- Set the background image from `art/maps/`.
- Configure grid: pixel size, units (5 ft default for DCC), grid offset.
- Set scene dimensions to match the image.
- Add **Notes** for each keyed area on the map — drag a journal entry
  onto the map and place its pin where the room is. Players will see
  these pins (once permissions are set) and can click them to read
  the area description.

### Set Up Maps with Lighting

- Use Foundry's wall tool to trace every wall, door, and barrier on the
  map. Doors should be **Door** wall type so they can be opened/closed.
- Place ambient light sources (torches, braziers, magical lights) using
  the Lights layer. Standard torch radius is `dim 20 / bright 10` in
  DCC's 5 ft units.
- Set the scene's **Global Illumination** based on the environment:
  - Outdoor day: on, with appropriate color/intensity
  - Dungeon: off — rely on player light sources
- Test by switching to a player view and walking a token through the
  scene to confirm fog-of-war reveals correctly.

### Set Up Maps with Actors (Tokens)

- For each encounter on a map, drag the relevant actor from the sidebar
  onto the scene. This creates a token linked to the actor.
- Position tokens where the encounter starts in the adventure text.
- Set token disposition (hostile/neutral/friendly) — affects the colored
  outline players see.
- For tokens that should not be linked to the source actor (e.g. 6
  identical goblins where each goblin has its own HP), make sure the
  actor's prototype token has **Link Actor Data** *off*.

### Hide Actors for Reveal During Play

By default, the GM places tokens visibly. To hide them so they're only
revealed when the encounter begins:

- Select all tokens for an encounter on the Tokens layer.
- Right-click → **Toggle Visibility** (or press `H`). Tokens become
  semi-transparent — players can't see them.
- Alternatively, set hidden as the default in the prototype token: on
  the actor sheet, open **Token Config → Identity → Hidden ☑**. Every
  new token from that actor will start hidden.
- The end-user docs cover the reveal flow:
  [Revealing Monsters](../user-guide/Using-a-Published-Adventure-Module.md#revealing-monsters).
- **Bulk-hide before release**: open each scene, select all tokens
  (`Ctrl/Cmd + A` on the Tokens layer), and toggle hidden. This is
  easy to forget — add it to your pre-release checklist.

---

## Phase 3: Package the Module

### Constants File

If the module has any custom JavaScript (rare for an adventure module,
common for a rules-extension module), set up a constants file:

- `module/constants.js` — module id, settings keys, hook names
- Import from this file rather than hard-coding strings; it makes
  refactors and i18n cleanup vastly easier.

Pure-content adventure modules can skip this step.

### Set Up module.json

This is the manifest Foundry uses to identify, load, and update the
module. Use the DCC system's `system.json` as a structural reference,
but `module.json` has its own required keys. Minimum viable manifest:

```json
{
  "id": "dcc-adventure-shortcode",
  "title": "DCC #XXX — Adventure Title",
  "description": "One-paragraph teaser shown on the Foundry store.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14",
    "maximum": "14"
  },
  "authors": [
    { "name": "Author Name", "email": "author@example.com" }
  ],
  "relationships": {
    "systems": [
      { "id": "dcc", "type": "system", "compatibility": { "minimum": "0.67.0" } }
    ]
  },
  "packs": [
    {
      "name": "adventure",
      "label": "DCC #XXX Adventure",
      "type": "Adventure",
      "path": "packs/adventure",
      "system": "dcc"
    }
  ],
  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" }
  ],
  "url": "https://github.com/foundryvtt-dcc/dcc-adventure-shortcode",
  "manifest": "https://github.com/foundryvtt-dcc/dcc-adventure-shortcode/releases/latest/download/module.json",
  "download": "https://github.com/foundryvtt-dcc/dcc-adventure-shortcode/releases/latest/download/module.zip"
}
```

The `manifest` and `download` URLs **must** match what Foundry's
update-checker fetches; the GitHub Actions in
[`/.github/workflows/`](../../.github/workflows/) handle rewriting these
per release.

### Build / Export the Adventure Pack

Use Foundry's built-in Adventure document to bundle scenes, journals,
actors, items, and tables into a single importable package:

1. In Foundry, create an **Adventure** in your module's adventure
   compendium (unlock the compendium first).
2. Drag every folder of content from your sidebar (Scenes, Journals,
   Actors, Items, Tables) onto the Adventure sheet. Foundry captures the
   contents and all internal `@UUID` links.
3. Save the Adventure.
4. Exit Foundry.
5. Run `npm run tojson` to extract LevelDB → JSON for git.
6. Commit JSON to the branch.

Rebuilds after future edits: see
[LEVELDB_WORKFLOW.md](LEVELDB_WORKFLOW.md) — right-click the Adventure
in the compendium and choose **Rebuild Adventure**, drag folders, save.

### Create Store Screenshots

Foundry's store listing supports up to ~10 screenshots. Aim for:

- One overview shot (a populated battle map with tokens)
- 2-3 different battle maps showing variety
- 1-2 journal entry screenshots (handouts, GM read-aloud)
- 1 actor sheet (a flagship NPC)
- 1 item or spell with custom art if applicable

Capture at 1920×1080. Keep your Foundry UI clean — close sidebars you
don't need for the shot, hide chat, hide the players list.

### Create Cover with Foundry Logo

The cover image is the hero art on the store page.

- Recommended dimensions: **1920 × 1080** (or whatever Foundry's current
  guidelines say — check the package admin page).
- Use the official Foundry logo somewhere visible — Foundry provides a
  logo pack at https://foundryvtt.com/article/media-kit/ — and Goodman's
  module cover art as the main image.
- Save as PNG or high-quality JPEG.

### Goodman Author Guide

Goodman's authors handle the source-content side (writing, layout,
final text). Once we've done the conversion a few times, write a short
guide for them covering:

- What format we need text in (HTML preferred over PDF)
- How to mark up boxed/read-aloud text so we can identify it during
  extraction
- Map specs (un-labeled version, grid size, target resolution)
- Token art expectations (square crops, transparent background,
  256×256 minimum)
- Turnaround/handoff process

Keep this guide in their website's CMS where their writers see it.

---

## Phase 4: Release

### Submit to Foundry Store

- Sign in to https://foundryvtt.com as the package owner.
- **Submit a New Package** → choose **Module** → fill in the form:
  - id (matches `module.json` `id`)
  - title, description
  - manifest URL (the `latest/download/module.json` URL above)
  - cover image and screenshots
  - tags (system: dcc, content type: adventure, level range, etc.)
- Set price (if commercial), region restrictions, and the system this
  module requires (DCC).

### Contact Foundry to Get the Package Approved

- After submission, the Foundry team reviews commercial packages
  manually. Reach out via the Foundry Discord
  (`#packages-and-development`) or the package-admin email to flag your
  submission for review.
- Be ready to share: a working test world, sample license terms (for
  commercial packages), and confirmation that you have the rights from
  Goodman to publish.

### Get the Package Deploy Token

Once approved, Foundry generates a **Package Release Token** — the
secret that authorizes GitHub Actions to push new version info to the
Foundry website.

- Foundry surfaces this token in the package admin page.
- Copy it.
- In the GitHub repo: **Settings → Secrets and Variables → Actions →
  New repository secret**.
- Name: `FOUNDRY_PACKAGE_RELEASE_TOKEN`. Value: the token. This is
  what `foundry-website-update.yml` references.

### Verify GitHub Actions

The DCC org provides three reusable actions wired into the workflows:

- `foundry-release-action` — creates the GitHub release zip on
  `version.txt` push (see
  [`create-github-release.yml`](../../.github/workflows/create-github-release.yml))
- `foundry-package-release-action` — notifies the Foundry website
  ([`foundry-website-update.yml`](../../.github/workflows/foundry-website-update.yml))
- `foundry-manifest-update-action` — patches `module.json` with the
  release URL
  ([`update-foundry-manifest-after-release.yml`](../../.github/workflows/update-foundry-manifest-after-release.yml))

Before going live, run a **dry-run release** on a private test repo:

- Set `dryRun: true` in `foundry-website-update.yml`.
- Bump `version.txt`, push to main, watch the Actions tab.
- Confirm: GitHub release is drafted, zip contains compiled packs,
  Foundry-website action reports success in dry-run mode.
- Flip `dryRun` back to `false` for real releases.

### Make the Initial Release

See [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for the canonical steps.
Short form:

1. `npm run tojson` to make sure JSON is up to date (LevelDB isn't
   committed).
2. Merge everything to `main`.
3. Bump `version.txt` (no `v` prefix), commit, push.
4. Watch GitHub Actions create the draft release.
5. Edit the release notes — adventure overview, what's included,
   compatibility info.
6. **Publish** the release. This fires the website-update workflow
   automatically.

### Coordinate with Goodman on Release Date

- Pick a release date with Goodman that aligns with their marketing.
- They typically announce on their newsletter and social channels —
  give them a heads-up at least a week before.
- Send Goodman the final cover image and screenshots so their
  announcement matches what's on the Foundry store.

### Notify the Foundry Team

- Email the Foundry packages team with the release date so they can
  feature the module on the front page of the marketplace if applicable.
- Also post in the Foundry Discord `#packages-and-development` channel
  on release day with a link to the store page.

---

## Pre-Release Checklist

Run through this every time before bumping `version.txt`:

- [ ] All tokens hidden on all scenes (Tokens layer → `Ctrl+A` → `H`)
- [ ] Journal permissions set so players can see player-facing pages
- [ ] Scene notes toggle is **on** (the magnifying glass —
      see [user guide](../user-guide/Using-a-Published-Adventure-Module.md#where-are-the-notes-on-the-map))
- [ ] Default scene navigation set; non-default scenes hidden
- [ ] All `@UUID[...]` links resolve (no red broken-link text)
- [ ] All actor portraits and token images load
- [ ] All map walls and doors render correctly in player view
- [ ] Lighting verified by switching to a player perspective
- [ ] Adventure compendium rebuilt and saved
- [ ] `npm run tojson` run, JSON committed
- [ ] All tests pass: `npm test`
- [ ] Translation coverage checked: `npm run compare-lang`
- [ ] `module.json` `version`, `compatibility`, and URLs correct

---

## Related Documentation

- [LEVELDB_WORKFLOW.md](LEVELDB_WORKFLOW.md) — JSON ↔ LevelDB mechanics
- [PACKS.md](PACKS.md) — Pack structure and commands
- [RELEASE_PROCESS.md](RELEASE_PROCESS.md) — Release commands and Actions
- [I18N.md](I18N.md) — Translation requirements
- [System Vs Module](../user-guide/System-Vs-Module.md) — Conceptual difference
- [Using a Published Adventure Module](../user-guide/Using-a-Published-Adventure-Module.md) — End-user flow
