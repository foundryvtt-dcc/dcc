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
`main` at the time (`2337ec0`). Cross-reference pass against
`ARCHITECTURE_REIMAGINED.md §2.8–§2.12` performed 2026-04-19 (Phase
3 session 8); pain-point columns added to the tables below.

## Stated contract: Foundry-smelling surface (§2.12)

Per `ARCHITECTURE_REIMAGINED.md §2.12`, the DCC system must keep its
**Foundry-smelling API surface** intact even as internals migrate to
the lib. Third-party Foundry modules — Token Action HUD, Item Piles,
Dynamic Active Effects, Active-Effects-aware HUDs, generic
`dnd-ui`-style consumers — read idiomatic Foundry shapes
(`system.attributes.ac.value`, currency paths, top-level
`type === 'Player' | 'NPC'` discriminators, attribute keys on the
template). Their compatibility constraints bound how aggressive the
refactor can get on `system.*` restructuring (especially
**Phase 4**'s schema slimming).

The categories above already encode the contract for hooks and
`game.dcc.*` exports — the stated commitment now extends explicitly
to the **schema shape** rendered into actor / item documents. This
is the hard ceiling on Phase 4: removing fields whose names or
locations are read by ecosystem tools requires a deprecation window
+ migration shim, not a silent restructure. When in doubt, grep the
audited sibling modules for the path before slimming.

---

## Hooks emitted by the system

### Stable

| Hook | Emit site | Consumers | Pain points it addresses | Notes |
|---|---|---|---|---|
| `dcc.ready` | `module/dcc.js:347` | `xcc`, `dcc-annual-1`, `xcc-core-book`, `dcc-core-book` | §2.10 (content packs are the hand-off boundary between rules + data) | Content modules register their packs on this hook. Any change breaks every content module. |
| `dcc.defineBaseActorSchema` | `module/data/actor/base-actor.mjs:282` | `xcc`, `mcc-classes`, `dcc-crawl-classes` | §2.1 (monolithic Player schema), §2.8 (homebrew classes) | Fires inside `defineSchema()` to let variants extend the base actor schema. |
| `dcc.definePlayerSchema` | `module/data/actor/player-data.mjs:245` | `xcc`, `mcc-classes`, `dcc-crawl-classes` | §2.1, §2.8, §2.11 (relieves module-extension pressure) | Same as above, for the Player schema. Phase 4 plans to *supplement* this with `dcc.registerClassMixin` but keep the hook. |
| `dcc.modifyAttackRollTerms` | `module/actor.js:1867` | `dcc-qol` (3 handlers), `xcc` (self-emission) | §2.5 (extension surface), §2.11 | Lets modules modify the terms of an attack roll before it's evaluated. `dcc-qol`'s primary integration point. Phase 3 sessions 3–4 fully bridged it through the adapter (pushed `Modifier` terms surface as `libResult.bonuses`; in-place `terms[0].formula` mutations reflect into `libResult.die`). |
| `dcc.rollWeaponAttack` | `module/actor.js:1782` | `dcc-qol`, `xcc` (several sheets emit + listen) | §2.5, §2.11 | Fired after a weapon attack resolves. Carries `rolls` and `messageData`. |
| `dcc.postActorImport` | `module/parser.js:273` | `xcc` (self-emission) | §2.5 | Fired after Purple Sorcerer / stat-block import. |
| `dcc.registerCriticalHitsPack` | `module/settings.js:76` | `dcc-core-book`, `xcc-core-book` (emitters) | §2.10, §2.11 | Emitted by settings change AND re-emitted by content packs during `dcc.ready`. |
| `dcc.registerDisapprovalPack` | `module/settings.js:124` | `dcc-core-book`, `xcc-core-book`, `dcc-annual-1` (emitters) | §2.10, §2.11 | Same pattern. |
| `dcc.registerLevelDataPack` | *(system listens; emitted by packs)* | `dcc-core-book`, `xcc-core-book`, `dcc-crawl-classes` (emitters); system listens at `dcc.js:923` | §2.10, §2.11 | System is a *listener* here, not an emitter. Class progressions come in through this. |
| `dcc.setFumbleTable` | `module/settings.js:108` | `dcc-core-book`, `xcc-core-book` (emitters) | §2.10 | |
| `dcc.setDivineAidTable` | `module/settings.js:172` | `dcc-core-book` (emitter) | §2.10 | |
| `dcc.setLayOnHandsTable` | `module/settings.js:156` | `dcc-core-book` (emitter) | §2.10 | |
| `dcc.setMercurialMagicTable` | `module/settings.js:188` | `dcc-core-book` (emitter); XCC explicitly cannot use this (see ARCHITECTURE_REIMAGINED.md §2.4) | §2.4 (hardcoded wizard/cleric magic system), §2.11 | Phase 2 needs to generalize this so XCC's two mercurial tables work without fighting the hook. |
| `dcc.setTurnUnholyTable` | `module/settings.js:140` | `dcc-core-book` (emitter) | §2.10 | |

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

| Export | Kind | Consumers | Pain points it addresses | Notes |
|---|---|---|---|---|
| `game.dcc.DCCRoll` | class | `dcc-qol` (`createRoll`), `xcc` (`createRoll`, `cleanFormula`) | §2.5 (extension surface), §2.9 (lib retirement reduces upgrade tax) | The unified roll abstraction. `createRoll(terms, data, options)` and `cleanFormula(terms)` are load-bearing. |
| `game.dcc.DiceChain` | object | `dcc-qol` (`bumpDie`), `xcc` (`bumpDie`, `calculateCritAdjustment`, `calculateProportionalCritRange`) | §2.5 | Dice-chain utility. Every XCC class sheet's attack/crit code calls these. |
| `game.dcc.FleetingLuck` | class | `xcc` (`init`, `updateFlags`, `give`, `enabled`, `automationEnabled`) | §2.5 | XCC uses `Object.defineProperty` on `enabled` and `automationEnabled` — so those must remain configurable properties, not frozen. |
| `game.dcc.processSpellCheck` | function | `xcc` (`xcc-actor-sheet.js` for wizard + cleric spells) | §2.4 (magic system), §2.5, §2.11 | Post-roll spell-check orchestrator: pre-built `Roll` + optional `RollTable` → patron taint check + crit/fumble classification + result-table lookup + level-added crit totaling + `SpellResult` chat render + wizard spell loss / cleric disapproval gating. **Phase 2 close (2026-04-18) finalized this as a permanent stable API** — not a deprecation target. The adapter dispatcher (`DCCActor.rollSpellCheck`) routes the happy-path generic / wizard / cleric / patron-bound casts through `_castViaCastSpell` / `_castViaCalculateSpellCheck`; everything else (result-table spells, naked pre-built-Roll calls, skill-table spells like Turn Unholy, XCC sheet paths with elf-trickster / blaster tweaks) continues to invoke `processSpellCheck`. Future adapter capability growth (result-table rendering, manifestation, forceCrit, mercurial display w/o race condition) can progressively migrate routes; `processSpellCheck` stays as the fallback orchestrator indefinitely. See `docs/00-progress.md` Phase 2 close-out for the inventory and rationale. |
| `game.dcc.registerItemSheet` | function | (none yet — stable from day one per recommendation 7) | §2.5 (extension surface), §2.11 | `(types, SheetClass, options?)` — single declarative call that folds the `Items.unregisterSheet('core', ItemSheetV2) + Items.registerSheet(scope, SheetClass, …)` boilerplate. `types` is `string \| string[] \| undefined` (undefined → all sub-types). `options.makeDefault: true` (the common case) also unregisters Foundry's core `ItemSheetV2` for the same `types` so the new sheet wins the default-pick. Source: `module/extension-api.mjs`. Added 2026-04-19 (Group B1). DCC's own `DCCItemSheet` registration was migrated to dogfood the helper — see `module/dcc.js`. |

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
   registration gives the needed flexibility. (Addresses §2.4 + §2.11.)
3. **Resolve `dcc.update`** before Phase 4 (schema slimming). Either
   re-introduce the emission point or coordinate with XCC to drop the
   listener. (Tracked as open question #3 in `00-progress.md`.)
4. **"Stabilize" `DCCRoll.cleanFormula` and the three `DiceChain`
   utilities** as the de-facto API surface XCC depends on. They're
   currently undocumented; the refactor should add JSDoc treating them
   as a public contract. (Addresses §2.5.)
5. **`game.dcc.processSpellCheck` is a permanent stable API** (decision
   at Phase 2 close, 2026-04-18). The earlier plan to deprecate-and-shim
   was abandoned once the audit showed XCC's two call sites are
   structurally identical peers of DCC's own internal callers (not
   public-API consumers). Keep the export, keep the implementation, grow
   the adapter alongside it. Route migration is per-call-site and
   incremental — no global deprecation.
6. **Honor the §2.12 Foundry-smelling-surface contract** during Phase 4
   schema slimming. See the contract section at the top of this doc:
   removing or relocating fields read by ecosystem tools (Token Action
   HUD, Item Piles, Dynamic Active Effects, etc.) requires a deprecation
   window + migration shim, not a silent restructure. This bounds the
   reach of every `system.*` change.
7. **Plan extension-hook additions to relieve §2.11 pressure.** The
   refactor's stated direction (§2.5, §2.8, §2.11) calls for new
   stable-from-day-one hooks to absorb pressure that currently leaks
   into core: `dcc.registerItemSheet` (closes §2.5 XCC
   `unregisterSheet`/`registerSheet` dance — Group B1 in
   `02-slice-backlog.md`), `dcc.registerClassMixin` (Phase 4),
   `dcc.registerSheetPart` + `dcc.registerVariant` (Phase 5/6). Each
   ships **stable** the moment it lands; document under the table above
   rather than waiting for downstream consumers to materialize.
