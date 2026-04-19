# Slice Backlog — `refactor/dcc-core-lib-adapter`

> Executable worklist for autonomous batch execution. Each slice is
> self-contained: scope, files, tests, stop conditions, and commit
> format. A fresh Claude session reading `docs/01-session-start.md` +
> this file should be able to execute the top N slices without human
> synthesis.

---

## How to consume

**Batch-slice mode:** one prompt = one batch of 2–3 slices from the top
of the backlog. Session starts fresh (`/clear`), reads
`docs/01-session-start.md` + this file, executes top-of-queue serially
(or in parallel where marked ✅ parallel-safe), commits each slice
independently under the auto-commit authorization in `CLAUDE.md`,
reports a single end-of-batch summary.

**Commit format:** `feat(adapter): Phase <N> session <M> — <slice title>`
matches established history. For retirement and cruft slices,
`refactor(adapter):` or `chore(cruft):` as appropriate.

**Every slice ends with:**
1. Full Vitest suite green (`npm test`)
2. Full Playwright e2e suite green (`cd browser-tests/e2e && npm test`
   — not just the dispatch spec; see `CLAUDE.md` refactor-slice rules)
3. At least one new browser-test assertion exercising the slice
4. `docs/00-progress.md` entry for the slice
5. `docs/01-session-start.md` status line updated
6. This file's slice marked done and moved to the Completed section

## Stop conditions (pause and ask)

- Any test goes red and fix requires non-mechanical investigation
  (>15 min or >1 debugging rabbit-hole)
- Gate-logic change is *semantic* (new branch kind) rather than
  *extension* (another variant of an existing branch)
- Any Foundry-facing API shape would change (`game.dcc.*` exports,
  `DCCActor` public methods, hook signatures, documented
  `CONFIG.DCC.*` paths) — see `ARCHITECTURE_REIMAGINED.md §8.6` and
  `EXTENSION_API.md`
- Any sibling module (`dcc-qol`, `xcc`, `mcc-classes`,
  `dcc-crawl-classes`) would need a code change
- Slice scope balloons past its backlog entry — don't silently expand
- Pre-commit hook rewrites code in ways that warrant review
- RAW-divergence decision surfaces (see Group D patron-taint entry)

## Retirement principle

Per `ARCHITECTURE_REIMAGINED.md §8.6`: Foundry-facing API stays as thin
wrappers indefinitely; internal `_xxxLegacy` branches and direct-reimpl
methods retire once adapter coverage is exhaustive for their call site.
Retirement is silent — no external consumer knows or cares.

---

## Active queue

### Group A — Phase 3 attack-gate completion (serial; `module/actor.js` conflicts)

These broaden the attack-dispatcher gate until coverage is exhaustive
for simplest-weapon, two-weapon, backstab, and deed-die paths.
Completion unblocks Group D retirement slices. Must serialize — all
touch `module/actor.js` dispatchers.

#### A2. Backstab attack + damage through adapter — **BLOCKED**
- **Blocked on:** in-flight `dcc-core-lib` backstab fix. User is
  correcting the lib's backstab semantics to match DCC RAW + the
  legacy DCC Foundry behavior. Do not start this slice until the
  vendored lib version (`module/vendor/dcc-core-lib/VERSION.json`)
  reflects a post-fix commit. See
  `memory/project_dcc_core_lib_backstab_fix_inflight.md`.
- **Scope:** Broaden attack + damage gates to allow backstab. Lib has
  `getBackstabMultiplier`; surface it as a `MultiplyModifier` on the
  damage `modifiers` list when wave 3 is in, or translate to the
  multiplier field on `DamageInput` in the meantime.
- **Files:** `module/actor.js` (both `_canRouteAttackViaAdapter` and
  `_canRouteDamageViaAdapter` + their adapter branches),
  `module/adapter/damage-input.mjs`,
  `module/__tests__/adapter-weapon-{attack,damage}.test.js`.
- **Browser tests:** extend dispatch spec with a thief-backstab scenario
  asserting the adapter path for both attack and damage, validating the
  `libDamageResult` breakdown includes the multiplier.
- **Commit:** `feat(adapter): Phase 3 session <M> — backstab adapter route`

#### A3. Deed-die adapter route (warrior + dwarf)
- **Scope:** Broaden attack gate to allow deed-die weapons. Lib has
  `isDeedSuccessful` + Mighty Deed skill definition (`add-dice` shape in
  MODIFIERS.md §4 once wave 3 lands; custom field pre-wave-3).
- **Files:** `module/actor.js` dispatchers,
  `module/adapter/attack-input.mjs`,
  `module/__tests__/adapter-weapon-attack.test.js`.
- **Browser tests:** warrior-with-deed-die case asserting dispatch and
  deed success threshold.
- **Commit:** `feat(adapter): Phase 3 session <M> — deed-die adapter route`

#### A4. Two-weapon fighting through adapter
- **Scope:** Both attacks + both damage rolls + penalty computation
  through adapter. Lib has `getTwoWeaponPenalty`. This is the hardest
  remaining attack-side slice — exercises multiple lib calls per user
  action and the two-result chat-rendering path.
- **Stop-and-ask trigger:** if the Foundry-side chat rendering for
  two-weapon requires a new shape (e.g., two separate chat messages
  vs. one combined), pause — that's an architecture decision.
- **Commit:** `feat(adapter): Phase 3 session <M> — two-weapon adapter route`

**Exit criterion for Group A:** simplest + NPC-adjusted + backstab +
deed-die + two-weapon all route via adapter; `_canRouteXxxViaAdapter`
returns `true` for the common-case paths. Legacy branches remain
(non-exhaustive edge cases still fall through), but the high-traffic
paths no longer use them. This unblocks Group D.

---

### Group B — Phase 3 XCC-win deliverable (✅ parallel-safe with Group A)

---

### Group C — Parallel cruft removal (✅ parallel-safe, independent)

Cheap Phase 7 wins per §2.7. Each is self-contained, touches files
unrelated to adapter work, and benefits from landing now rather than
waiting for Phase 7.

#### C1. Retire `critText` / `fumbleText` compatibility shims
- **Scope:** Audit callers of `critText` / `fumbleText` (the "Legacy
  name for dcc-qol compatibility" shims in chat templates / item
  data). Verify `../../modules/dcc-qol` no longer reads them;
  coordinate with dcc-qol maintainer if any live callers remain.
- **Stop-and-ask trigger:** if `dcc-qol` still uses them, do NOT
  remove — pause and ask.
- **Files:** grep-driven — chat templates, `item.js`, schema
  migrations.
- **Commit:** `chore(cruft): retire critText/fumbleText legacy shims`

#### C2. Prune pre-V14 migrations
- **Scope:** Review `module/dcc.js` migration block (referenced as
  "418 lines of cumulative migrations" in §2.7). Identify migrations
  that ran before a minimum data version we can now require. Delete
  them; bump the minimum-data-version constant.
- **Stop-and-ask trigger:** if any active DCC world could still need
  a migration, do NOT delete — pause and ask.
- **Commit:** `chore(cruft): prune pre-V14 migrations`

#### C3. Delete halfling i18n-localize dispatch remnants
- **Scope:** `actor.js:1725` is fixed per earlier audit — but grep
  for any residual `game.i18n.localize('DCC.Halfling')` equality
  checks elsewhere, and document in `EXTENSION_API.md` that class
  dispatch uses internal class IDs, not localized labels.
- **Files:** search-driven.
- **Commit:** `chore(cruft): audit + remove residual halfling i18n equality checks`

---

### Group D — Legacy-branch retirements (depends on Group A completion)

Per the §8.6 retirement principle. Do NOT start these until Group A
marks the gate exhaustive.

#### D1. Retire `_rollToHitLegacy`
- **Scope:** After A1–A4 complete, verify the dispatcher gate returns
  `true` for every call site. Delete `_rollToHitLegacy` + collapse
  `rollToHit` dispatcher to single adapter call.
- **Test regression:** every existing `_rollToHitLegacy` assertion
  either moves to the adapter path or gets deleted.
- **Commit:** `refactor(adapter): retire _rollToHitLegacy (gate exhaustive)`

#### D2. Retire `_rollDamageLegacy`, `_rollCriticalLegacy`, `_rollFumbleLegacy`
- Same pattern as D1, once each gate is exhaustive.

#### D3. Resolve RAW patron-taint alignment → retire `_runLegacyPatronTaint`
- **Scope:** The Phase 2 close-out deferred RAW alignment for patron
  taint. Per the new retirement principle, this is now critical
  path. Either (a) the lib's RAW patron-taint replaces the legacy
  d100-vs-chance mechanic — requires fumble-table effect-tag
  migration across sibling content modules (`dcc-core-book`,
  `xcc-core-book`); or (b) we formally accept the legacy mechanic
  as a DCC-system-specific divergence and port it into the lib
  (lib's combat rules get a variant flag).
- **Stop-and-ask trigger:** this is a design decision with
  cross-repo scope — always pause and ask. This entry documents
  the blocker, not a silent-to-execute slice.
- **Commit:** depends on decision outcome.

#### D4. Fold direct-reimpl spell-check branches
- **Scope:** `rollSpellCheck` dispatcher has direct-reimpl branches
  for routes the adapter's two-pass pipeline didn't cover at Phase 2
  close (pre-built Roll + RollTable, forceCrit, skill-table spells
  like Turn Unholy). Evaluate which can route through the adapter
  now; retire the rest only after their specific capability lands.
- **Stop-and-ask trigger:** each branch evaluated separately —
  pause and ask for each.

---

### Group E — Vertical slice for XCC/MCC validation (after Groups A + B)

Once the attack-side pattern is proven (Group A) and the first XCC
hack is closed (Group B), pick ONE vertical to take all the way
through Phases 4 → 5 → 6 for a single capability. Demonstrates the
full-stack approach works end-to-end with a real sibling consumer.

**Candidates (pick one at slice time):**

1. **Halfling vertical** — slim halfling-specific fields out of
   Player schema (Phase 4 slice), add halfling-tab sheet composition
   (Phase 5 slice), register halfling as a class-mixin consumed by
   `mcc-classes`' halfling equivalent. Most architecturally
   informative — touches data model + sheet composition + mixin API.
2. **Mercurial-magic vertical** — fix the XCC "2 tables vs 1"
   problem (§2.4) by making mercurial table lookup variant-aware via
   a Phase 6-style variant config. Small, targeted XCC win.
3. **Single-class homebrew vertical** — pick a fan-made class (e.g.,
   from `dcc-crawl-classes`), rewire it as a class-mixin + sheet-part
   registration. Validates §2.8 homebrew extensibility.

**This entry is a placeholder** — pick the specific vertical via
explicit user decision before drafting its concrete slice list.

---

## Completed slices

Move entries here as they land; keep the active queue scannable.

### Phase 3 sessions 1–8 (2026-04-18 → 2026-04-19)

See `docs/00-progress.md` for details. Summary:
- Phase 3 session 1: Spellburn dialog-adapter
- Phase 3 session 2: first attack-migration slice (simplest happy-path)
- Phase 3 session 3: hook-translation bridge (`hookTermsToBonuses`)
- Phase 3 session 4: long-range dice-chain translation (`normalizeLibDie`)
- Phase 3 session 5: first damage-migration slice (simplest happy-path)
- Phase 3 session 6: crit + fumble migration (both adapter routes)
- Phase 3 session 7: NPC damage-bonus adjustment threaded through the
  adapter as a `RollBonus` so the lib breakdown attributes it correctly
  (was previously misattributed to Strength)
- Phase 3 session 8: PC magic weapon bonus (`damageWeaponBonus: '+N'`)
  threaded through the adapter as `DamageInput.magicBonus` so the lib
  breakdown carries a separate `source: 'magic'` entry; parser extended
  to sum multiple flat modifiers, new `extractWeaponMagicBonus` helper
  gates dice-bearing / cursed bonuses to legacy

### Docs slices

- B2 (2026-04-19): `EXTENSION_API.md` cross-referenced against
  `ARCHITECTURE_REIMAGINED.md §2.8–§2.12`; pain-point columns added
  to both surface tables; §2.12 Foundry-smelling-surface contract
  stated explicitly; recommendations grew schema-shape + future-hook
  guidance.

### Extension API slices

- B1 (2026-04-19): `game.dcc.registerItemSheet(types, SheetClass,
  options?)` shipped as stable extension API. Closes §2.5 / §2.11
  pain points. Helper at `module/extension-api.mjs`; DCC's own
  `DCCItemSheet` registration migrated to dogfood it. 9 unit tests
  + 3 Playwright e2e cases.
- B1-followup-2 (2026-04-19): `dcc.afterComputeSpellCheck` post-hook
  on `DCCActor.computeSpellCheck`. Retires XCC's `XCCActor`
  subclass + the `CONFIG.Actor.documentClass = XCCActor` global
  replacement at `xcc/module/xcc.js:171`. XCC migration recipe
  added to `EXTENSION_API.md` for the maintainer to consume.
  +2 unit tests + 1 Playwright case.

- B1-followup (2026-04-19): `game.dcc.registerActorSheet(types,
  SheetClass, options?)` Actor-side mirror. DCC's own 11 actor-sheet
  registrations migrated to dogfood the helper. Sibling-module
  migration is opt-in (XCC has 19 call sites, MCC 7,
  dcc-crawl-classes 9 — total 35 lines of boilerplate that can each
  collapse to a one-liner when their maintainers want to take it up).
  +7 unit tests + 3 Playwright cases.
