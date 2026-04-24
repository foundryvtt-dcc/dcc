# Phase 2 — Spell Check Migration

> Archive of session-by-session detail for Phase 2: routing
> `DCCActor.rollSpellCheck` through the adapter for generic /
> wizard / cleric / patron-bound casts, plus spellburn + mercurial
> magic. See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 2`](../ARCHITECTURE_REIMAGINED.md)
> for the phase plan and [`00-progress.md`](../../00-progress.md) for
> current state + open questions.

---

## Session 1 (2026-04-18, sixth overall) — dispatcher + generic path

- **Adapter scaffolded** for spell checks:
  - `module/adapter/spell-input.mjs` — new. Exports
    `buildSpellCastInput(actor, spellItem, options)` which returns a
    lib-shaped `SpellCastInput`. Session 1 uses a synthesized
    generic `casterProfile` (`type: 'generic'`, all side-effect
    flags off) so `castSpell` accepts it directly — no spellbook
    or real caster-profile lookup yet. `DEFAULT_SPELL_CASTER_TYPES`
    and `normalizeLibDie` are local helpers (inlined to avoid a
    third scaffold file for one constant + one function).
  - `module/adapter/spell-events.mjs` — stub. Header JSDoc lists
    the callback surface (`onSpellCheckStart`, `onSpellLost`,
    `onCorruptionTriggered`, `onPatronTaint`,
    `onDisapprovalIncreased`, `onSpellburnApplied`,
    `onMercurialEffect`) and the migration order sessions 2–5
    will fill in. Empty `export {}` body.
  - `module/adapter/chat-renderer.mjs` — extended with
    `renderSpellCheck({ actor, spellItem, flavor, result,
    foundryRoll })`. Preserves legacy flag contract
    (`dcc.RollType: 'SpellCheck'`, `dcc.isSpellCheck`,
    `dcc.isSkillCheck`, `dcc.ItemId`) plus a structured
    `dcc.libResult` payload with spell-check fields
    (`spellId`/`die`/`natural`/`total`/`formula`/`critical`/
    `fumble`/`tier`/`spellLost`/`corruptionTriggered`/`modifiers`).
    No side effects — wizard spell loss, cleric disapproval,
    patron taint, spellburn, mercurial magic all stay on the
    legacy path this session.
- **Dispatcher wired** for `DCCActor.rollSpellCheck`:
  - `module/actor.js` — `rollSpellCheck` hoists the single item
    lookup (so `collectionFindMock` call-count assertions in
    `actor.test.js` still match) then routes on
    `castingMode === 'generic' && !hasPatron && !isCleric` →
    `_rollSpellCheckViaAdapter`; everything else →
    `_rollSpellCheckLegacy`. Legacy keeps the pre-dispatcher body
    verbatim (fire-and-forget item delegation + naked-path term
    construction + `game.dcc.processSpellCheck` handoff).
    `game.dcc.processSpellCheck` export is untouched, so XCC's
    wizard/cleric sheets keep working.
  - `_rollSpellCheckViaAdapter` uses the two-pass
    formula/evaluate pattern (formula mode → `new Roll(formula)`
    → Foundry evaluate → evaluate mode with `roller: () => natural`).
    Uses `castSpell` directly, bypassing `calculateSpellCheck`'s
    spellbook + profile lookups (wizard/cleric spellbook bridge
    is session 2+ work). `logDispatch('rollSpellCheck', 'adapter',
    { spell })` as first line; legacy branch emits the matching
    LEGACY line.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — new. 4
    tests: generic item on non-cleric non-patron actor routes
    adapter (+ flag assertions); wizard-castingMode item routes
    legacy (+ delegates to `DCCItem.rollSpellCheck`); generic
    item on a Cleric actor routes legacy; generic item on a
    patron-bound actor routes legacy.
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — three
    new test cases in a `rollSpellCheck` describe block:
    generic-castingMode item → adapter, wizard-castingMode item
    → legacy, naked `rollSpellCheck()` → legacy.
    `npx playwright test --list` reports 18 tests in the file
    (up from 15). Not run against live Foundry this session —
    needs manual verification next time v14 is launched.
  - Existing `actor.test.js` "roll spell check" / "roll spell
    check int" / "roll spell check personality" / "roll spell
    check stamina" / "roll spell check item" / "roll spell check
    wrong item type" / "roll spell check missing spell" all
    still pass unchanged (the legacy branch preserves the old
    body + call-sequence).
  - 763 tests pass (up from 759). `npm run format` clean.

**Scope decisions (Phase 2 session 1):**

- **`castSpell` instead of `calculateSpellCheck` this session.**
  The session-start doc pointed at `calculateSpellCheck`, but it
  performs a spellbook entry + caster profile lookup that
  requires `actorToCharacter` to populate `state.classState.*`
  (not wired yet). `castSpell` accepts a fully-built
  `SpellCastInput` and runs the lib's buildFormula / evaluateRoll
  / determineTier pipeline without the gatekeeping. Session 2
  extends `actorToCharacter` (or `buildSpellCastInput`) to fetch
  a real wizard caster profile + spellbook entry, at which point
  the adapter can switch to `calculateSpellCheck`.
- **Legacy path delegates to `DCCItem.rollSpellCheck`
  fire-and-forget.** Preserves the pre-dispatcher contract —
  awaiting the delegated promise would surface errors the
  original code swallowed (e.g. `actor.system.abilities[...]`
  on a dummy item without a real actor in `actor.test.js:805`).
  Not ideal long-term, but matches today's behavior; a later
  session can audit whether the swallow is safe.

---

## Session 2 (2026-04-18, seventh overall) — wizard spell loss

- **Wizard spell loss migration.** `DCCActor.rollSpellCheck` now
  routes wizard-castingMode items (on non-cleric, non-patron-bound
  actors) through the adapter. The dispatcher's gate broadened from
  `castingMode === 'generic' && !hasPatron && !isCleric` to also
  accept `castingMode === 'wizard' && !hasPatron && !isCleric`.
  Adapter-side pre-check: `spellItem.system.lost &&
  settings.get('dcc', 'automateWizardSpellLoss')` → warn + early
  return, mirroring `DCCItem.rollSpellCheck:260`.
- **Adapter branch structure:**
  `_rollSpellCheckViaAdapter` (single logDispatch call, now logs
  `mode=generic|wizard`) internally dispatches to
  `_castViaCastSpell` (generic path) or
  `_castViaCalculateSpellCheck` (wizard path). Both use the
  two-pass formula/evaluate pattern established by Phase 1.
  `_buildSpellCheckFlavor` factors out the shared chat-flavor
  construction.
- **`module/adapter/spell-input.mjs`** extended:
  - Exported `syntheticGenericProfile(abilityId)` — named factory
    for the generic profile.
  - Exported `buildSpellbookEntry(spellItem, spellId)` — builds a
    lib-shaped entry from the item's `system.lost` /
    `system.lastResult`.
  - New `buildSpellCheckArgs(actor, spellItem, options)` —
    returns `{ character, input, profile, abilityId }` for
    `calculateSpellCheck`. Looks up the real caster profile via
    `getCasterProfile(classId)` (from `actor.system.class.className
    .toLowerCase()`), extends `actorToCharacter` with the
    `identity.birthAugur.multiplier` + `identity.startingLuck` that
    the lib's luck-modifier helpers read, and populates
    `character.state.classState.<profile.type>.spellbook` with the
    single entry so `findSpellEntry` succeeds. Returns `null` for
    classes with no lib-side profile — the adapter then falls back
    to the legacy path.
- **`module/adapter/spell-events.mjs`** filled in:
  - `createSpellEvents({ actor, spellItem })` — session-2 returns
    `{ onSpellLost }`; `onSpellLost(result)` calls
    `spellItem.update({ 'system.lost': true })` fire-and-forget.
    Actor kept in the closure for sessions 3–5.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 8 tests
    (up from 4). New: wizard-on-wizard → adapter (asserts flags +
    no legacy delegation); already-lost wizard + automation on →
    warn + early return; wizard on patron-bound → legacy;
    `createSpellEvents.onSpellLost` bridge unit test; naked-path
    `createSpellEvents` has no `onSpellLost`.
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — 19 tests
    (up from 18). New: "wizard-castingMode spell item on a Wizard
    actor → adapter (wizard)" asserts `mode=wizard`. The previous
    "wizard → legacy" test was rescoped to "wizard on patron-bound
    → legacy" since plain wizard now goes through the adapter.
    Not yet run against live Foundry — pending next v14 launch.
  - Existing `actor.test.js` wizard spell-check tests all still
    pass: the dispatcher routes them to legacy (default mock actor
    has no `className`, so `getCasterProfile` returns undefined
    and the wizard-adapter path falls back — see the "no lib-side
    profile" branch in `_rollSpellCheckViaAdapter`).
  - 767 Vitest tests pass (up from 763).

**Scope decisions (Phase 2 session 2):**

- **`calculateSpellCheck` for the wizard path, `castSpell` for
  generic.** The session doc left both paths open
  ("`castSpell` stays as a fallback for the synthetic generic
  path (or we drop the generic branch in favor of routing all
  casts through `calculateSpellCheck`)"). We kept them split: the
  generic path already had a working single-call `castSpell`
  pipeline; migrating it to `calculateSpellCheck` would force a
  synthetic `Character.state.classState` for no behavioral gain.
  The wizard path genuinely needs `calculateSpellCheck` because
  its lib-side spellbook + `updatedSpellbookEntry` bookkeeping is
  what session 2 is migrating toward — and because later sessions
  layer fumble / corruption / patron / disapproval on top of
  `calculateSpellCheck`'s orchestrator.
- **Class fallback to legacy.** When the actor's
  `system.class.className` doesn't resolve to a lib-side caster
  profile (homebrew class, spinoff module, or a non-caster class
  with a wizard-castingMode item), `buildSpellCheckArgs` returns
  `null` and the adapter drops back to the legacy
  `DCCItem.rollSpellCheck` delegation. This keeps XCC / spinoff
  content working while the migration proceeds.
- **Lost-spell pre-check in the dispatcher, not the adapter.**
  Placing the check in `rollSpellCheck` before dispatch means
  `_rollSpellCheckViaAdapter` / `_castViaCalculateSpellCheck` can
  assume the cast is going ahead. The adapter-side `logDispatch`
  call does not fire when the cast is pre-empted — the observable
  signal is the `ui.notifications.warn`, matching the legacy
  `DCCItem.rollSpellCheck:260` path.
- **Wave-2 lib modifier migration not required.**
  `calculateSpellCheck` / `castSpell` still emit
  `LegacyRollModifier[]` (per the staged migration in
  `dcc-core-lib/docs/MODIFIERS.md §9`, spells are wave 2 and not
  yet landed). The renderer passes the list through unchanged in
  `dcc.libResult.modifiers`; downstream consumers already know
  about the legacy shape.

---

## Session 3 (2026-04-18, eighth overall) — cleric disapproval

- **Cleric disapproval migration.** `DCCActor.rollSpellCheck` now
  routes cleric-castingMode items on non-patron-bound Cleric actors
  through the adapter. The dispatcher gate broadens from the
  session-2 set to also accept `castingMode === 'cleric' && isCleric
  && !hasPatron`. Wizard-on-cleric and cleric-on-non-cleric stay on
  legacy (class-vs-castingMode mismatch would silently switch the
  side-effect set between `handleClericDisapproval` and wizard spell
  loss — safer to keep the mismatch on the old path).
- **`_castViaCalculateSpellCheck` extended** to the cleric path.
  When `profile.type === 'cleric'`, the adapter loads the actor's
  configured disapproval table via `loadDisapprovalTable(actor)` and
  attaches it to `input.disapprovalTable`; when the pass-1 natural
  roll lands within the disapproval range, a 1d4 is pre-rolled in
  Foundry so the pass-2 roller can hand it back when the lib calls
  `options.roller('1d4')` inside `rollDisapproval`. The pass-2 roller
  is now formula-dispatching (`'1d4'` → pre-rolled d4, else spell-check
  natural) instead of the session-2 `() => natural`. After the lib
  returns, `result.disapprovalResult` drives a dedicated chat message
  via `renderDisapprovalRoll` (replaces `_onRollDisapproval` +
  `RollTable.draw`).
- **`module/adapter/spell-input.mjs`** extended:
  - `buildSpellCheckArgs` now populates
    `character.state.classState.cleric.disapprovalRange` from
    `actor.system.class.disapproval` when `profile.type === 'cleric'`;
    defaults to 1 when the actor has no value yet (matches the lib's
    `DEFAULT_DISAPPROVAL_RANGE`).
  - New `loadDisapprovalTable(actor)` — async. Walks the same
    resolution path as the legacy `_onRollDisapproval`
    (`actor.js:2858-2886`): `CONFIG.DCC.disapprovalPacks.packs` first,
    then world tables. Converts the Foundry `RollTable` to the lib's
    `SimpleTable` via `toLibSimpleTable` (module-local helper). Returns
    `null` when no table resolves (unit-test env, misconfigured
    compendium) — the lib then skips the table draw and still triggers
    the range bump via `handleClericDisapproval`, matching legacy
    "no table configured" behavior. **Sessions 4–5 reuse
    `toLibSimpleTable`** for corruption / patron taint / mercurial
    tables if the lookup shape stays the same; extract a shared loader
    when the third consumer lands.
- **`module/adapter/spell-events.mjs`** extended:
  - `createSpellEvents` now returns `onDisapprovalIncreased` when an
    `actor` is provided (previously only `onSpellLost` when a
    `spellItem` was). The handler mirrors the legacy `applyDisapproval`
    (`actor.js:2789`): bails early on `actor.isNPC`, otherwise updates
    `system.class.disapproval` and posts the "DCC.DisapprovalGained"
    EMOTE chat message. Chat rendering is additionally gated on
    `ChatMessage` + `CONFIG.ChatMessage.documentClass` being defined so
    unit tests can assert on `actor.update` without setting up the
    full chat mock.
- **`module/adapter/chat-renderer.mjs`** extended:
  - New `renderDisapprovalRoll({ actor, disapprovalResult })` export.
    Posts a single chat message with the lib's rolled disapproval total
    and the drawn table entry's description (mirrors the
    `RollTable.draw` chat the legacy `_onRollDisapproval` emits). Uses
    a deterministic `${total}d1` Roll so the value renders through
    Foundry's normal chat pipeline (DSN, highlighting, etc.).
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 14 tests (up
    from 8). New: `adapter path fires for a cleric-castingMode item on
    a Cleric actor`; `cleric-castingMode item on a patron-bound actor
    routes to legacy`; `cleric-castingMode item on a non-Cleric actor
    routes to legacy`; `createSpellEvents onDisapprovalIncreased
    updates system.class.disapproval`; `createSpellEvents
    onDisapprovalIncreased bails early for NPC actors`;
    `createSpellEvents without actor does not wire
    onDisapprovalIncreased`. Existing "generic item on Cleric →
    legacy" test kept (generic castingMode doesn't gate on isCleric in
    the old dispatcher logic; the new gate `!isCleric` keeps it legacy).
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — 20 tests
    (up from 19). New: "cleric-castingMode spell item on a Cleric
    actor → adapter (cleric)" asserts `mode=cleric`. **All 20 tests
    pass against live v14 Foundry** (verified 2026-04-18 against the
    running `v14` world; 2.1 min run).
  - Existing `actor.test.js` cleric spell-check tests all still
    pass: the dispatcher routes them to legacy when castingMode is
    generic/wizard or when the actor has no className set.
  - 773 Vitest tests pass (up from 767).

**Scope decisions (Phase 2 session 3):**

- **Gate tightened from `(castingMode === 'cleric' || isCleric)` to
  `castingMode === 'cleric' && isCleric`.** The session-start slice
  was permissive (any cleric-mode item OR any cleric actor). Routing
  wizard-castingMode items on a cleric actor through the adapter
  would pick up the cleric profile (since `getCasterProfile` reads
  `actor.system.class.className`) and trigger `handleClericDisapproval`
  — swapping the legacy wizard-spell-loss side effect for disapproval.
  The narrower gate preserves the legacy behavior for mismatched
  cases. Re-open if a future session surfaces a real cross-class need.
- **`toLibSimpleTable` conversion is local to `spell-input.mjs`.**
  Sessions 4–5 (corruption / taint / mercurial) will likely reuse the
  same Foundry-RollTable → lib-SimpleTable shape; extracting a shared
  helper now would be premature. When the third consumer lands, fold
  into a `table-adapter.mjs` or similar.
- **Pre-roll the 1d4 only when natural ≤ disapprovalRange.** The lib
  calls `options.roller('1d4')` inside `rollDisapproval` only when
  `rollTriggersDisapproval` is true. Pre-rolling unconditionally would
  waste a roll (and pollute DSN); pre-rolling conditionally is the
  same branch the lib uses.
- **`renderDisapprovalRoll` uses a `${total}d1` Roll.** The lib's
  rolled value is already computed; Foundry just needs *some* Roll
  object to post the chat message. `NdN1d1` evaluates deterministically
  to `N`, preserving the DSN/chat highlighting pipeline without
  re-rolling the d4.
- **Wave-2 lib modifier migration still not required.** The
  disapproval pipeline reads from `castInput.disapprovalRange` (a
  plain number) and writes to `result.disapprovalResult` /
  `result.newDisapprovalRange`. No tagged-union modifiers touched.

---

## Session 4 (2026-04-18, ninth overall) — patron route

- **Patron route lands on the adapter; legacy taint mechanic preserved
  verbatim adapter-side.** `DCCActor.rollSpellCheck`'s gate broadens
  for the wizard branch from `castingMode === 'wizard' && !isCleric &&
  !hasPatron` to `castingMode === 'wizard' && !isCleric` — patron-bound
  wizards / elves with wizard-castingMode items now flow through
  `_castViaCalculateSpellCheck`. Generic + cleric branches keep
  `!hasPatron` (rare cross-class cases — defer until session 5 close).
- **`buildSpellCheckArgs` extended** to populate
  `character.state.classState.<wizard|elf>.patron` from
  `actor.system.class.patron` so `getPatronId(character)`
  (`spells/spell-check.js:72`) resolves and the lib records
  `castInput.patron`. The lib's RAW patron-taint pipeline
  (`handleWizardFumble` → `rollPatronTaint`) stays dormant because
  the adapter never plumbs in `input.fumbleTable` — populating the
  patron field is harmless but future-proofs for when the RAW
  alignment lands.
- **`_runLegacyPatronTaint(spellItem)`** — new private DCCActor method.
  Ports `module/dcc.js:623-660` verbatim: rolls 1d100 for the d100-vs-
  chance check, parses `system.class.patronTaintChance` ("3%" → 3),
  bumps to `${chance + 1}%`, calls `actor.update`. Same trigger
  conditions as legacy: `actor.system.class?.patron` set AND
  (`spell name includes 'Patron'` OR `item.system.associatedPatron`
  truthy). Called from `_castViaCalculateSpellCheck` after
  `renderSpellCheck` for `profile.type === 'wizard' || 'elf'` casts on
  patron-bound actors. **Silent chance bump** — no chat message — which
  matches the legacy no-table fallback in `processSpellCheck` (the
  patron-taint chat only renders inside `chat-card-spell-result.html`
  when a spell result table is present, and the adapter doesn't
  produce result-table chats this phase).
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 18 tests
    (up from 14). Removed the rescoped "wizard + patron → legacy"
    case. Added: `wizard-castingMode item on a patron-bound wizard
    routes to adapter (session 4)` (no chance bump for non-patron-
    related spell name); `patron-related spell (name contains
    Patron) bumps patronTaintChance adapter-side` (3% → 4%); `spell
    with system.associatedPatron set bumps patronTaintChance
    adapter-side` (1% → 2%); `non-patron-related spell on patron-
    bound wizard does not bump patronTaintChance`; `wizard-castingMode
    item on a patron-bound elf routes to adapter (session 4)` (2% → 3%).
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — still 20
    tests. Rescoped the existing "wizard + patron → legacy" case to
    "wizard + patron → adapter (session 4)" with a chance-bump
    assertion (reads `system.class.patronTaintChance` before + after,
    expects +1). **All 20 tests pass against live v14 Foundry**
    (verified 2026-04-18 against the running `v14` world; 2.2 min run).
  - 777 Vitest tests pass (up from 773).

**Scope decisions (Phase 2 session 4):**

- **Option 1: adapter-side legacy preservation, not RAW migration.**
  The session-start prompt step 5 implied wiring the lib's
  `onPatronTaint` callback to bump `patronTaintChance`. On reading
  the legacy code (`dcc.js:623-660`), the Foundry-system patron-taint
  mechanic is fundamentally different from the lib's RAW model:
  - **Legacy**: per-cast 1d100 vs creeping chance, +1% each cast
    (regardless of outcome). No table lookup. Triggered for any
    patron-related spell on a patron-bound actor.
  - **Lib RAW** (`spells/spell-check.js:241` + `spells/fumble.js:46`):
    only fires on a fumble (natural 1) AND only when the fumble-
    table entry is tagged with `effect.type === 'patron-taint'`.
    Foundry-side fumble tables don't carry these tags, so naively
    switching to the lib's pipeline would have made patron taint
    effectively never trigger AND lost the creeping-chance display.
  Discussed the tradeoff with the user mid-session; chose to keep the
  legacy mechanic verbatim adapter-side and defer the RAW alignment.
  See open question below.
- **No fumble / corruption / patron-taint tables loaded.** With the
  lib's RAW pipeline dormant, plumbing in tables would have been dead
  code. Sessions 5+ revisit when figuring out the RAW alignment.
- **Generic + cleric branches keep `!hasPatron`.** Generic items on
  patron-bound actors: still legacy (rare; preserves XCC compatibility
  for patron-related generic-mode side spells). Cleric + patron is a
  rare XCC variant; defer until the last session decides whether to
  include.
- **Patron field populated even though the lib's pipeline is dormant.**
  Harmless (no fumbleTable means no taint trigger) and forward-looking:
  when RAW alignment lands, the character state is already correct.

---

## Session 5 (2026-04-18, tenth overall) — spellburn + mercurial

- **Spellburn migration (wizard / elf).** `DCCActor.rollSpellCheck` for
  wizard-castingMode items now forwards `options.spellburn` (a lib
  `SpellburnCommitment`) through `buildSpellCheckArgs` →
  `input.spellburn` → lib `castSpell`. The lib adds a Spellburn modifier
  to the roll formula (`cast.js:50-58`) and fires `onSpellburnApplied`
  with the burn commitment. The new `spell-events.mjs` bridge subtracts
  each ability's burn from `system.abilities.<id>.value`, clamped at
  1 and NPC-gated (mirrors `onDisapprovalIncreased`). Today no code
  path supplies `options.spellburn` — the roll-modifier dialog's
  Spellburn term (`roll-modifier.js:115-126`) still sits on the legacy
  `DCCRoll.createRoll` path, which the adapter bypasses. Plumbing is
  in place for a future dialog-adapter session.
- **Mercurial magic migration (wizard / elf).** `_castViaCalculateSpellCheck`
  now calls `_rollMercurialIfNeeded(spellItem, spellbookEntry)` before
  pass 1 when `profile.usesMercurial === true` and the Foundry spell
  item has no stored effect. The helper walks the configured
  `CONFIG.DCC.mercurialMagicTable` via the new
  `loadMercurialMagicTable()` exporter (pack-then-world resolution,
  mirrors the legacy `DCCItem.rollMercurialMagic:531-558` walk),
  pre-rolls a Foundry `1d100`, passes the total into the lib's
  `rollMercurialMagic(luckMod, table, {roller})`, and persists the
  rolled effect to `spellItem.system.mercurialEffect.{value,summary,
  description,displayInChat}` + attaches it to the in-flight
  spellbook entry. After the main spell-check chat, the adapter
  renders a dedicated mercurial display chat via the new
  `renderMercurialEffect` (mirrors session-3's `renderDisapprovalRoll`
  pattern) directly from `result.mercurialEffect` — see "Scope
  decisions" below for why the lib's `onMercurialEffect` callback is
  intentionally NOT wired.
- **Pass-1 events tightened.** `libCalculateSpellCheck` is now called
  in formula mode with an empty events object `{}` instead of the
  full bridge. Rationale in `cast.js:339-343`: `onSpellburnApplied`
  and `onMercurialEffect` fire unconditionally whenever their input
  fields are populated, so passing events to both passes would
  double-apply the burn and double-post the mercurial chat. Pass 2
  remains the authoritative side-effect pass. `onSpellLost` and
  `onDisapprovalIncreased` were already pass-2-gated via natural-roll
  / spellLost conditions, so earlier sessions didn't hit this.
- **`module/adapter/spell-input.mjs`** extended:
  - `readMercurialEffect(spellItem)` (module-local) converts the
    Foundry item's `system.mercurialEffect.{value,summary,description,
    displayInChat}` to the lib's `MercurialEffect` shape, returning
    `null` when `value` is missing / zero. Called from
    `buildSpellbookEntry` so the lib sees an already-rolled mercurial
    on subsequent casts.
  - `foundryTableEntries(foundryTable, project)` (module-local)
    factors out the Foundry-RollTable → lib-entries walk shared by
    `toLibSimpleTable` (disapproval) and the new `toLibMercurialTable`
    (mercurial). Per-entry projection differs — mercurial carries
    `summary` + `description` + `displayOnCast` — but the row-range
    extraction is identical.
  - `loadMercurialMagicTable()` — async. Walks
    `CONFIG.DCC.mercurialMagicTable` compendium → world-name fallback
    and converts via `toLibMercurialTable`. Returns `null` when no
    table is resolvable.
  - `buildSpellCheckArgs` now forwards `options.spellburn` when the
    commitment is a valid `{str, agl, sta}` object with at least one
    positive value. All-zero commitments are dropped to avoid a no-op
    Spellburn modifier surfacing in the lib's result.
- **`module/adapter/spell-events.mjs`** extended:
  - `createSpellEvents` returns `onSpellburnApplied` when an `actor`
    is provided. The handler bails for NPC actors, then builds
    `actor.update({ 'system.abilities.<id>.value': max(1, current -
    burn) })` for each of str/agl/sta with a positive burn. Skips the
    update entirely if all three are zero.
  - No `onMercurialEffect` bridge — mercurial rendering happens
    adapter-side in `_castViaCalculateSpellCheck` instead (see "Scope
    decisions" below).
- **`module/adapter/chat-renderer.mjs`** extended:
  - `renderMercurialEffect({actor, spellItem, effect})` — posts a
    single chat with the `${rollValue}d1` deterministic Roll, the
    localized "Mercurial Magic Roll" flavor + summary, and a
    `dcc.libMercurial` structured flag (`rollValue`, `summary`,
    `description`, `displayOnCast`). Replaces the chat-card mercurial
    block that `DCCItem.rollSpellCheck:382` threaded through
    `game.dcc.processSpellCheck` on the legacy path.
- **`module/actor.js`** extended:
  - New `_rollMercurialIfNeeded(spellItem, spellbookEntry)` — private.
    Skips when `loadMercurialMagicTable()` returns null (matches the
    legacy `DCCItem.rollMercurialMagic:564` no-table fall-back). Rolls
    via the lib's `rollMercurialMagic(luckMod, table, {roller})`,
    persists the effect to the Foundry item, and mutates the in-flight
    spellbook entry.
  - `_castViaCalculateSpellCheck` now calls `_rollMercurialIfNeeded`
    before pass 1 for wizard / elf profiles, and renders
    `renderMercurialEffect(result.mercurialEffect)` after
    `renderSpellCheck` when the effect's `displayOnCast !== false`.
  - Pass-1 `libCalculateSpellCheck` call now passes `{}` as events
    instead of the full `events` bridge.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 31 tests
    (up from 18 at session 4 close). New:
    `createSpellEvents onSpellburnApplied subtracts burn amounts` (PC
    with str=14/agl=12/sta=13, burn {str:2,sta:3} → str→12/sta→10);
    `onSpellburnApplied clamps at 1` (str=3, burn=5 → str=1);
    `onSpellburnApplied bails early for NPC actors`;
    `onSpellburnApplied with zero commitment does not update`;
    `without actor does not wire onSpellburnApplied`;
    `renderMercurialEffect posts chat with the mercurial flag payload`;
    `buildSpellCheckArgs threads options.spellburn into input.spellburn`;
    `buildSpellCheckArgs drops all-zero spellburn commitment`;
    `buildSpellCheckArgs populates spellbookEntry.mercurialEffect from
    existing Foundry item`;
    `buildSpellCheckArgs omits mercurialEffect when item has no rolled
    value`;
    `adapter wizard first-cast pre-rolls mercurial magic when the item
    has none` (CONFIG.DCC.mercurialMagicTable + game.tables.getName
    mocked);
    `adapter wizard cast on a spell item that already has mercurial does
    not re-roll` (display chat still fires via result path);
    `adapter wizard cast with options.spellburn reduces ability scores
    adapter-side` (integration of the above — str=14, agl=12, sta=13,
    burn {str:2,sta:1} → actor.update str=12, sta=12).
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — 22 tests (up
    from 20). Two new session-5 cases:
    `wizard cast with options.spellburn reduces physical ability scores`
    (asserts str=12/agl=12/sta=12 after a 14/12/13 cast with burn
    {str:2,agl:0,sta:1});
    `wizard first-cast pre-rolls mercurial magic` (asserts
    `item.system.mercurialEffect.value > 0` after first cast, with
    `test.skip` when no `mercurialMagicTable` is configured). **All 22
    tests pass against live v14 Foundry** (verified 2026-04-18 against
    the running `v14` world; 2.3 min run).
  - 790 Vitest tests pass (up from 777).

**Scope decisions (Phase 2 session 5):**

- **Direct render over `onMercurialEffect` bridge.** The initial
  design wired `onMercurialEffect` to call `renderMercurialEffect`.
  That failed in tests because: (1) the lib fires the event on BOTH
  formula-mode and evaluate-mode passes (cast.js:342-344, unconditional
  when `input.spellbookEntry.mercurialEffect` is set), which would
  double-post; (2) the bridge's returned Promise isn't propagated
  through the lib, so the adapter couldn't await the chat before
  returning — causing race-conditions with `rollToMessageMock` in the
  unit tests. Refactored to: (a) pass `{}` events to pass 1 to prevent
  the pass-1 fire; (b) remove the `onMercurialEffect` bridge entirely;
  (c) render directly from `result.mercurialEffect` in
  `_castViaCalculateSpellCheck` post-renderSpellCheck. Same for
  spellburn — pass 1 no longer fires `onSpellburnApplied`; pass 2 is
  the authoritative side-effect pass.
- **`_rollMercurialIfNeeded` is adapter-side, not lib-extension.** The
  lib's `calculateSpellCheck` doesn't accept a mercurial-magic table —
  mercurial effects are expected to be pre-attached to the spellbook
  entry (rolled at spell-learn time per RAW). The legacy Foundry flow
  rolls mercurial via a user-triggered button
  (`DCCItem.rollMercurialMagic`) rather than auto-rolling at first
  cast. Session 5 added adapter-side first-cast auto-roll as an
  improvement: any wizard / elf casting a spell without a stored
  mercurial effect gets one rolled and persisted. This is slightly
  more RAW-aligned than legacy (which left mercurial rolling fully
  manual). Could revisit if users want explicit opt-in.
- **No spellburn dialog integration.** The spellburn UI ships as a
  `Spellburn` term in the legacy roll-modifier dialog
  (`roll-modifier.js:115` `DCCSpellburnTerm`) — the user clicks +/- to
  allocate burn, the dialog calls the term's callback with post-burn
  ability values, which calls `actor.update` directly. The adapter
  path bypasses `DCCRoll.createRoll` entirely, so the dialog never
  appears. Today this means wizard adapter casts silently don't offer
  spellburn UI — a regression introduced in session 2 that's been
  latent until now. Session 5 wires the `options.spellburn` plumbing
  but does NOT integrate the dialog; a future session needs to either:
  (a) detect `options.showModifierDialog` on the dispatcher and fall
  back to legacy for wizard casts (loses the adapter migration for the
  dialog case), or (b) build a dialog-adapter that collects the
  commitment as `options.spellburn` before the adapter runs. Track as
  open question #6 (added below). **[Later: resolved at Phase 3
  session 1 via option (b) — see phase-3.md.]**
- **Factored table conversion via `foundryTableEntries` helper.**
  `toLibSimpleTable` (disapproval) and the new `toLibMercurialTable`
  (mercurial) differ only in per-entry projection. Extracted the
  row-walk into a shared module-local `foundryTableEntries(table,
  project)` helper. If a third consumer lands (corruption, fumble,
  patron-taint) the helper is ready. Still not promoted to a top-level
  `table-adapter.mjs` — three consumers would tip the balance.

---

## Phase 2 CLOSE — 2026-04-18 (eleventh session, doc-only)

No code changed. Closes both Phase 2 gate items.

**Gate 1 — `game.dcc.processSpellCheck` consumer audit.**

Inventoried all 5 call sites across DCC + XCC:

| # | Caller | File:line | Options passed | Adapter covers today? |
|---|---|---|---|---|
| 1 | DCC `rollSkillCheck` cleric/skill-table route (Turn Unholy, Lay on Hands, Divine Aid) | `module/actor.js:1757` | `{ rollTable, roll, item, flavor }` | **No** — needs RollTable lookup + level-added crit totals |
| 2 | DCC `_rollSpellCheckLegacy` naked path | `module/actor.js:2371` | `{ rollTable: null, roll, item: null, flavor, forceCrit }` | **Partial** — naked case (no item) needs pre-built-Roll handoff path the adapter doesn't expose |
| 3 | DCC `DCCItem.rollSpellCheck` | `module/item.js:376` | `{ rollTable, roll, item, flavor, manifestation, mercurial, forceCrit }` | **No** — RollTable + manifestation + forceCrit all absent from adapter |
| 4 | XCC naked path (copy of #2) | `xcc/module/xcc-actor-sheet.js:471` | `{ rollTable: null, roll, item: null, flavor }` | Partial (same as #2) |
| 5 | XCC item path (copy of #3 + elf-trickster no-spellburn + blaster die label) | `xcc/module/xcc-actor-sheet.js:597` | `{ rollTable, roll, item, flavor, manifestation, mercurial }` | No (same as #3) |

**Key finding:** XCC's two call sites are structurally identical peers
of DCC's own internal callers, not public-API consumers. They do the
same thing DCC does (construct pre-built Foundry Roll → hand off to
orchestrator) with XCC-specific term tweaks. A deprecation would force
XCC to reinvent the orchestrator; a shim-to-adapter rewrite would break
DCC's own still-legacy paths (`actor.js:1757`, `actor.js:2371`,
`item.js:376`).

**Decision — Option (d): `processSpellCheck` is permanent stable API.**
Don't deprecate. Don't shim. Don't publish a new parallel entry. The
adapter dispatcher (`DCCActor.rollSpellCheck`, sessions 1–5) routes
narrow happy-paths through `_castViaCastSpell` /
`_castViaCalculateSpellCheck`; everything else stays on
`processSpellCheck`. Future adapter capability growth (result-table
rendering, manifestation display, forceCrit, mercurial-chat-without-
race) migrates routes one at a time.

Options (a)–(c) from the session prompt considered and rejected:
- **(a) Shim-to-adapter**: the five call sites all pass a pre-built
  Foundry `Roll` that the adapter's two-pass pipeline doesn't consume.
  Rewriting the shim to construct a `SpellCastInput` from a pre-built
  Roll would require inventing new adapter machinery just to satisfy
  the shim. High blast radius, zero user benefit.
- **(b) Deprecate with 1-version warning**: XCC maintainer would have
  to refactor sheets to stop pre-building terms. No user benefit;
  adversarial to a sibling module.
- **(c) New public `game.dcc.adapter.castSpell` entry**: if it accepts
  a `SpellCastInput`, it's `actor.rollSpellCheck(...)` renamed; if it
  accepts a pre-built Roll, it's `processSpellCheck` renamed. Nothing
  gained.

Actions taken:
- Updated `docs/dev/EXTENSION_API.md` `processSpellCheck` row to
  reflect permanent-stable designation + orchestrator semantics.
- Updated `EXTENSION_API.md` recommendation #5 from "begin deprecating"
  to "permanent stable API".
- Updated `docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 2` to remove
  the "Delete `processSpellCheck` from dcc.js" goal and document the
  incremental-route-migration approach.

**Gate 2 — Open question #5 (patron-taint RAW alignment).**

Re-read legacy `module/dcc.js:623-660` (creeping d100-vs-chance
mechanic) and lib RAW (`spells/spell-check.js:241` `handleWizardFumble`
+ `spells/fumble.js:46` `fumbleRequiresPatronTaint`).

**Decision — Option (a): keep `_runLegacyPatronTaint` as permanent
adapter infrastructure.** Document the RAW divergence. RAW alignment
becomes a backlog project (not a Phase 2 gate). **[Later note: per
the §8.6 retirement principle added post-close, patron-taint RAW
alignment is on the critical path once other work unblocks, not
permanent. See the Group D / D3 entry in `02-slice-backlog.md`.]**

Rationale:
- Legacy creeping-chance is user-facing established behavior across
  every DCC Foundry world since the system was written. Changing to
  RAW would be a silent behavioral regression for every actor with a
  non-1% `patronTaintChance`.
- RAW alignment would touch sibling content modules
  (`dcc-core-book`, `xcc-core-book`) by demanding fumble-table
  effect-tag migration, plus per-patron taint-table resolution
  (Foundry has `spellSideEffectsCompendium` but no taint-table
  setting; likely name-convention lookup). Multi-session, multi-repo
  project.
- `_runLegacyPatronTaint` is already minimal (15 lines), tested (5
  Vitest cases + 1 Playwright case), and works against live v14
  Foundry. Zero incremental cost.

Actions taken:
- Clarified `_runLegacyPatronTaint` JSDoc to explicitly mark it as
  permanent (not a phase scaffold) with the Phase 2 close decision
  date. (Existing JSDoc already captured the divergence; the update
  removes the "defer to a future session" hedge and pins the decision.)
- Moved open question #5 from "Blockers / open questions" to "Closed
  questions".

**Phase 2 close-out summary:**
- All 5 spell-check sessions landed (dispatcher + generic + wizard +
  cleric + patron + spellburn + mercurial).
- 790 Vitest tests pass + 22 Playwright dispatch tests pass against
  live v14 Foundry (verified 2026-04-18).
- `processSpellCheck` stays exported; dispatcher fall-through preserves
  all non-covered routes verbatim. No behavioral regressions.
- Sibling modules untouched. XCC works as-is.
- Phase 3 (attack / damage / crit / fumble) is the next active phase;
  open question #6 (spellburn dialog) is the early Phase 3 pick-up.
