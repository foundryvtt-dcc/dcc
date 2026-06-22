# Bringing DCC-QOL Functionality Into the Core System

**Status:** Analysis / design proposal — not yet implemented
**Author:** drafted 2026-06-22
**Scope:** Evaluates folding the [`dcc-qol`](../../../../modules/dcc-qol) module's
combat-automation and quality-of-life features into the DCC system itself,
gated behind a set of system settings.

> **TL;DR** — Most of dcc-qol's *rules* logic (range penalties, firing into
> melee, friendly fire, luck-vs-crit) belongs in `dcc-core-lib` as pure
> functions; most of its *presentation* logic (enhanced cards, colored
> buttons, hit/miss) belongs in the system's chat layer; and its *privileged
> actions* (auto-damage, auto-dead) need a native socket story to replace
> dcc-qol's `socketlib` dependency. The system already fires the two hooks the
> module relies on (`dcc.modifyAttackRollTerms`, `dcc.rollWeaponAttack`) and
> already ships three of the relevant settings (`emoteRolls`,
> `automateDamageFumblesCrits`, `showRollModifierByDefault`). The hard part is
> not the rules — it's the chat-card rewrite and a clean coexistence story so
> the system and the module don't both render the same card.

---

## 1. Why consider this at all?

dcc-qol is the de-facto "make DCC combat feel finished" module. Folding its
features into core would mean:

- New users get streamlined combat **out of the box**, with no second install
  and no `socketlib` dependency.
- The rules-enforcement features (range, firing-into-melee, friendly fire) are
  **RAW** — they're not house rules, so they have a legitimate home in the
  system.
- We control the chat-card surface directly instead of having an external
  module re-render our cards via `renderChatMessageHTML` (today's
  arrangement is inherently brittle — see §6).

The counter-pressure: dcc-qol is actively maintained, has its own release
cadence, four translations, and a test suite. Absorbing it creates a
maintenance and coexistence burden (§7) and risks regressing the module's
existing users.

---

## 2. Feature inventory (what dcc-qol actually does)

Each row notes where the logic would naturally live if ported. "Lib" =
`dcc-core-lib` pure functions; "System" = chat/UI/settings/socket wiring;
"Both" = rules in lib, presentation in system.

| # | Feature | dcc-qol implementation | Natural core home | Needs GM/socket? |
|---|---------|------------------------|-------------------|------------------|
| 1 | Enhanced attack cards (Full/Compact, colored buttons, separate damage/crit/fumble buttons, weapon-desc toggle) | `chatMessageHooks.js → enhanceAttackRollCard()` re-renders the card from `templates/attackroll-card[-compact].html` using flags written during the attack | System (chat templates + `chat.js`) | No |
| 2 | Hit/Miss display vs. selected target | `attackRollHooks.js → prepareQoLAttackData()` compares roll vs. target AC, writes `dccqol.hitsTarget`; CSS classes applied at render | Both (hit calc already in lib; display in system) | No |
| 3 | Auto-apply damage to targeted token | `damageApplicationHooks.js`; GM-side `socketHandlers.js → gmApplyDamage()`; scrolling-text feedback | System | **Yes** |
| 4 | Auto "Dead" status on NPC at ≤0 HP | `updateActorHooks.js → handleNPCDeathStatusUpdate()` on `updateActor`, GM-only | System | **Yes** (GM-only path) |
| 5 | Range checking & penalties (melee adjacency warning; ranged medium −2, long −1 die step; out-of-range dialog) | `attackRollHooks.js → applyRangeChecksAndPenalties()` on `dcc.modifyAttackRollTerms`; distance via `utils.measureTokenDistance()` | Both (penalty math in lib; distance + dialog in system) | No |
| 6 | Friendly fire (firing into melee, d100 ≤ 50, random ally, full resolution) | `attackRollHooks.js` flags it; `chatCardActions/handleFriendlyFireClick.js` resolves | Both (FF rule in lib; resolution + card in system) | **Yes** (damage step) |
| 7 | Firing-into-melee −1 penalty | `attackRollHooks.js → applyFiringIntoMeleePenalty()` on `dcc.modifyAttackRollTerms` | Both | No |
| 8 | PC luck adjusts incoming monster crits/fumbles | `attackRollHooks.js → _modifyCritRollForTargetPCLuck()` / `_modifyFumbleDieForTargetPCLuck()`, via `game.dcc.DiceChain.bumpDie` | Both (die math in lib) | No |

Distance/adjacency utilities (`measureTokenDistance`, `getTokensInMeleeRange`,
`checkFiringIntoMelee`) are canvas/token helpers — they'd live in the system,
not the lib (the lib is Foundry-agnostic).

---

## 3. What core already provides

The system is already well-prepared for this — several of these hooks and
settings were added *for* dcc-qol:

**Hooks already fired** (`module/actor/rolls-weapon-mixin.mjs`):
- `dcc.modifyAttackRollTerms` (blocking; `(terms, actor, weapon, options)`) —
  the injection point for range / firing-into-melee penalties.
- `dcc.rollWeaponAttack` (`callAll`; `(rolls, messageData)`) — fires
  post-resolution, pre-message; where the module computes hit/miss and stashes
  flags.

**Settings already shipped** (`module/settings.js`, all client-scoped):
- `emoteRolls` — the system *already* re-renders cards as emotes; dcc-qol's
  README recommends turning this **off** because the two rendering paths
  conflict. This is the clearest signal that card rendering needs one owner.
- `automateDamageFumblesCrits` — rolls damage/crit/fumble inline with the
  attack. dcc-qol recommends turning this **off** so players roll those
  separately via card buttons.
- `showRollModifierByDefault` — dcc-qol's buttons already honor this.

**Infrastructure already present:**
- `actor.applyDamage(amount, multiplier)` (`module/actor.js`) + the
  "Apply Damage / Apply Healing" chat context menu.
- Crit/fumble table lookup + result navigation, Mighty Deed prompt wiring
  (`module/chat.js`, `module/table-result.js`).
- `dcc-core-lib` already owns `makeAttackRoll`, `rollDamage`, `rollCritical`,
  `rollFumble` — so adding range/FF/luck math there fits the existing seam.

**Notably absent:** the system uses **no sockets at all** today (`game.socket`
is unused). This is the single biggest infrastructure gap for features 3, 4,
and 6 (§5).

---

## 4. Proposed settings

Recommended grouping. Defaults are chosen to **preserve today's behavior**
(everything off / neutral) so that enabling the feature set is a deliberate
opt-in and so a fresh world behaves exactly as it does now. A world with the
dcc-qol module installed would leave these off and let the module keep
driving (§7).

### 4a. Card presentation

| Setting key | Type | Default | Effect |
|-------------|------|---------|--------|
| `enhancedAttackCards` | Boolean | `false` | Master toggle for the redesigned attack card (hit/miss banner, colored buttons, separate roll buttons). When on, the system renders the rich card instead of the plain one. |
| `attackCardFormat` | String (`full`/`compact`) | `full` | Layout, mirrors dcc-qol. Only meaningful when `enhancedAttackCards` is on. |
| `showHitMissOnCard` | Boolean | `true` | Show hit/miss vs. the selected target. (Could be implied by the master toggle rather than its own setting.) |

> **Interaction:** `enhancedAttackCards` is fundamentally incompatible with
> `emoteRolls` (both rewrite the card). The setting registration should make
> this explicit — e.g. enabling one forces the other off, with a UI note.

### 4b. Combat rules enforcement (RAW)

| Setting key | Type | Default | Effect |
|-------------|------|---------|--------|
| `checkWeaponRange` | Boolean | `false` | Range distance check + medium/long penalties + out-of-range confirm dialog. |
| `firingIntoMeleePenalty` | Boolean | `false` | −1 to ranged attacks into melee (DCC core rulebook p. 96). |
| `automateFriendlyFire` | Boolean | `false` | d100 ≤ 50 friendly-fire check when a ranged-into-melee attack misses (p. 96). |

### 4c. Luck-driven rules (crit = always-on RAW; fumble = optional)

| Setting key | Type | Default | Effect |
|-------------|------|---------|--------|
| `playerLuckVsMonsterCrits` | Boolean | `false` | Automate the (always-on RAW) rule that a target PC's Luck mod alters an incoming monster crit. |
| `monsterFumbles` | Boolean | `false` | Enable the optional **DCC Yearbook #8** Monster Fumbles rule: a targeted PC's Luck steps the monster's fumble die along the dice chain (base `1d10`). |

The crit half is **strict RAW**, not a house rule: "A PC's Luck modifier always
alters a monster's critical hit. A positive Luck modifier reduces the monster's
roll, whereas a negative modifier grants a bonus to the monster's critical hit
roll." It's modelled in `dcc-core-lib` as `CriticalInput.defenderLuckModifier`
(subtracted from the crit total, surfaced as a `"Target's Luck"` modifier). The
setting governs *automation* of an otherwise-always-on rule, not whether the
rule applies — so `playerLuckVsMonsterCrits` is really crit-only.

**Fumbles: two separate rules.** The *core* fumble rule only invokes the
*fumbler's own* Luck ("modified by the reverse of the character's Luck"), die
set by the fumbler's armor — already modelled by the lib's `rollFumble`
(fumbler Luck reversed; armor die; `fumbleDieOverride` for the
equipment-supplied die) and by the system (PCs use their armor-derived
`attributes.fumble.die` + reverse of own Luck; NPCs roll a flat `1d10` on the
NPC fumble table).

dcc-qol's "Monster Fumbles vs Player Luck" is a *separate optional rule from
**DCC Yearbook #8***, not the core rule: when a monster fumbles against a PC,
the targeted PC's Luck modifier steps the monster's fumble die along the dice
chain — base `1d10` at +0, one rung up per +1 (`d12`/`d14`/`d16`), one rung
down per -1 (`d8`/`d7`/`d6`); multi-target uses the highest targeted Luck. This
is modelled in `dcc-core-lib` as `getMonsterFumbleDie(targetLuckModifier)`
(distinct from `rollFumble` — it resizes the *die* rather than applying a flat
modifier). It is **gated behind the monster-fumbles setting**: when enabled, the
system swaps the flat NPC `1d10` for `getMonsterFumbleDie(highestTargetPcLuck)`;
when disabled, the shipped flat-`1d10` behaviour is unchanged.

### 4d. Privileged automation (need socket story — §5)

| Setting key | Type | Default | Effect |
|-------------|------|---------|--------|
| `autoApplyDamage` | Boolean | `false` | Auto-apply rolled damage to the targeted token, with scrolling-text feedback. |
| `autoApplyDeadStatus` | Boolean | `false` | Auto-apply the `dead` status to NPCs reaching ≤0 HP. |

**Scope note:** dcc-qol registers all of its settings at **world** scope.
`autoApplyDamage` / `autoApplyDeadStatus` must be world-scoped (the GM decides
the rule for the table). Card presentation (`enhancedAttackCards`,
`attackCardFormat`) is arguably better **client**-scoped, matching
`emoteRolls`, so each player picks their own card style — but dcc-qol made it
world-scoped for consistency. Pick one and document it.

---

## 5. The socket problem (features 3, 4, 6)

dcc-qol depends on `socketlib` purely to let a **player client** ask the **GM
client** to mutate another actor (apply damage, toggle `dead`, update message
flags). The system has no socket layer today.

A system does **not** need `socketlib` — Foundry gives every system a socket
channel automatically. The core implementation would:

1. On init, register a handler: `game.socket.on('system.dcc', handler)`.
2. From a player client, emit a typed payload
   (`{ action: 'applyDamage', tokenUuid, amount }`).
3. On the GM client, the handler validates `game.user.isGM` (and that *an*
   active GM should respond — guard against multiple GMs double-applying,
   e.g. lowest-id GM responds), then performs the mutation.

This is ~1 small module (`module/socket.mjs`) plus init wiring. It's the
single new piece of infrastructure required, and it's reusable beyond these
features. **Pro:** removes the `socketlib` dependency entirely for users who
only wanted these features. **Con:** we now own socket correctness
(multi-GM, no-GM-present, permission validation) — areas where bugs are
subtle.

Alternative (cheaper, weaker): restrict auto-apply to **GM-driven rolls only**
(no socket; mirrors today's GM-only `autoApplyDeadStatus` path). This covers
the common "GM rolls monster attacks" case but not "player rolls, damage
auto-applies to the monster." Probably not good enough to match dcc-qol.

---

## 6. Architecture: where each piece lands

```
dcc-core-lib (pure, Foundry-agnostic)
  combat/range.js          ← medium/long penalty + die-step math
  combat/firing-melee.js   ← −1 modifier rule
  combat/friendly-fire.js  ← d100 ≤ 50 outcome
  combat/luck-vs-crit.js   ← luck-adjusted crit/fumble die math
        │  (new pure functions + regression tests, per CLAUDE.md lib policy)
        ▼
module/adapter/*           ← translate Foundry weapon/token data → lib inputs
        │
        ▼
module/actor/rolls-weapon-mixin.mjs
  - calls the lib functions when the matching setting is on
  - the system becomes its own consumer of dcc.modifyAttackRollTerms
    instead of relying on an external module to listen
        │
        ▼
module/chat.js + templates/chat-card-attack-result*.html
  - enhanced card rendering (full/compact), hit/miss banner, colored
    buttons, separate damage/crit/fumble buttons
  - this is the largest single chunk of work
        │
        ▼
module/socket.mjs (new)    ← GM-side apply-damage / apply-dead / flag updates
```

**Key principle (from `CLAUDE.md`):** roll/combat *rules* bugs and behavior
belong in `dcc-core-lib` with regression tests, not in adapter-side
compensation. So range/FF/luck math should be **lib PRs first**, then vendored
in via `npm run sync-core-lib`, then wired up in the system. The
canvas/token-distance helpers and all chat/socket code stay in the system
(the lib never touches Foundry globals).

**Why the card rewrite is the crux:** today the module *replaces* our card's
inner HTML on `renderChatMessageHTML`. If core renders a rich card natively,
the template (`chat-card-attack-result.html`) and `chat.js` button wiring grow
substantially: per-button color states, full vs. compact partials, persisted
button-clicked state in message flags (so reloads render correctly), and
per-client permission checks on the damage button. This is also where it
collides hardest with the existing `emoteRolls` path — they cannot both own
the card.

---

## 7. Coexistence with the dcc-qol module (the guard)

Most DCC worlds today run dcc-qol. If core ships overlapping features, **both
could try to act on the same attack** → double penalties, double cards, double
damage, broken listeners. The system needs a guard, and it lives in the
**system** (not the module): the system **defers to the module** whenever the
module is present.

**Why this direction.** dcc-qol is already deployed in the field (v1.2.1) and
we can't change installed copies. The system's feature is the *new, opt-in*
one, so the system is the side that must yield. Net effect: existing module
users see **zero change** and keep the module's more mature implementation. The
system's implementation only takes over once the module is gone.

**The endgame is retirement, not negotiation.** We intend to eventually drop
dcc-qol entirely once core reaches parity. So the guard is purely a
*transitional* safety net — there is no need for a fine-grained per-feature
handshake between the two codebases. When core is ready, the steps are: remove
the module, the guard predicate returns `false`, and the system's features
default on. (Until then, dcc-qol registers all of its hook handlers
unconditionally and checks its own settings internally, so the only safe line
is **all-or-nothing**: if dcc-qol is active at all, the system cedes the entire
overlapping feature set.)

### Implementation: one predicate, three layers

**Single source of truth** — a small `module/integrations.mjs`, following the
existing `game.modules.get('dcc-core-book')?.active` idiom already used in
`module/table-loading.mjs` and `module/spell-duel.js`:

```js
// Day-one transitional guard. When dcc-qol is retired this returns false and
// the system's combat features take over. Named semantically so the eventual
// flip is a one-line change.
export function qolHandlingCombat () {
  return game.modules.get('dcc-qol')?.active ?? false
}
```

1. **Registration-time gate (primary correctness).** In
   `module/chat-and-hook-wiring.mjs` (where the `Hooks.on/once` helper lives),
   simply **don't register** the system's new QoL hook handlers / don't take
   the enhanced-card render path when `qolHandlingCombat()` is true. No handler
   registered ⇒ no possible double-action. One decision, zero runtime overhead,
   nothing to remember in individual handlers.
2. **Setting-visibility gate (UX).** In `settings.js`, register the §4 settings
   with `config: !qolHandlingCombat()` (plus a hint string) so the GM never
   sees toggles that would fight the module. Stored values persist; they just
   hide while the module is active.
3. **Per-execution guard (optional belt-and-suspenders).** Only on any path not
   already covered by layer 1. Usually unnecessary once registration is gated.

**Non-issue worth stating:** enabling/disabling a module forces a Foundry
reload anyway, so checking `qolHandlingCombat()` at `init`/`ready` is
sufficient — no reactive re-checking needed.

---

## 8. Pros / cons summary

**Pros**
- Streamlined, RAW-correct combat out of the box; no second install.
- Eliminates the `socketlib` dependency for these features.
- We own the chat-card surface directly — no external `renderChatMessageHTML`
  monkey-with, which is inherently fragile across system updates.
- Rules logic lands in `dcc-core-lib` where it's unit-testable and shared with
  any other consumer (xcc, mcc-classes, crawl-classes, custom sheets).
- Replaces the awkward "turn OFF `emoteRolls` and `automateDamageFumblesCrits`
  for the module to work right" guidance with one coherent setting set.

**Cons / risks**
- **Coexistence** with the installed module is the dominant risk (§7).
- **Card rewrite** is large and touches the most-tested path (attack/sheet/
  chat) — full Playwright E2E required, not just Vitest.
- New **socket** surface to own and get right (multi-GM, no-GM).
- **i18n**: dcc-qol ships en/es/fr/pt-br strings for all of this; porting means
  porting (and maintaining) those keys.
- **Maintenance transfer**: bugs that were the module's problem become the
  system's problem, on the system's release cadence.
- Some features (auto-dead, auto-apply) are conveniences rather than rules;
  baking them in invites "this isn't how my table plays" feedback unless
  clearly opt-in. (Luck-vs-crit, by contrast, is confirmed strict RAW — see
  §4c — so the only question there is automating it, not whether it applies.)

---

## 9. Implementation status

Work lives on branch **`feat/dcc-qol-integration`** (off `main`). The lib side
shipped as **`@moonloch/dcc-core-lib` v0.12.0** (PR #9, merged) and is vendored
at `module/vendor/dcc-core-lib/`.

**Shipped (8 slices, all green):**

| Feature | Setting (world, default off) | System file | Lib helper |
|---------|------------------------------|-------------|------------|
| Coexistence guard | — | `module/integrations.mjs` (`qolHandlingCombat`) | — |
| Missile range penalties | `checkWeaponRange` | `module/weapon-range.mjs` | `parseMissileRange`, `getMissileRangePenalty` |
| Firing-into-melee −1 | `firingIntoMeleePenalty` | `module/weapon-range.mjs` | `getFiringIntoMeleePenalty` |
| Defender Luck vs monster crit | `playerLuckVsMonsterCrits` | `rolls-weapon-mixin._rollCritical` + `combat-targeting.mjs` | `CriticalInput.defenderLuckModifier` |
| Monster fumbles (Yearbook #8) | `monsterFumbles` | `rolls-weapon-mixin._rollFumble` + `combat-targeting.mjs` | `getMonsterFumbleDie` |
| Native socket | — | `module/socket.mjs` (`executeAsGM`, active-GM election; `game.dcc.socket`) | — |
| Auto-apply damage | `autoApplyDamage` | `module/auto-apply-damage.mjs` | — |
| Auto-dead status | `autoApplyDeadStatus` | `module/auto-dead-status.mjs` | — |

Range + firing-into-melee run through one combined `onModifyAttackRollTerms`
dispatcher on `dcc.modifyAttackRollTerms`. Tests: full Vitest green (~1896);
each slice has a Playwright probe in `browser-tests/e2e/` (`weapon-range`,
`monster-luck`, `socket`, `auto-apply-damage`, `auto-dead-status`). The only
red in the full E2E run is the pre-existing `extension-api` class-progression
env failure (uncompiled level pack), unrelated to this work.

**Gating as built (deviates from §7's plan — reconcile or accept):** every
handler is **always registered** and checks `qolHandlingCombat()` + its setting
**per execution** (the "belt-and-suspenders" layer), rather than the
registration-time gate + `config: !qolHandlingCombat()` setting-hiding that §7
proposed. This is simpler and, with all settings defaulting off, equally safe;
the cost is the §4 toggles remain *visible* even when dcc-qol is active (a GM
could turn one on and see nothing happen because the guard suppresses it). If
that's undesirable, add the setting-visibility gate later.

**Not yet built:**
- **Friendly fire** — lib `checkFiringIntoMelee` is ready; needs Foundry-side
  ally detection, the d100 resolution, and chat-card buttons (UI-heavy).
- **Enhanced attack cards** — hit/miss banner, colored/separated buttons,
  full/compact layouts. The big template rewrite; collides with `emoteRolls`.
- **Module retirement** — once at parity, drop dcc-qol and flip defaults (§10).

---

## 10. Open questions

- **Defaults / on-by-default (under active discussion).** Everything ships
  **off** today to preserve existing-world behavior on a system update. The
  RAW rules (`checkWeaponRange`, `firingIntoMeleePenalty`,
  `playerLuckVsMonsterCrits`) have a case for defaulting **on** at the dcc-qol
  retirement milestone (they're rules-correct and inert without targeting);
  the optional rule (`monsterFumbles`) and the conveniences (`autoApplyDamage`,
  `autoApplyDeadStatus`) should stay opt-in. Note the coexistence guard means
  defaults only affect worlds **without** dcc-qol.
- **Setting-visibility gate:** adopt §7's `config: !qolHandlingCombat()` so the
  toggles hide while dcc-qol is active? (See §9 gating note.)
- **`emoteRolls` future:** does the enhanced card *replace* emote rendering, or
  remain a mutually-exclusive mode? (plain / emote / enhanced is a lot to test.)
- **Ownership of FF randomness** in the lib — the d100 must be a Foundry `Roll`
  in the system, with the lib only classifying the outcome.

- **Setting scope:** card presentation client-scoped (like `emoteRolls`) or
  world-scoped (like dcc-qol)? Recommend client for presentation, world for
  rules/automation.
- **`emoteRolls` future:** does the enhanced card *replace* emote rendering,
  or do they remain two mutually-exclusive presentation modes? (Three modes —
  plain / emote / enhanced — is a lot of surface to test.)
- **Defaults at the cutover:** ship off (preserve current behavior, opt-in) vs.
  on (best first-run experience but changes every existing world). Recommend
  off, with the welcome dialog advertising the new toggle.
- **Do we want auto-dead / luck-vs-crit in core at all,** or leave the
  opinionated bits in the module even after the cutover?
- **Ownership of FF randomness** in the lib (the lib forbids `Math.random()`
  in some contexts) — the d100 roll must be a Foundry `Roll` in the system,
  with the lib only classifying the outcome.
```

