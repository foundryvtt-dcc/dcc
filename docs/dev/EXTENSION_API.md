# DCC System Extension API

The DCC FoundryVTT system exposes a surface to downstream modules through
two channels: **Foundry hooks** (`Hooks.on('dcc.*', …)`) and the global
**`game.dcc` namespace**. This document categorizes every item on that
surface so module authors know what they can rely on and so the refactor
to an adapter over [dcc-core-lib](ARCHITECTURE_REIMAGINED.md) knows what
it must preserve.

**Categories:**

- **Stable** — emitted/exported *and* known to be consumed by at least
  one sibling module. Must be preserved verbatim through the refactor,
  with at least a deprecation window before any breaking change.
- **Internal** — emitted/exported but no external consumer found in the
  audited modules (`dcc-qol`, `xcc`, `xcc-core-book`, `mcc-classes`,
  `dcc-crawl-classes`, `dcc-core-book`, `dcc-annual-1`,
  `token-action-hud-dcc`). Safe to refactor or rename. Flag on a best-
  effort basis if changes land.
- **Dead** — either listened to externally but never emitted by the
  system, or emitted but with no consumers detected anywhere. Candidates
  for removal in coordination with downstream maintainers.

Audit method: `Hooks.(call|callAll|on|once)\(['"]dcc\.` and
`game\.dcc\.*` across sibling modules at `/Users/timwhite/FoundryVTT/
Data/modules/`. Audit performed 2026-04-17 against the commit on
`main` at the time (`2337ec0`).

---

## Hooks emitted by the system

### Stable

| Hook | Emit site | Consumers | Notes |
|---|---|---|---|
| `dcc.ready` | `module/dcc.js:347` | `xcc`, `dcc-annual-1`, `xcc-core-book`, `dcc-core-book` | Content modules register their packs on this hook. Any change breaks every content module. |
| `dcc.defineBaseActorSchema` | `module/data/actor/base-actor.mjs:282` | `xcc`, `mcc-classes`, `dcc-crawl-classes` | Fires inside `defineSchema()` to let variants extend the base actor schema. |
| `dcc.definePlayerSchema` | `module/data/actor/player-data.mjs:245` | `xcc`, `mcc-classes`, `dcc-crawl-classes` | Same as above, for the Player schema. Phase 4 plans to *supplement* this with `dcc.registerClassMixin` but keep the hook. |
| `dcc.modifyAttackRollTerms` | `module/actor.js:1867` | `dcc-qol` (3 handlers), `xcc` (self-emission) | Lets modules modify the terms of an attack roll before it's evaluated. `dcc-qol`'s primary integration point. |
| `dcc.rollWeaponAttack` | `module/actor.js:1782` | `dcc-qol`, `xcc` (several sheets emit + listen) | Fired after a weapon attack resolves. Carries `rolls` and `messageData`. |
| `dcc.postActorImport` | `module/parser.js:273` | `xcc` (self-emission) | Fired after Purple Sorcerer / stat-block import. |
| `dcc.registerCriticalHitsPack` | `module/settings.js:76` | `dcc-core-book`, `xcc-core-book` (emitters) | Emitted by settings change AND re-emitted by content packs during `dcc.ready`. |
| `dcc.registerDisapprovalPack` | `module/settings.js:124` | `dcc-core-book`, `xcc-core-book`, `dcc-annual-1` (emitters) | Same pattern. |
| `dcc.registerLevelDataPack` | *(system listens; emitted by packs)* | `dcc-core-book`, `xcc-core-book`, `dcc-crawl-classes` (emitters); system listens at `dcc.js:923` | System is a *listener* here, not an emitter. Class progressions come in through this. |
| `dcc.setFumbleTable` | `module/settings.js:108` | `dcc-core-book`, `xcc-core-book` (emitters) | |
| `dcc.setDivineAidTable` | `module/settings.js:172` | `dcc-core-book` (emitter) | |
| `dcc.setLayOnHandsTable` | `module/settings.js:156` | `dcc-core-book` (emitter) | |
| `dcc.setMercurialMagicTable` | `module/settings.js:188` | `dcc-core-book` (emitter); XCC explicitly cannot use this (see ARCHITECTURE_REIMAGINED.md §2.4) | Phase 2 needs to generalize this so XCC's two mercurial tables work without fighting the hook. |
| `dcc.setTurnUnholyTable` | `module/settings.js:140` | `dcc-core-book` (emitter) | |

### Internal

| Hook | Emit site | Reason |
|---|---|---|
| `dcc.registerSpellSideEffectsPack` | `module/settings.js:92` | No consumers found in audited modules. Appears to be self-contained. |

### Dead

| Hook | Where it fails | Notes |
|---|---|---|
| `dcc.update` | Listener at `modules/xcc/module/xcc.js:525`; no emission in the DCC system | Either dropped during an earlier refactor or speculatively added by XCC. Requires a decision: re-introduce the emit, or ask XCC to remove the listener. |

---

## `game.dcc.*` exports

Set in `module/dcc.js:108–121`.

### Stable

| Export | Kind | Consumers | Notes |
|---|---|---|---|
| `game.dcc.DCCRoll` | class | `dcc-qol` (`createRoll`), `xcc` (`createRoll`, `cleanFormula`) | The unified roll abstraction. `createRoll(terms, data, options)` and `cleanFormula(terms)` are load-bearing. |
| `game.dcc.DiceChain` | object | `dcc-qol` (`bumpDie`), `xcc` (`bumpDie`, `calculateCritAdjustment`, `calculateProportionalCritRange`) | Dice-chain utility. Every XCC class sheet's attack/crit code calls these. |
| `game.dcc.FleetingLuck` | class | `xcc` (`init`, `updateFlags`, `give`, `enabled`, `automationEnabled`) | XCC uses `Object.defineProperty` on `enabled` and `automationEnabled` — so those must remain configurable properties, not frozen. |
| `game.dcc.processSpellCheck` | function | `xcc` (`xcc-actor-sheet.js` for wizard + cleric spells) | Post-roll spell-check orchestrator: pre-built `Roll` + optional `RollTable` → patron taint check + crit/fumble classification + result-table lookup + level-added crit totaling + `SpellResult` chat render + wizard spell loss / cleric disapproval gating. **Phase 2 close (2026-04-18) finalized this as a permanent stable API** — not a deprecation target. The adapter dispatcher (`DCCActor.rollSpellCheck`) routes the happy-path generic / wizard / cleric / patron-bound casts through `_castViaCastSpell` / `_castViaCalculateSpellCheck`; everything else (result-table spells, naked pre-built-Roll calls, skill-table spells like Turn Unholy, XCC sheet paths with elf-trickster / blaster tweaks) continues to invoke `processSpellCheck`. Future adapter capability growth (result-table rendering, manifestation, forceCrit, mercurial display w/o race condition) can progressively migrate routes; `processSpellCheck` stays as the fallback orchestrator indefinitely. See `docs/00-progress.md` Phase 2 close-out for the inventory and rationale. |

### Internal

| Export | Kind | Reason |
|---|---|---|
| `game.dcc.DCCActor` | class | No external references found; Foundry reaches the document class through `CONFIG.Actor.documentClass`. XCC replaces that globally anyway — it doesn't use `game.dcc.DCCActor`. |
| `game.dcc.SpellDuel` | class | No external references. |
| `game.dcc.SpellResult` | class | No external references. |
| `game.dcc.TableResult` | class | No external references. |
| `game.dcc.getSkillTable` | function | `dcc-qol` only references it inside a test mock (`scripts/__mocks__/foundry.js`), not in runtime code. Treat as internal. |
| `game.dcc.rollDCCWeaponMacro` | function | Called from hotbar macros (see comment in `dcc.js`). Not imported by modules. |
| `game.dcc.getMacroActor` | function | Same — macro surface. |
| `game.dcc.getMacroOptions` | function | Same — macro surface. |

The macro-surface functions (`rollDCCWeaponMacro`, `getMacroActor`,
`getMacroOptions`) are internal to modules but **published to end-user
macro scripts**. They're de-facto stable in the same sense that the
`game.dcc.*` JS shape is.

### Dead

None identified.

---

## Recommendations for the refactor

1. **Preserve every "Stable" item verbatim** through Phases 1–3. Thin
   wrappers are fine; signatures and hook names are not negotiable
   without a deprecation window.
2. **Generalize** `dcc.setMercurialMagicTable` in Phase 2. XCC already
   hit a wall with it. The lib's per-class `CasterProfile.type`
   (`@moonloch/dcc-core-lib` `spells/cast.ts`) plus a per-class table
   registration gives the needed flexibility.
3. **Resolve `dcc.update`** before Phase 4 (schema slimming). Either
   re-introduce the emission point or coordinate with XCC to drop the
   listener.
4. **"Stabilize" `DCCRoll.cleanFormula` and the three `DiceChain`
   utilities** as the de-facto API surface XCC depends on. They're
   currently undocumented; the refactor should add JSDoc treating them
   as a public contract.
5. **`game.dcc.processSpellCheck` is a permanent stable API** (decision
   at Phase 2 close, 2026-04-18). The earlier plan to deprecate-and-shim
   was abandoned once the audit showed XCC's two call sites are
   structurally identical peers of DCC's own internal callers (not
   public-API consumers). Keep the export, keep the implementation, grow
   the adapter alongside it. Route migration is per-call-site and
   incremental — no global deprecation.
