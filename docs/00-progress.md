# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and
> after any significant decision. Future Claude sessions rely on this.
>
> **Detailed session-by-session history lives in phase archives:**
> - [Phase 0 + 1 — scaffolding + simple rolls](dev/progress/phase-0-1.md)
> - [Phase 2 — spell check migration](dev/progress/phase-2.md)
> - [Phase 3 — attacks, damage, crit, fumble + cruft](dev/progress/phase-3.md)
> - [Phase 4 — data-model slimming + class-mixin extension surface](dev/progress/phase-4.md)
> - [Phase 5 — sheet composition + class defaults + starting items](dev/progress/phase-5.md)

## Archive discipline

**This file is the index, not the log.** Keep it scannable — session
narratives belong in the phase archives above. Rules for maintaining
the split:

- **End-of-session updates go here first**, in *Recent slices*
  (newest at top). Write the slice narrative at whatever detail level
  feels right to the author; don't pre-abbreviate.
- **When *Recent slices* passes 5 entries, push the oldest down to
  the relevant phase archive.** The archives are chronological
  within each phase — append the demoted entry at the end of its
  section. Don't delete anything. If the entry belongs to a phase
  that isn't yet archived (e.g., first Phase 4 slice), start
  `dev/progress/phase-N.md` with the existing archive header style
  and link it from the index above.
- **New phase boundaries** (a slice starts Phase 4 / 5 / 6 / 7) get
  a new archive file from day one. The first slice of a new phase
  lands in *Recent slices* like any other; the archive file exists
  ready to receive it when it rotates out.
- **What stays here indefinitely:** *Current phase* (≤2 paragraphs,
  rewritten each session if the situation moved), *Closed questions*
  (short ticks), *Blockers / open questions* (active only — move
  resolved ones to *Closed* with a one-line date stamp),
  *PR #N review backlog* (these are actionable and short-lived —
  prune fixed items with strikethrough + date, delete fully when
  a section is empty), *Decisions made* (durable — never archived),
  *Next steps*, *Notes for future sessions*.
- **What never goes here:** session-by-session narrative beyond the
  5 most recent, historical decision rationale that's already
  captured in a completed slice, test-count deltas from older
  sessions. If you catch yourself summarizing a session that's
  already in an archive, delete the summary and let the archive
  speak.
- **Cross-linking rule.** Every entry in *Recent slices* should fit
  in 3–6 lines. If the slice has architecturally interesting detail,
  put that detail in the archive and link from the *Recent slices*
  bullet, don't inline it here.
- **No dedup pass required between this file and `01-session-start.md`.**
  The session-start prompt is a self-contained handoff; it will
  drift from this file's *Current phase* summary by a sentence or
  two and that's fine. They're read in different contexts (fresh
  session vs. in-progress update). If they diverge meaningfully,
  treat *this file* as authoritative and refresh the session-start
  prompt when the next slice lands.

**Length check.** If `00-progress.md` creeps past ~600 lines, one of
the rules above is being ignored. The *PR #720 review backlog* is
the most likely offender — prune fixed items with strikethrough +
date, then delete them entirely once a whole sub-section is cleared.

## Current phase

**Phase 5 session 2 (2026-05-18)** shipped the
`registerClassStartingItems` registry — the third Phase 5
extension hook alongside session 1's `registerClassDefaults`. New
stable hook `game.dcc.registerClassStartingItems(classId, items)`
+ `applyClassStartingItems(actor, classId)` helper in
`module/extension-api.mjs`. `CONFIG.DCC.classStartingItems = {}`
seeded in `module/config.js`. Each registered entry is a
`{ nameKey, type, img?, system? }` factory descriptor; the helper
localizes `nameKey` at apply time, checks the actor for a
matching `(type, name)` doc (idempotent on re-open), batches
missing entries into a single `createEmbeddedDocuments('Item',
[...])` call, and returns the created docs array.
`module/built-in-class-starting-items.mjs` carries the dwarf
ShieldBash seed (today's only built-in starting item); wired into
`module/dcc.js:init` via `registerBuiltInClassStartingItems`. The
dwarf sheet's inline ~21-line ShieldBash block in
`module/actor-sheets-dcc.js` collapsed to a 2-line uniform pattern
matched by all 7 PC sheets — `if (result === 'initialized')` →
`applyClassStartingItems` → `render(false)` when items created.
The other 6 sheets pick up the same call (no-op today since they
have no built-in entries) so homebrew classes registering items
through any PC sheet subclass get them applied automatically.
996 Vitest green (was 983, +13: 13 new `registerClassStartingItems`
/ `applyClassStartingItems` tests). +5 Playwright cases in
`extension-api.spec.js` (hook exposed on game.dcc; dwarf seed
shape; live end-to-end dwarf ShieldBash creation; idempotent on
second call; homebrew classId registration applied through the
same code path).

**Phase 5 session 1 (2026-05-18)** opened Phase 5 with the
`registerClassDefaults` registry — class identity (className,
classLink + optional mightyDeedsLink/spellcastingLink/spellburnLink
enriched-HTML), mechanical defaults (critRange, attackBonusMode,
…), and skill toggles (`shieldBash.useDeed`) packaged per class
and seeded via `module/built-in-class-defaults.mjs` for all 7 PC
classes. All 7 PC `_prepareContext` blocks shrunk from ~22 lines
to a single helper call (156 lines deleted). Detail rotates to
Recent slices below.

**Latent gap (pre-existing, NOT fixed by session 1 or 2):** the
warrior + dwarf `class.mightyDeedsLink` and wizard
`class.spellcastingLink` / `class.spellburnLink` writes don't
surface on `system.class.*` because no schema field registers them.
Sibling modules contribute `classLink` via `dcc.definePlayerSchema`
(and a slew of other class-extras like `archaicAlignment`,
`aiPatron`, `blasterDie`), but no module covers Mighty Deeds or
the wizard links. Templates render those fields → empty. The
legacy sheets have been writing these stripped values forever; the
refactor is byte-for-byte equivalent. Follow-up tracked in the
slice backlog.

Remaining Phase 5 work: (a) `registerSheetPart` for the
`CLASS_PARTS` / `CLASS_TABS` collapse (§3.2), (b) add the link
fields to the base Player schema to close the latent gap above
(low-risk pure schema slice), (c) migrate the remaining
capitalized `sheetClass` readers (Elf at `actor.js:182`; Cleric at
`actor.js:2180` / `actor.js:2481` / `dcc.js:746`) to
`actor.classId` — bundle with the `DCCSheet` collapse since that
restructures the writer side.

**Phase 4 (data-model slimming + class-mixin registry, closed
2026-05-18)** lifted per-class schema fields off the monolithic
`module/data/actor/player-data.mjs` body onto a single
`BUILT_IN_CLASS_MIXINS` table consumed via `registerClassMixin`.
All seven DCC classes (halfling, dwarf, thief, cleric, warrior,
wizard, elf) mixin-source their fields. The Phase 4 closer added
`DCCActor.classId` for normalized dispatch. Detail in
[`dev/progress/phase-4.md`](dev/progress/phase-4.md).

**Phase 3 (attacks, damage, crit, fumble — closed 2026-05-17)**
took every `rollWeaponAttack` downstream call to single-path
adapter via `dcc-core-lib`; the bespoke `promptSpellburnCommitment`
also retired in favor of a unified `promptRollModifierDialog`. Open
question #7 (modifier-dialog generalization) closed at session 27.
Detail in [`dev/progress/phase-3.md`](dev/progress/phase-3.md).

**Group E session 1 (2026-05-18)** landed the per-class
mercurial-magic table registry — `dcc.registerMercurialMagicTable`
hook + `CONFIG.DCC.mercurialMagicTables` registry. Closes the §2.4
XCC critique. Detail rotated to the Recent slices section below.

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-05-18 — Phase 5 session 2: `registerClassStartingItems`
  registry + dwarf ShieldBash migrated.** New stable extension
  hook `game.dcc.registerClassStartingItems(classId, items)` and
  companion `applyClassStartingItems(actor, classId)` helper in
  `module/extension-api.mjs`. `CONFIG.DCC.classStartingItems = {}`
  seeded in `module/config.js`. Each entry shape is a
  `{ nameKey, type, img?, system? }` factory descriptor — the
  helper localizes `nameKey` at apply time (item documents are
  created with `name: localize(nameKey)`), and the duplicate check
  matches on `(type, localized-name)` so renaming an existing
  auto-created item suppresses re-creation. Created items batch
  into a single `createEmbeddedDocuments('Item', [...])` call so
  multi-item registrations (future homebrew "Cultist" with multiple
  starting items) get the Foundry-preferred bulk-create shape, and
  the helper returns the created docs array so callers can decide
  whether to re-render. Dwarf ShieldBash seed registered via new
  `module/built-in-class-starting-items.mjs` table consumed by
  `module/dcc.js:init` (mirror of the mixins/defaults table
  pattern). The dwarf sheet's inline ~21-line ShieldBash
  auto-create block in `module/actor-sheets-dcc.js` collapsed to
  the same 2-line uniform pattern used by every other PC sheet:
  `if (result === 'initialized')` → `applyClassStartingItems` →
  `render(false)` when created.length>0. All 7 PC sheets now share
  identical `_prepareContext` shape — only the `classId` literal
  differs. Future-homebrew benefit: a sibling module registering
  starting items for its own classId gets them applied
  automatically through any PC sheet subclass that uses the
  uniform pattern (no monkey-patching, no subclassing needed).
  +13 Vitest tests in `extension-api.test.js` covering both helpers
  (registration storage / self-heal / last-write-wins / validation
  throws; helper create-missing / skip-existing /
  partial-create-mixed-state / unregistered no-op / empty-list
  no-op / malformed-entry defense / lean-payload omits img+system).
  996 Vitest green (was 983, +13). +5 Playwright cases in
  `extension-api.spec.js` exercising the hook end-to-end against
  live Foundry: hook exposed on `game.dcc`; built-in dwarf entry
  seeded with the expected shape AND no other DCC class has
  entries; live dwarf actor gets ShieldBash created via
  `applyClassStartingItems`; idempotent on second call (no
  duplicate); homebrew classId registered mid-test propagates
  through the helper. **Phase 5 active sub-arc progress:** schema
  mixins (component 1, Phase 4) + class defaults (component 3,
  Phase 5-1) + starting items (component 5, Phase 5-2) all
  complete for the dwarf vertical. Remaining: sheet parts
  (component 2, registerSheetPart — Phase 5 session 3 territory)
  and lib progression (component 6, Phase 6).
- **2026-05-18 — Phase 5 session 1: `registerClassDefaults` registry
  + 7 PC sheets migrated.** New stable extension hook
  `game.dcc.registerClassDefaults(classId, defaults)` and companion
  `applyClassDefaults(actor, classId)` helper in
  `module/extension-api.mjs`. Each entry packages the
  `_prepareContext` first-open writes the legacy class-sheet subclasses
  inlined: `sheetClass` (capitalized sentinel that drives the
  initial-setup-vs-maintenance dispatch), `localize` (i18n keys for
  `class.className`), `enrichHtml` (i18n keys for `class.classLink` +
  optional `mightyDeedsLink` / `spellcastingLink` / `spellburnLink`),
  and `literal` (scalar mechanical defaults — critRange,
  attackBonusMode, addClassLevelToInitiative, spellCheckAbility,
  showBackstab / showSpells, `skills.shieldBash.useDeed`).
  `applyClassDefaults` returns `'initialized' | 'regenerated' |
  'unchanged'` so the dwarf sheet can still gate its inline
  ShieldBash auto-create on the `'initialized'` branch — that
  starting-item logic stays inline pending a follow-up
  `registerClassStartingItems` slice. Seven built-in PC entries
  (cleric/dwarf/elf/halfling/thief/warrior/wizard) seeded via the
  new `module/built-in-class-defaults.mjs` table consumed by
  `module/dcc.js:init` only (integration tests don't open sheets,
  so the shared production-and-test registration pattern the mixin
  table uses isn't needed here). All 7 PC sheets in
  `module/actor-sheets-dcc.js` shrunk from ~22-line
  `_prepareContext` blocks to a single
  `applyClassDefaults(this.options.document, '<classId>')` call —
  net 156 lines deleted (623 → 467); `TextEditor` import dropped
  alongside (it was only used by the now-extracted blocks). Generic
  sheet stays untouched (not class-bound, has no maintenance branch
  in the legacy code either). +11 Vitest in `extension-api.test.js`
  covering both helpers (registration storage, self-heal on missing
  registry, last-write-wins, validation throws on bad classId /
  bad defaults / missing sheetClass / missing CONFIG.DCC; helper
  initial-setup payload shape, maintenance-branch enrichHtml-only
  payload, dual-enrichHtml mightyDeedsLink path, `unchanged` /
  `initialized` / `regenerated` returns, defensive partial-entry
  handling). 983 Vitest green (was 970, +13: 11 new helper tests
  + 2 happy-path flippers). +5 Playwright cases in
  `extension-api.spec.js` exercising the new helper end-to-end
  against live Foundry: hook exposed on `game.dcc`; seed table
  shape across all 7 PC classes asserting sheetClass + classLink
  presence + critRange/attackBonusMode literal correctness; warrior
  + dwarf carry the mightyDeedsLink slot AND wizard carries
  spellcastingLink + spellburnLink; `applyClassDefaults` full
  lifecycle on a halfling Player (initial → unchanged on second
  call → regenerate after classLink wipe); warrior literal-defaults
  end-to-end (`attackBonusMode='autoPerAttack'`,
  `addClassLevelToInitiative=true`). 122 Playwright passed (was
  117, +5), 1 latent failure (xcc-core-book DCCItemSheet override,
  unchanged baseline). **Latent gap surfaced, NOT fixed in this
  slice:** the warrior + dwarf `class.mightyDeedsLink` and wizard
  `class.spellcastingLink` / `class.spellburnLink` writes don't
  surface on `system.class.*` because those paths aren't registered
  on the Player schema (only `class.classLink` is, contributed by
  a sibling module's `dcc.definePlayerSchema` hook — the test
  world also adds dozens of XCC/MCC extras like `archaicAlignment`,
  `aiPatron`, `blasterDie`). Templates render
  `{{{system.class.mightyDeedsLink}}}` → empty. Legacy sheets have
  been writing these stripped values forever; my refactor matches
  byte-for-byte. Tracked as a follow-up: either register the link
  fields in the static `class` SchemaField in `player-data.mjs` or
  document the missing sibling contribution in `EXTENSION_API.md`.
  Opens Phase 5; remaining work is the `registerSheetPart` collapse
  (§3.2), `registerClassStartingItems` (§3.4), and the
  remaining-capitalized-`sheetClass`-readers migration (Elf at
  `actor.js:182`; Cleric at `actor.js:2180`/`actor.js:2481`/
  `dcc.js:746` — bundled with whichever later Phase 5 slice touches
  the writer side).
- **2026-05-18 — Phase 4 session 7: `DCCActor.classId` accessor for
  class dispatch.** Closes the non-class-extraction sub-slice that
  was open in the Phase 4 sub-arc: replace `system.details.sheetClass
  === 'Halfling'` string comparisons with a normalized
  `actor.classId === 'halfling'` accessor reading the canonical
  lowercase ID. New getter on `DCCActor` (`module/actor.js:65-74`)
  returns `system.details.sheetClass?.toLowerCase()` or `null` when
  unset. Backing store stays `system.details.sheetClass` (still the
  capitalized sheet label that `_prepareContext` writes on first
  open — sheet-side rewrite is Phase 5 territory); the accessor
  exists so caller-side dispatch matches the lib's
  `character.classInfo.classId` convention and is robust to future
  sheetClass-shape shifts. Two call sites migrated: the halfling
  two-weapon fumble note in `module/actor.js:3281` (rollWeaponAttack
  message-building) and the halfling agility-floor branch in
  `module/item.js:70` (two-weapon dice-penalty + crit-range
  computation). Other capitalized sheetClass comparisons (Elf at
  `actor.js:182`, Cleric at `actor.js:2180/2481` + `dcc.js:746`)
  left untouched — out of slice scope; they can migrate
  opportunistically alongside the Phase 5 `registerClassDefaults`
  work where the writer side of `sheetClass` gets restructured. +4
  Vitest tests in `actor.test.js` (null when unset / null when
  missing / lowercases canonical labels for halfling/wizard/dwarf /
  idempotent when already lowercase). +1 Playwright case in
  `extension-api.spec.js` exercising the accessor end-to-end against
  a live Player document (default null → 'halfling' → 'warrior' →
  null on clear). 970 Vitest green (was 966, +4); 117 Playwright
  passed (was 116, +1 classId case), 1 latent failure (xcc-core-book
  DCCItemSheet override, unchanged baseline). With component 1
  (schema mixins) complete and the class-id dispatch helper in
  place, Phase 4's active sub-arc is closed; remaining work is
  Phase 5 (sheet composition + class defaults).
- **2026-05-18 — Phase 4 session 6: wizard + elf class-mixin
  extraction (closes per-class arc).** New `'wizard'` + `'elf'`
  entries in `BUILT_IN_CLASS_MIXINS` (`module/built-in-class-mixins.mjs`)
  both call a shared `attachWizardFields(schema)` helper that
  contributes 9 wizard class fields (`knownSpells` /
  `maxSpellLevel` / `spellCheckOtherMod` / `spellCheckDieOverride`
  / `spellCheckOverride` / `patron` / `patronTaintChance` /
  `familiar` / `corruption` HTMLField). Wizard mixin attaches them
  via the helper; elf mixin **also** calls the helper (last-
  write-wins makes the second-running mixin's pass functionally a
  no-op as long as both build identical instances) **and** then
  overrides `skills.detectSecretDoors` with the HeightenedSenses
  defaults (`label='DCC.HeightenedSenses'` / `ability='int'` /
  `value='+4'`). Base body kept the non-Elf default; the elf mixin
  replaces the entire SchemaField. Static `class` block in
  `module/data/actor/player-data.mjs` collapsed to a single
  `className` StringField; static `skills` block to just the
  base `detectSecretDoors`. `HTMLField` + `NumberField` imports
  dropped (only `SchemaField`, `StringField`, `BooleanField`
  remain — the wizard/cleric `NumberField` usages all moved to
  their respective mixins). **All seven DCC classes mixin-source
  their fields** — component 1 of the Class Decomposition is
  complete for every built-in. +2 Playwright cases
  (`built-in wizard mixin` asserts all 9 wizard class-field
  initials + key types reading from `_source`; `built-in elf mixin
  attaches wizard fields AND overrides detectSecretDoors`
  asserts the same wizard fields are present plus the elf
  detectSecretDoors override). 966 Vitest unchanged; 116
  Playwright passed (was 114, +2 wizard/elf cases), 1 latent
  failure (xcc-core-book DCCItemSheet override, unchanged
  baseline).
- **2026-05-18 — Phase 4 session 5: warrior class-mixin extraction.**
  Smallest remaining class block. New `'warrior'` entry in the
  `BUILT_IN_CLASS_MIXINS` table (`module/built-in-class-mixins.mjs`)
  contributes `class.luckyWeapon` (nullable StringField, initial
  null) + `class.luckyWeaponMod` (StringField, initial `'+0'`). No
  skills — warrior is the only DCC class whose contribution is
  pure class-fields. Static block deleted from
  `module/data/actor/player-data.mjs`. +1 Playwright case in
  `extension-api.spec.js` asserts the nullable StringField initial
  (`luckyWeapon === null`) + the signed-string default
  (`luckyWeaponMod === '+0'`) + field types
  (`StringField` for both, `nullable: true` for `luckyWeapon`)
  reading from `_source`. 966 Vitest unchanged; 114 Playwright
  passed (was 113, +1 warrior case), 1 latent failure (xcc-core-book
  DCCItemSheet override, unchanged baseline). Six-of-seven DCC
  classes (halfling, dwarf, thief, cleric, warrior) now mixin-source;
  wizard + elf remain together for session 6.
- **2026-05-18 — Phase 4 session 4: cleric class-mixin extraction +
  shared `built-in-class-mixins.mjs` table.** Built-in `'cleric'`
  mixin contributes 8 class fields (`spellCheck` NumberField,
  `spellCheckAbility` StringField, `spellsLevel1–5` NumberFields,
  `deity` nullable StringField, `disapproval` NumberField min=1
  max=20, `disapprovalTable` StringField) + 3 disapproval-range
  skills (`divineAid` / `turnUnholy` / `layOnHands`) sharing a
  `disapprovalSkill(label, extra)` helper inside the mixin body —
  `divineAid` extends with a NumberField `drainDisapproval` slot.
  All four built-in mixin registrations relocated from
  `module/dcc.js:init` inline `registerClassMixin('halfling', …)`
  calls to a single `BUILT_IN_CLASS_MIXINS` table in
  `module/built-in-class-mixins.mjs` plus a
  `registerBuiltInClassMixins(register)` helper consumed by both
  production (init hook) and the integration-test setup
  (`module/__integration__/setup-foundry.js`). The latter additions
  fix three pre-existing assertions in
  `module/__integration__/data-models.test.js` that broke when the
  cleric block left the static schema body
  (`class.disapproval=1` / `class.deity=null` / NumberField min/max
  validation) — integration tests construct `PlayerData` directly
  without invoking the Foundry `init` hook, so the inline registrations
  in `dcc.js` weren't running for them. Net diff in `dcc.js`: −76
  lines of inline mixin code → +1 helper call (kept the rest of the
  init logic untouched). +1 Playwright case in
  `extension-api.spec.js` asserts schema-defaults + field types,
  reading from `player.system._source` so the assertions stay valid
  even though `prepareDerivedData` overwrites `class.spellCheck` and
  the cleric skill `.value` slots with computed strings. Field-type
  assertions confirm `disapproval`→NumberField, `deity`→StringField,
  `useDisapprovalRange`→BooleanField, `drainDisapproval`→NumberField,
  and that `turnUnholy` / `layOnHands` do NOT carry the
  divineAid-specific `drainDisapproval` slot. 966 Vitest green
  (unchanged); 113 Playwright passed (was 112, +1 cleric case), 1
  latent failure (xcc-core-book DCCItemSheet override — unchanged
  from baseline).

## Closed questions

5. ~~**Patron-taint mechanic alignment.**~~ **Resolved 2026-04-24 at
   Session 21 / D3a: `dcc-core-lib@0.7.0` models the two RAW triggers
   (creeping chance + patron-spell result-table entries) plus the
   natural-1-forces-row-1 rule; `_runLegacyPatronTaint` deleted.
   D3b (manifestation table loader + cross-repo content mirror) closed
   at session 22; D3b-γ (sibling audit) closed as a no-op; D3c
   (dead-flag cleanup) closed at session 23 via `dcc-core-lib@0.8.0`.
   Entire D3 arc complete.**

6. ~~**Spellburn dialog integration.**~~ **Resolved 2026-04-18 at
   Phase 3 session 1: adapter-side `promptSpellburnCommitment` dialog
   via DialogV2, wired into `rollSpellCheck` dispatcher for the
   wizard / elf + `showModifierDialog` branch.** The latent regression
   from Phase 2 session 2 (wizard adapter casts silently lost the
   Spellburn UI) is fixed. Other legacy-dialog capabilities (die
   tweak, custom modifier rows, CheckPenalty toggle, FleetingLuck)
   remain absent on the adapter path and will be revisited once the
   attack / damage dialog work generalizes the roll-dialog scaffold.

3. ~~**Dead hook `dcc.update`.**~~ **Resolved 2026-05-18: don't emit.**
   Git history showed the DCC system never emitted the hook; XCC's
   listener was speculative from its initial commit (`24b68b1`) and
   its body was a debug-only `console.log` gated on `isDebug` —
   redundant with the adjacent Foundry-native `updateActor` listener
   doing the same thing. Inventing an emission contract from nothing
   would add coupling without a real consumer. XCC removed the
   listener on `chore/drop-dead-dcc-update-hook`; `EXTENSION_API.md`
   Dead-hook table cleared.

## Blockers / open questions

1. ~~**Runtime loading strategy.**~~ **Resolved 2026-04-17: vendor
   approach (option b).** `scripts/sync-core-lib.mjs` builds the linked
   lib and copies its `dist/` into `module/vendor/dcc-core-lib/`, which
   is committed. Adapter code imports via relative path
   (`../vendor/dcc-core-lib/index.js`). No bundler added. One sync
   command (`npm run sync-core-lib`) + one commit per lib-version bump.

2. ~~**Package name discrepancy.**~~ **Closed 2026-05-18.** The
   underlying issue (the unscoped `dcc-core-lib` cannot be `npm
   install`ed because only the scoped `@moonloch/dcc-core-lib` is
   published) was rendered moot by the vendor approach (open question
   #1, resolved 2026-04-17) — the system imports from
   `module/vendor/dcc-core-lib/` and never `npm install`s the lib at
   all. The documentation cleanup (2026-05-18) updated the top of
   `ARCHITECTURE_REIMAGINED.md`, the install step in Phase 0, the
   `EXTENSION_API.md` header, and the "Working with dcc-core-lib"
   section in `CLAUDE.md` to call out the scoped name explicitly and
   note that the bare `dcc-core-lib` token in branch / vendor / repo
   identifiers refers to local-only paths, not the npm package.
   Historical session-handoff prose that says e.g. "synced
   dcc-core-lib@0.7.0" is unchanged — it refers to lib versions, not
   install instructions, and the context is unambiguous.

4. ~~**Undocumented `game.dcc.*` pieces with heavy XCC usage.**~~
   **Closed 2026-05-18.** Re-audit of XCC, MCC, dcc-crawl-classes,
   dcc-qol, and the four content-pack modules against the current
   stable surface confirmed: every `game.dcc.*` symbol XCC actually
   touches (`DCCRoll.createRoll` / `DCCRoll.cleanFormula`,
   `DiceChain.bumpDie` / `calculateCritAdjustment` /
   `calculateProportionalCritRange`, the five-method `FleetingLuck`
   surface — `init`, `updateFlags`, `give`, `enabled`,
   `automationEnabled`, the latter two consumed via
   `Object.defineProperty`, so they must remain configurable —
   `processSpellCheck`, and `registerActorSheet`) appears in
   `EXTENSION_API.md`'s Stable table. No undocumented usage and no
   gaps. The audit also caught two doc-rot items, both fixed in the
   same pass: `dcc.afterComputeSpellCheck` now has a live XCC
   consumer (XCC retired `xcc-actor.js` + `CONFIG.Actor.documentClass`
   override 2026-05-18 in favor of the hook) and XCC migrated all 19
   actor-sheet registrations to `game.dcc.registerActorSheet`. MCC
   (7 sites) and dcc-crawl-classes (9 sites) have not migrated yet;
   that's opt-in with no deadline. See `EXTENSION_API.md` re-audit
   header dated 2026-05-18.

7. **Wizard / elf adapter-path modifier-dialog coverage beyond
   Spellburn.** **Fully resolved 2026-05-17 across sessions 26 +
   27.** Session 26 / Q7-phase1 landed
   `promptRollModifierDialog` + the skill-check fold; session 27 /
   Q7-phase2 extended the wrapper with an optional spellburn
   descriptor and folded wizard / cleric / naked spell-check
   routes onto it (retiring the bespoke
   `promptSpellburnCommitment` helper). The unified prompt now
   surfaces Die / Compound / CheckPenalty / Spellburn / Other
   Bonus in one dialog for both skill checks and spell checks,
   matching the legacy `DCCItem.rollSpellCheck` term layout.
   `_castViaCalculateSpellCheck` subtracts the lib's auto level +
   ability from the dialog total to avoid double-counting when
   feeding the user's flat modifier as a situational. Can be
   closed.

## PR #720 review backlog (2026-04-19)

PR #720 (the merge of Phases 0-3 into `main`) triggered a full
8-agent review. Safe auto-fixes landed in the PR as follow-up
commits; the items below are the deferred findings — real issues or
design calls — that are out of scope for a "review cleanup" commit
and should be scheduled into Phase 4+ work.

**Blocking for Phase 4 start (pick up before broadening the adapter):**

- ~~**Silent adapter→legacy fallbacks missing a logged reason.**~~
  **Fixed 2026-04-23.** Each silent-fallback site now emits a
  `reason=<tag>` field on the dispatch log so the code path is
  readable from the console without opening the source.
    - `buildSpellCheckArgs` returns `null` (custom-class caster with
      no lib profile) → `_rollSpellCheckLegacy` called with
      `reason: 'noCasterProfile'`; the legacy dispatch log carries
      `reason=noCasterProfile` alongside the `spell=…` field.
    - `loadDisapprovalTable` returns `null` (cleric actor without a
      disapproval table configured) → a second
      `logDispatch('rollSpellCheck', 'adapter', { reason: 'noDisapprovalTable' })`
      line fires from `_castViaCalculateSpellCheck`. The adapter path
      continues (degradation, not legacy fall-back) but the silent
      sub-roll skip is now observable.
    - `loadMercurialMagicTable` returns `null` (wizard/elf first-cast
      with no mercurial table) → `_rollMercurialIfNeeded` emits a
      `logDispatch('rollSpellCheck', 'adapter', { reason: 'noMercurialTable' })`
      line and bails; the cast continues without a fresh effect.
  Coverage: three new unit tests in
  `module/__tests__/adapter-spell-check.test.js` (`…reason=noCasterProfile`,
  `…reason=noDisapprovalTable`, `…reason=noMercurialTable`) and three
  matching Playwright cases in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.
- ~~**Partial-failure state when `_castViaCalculateSpellCheck`'s pass-2
  returns `result.error`.**~~ **Fixed 2026-04-23.** Events now run
  with a rollback-capable wrapper; if pass-2 returns `result.error`
  the adapter reverses applied actor / spellItem mutations before
  returning.
- **Spellburn dialog prompts before the adapter knows it can handle
  the cast.** `rollSpellCheck` (`module/actor.js:1914-1940`) calls
  `promptSpellburnCommitment` before `_rollSpellCheckViaAdapter` tries
  `buildSpellCheckArgs` — when the actor's class has no lib caster
  profile the adapter falls back to `_rollSpellCheckLegacy`, which
  ignores `options.spellburn`, silently dropping the user's
  commitment. Scope is narrow (custom-class wizards / elves with
  spellburn) but user-visible. Fix: a cheap `resolveCasterProfile`
  pre-check before the dialog, or have legacy honor `options.spellburn`.

**Design calls (need a deliberate decision, not a silent fix):**

- **Spellburn clamp: `1` vs `0`.** `onSpellburnApplied`
  (`module/adapter/spell-events.mjs:124`) clamps ability scores at
  1; legacy `DCCSpellburnTerm` allowed 0 (RAW permits a wizard dying
  from Stamina burn). The docstring acknowledges the adapter's
  choice. Decide: preserve legacy (allow 0) or keep the safer
  adapter floor (1) and document it as a house-rules change.
- **Damage `_total` clamp divergence** (`module/actor.js:3096`).
  Foundry clamps `damageRoll._total = 1` when below; the lib
  doesn't. Review cleanup added `warnIfDivergent` with post-clamp
  normalization, so no more false-positive warns — but the
  `dcc.libDamageResult.total` flag can still carry `0` or a negative
  while chat shows `1`. Decide: mirror the clamp on the flag
  (`libDamageResult.total = Math.max(1, libResult.total)`) or
  document that the flag is "lib-native, pre-clamp" and let
  consumers clamp.
- **Error boundaries around `_xxxViaAdapter`.** A lib throw currently
  becomes an unhandled rejection → the cast silently fails, broken UX.
  Wrapping every adapter path in `try/catch` with legacy fallback
  would make the system more forgiving, but risks masking the very
  lib bugs the observational refactor is designed to surface. Right
  answer is probably: add the fallback *after* Phase 4-5 prove the
  adapter paths stable.
- **`createFoundryRoller` — delete or wire.** Review cleanup updated
  the docstring to reflect that no dispatcher path currently consumes
  it. Phase 4 should either adopt it (replacing the inline `new Roll`
  + `evaluate()` scattered across dispatchers) or delete the file.

**Resilience (low-risk, nice-to-have):**

- ~~**`rollSpellCheck`'s cleric branch silently no-ops without
  `details.sheetClass = 'Cleric'`.**~~ **Fixed 2026-04-23.** The
  dispatcher's `isCleric` gate in `module/actor.js` now accepts
  either `system.details.sheetClass === 'Cleric'` OR
  `system.class.className === 'Cleric'` — programmatic PCs (anything
  not routed through the level-change dialog) route via the cleric
  adapter path instead of silently no-oping on the legacy
  `spellItem.rollSpellCheck` delegate. Matches the class-identity
  key `resolveCasterProfile` (`spell-input.mjs:194`) already uses.
  Symmetric effect: wizard / generic branches on a
  className-only-Cleric actor now correctly route to legacy
  (preserving the "wizard spell on cleric → legacy side-effect set"
  contract). Coverage: unit test
  `adapter path fires for a cleric-castingMode item on a
  className-only Cleric (no sheetClass)` in
  `module/__tests__/adapter-spell-check.test.js`; Playwright case
  `cleric-castingMode spell on className-only Cleric (no sheetClass)
  → adapter + chat` in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.

- **Programmatic PC creation produces inconsistent class config —
  the system relies on the level-change dialog to populate it.**
  `Actor.create({..., system: { class: { className: 'Wizard' } } })`
  does NOT set `class.spellCheckAbility` (defaults to `'per'` for
  every class — Wizards then cast with Personality, formula AND
  flavor), `details.sheetClass` (cleric branch above won't fire),
  `saves.{ref,frt,wil}.classBonus` (saves drop to ability-mod-only),
  or class-appropriate crit die / luck die / etc. Real users get
  these via the level-change dialog (which applies a class-specific
  level item from `CONFIG.DCC.levelDataPacks`), so end-users don't
  hit this — it bites browser-test fixtures, the PC parser when a
  field is missing, and any future "quick PC" tooling. Two paths to
  resolve: (a) document the level-change-dialog dependency
  prominently and have programmatic creators call into the same
  apply-level-data routine, or (b) register the standard DCC class
  progressions with the lib (`registerClassProgression`) and have
  the system auto-derive defaults from `class.className` + level on
  prepare. The lib already has `getSavingThrows("warrior", 3)` etc.
  — currently returns zeros because no class is registered. Option
  (b) is more invasive but eliminates a whole class of "PC silently
  has wrong stats because user skipped the level-up dialog" bugs.
  Surfaced 2026-04-23 during exhaustive manual-testing.

- **Chat doesn't surface the per-modifier breakdown the adapter
  already captures.** The lib emits each contributing modifier with
  rich origin metadata (`{ kind, value, origin: { category, id,
  label }, applied }`) and the adapter persists the array onto the
  ChatMessage as `flags.dcc.libResult.modifiers` (see
  `module/adapter/chat-renderer.mjs` — every renderer projects it).
  Nothing currently renders it: chat templates don't reference
  `libResult.modifiers`, and because the adapter builds the Foundry
  Roll from the lib's flat formula string (`new Roll(plan.formula)`),
  Foundry's native term-tooltip is unlabelled too — a regression vs.
  the legacy `module/roll-modifier.js` path, which set per-term
  `label` (e.g. "Strength", "Stamina") that Foundry's tooltip
  surfaced. Cheapest fix: a small chat-template partial under the
  rolled formula that lists each `applied` modifier as
  `<origin.label> <signed value>` (e.g. "STA modifier +1, Save bonus
  +0"). More invasive alternative: reconstruct the Roll term-by-term
  in the adapter so the native Foundry tooltip works again — keeps
  parity with the legacy path's UX without adding a chat partial,
  but requires every renderer / dispatcher to thread structured
  terms instead of a string formula. Surfaced 2026-04-23 during the
  Cheesemaker save-bonus debugging session — modifier metadata is
  available to downstream modules (`dcc-qol` etc.) and to debugger
  scripts via the flag, but invisible to the player reading chat.

- **Dispatcher gate style inconsistency.** Attack / damage / crit /
  fumble use named `_canRouteXxxViaAdapter` predicates; ability /
  save / skill / spell / init inline their gates as
  `const needsLegacyPath = …`. Pick one convention and retrofit —
  the named predicate form scales better as gates grow.
- **Unused `weapon` / `attackRollResult` parameters** on
  `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`
  (`weapon` unused) and `_rollCriticalLegacy` / `_rollFumbleLegacy`
  (`attackRollResult` unused). Dropping them touches test call
  sites that pass positional args; clean as a pair of coordinated
  edits but out of scope for the review cleanup. Tracker: do this
  with the gate-style unification above. (Note: `_rollCriticalLegacy`
  / `_rollFumbleLegacy` retired at session 16 — revisit the
  remaining predicate params.)
- **Three copies of "strip die count" normalization:**
  `module/adapter/attack-input.mjs:normalizeLibDie`,
  `module/adapter/spell-input.mjs:normalizeLibDie` (private), and
  `module/actor.js:_stripDieCount`. Pick one canonical
  `normalizeLibDie` (probably `attack-input.mjs`'s, it's already
  exported) and consolidate.
- **Four near-identical `dcc.libResult` flag payloads** in
  `module/adapter/chat-renderer.mjs` — every renderer hand-rolls
  the same projection plus the `FleetingLuck.updateFlags` guard.
  Extract a `buildLibResultFlag(result, extras)` + `applyFleetingLuck(flags, roll)`
  helper; renderers keep per-type extras only.
- **Uncached compendium walks.**
  `loadDisapprovalTable` + `loadMercurialMagicTable`
  (`module/adapter/spell-input.mjs`) walk packs on every cleric
  disapproval / wizard first-cast. `getCritTableLink` +
  `getCritTableResult` (`module/utilities.js`, reached from
  `_rollCriticalViaAdapter`) do two independent pack walks per
  crit. Module-level `Map` cache keyed on `tableName`, cleared on
  world reload, is plenty. The caching opportunity was already
  flagged in `spell-input.mjs:399`.
- **`migrateWorld` per-doc catches swallow silently** (C2 review,
  2026-04-24). Four `catch (err) { console.error(err) }` sites in
  `module/migrations.js` (`migrateWorld`'s actors/items/scenes loops
  + `migrateCompendium`) log to console and keep going. A
  migration that fails on every document still stamps the world at
  `NEEDS_MIGRATION_VERSION` and shows the green "complete"
  notification, so the GM has no signal. Align with the
  `9e79459 feat(adapter): reason codes for silent adapter→legacy
  fallbacks` pattern: accumulate failures into a `failedMigrations[]`
  array, surface a `ui.notifications.warn` with the count at the
  end, and only stamp the version when the run was clean.
- **`migrateWorld` fire-and-forget from a sync ready hook** (C2
  review, 2026-04-24). `checkMigrations` calls `migrations.migrateWorld()`
  without `await` from a non-async ready callback, so the rest of
  the ready chain (`registerTables`, `FleetingLuck.init`,
  `SpellDuel.init`, `defineStatusIcons`, welcome dialog,
  `Hooks.callAll('dcc.ready')`) runs concurrently with the async
  per-document mutations. Third-party modules listening on
  `dcc.ready` can fire against a half-migrated world. Pre-existing;
  elevated by C2 because the guard-up-front approach now means
  ordering is the only remaining correctness lever. Fix: make
  `checkMigrations` async, `await migrations.migrateWorld()`, and
  thread a `{ migrationComplete: true }` payload on `dcc.ready`.

**Test coverage gaps (pr-test-analyzer severity ≥ 6):**

- `renderDisapprovalRoll` has no unit/integration test — only covered
  transitively via the cleric disapproval browser-test case.
- `promptSpellburnCommitment` + `clampBurn` are entirely mocked
  across every caller; `roll-dialog.mjs` has no direct coverage.
- `onSpellLost` is tested as a direct callback but never verified to
  *actually fire* during a real adapter cast — regression surface if
  `createSpellEvents` wiring drifts.
- Two-pass divergence (hook mutates terms *after* pass 1) only has
  coverage for the `terms[0]` die-bump case; `terms[N]` Compound /
  Modifier in-place mutations are uncovered.
- `_canRouteAttackViaAdapter` untested branches: dice-bearing
  `weapon.toHit` (e.g. `+1d4` magic), `twoWeaponSecondary: true`,
  and the `game.settings.get` try/catch fallback. **(Note: gate
  retired at session 15 — these assertions moved to the single-path
  body.)**
- `_rollToHitViaAdapter` NPC `attackHitBonus.melee.adjustment`
  Modifier injection block is uncovered (PC-only tests).
- `_rollToHitViaAdapter` `Roll.validate(toHit) === false` early
  return path is untested.
- `loadDisapprovalTable` / `loadMercurialMagicTable` isolated
  fallback-order tests (compendium hit / world fallback / both miss)
  are missing.
- `createFoundryRoller` has no direct unit test (ties to the
  delete-or-wire decision above).
- `__mocks__/dcc-roll.js` declares `createRoll` as `static async`
  while production is sync; tests install local sync stubs to
  paper over the mismatch — fix the shared mock, delete the stubs.
- **Surviving data-driven migration branches have no fixture
  tests** (C2 review, 2026-04-24). `migrateActorData` /
  `migrateItemData` retain the V14 ActiveEffect numeric-mode →
  string-type converter, the `sheetClass`-from-localized-`className`
  inverse helper, `critRange` / `disapproval` string→number
  coercion, `luckyRoll` → `birthAugur`, and default alignment.
  None have direct Vitest coverage; they're exercised only
  transitively when Foundry boots a real world. The V14 AE
  converter is particularly V14-critical — if it silently stops
  running, every pre-V14 active effect fails to apply on upgrade.
  Proposed: `migrations-data-driven.test.js` with one fixture per
  branch (numeric-mode effect → string-type, localized
  `className: 'Zwerg'` → `sheetClass: 'Dwarf'`, stringy
  `critRange: '20'` → number, unaligned actor → alignment `'l'`,
  `luckyRoll: '…'` → `birthAugur`). Requires exporting
  `migrateActorData` / `migrateItemData` (currently module-local
  `const`) or a test-only export.

**Documentation / comment hygiene:**

- `docs/dev/ARCHITECTURE_REIMAGINED.md` §7 Phase-1 bullets reference
  lib APIs `rollCheck('ability:str', …)` / `resolveSkillCheck(…)` /
  `rollInitiative(…)` but the adapter landed `rollAbilityCheck` /
  `rollSavingThrow` / `rollCheck` (subsumed skill + init). Annotate
  the bullets with landed names.
- ARCHITECTURE_REIMAGINED.md §2.7 file-size snapshot is pinned to
  branch start; prefix with a `(Snapshot at main @ 2337ec0)` note
  so readers don't mistake it for current state.
- `module/actor.js:2136-2138` ("post the disapproval roll chat
  after the main spell-check chat, mirroring the legacy two-message
  ordering") overstates ordering guarantees — `onDisapprovalIncreased`
  fires fire-and-forget inside pass 2, actual interleaving is at
  the mercy of Foundry's chat-message pipeline. Soften the claim or
  `await` the chat-message creation inside the event.
- `_getInitiativeRollViaAdapter` accepts an `options = {}` parameter
  it never reads — drop, or document "reserved for future
  modifier-dialog bridge."

**Performance (below measurement threshold; document only):**

- `getActionDice` called 3× per `_rollToHitViaAdapter`
  (`module/actor.js:2735-2752`). Hoist to a single `const dice = ...`.
- `items.find` called 2× per `_getInitiativeRollViaAdapter`
  (`module/actor.js:1065, 1070, 1129, 1133`). Fold into one iteration.
- `renderDisapprovalRoll` / `renderMercurialEffect` use
  `new Roll('${N}d1')` for deterministic chat. Use
  `Roll.fromTerms([new NumericTerm({ number: total })])` — no
  measurable win, but reads cleaner.

## Decisions made

0. **Runtime loading: vendor the lib's built `dist/`.** See open
   question #1 above for the full rationale. Committed the initial
   sync + `scripts/sync-core-lib.mjs` in a standalone prep commit so
   Phase 1 imports have somewhere to import *from*. The sync script
   reads from `$DCC_CORE_LIB_SRC` (default
   `/Users/timwhite/WebstormProjects/dcc-core-lib`), runs `npm run
   build` inside the lib, wipes and copies `dist/`, and writes a
   `VERSION.json` with `{ name, version, commit, dirty, syncedAt }`.
   `module/vendor/**` added to `standard.ignore` so the linter skips
   vendored output.

1. **Worktree location.** Now at
   `/Users/timwhite/FoundryVTT-Next/Data/systems/dcc`. Main repo remains
   at `/Users/timwhite/FoundryVTT/Data/systems/dcc`.
   *Why:* `FoundryVTT-Next` is a separate Foundry user-data install, so
   the worktree can live under its `systems/` directory without clashing
   with the main repo on `system.json` id (each Foundry install sees
   only its own `systems/` tree). This lets Tim actually run the
   refactored system in Foundry for testing during Phase 1+.
   *History:* originally parked at
   `/Users/timwhite/WebstormProjects/dcc-refactor` on 2026-04-17 to
   avoid `systems/` collisions; moved same day once the separate
   `FoundryVTT-Next` install was set up.

2. **No `package.json` dependency entry this phase.** Adding
   `"@moonloch/dcc-core-lib": "file:../../../WebstormProjects/dcc-core-lib"`
   would break CI (absolute path, ubuntu runner), and `"*"` or any
   registry version fails because the package is unpublished. Chose to
   leave `package.json` alone and document `npm link` in this log.
   Revisit when open question #1 is resolved.

3. **Adapter stubs are empty by design.** The goal of Phase 0 is to lock
   in the *shape* of the adapter layer (which concerns live where) and
   catch any architectural objections before implementation starts in
   Phase 1. Empty stubs give reviewers a file-tree to react to; filled
   stubs would invite relitigation on boilerplate.

4. **Hook categorization method.** "Stable" = emitted *and* actively
   consumed by a sibling module. "Internal" = emitted but no external
   consumer found in the audited modules. "Dead" = listened to
   externally but never emitted (or vice versa). Tagged per-item in
   `docs/dev/EXTENSION_API.md`.

5. **Dispatch logs are permanent infrastructure** (2026-04-18).
   Originally planned to strip at Phase 1 close; reversed because
   the Playwright dispatch spec asserts on them. Every
   `_xxxViaAdapter` / single-path-with-branch added in later phases
   must call `logDispatch(...)` as its first line. See
   "Dispatch logging" note below.

6. **`game.dcc.processSpellCheck` is permanent stable API**
   (Phase 2 close, 2026-04-18). Don't deprecate; don't shim; route
   migration is per-call-site and incremental. See phase-2.md
   Phase 2 CLOSE section for full rationale.

7. **Legacy-branch retirement principle** (added post-Phase-2,
   2026-04-19; see `ARCHITECTURE_REIMAGINED.md §8.6`). Foundry-facing
   API (`DCCActor.rollXxx`, `game.dcc.*`, hooks) stays as thin
   wrappers indefinitely. Internal `_xxxLegacy` branches and
   direct-reimpl methods retire once adapter coverage is exhaustive
   for their call site. **Supersedes** earlier "permanent legacy
   branch" close-outs — those blockers are back on the critical
   path. Group D D1 / D2 (attack / crit / fumble / damage) all
   landed under this principle.

## Next steps

**Post-Group-E-session-1 (2026-05-18) — Groups A, C, and D are
fully closed; open questions #2, #3, #4, and #7 all closed
2026-05-18.** `rollWeaponAttack` + all four chained calls are
single-path via the adapter; `module/migrations.js` targets V14-era
(0.66+) worlds only; patron-taint matches DCC RAW end-to-end; the
unified roll-modifier dialog covers wizard / cleric / naked spell
checks + skill checks. Group E session 1 added the per-class
mercurial-magic table registry, closing the long-standing §2.4
generalization promise. Remaining Group E candidates (any are
viable next):

1. **Halfling vertical slice** — most natural Phase 4 starter
   because it concentrates the schema-slimming question on one
   class. Exercises §2.1 (monolithic Player schema) directly.
2. **Homebrew single-class slice** — most ambitious; exercises
   Phase 4 + 5 + 6 end-to-end via `registerClassMixin` +
   `registerSheetPart` + variant-aware data loading. Largest blast
   radius but lays the most pattern down.

(Mercurial-magic, originally listed here as the third candidate,
landed as Group E session 1 — see Recent slices.)

**Cross-repo coordination:** if any migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with
`allowLuck` needing dice-chain bumps), land the lib change first in
its own PR in `dcc-core-lib`, then sync via `npm run sync-core-lib`.

**Sibling-module status:** XCC has consumed the
`dcc.afterComputeSpellCheck` hook + `game.dcc.registerActorSheet`
recipes shipped in B1-followup / B1-followup-2; PR pending on
`foundryvtt-dcc/xcc` branch `chore/migrate-to-dcc-extension-api`.
Same branch also retires 9 XCC-side redefinitions of DCC class
schema fields (luckDie, backstab, knownSpells, maxSpellLevel,
disapproval, disapprovalTable, deity, corruption,
spellCheckAbility) that were silently clobbering DCC defaults.
Phase 4 schema-mixin design needs to coordinate with the XCC field
consumption documented in this PR.

## Notes for future sessions

- The pre-commit hook runs `npm run format` → `git add .` → `npm test`.
  That `git add .` **will sweep untracked files into the commit**. Before
  committing, either stash or add to `.gitignore`.
- **Lib updates require `npm run sync-core-lib`** to re-vendor
  `module/vendor/dcc-core-lib/`. Commit the vendor delta separately
  from any adapter change that depends on it — two commits: `vendor:
  sync dcc-core-lib to <version> (<sha>)` then the adapter change.
  `VERSION.json` records the lib's git SHA and flags `dirty: true` if
  the lib tree had uncommitted changes at sync time (do not release
  from a dirty sync).
- `npm link @moonloch/dcc-core-lib` is no longer required for runtime
  loading (the vendored copy is used instead). It *is* still useful if
  you want TypeScript-aware IDE support against the linked source, but
  nothing in the system imports from `@moonloch/dcc-core-lib` at
  runtime anymore — all imports are relative paths into
  `module/vendor/dcc-core-lib/`.
- Sibling modules that must keep working:
  - `../../modules/dcc-qol` — attack hook consumer, reaches into
    `DiceChain.bumpDie` + `DCCRoll.createRoll`
  - `../../modules/xcc` — heaviest consumer; variant game fighting the
    system (replaces `CONFIG.Actor.documentClass` globally)
  - `../../modules/mcc-classes` — clean schema-hook consumer
  - `../../modules/dcc-crawl-classes` — clean schema-hook consumer

### Dispatch logging (permanent)

- Centralized at `module/adapter/debug.mjs`. Every dispatch path calls
  `logDispatch(rollType, 'adapter'|'legacy', details)` to print one
  line to the Foundry console, e.g.
  `[DCC adapter] rollSavingThrow → via adapter saveId=ref`.
- **The logs are permanent, not a Phase-1 scaffold** (decision
  2026-04-18). `browser-tests/e2e/phase1-adapter-dispatch.spec.js`
  captures them via Playwright and asserts every dispatcher branch
  end-to-end; stripping the logs would delete that signal.
- Every `_xxxViaAdapter` / `_xxxLegacy` added in later phases (spell,
  attack, damage, crit, fumble) must call `logDispatch(...)` as its
  first line. Mirror the pattern at `_rollSavingThrowViaAdapter` in
  `module/actor.js`.
- The helper's header JSDoc describes the role. This bullet is the
  process-level reminder; `debug.mjs` itself should be treated as
  core adapter infrastructure on a par with `chat-renderer.mjs` and
  `character-accessors.mjs`.

### Silent adapter→legacy fallback reason codes (2026-04-23)

- Every silent-fallback site emits a `reason=<tag>` field on the
  dispatch log. Pattern: `logDispatch('rollXxx', 'adapter' | 'legacy',
  { reason: 'camelCaseTag', ...extras })` so the Foundry console is
  self-documenting ("why did this cast fall back?") without opening
  source. Tags in use: `noCasterProfile`, `noDisapprovalTable`,
  `noMercurialTable`. New fallback sites added in future sessions
  must pick a short tag and document it here.
