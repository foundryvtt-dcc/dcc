# V14 Module Compatibility Updates

This document tracks the V14 compatibility updates applied across all DCC ecosystem modules.

**Date**: 2026-04-02
**Branch**: `feature/v14` on each repo

## Summary

31 modules updated with `feature/v14` branches pushed. All modules have `module.json` compatibility set to `{"minimum":"14","verified":"14","maximum":"14"}`.

## Main Modules

### xcc (XCrawl Classics)

**Repo**: `foundryvtt-dcc/xcc`
**Changes**:
- `foundry.utils.duplicate()` replaced with `foundry.utils.deepClone()` (3 instances in `xcc-actor-sheet.js`)
- `game.settings.get('core', 'rollMode')` migrated to `game.settings.get('core', 'messageMode')` (3 files: athlete, brawler, half-elf sheets)
- `ChatMessage.applyRollMode()` migrated to `ChatMessage.applyMode()` (3 files: athlete, brawler, half-elf sheets)
- `module.json` compatibility updated to V14

### mcc-classes (MCC Sheets)

**Repo**: `foundryvtt-dcc/mcc-classes`
**Changes**:
- `module.json` compatibility updated to V14
- No code changes needed (migration `-=key` syntax in `document.update()` is still supported in V14)

### dcc-crawl-classes (Crawl! Sheets)

**Repo**: `foundryvtt-dcc/dcc-crawl-classes`
**Changes**:
- `TextEditor.implementation.enrichHTML()` replaced with `TextEditor.enrichHTML()` (4 files: bard, gnome, elven-rogue, halfling-burglar sheets)
- `module.json` compatibility updated to V14

### dcc-qol (Quality of Life)

**Repo**: `foundryvtt-dcc/dcc-qol`
**Changes**:
- `module.json` compatibility updated to V14
- No code changes needed (DialogV2 `icon` property is not affected by the status effect `icon`->`img` change)

### dcc-macros

**Repo**: `foundryvtt-dcc/dcc-macros`
**Changes** (major rewrite - was at V10 compatibility):
- `game.actors.entities` replaced with `game.actors` (iterable)
- `_actor.data.type` / `_actor.data.name` / `_actor.data.img` replaced with `_actor.type` / `_actor.name` / `_actor.img`
- `actor.data.data.attributes` replaced with `actor.system.attributes`
- `token.update()` replaced with `token.document.update()` with updated property names
- Token properties: `dimLight`->`light.dim`, `brightLight`->`light.bright`, `dimSight`->`sight.range`, `lightAnimation`->`light.animation`, `lightColor`->`light.color`, `lightAlpha`->`light.alpha`
- `img` replaced with `texture.src`, `vision` replaced with `sight.enabled`
- Actor `token.` prefix replaced with `prototypeToken.`
- `duplicate()` replaced with `foundry.utils.deepClone()`
- `mergeObject()` replaced with `foundry.utils.mergeObject()`
- `scene.data.notes` replaced with `scene.notes`
- `new Roll().roll()` replaced with `await new Roll().evaluate()`
- `module.json` compatibility updated from V10 to V14

### dcc-annual-1

**Repo**: `foundryvtt-dcc/dcc-annual-1`
**Changes**:
- `module.json` compatibility updated to V14
- No code changes needed (already uses ApplicationV2 and modern APIs)

### dcc-core-book

**Repo**: `foundryvtt-dcc/dcc-core-book`
**Status**: Already at V14 compatibility (branch `v14` existed)

## Adventure Modules with Code Fixes

### dcc-accursed-heart-of-the-world-ender

**Repo**: `foundryvtt-dcc/dcc-accursed-heart-of-the-world-ender`
**Changes**:
- `duplicate(scene.data.tokens)` replaced with `foundry.utils.deepClone(Array.from(scene.tokens))`
- `duplicate(scene.data.notes)` replaced with `foundry.utils.deepClone(Array.from(scene.notes))`
- Removed `duplicate` from globals comment
- `module.json` compatibility updated to V14
- **Note**: Still uses old `contentImporter.js` pattern with NeDB `.db` packs. Needs future migration to Adventure documents + LevelDB packs.

### dcc-chaos-rising

**Repo**: `foundryvtt-dcc/dcc-chaos-rising`
**Changes**:
- Same `contentImporter.js` fixes as accursed-heart (duplicate, scene.data)
- `module.json` compatibility updated from V11 to V14
- **Note**: Still uses old `contentImporter.js` pattern with NeDB `.db` packs. Needs future migration to Adventure documents + LevelDB packs.

### dcc-the-portal-under-the-stars

**Repo**: `foundryvtt-dcc/dcc-the-portal-under-the-stars`
**Changes**:
- `Math.clamped()` replaced with `Math.clamp()` in `trackingStatue.js` (deprecated since V10)
- `module.json` compatibility updated to V14
- Macro pack verified: all 5 macros are simple TrackingStatue API calls, no issues

## Adventure Modules - module.json Only (21)

These modules contain no code issues. Only `module.json` compatibility was updated to V14.

| Module | Repo | Previous Compat |
|--------|------|-----------------|
| dcc-beneath-the-well-of-brass | `foundryvtt-dcc/dcc-beneath-the-well-of-brass` | V13 |
| dcc-beyond-the-black-gate | `foundryvtt-dcc/dcc-beyond-the-black-gate` | V13 |
| dcc-blades-against-death | `foundryvtt-dcc/dcc-blades-against-death` | V13 |
| dcc-colossus-arise | `foundryvtt-dcc/dcc-colossus-arise` | V13 |
| dcc-danger-in-the-air | `foundryvtt-dcc/dcc-danger-in-the-air` | V13 |
| dcc-dark-tower | `foundryvtt-dcc/dcc-dark-tower` | V13 |
| dcc-doom-of-the-savage-kings | `foundryvtt-dcc/dcc-doom-of-the-savage-kings` | V13 |
| dcc-frozen-in-time | `foundryvtt-dcc/dcc-frozen-in-time` | V13 |
| dcc-intrigue-at-the-court-of-chaos | `foundryvtt-dcc/dcc-intrigue-at-the-court-of-chaos` | V13 |
| dcc-jewels-of-the-carnifex | `foundryvtt-dcc/dcc-jewels-of-the-carnifex` | V13 |
| dcc-lankhmar | `foundryvtt-dcc/dcc-lankhmar` | None |
| dcc-moon-slaves-of-the-cannibal-kingdom | `foundryvtt-dcc/dcc-moon-slaves-of-the-cannibal-kingdom` | V13 |
| dcc-sailors-on-the-starless-sea | `foundryvtt-dcc/dcc-sailors-on-the-starless-sea` | V13 |
| dcc-shadow-of-the-beakmen | `foundryvtt-dcc/dcc-shadow-of-the-beakmen` | V13 |
| dcc-the-chosen-sons-of-set | `foundryvtt-dcc/dcc-the-chosen-sons-of-set` | V13 |
| dcc-the-croaking-fane | `foundryvtt-dcc/dcc-the-croaking-fane` | V13 |
| dcc-the-emerald-enchanter | `foundryvtt-dcc/dcc-the-emerald-enchanter` | V13 |
| dcc-the-making-of-the-ghost-ring | `foundryvtt-dcc/dcc-the-making-of-the-ghost-ring` | V13 |
| dcc-the-rats-of-ilthmar | `foundryvtt-dcc/dcc-the-rats-of-ilthmar` | V12 |
| dcc-they-served-brandolyn-red | `foundryvtt-dcc/dcc-they-served-brandolyn-red` | V13 |
| dcc-tower-of-the-black-pearl | `foundryvtt-dcc/dcc-tower-of-the-black-pearl` | V13 |
| xcc-core-book | `foundryvtt-dcc/xcc-core-book` | V13 |

## Known Issues / Future Work

### NeDB Pack Migration Required
The following modules still use the old NeDB `.db` pack format with `contentImporter.js`:
- `dcc-accursed-heart-of-the-world-ender`
- `dcc-chaos-rising`

These need to be migrated to:
1. Adventure documents (single Adventure pack replacing multiple entity packs)
2. LevelDB pack format (directory-based instead of `.db` files)
3. `adventureImporter.js` pattern (replacing `contentImporter.js`)

This requires opening each module in Foundry, creating Adventure documents from the existing content, exporting the Adventure packs, and restructuring the module.

### V14 Breaking Changes Reference

Key V14 API changes that were applied:

| Deprecated | Replacement | Modules Affected |
|------------|-------------|-----------------|
| `foundry.utils.duplicate()` | `foundry.utils.deepClone()` | xcc, dcc-macros, accursed-heart, chaos-rising |
| `game.settings.get('core', 'rollMode')` | `game.settings.get('core', 'messageMode')` | xcc |
| `ChatMessage.applyRollMode()` | `ChatMessage.applyMode()` | xcc |
| `TextEditor.implementation.enrichHTML()` | `TextEditor.enrichHTML()` | dcc-crawl-classes |
| `Math.clamped()` | `Math.clamp()` | dcc-the-portal-under-the-stars |
| `game.actors.entities` | `game.actors` (iterable) | dcc-macros |
| `actor.data.type` | `actor.type` | dcc-macros |
| `actor.data.data.*` | `actor.system.*` | dcc-macros |
| `scene.data.tokens` / `scene.data.notes` | `scene.tokens` / `scene.notes` | dcc-macros, accursed-heart, chaos-rising |
| `token.update({dimLight})` | `token.document.update({"light.dim"})` | dcc-macros |
| `Roll().roll()` | `Roll().evaluate()` | dcc-macros |
| `mergeObject()` global | `foundry.utils.mergeObject()` | dcc-macros |
