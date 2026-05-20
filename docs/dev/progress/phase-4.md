# Phase 4 — Data-model slimming + class-mixin extension surface

> Archive of session-by-session detail for Phase 4: relocating
> class-bound fields off `module/data/actor/player-data.mjs`'s
> monolithic body onto the `game.dcc.registerClassMixin` registry, plus
> the related infrastructure (extension hook, dispatch by class ID,
> homebrew enablement). See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 4`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

<!-- Sessions will land here as they rotate out of Recent slices. -->

- **2026-05-18 — Phase 4 session 1: halfling vertical kickoff —
  `registerClassMixin` infrastructure + sneakAndHide extraction.**
  New stable extension helper `game.dcc.registerClassMixin(classId,
  mixinFn)` in `module/extension-api.mjs` (alongside companion
  `applyClassMixins(schema)` used by `defineSchema`).
  `CONFIG.DCC.classMixins = {}` initialized in `module/config.js`;
  mutators run in sorted-classId order during
  `PlayerData.defineSchema()` **before** the existing
  `dcc.definePlayerSchema` hook fires so external handlers see
  mixin-contributed fields. `module/dcc.js`'s init registers a
  built-in `'halfling'` mixin (right after `CONFIG.DCC = DCC`,
  before `CONFIG.Actor.dataModels`) that contributes
  `skills.sneakAndHide` (`StringField initial '+3'`,
  `label initial 'DCC.SneakAndHide'`) — identical to the static
  definition it replaces. The static `player-data.mjs` halfling
  block is removed; the field is no longer hardcoded in the
  monolithic schema body. Last-write-wins on duplicate `classId`
  registration (matches mercurial-magic registry semantic) — lets a
  sibling module fully replace a DCC built-in mixin instead of
  having to additively patch. EXTENSION_API.md gains the new helper
  in the Stable `game.dcc.*` exports table, refreshes the
  `dcc.definePlayerSchema` row to call out the new sibling registry,
  and adds a "Homebrew / sibling-module recipe: registerClassMixin"
  migration entry. +11 Vitest tests in `extension-api.test.js`
  (registry mechanics: stores under classId, self-heals missing
  registry, last-write-wins, throws on bad inputs;
  `applyClassMixins`: deterministic sort order, no-op on empty /
  missing registry, defensive against malformed entries). +3
  Playwright cases in `extension-api.spec.js` (helper exposed on
  `game.dcc`, built-in halfling mixin produces `sneakAndHide` on a
  live Player document, last-write-wins survives a round-trip
  restore). 966 Vitest green (was 955, +11); 109 Playwright passed.
  **Two pre-existing environmental Playwright failures observed
  (unrelated to slice, pin-pointed):**
  (1) `extension-api.spec.js:78 › registerItemSheet adds a sheet
  option…` asserts `sheetCtorName === 'DCCItemSheet'` but resolves
  to `'XCCItemSheet'` — `xcc-core-book/module/dccModule.js:14-16`
  unregisters DCC's item sheet and registers XCCItemSheet as
  default at init; the assertion has been latent since the test
  landed 2026-04-19 (`907cfaf`) and only fires when xcc-core-book
  is enabled in the test world. Fix is one of: relax to
  `expect(['DCCItemSheet', 'XCCItemSheet']).toContain(…)`, or
  disable xcc-core-book in the v14 world for the test run.
  (2) `v14-features.spec.js:659 › Status Icons › can toggle…`
  hit a "You have lost connection to the server" console error
  mid-suite — environmental Foundry connection flake during the
  long v14-features run, not a test-logic failure. Neither is
  introduced by this slice. First chip away at
  §2.1; Foundry-smelling shape (`system.skills.sneakAndHide`) stays
  intact per §2.12. Subsequent halfling-vertical sessions: extract
  remaining class-bound fields (Phase 4 cont.), halfling sheet-tab
  composition (Phase 5), variant registration (Phase 6).
- **2026-05-18 — Phase 4 session 2: dwarf `shieldBash` class-mixin
  extraction.** Second halfling-vertical slice, same pattern as
  session 1 but with mixed field types. New `'dwarf'` entry in
  `CONFIG.DCC.classMixins` registered in `module/dcc.js:init`
  contributes `skills.shieldBash` (`label` / `ability` / `value`
  StringFields + `die` DiceField + `useDeed` BooleanField). The
  static `shieldBash` block in `player-data.mjs` is deleted; the
  comment near the removed block is updated to document both
  halfling + dwarf mixin-sourced fields together. `DiceField`
  imported into `dcc.js` from `module/data/fields/_module.mjs` so the
  mixin can reference it without further plumbing. +1 Playwright
  case in `extension-api.spec.js` asserts the built-in dwarf mixin
  produces all five fields with the expected defaults AND verifies
  `dieFieldType === 'DiceField'` + `useDeedFieldType === 'BooleanField'`
  on the resolved schema — proves mixed field types survive the
  mixin path identically to a static definition. No new Vitest test
  needed; the registry mechanics tested in session 1
  (`applyClassMixins` sort order, last-write-wins, etc.) cover the
  dwarf mixin's plumbing — only the schema-shape claim is new and
  it's best exercised against live Foundry. 966 Vitest green
  (unchanged from session 1). 110 Playwright passed (was 109, +1
  dwarf case); same single pre-existing environmental flake as
  session 1 (`xcc-core-book` unregistering DCCItemSheet).
- **2026-05-18 — Phase 4 session 3: thief class-mixin extraction (12
  skills + `class.luckDie` + `class.backstab`).** Largest single-
  class relocation so far. New `'thief'` entry in `CONFIG.DCC.classMixins`
  registered in `module/dcc.js:init` builds 12 skill SchemaFields via
  a shared inline `thiefSkill(label, ability)` helper plus two class-
  field mutations (`schema.class.fields.luckDie` =
  `DiceField('1d3')`, `schema.class.fields.backstab` =
  `StringField('0')`). First mixin to touch BOTH `schema.class.fields`
  and `schema.skills.fields` on the same registration. `handlePoison`
  deliberately omits `ability` to match the static body's shape;
  `castSpellFromScroll` carries its own DiceField die (`'1d10'`)
  alongside the standard label/ability/value triple. The static
  thief-skills block (~62 lines) + the two thief class-field lines
  in `module/data/actor/player-data.mjs` are deleted; the trailing
  comment near the removed skill block now documents thief alongside
  halfling/dwarf mixins. `DiceField` import dropped from
  `player-data.mjs` (was only used by the two now-relocated thief
  fields). +1 Playwright case in `extension-api.spec.js` asserts (a)
  all 12 skill fields are present, (b) `findTrap`/`disguiseSelf`
  carry their non-`agl` abilities, (c) `handlePoison` lacks the
  `ability` field, (d) `castSpellFromScroll.die`'s field type is
  `DiceField` with initial `'1d10'`, and (e) `class.luckDie` /
  `class.backstab` are present with correct types + initials. No new
  Vitest needed (registry mechanics covered session 1). 966 Vitest
  green (unchanged); 112 Playwright passed (was 110, +1 thief + 1
  dwarf-flake recovered), 1 latent failure (xcc-core-book DCCItemSheet
  override — unchanged).
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
