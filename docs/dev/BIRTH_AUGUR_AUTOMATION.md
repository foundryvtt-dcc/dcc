# Birth Augur / Lucky Roll Automation

## Context

Issues [#684](https://github.com/foundryvtt-dcc/dcc/issues/684) and [#470](https://github.com/foundryvtt-dcc/dcc/issues/470) request automation of birth augur effects. Currently, the "Lucky Roll" field is a free-text textarea with no mechanical effect — users must manually track and apply their birth augur modifier.

DCC RAW: the birth augur modifier is locked at character creation (level-1 luck mod). Some groups house-rule it to float with current luck. Both modes need support.

The system already applies luck mod to crits, fumbles, and turn unholy for ALL characters (regardless of birth augur). Phase 1 leaves that behavior unchanged.

## Approach: `_getBirthAugurBonusFor()` Helper

A helper method on `DCCActor` that returns the effective birth augur modifier for a given effect type. Each compute function calls this helper for its relevant effect types and adds the result. This avoids mutating persisted fields and handles the double-compute pattern cleanly (same inputs → same outputs).

```javascript
_getBirthAugurBonusFor (...effectTypes) {
  if (!this.isPC) return 0
  const augurIndex = this.system.details.birthAugurIndex
  if (augurIndex == null) return 0
  const augur = BIRTH_AUGURS[augurIndex - 1]
  if (!augur || !effectTypes.includes(augur.effect)) return 0
  return this.system.config.birthAugurMode === 'floating'
    ? this.system.abilities.lck.mod
    : this.system.details.birthAugurLuckMod
}
```

## Phase 1 (MVP): Data Model + UI + 14 "Easy" Augurs

### Files to Create

**`module/birth-augurs.mjs`** — Canonical table of all 30 birth augurs:
```javascript
export const BIRTH_AUGURS = [
  { index: 1,  key: 'harshWinter',   effect: 'allAttack' },
  { index: 2,  key: 'theBull',       effect: 'meleeAttack' },
  { index: 3,  key: 'fortunateDate', effect: 'missileAttack' },
  // ...etc for all 30, with i18n keys for name and description
]
```

Effect types for Phase 1 automation:

| # | Augur | Effect Type | Target |
|---|-------|-------------|--------|
| 1 | Harsh winter | `allAttack` | melee + missile attack adjustment |
| 2 | The bull | `meleeAttack` | melee attack adjustment |
| 3 | Fortunate date | `missileAttack` | missile attack adjustment |
| 6 | Born on the battlefield | `allDamage` | melee + missile damage adjustment |
| 7 | Path of the bear | `meleeDamage` | melee damage adjustment |
| 8 | Hawkeye | `missileDamage` | missile damage adjustment |
| 13 | Seventh son | `spellCheck` | spellCheckOtherMod |
| 17 | Lucky sign | `allSaves` | all three save otherBonus |
| 20 | Struck by lightning | `reflexSave` | ref save otherBonus |
| 21 | Lived through famine | `fortSave` | frt save otherBonus |
| 22 | Resisted temptation | `willSave` | wil save otherBonus |
| 23 | Charmed house | `armorClass` | AC computation |
| 24 | Speed of the cobra | `initiative` | init computation |
| 30 | Wild child | `speed` | speed (×5 per +1/-1) |

Remaining augurs (#4, 5, 9, 10–12, 14–16, 18–19, 25–29) are defined in the table but their effect is not yet automated — selecting them stores the data but won't auto-apply until later phases.

### Files to Modify

**`module/data/actor/base-actor.mjs`**
- Add `birthAugurIndex: new NumberField({ initial: null, nullable: true, integer: true, min: 1, max: 30 })` to `details`
- Add migration in `migrateData()` to auto-populate `birthAugurIndex` from existing `birthAugur` text (best-effort pattern matching)

**`module/data/actor/player-data.mjs`**
- Add `birthAugurMode: new StringField({ initial: 'static' })` to `config` SchemaField

**`module/actor.js`**
- Add `import { BIRTH_AUGURS } from './birth-augurs.mjs'`
- Add `_getBirthAugurBonusFor(...effectTypes)` helper method
- `computeMeleeAndMissileAttackAndDamage()`: add birth augur bonus for `allAttack`/`meleeAttack`/`missileAttack`/`allDamage`/`meleeDamage`/`missileDamage`
- `computeSavingThrows()`: add birth augur bonus for `allSaves`/`reflexSave`/`fortSave`/`willSave`
- `computeSpellCheck()`: add birth augur bonus for `spellCheck`
- `computeInitiative()`: add birth augur bonus for `initiative`
- `prepareDerivedData()` AC section: add birth augur bonus for `armorClass`
- `prepareDerivedData()` speed section: add birth augur bonus for `speed` (×5)
- Store `_computedBirthAugurMod` and `_computedBirthAugurEffect` for UI display

**`templates/actor-partial-pc-common.html`**
- Replace "Lucky Roll" textarea section with: dropdown selector (30 augurs + "Custom") + textarea (kept for display/custom text)
- Show computed birth augur modifier value

**`templates/dialog-actor-config.html`**
- Add Birth Augur Mode selector (Static / Floating) with tooltip explaining RAW vs house rule

**`module/actor-sheet.js`**
- Pass `birthAugurs` array with selection state to template context

**`lang/en.json`** (and other lang files)
- Add i18n keys for all 30 augur names, descriptions, and UI labels

**`module/pc-parser.js`**
- When parsing `luckySign`, also set `birthAugurIndex` by matching against the augur table

### Tests

**`module/__tests__/birth-augur.test.js`** (new)
- `_getBirthAugurBonusFor()` returns correct values per effect type
- Static mode uses `birthAugurLuckMod`, floating mode uses `lck.mod`
- Null index → no bonus
- Each automated augur modifies the correct computed values

**`module/__tests__/actor.test.js`** (extend)
- Compute functions incorporate birth augur bonus correctly
- Birth augur interacts correctly with Active Effects (they stack)

## Phase 2: Skills + HP Augurs

**Skill augurs (#10, #11, #12)** — Apply at roll time in `rollSkillCheck()`:
- Born under the loom (#10): Add bonus to all skill rolls
- Fox's cunning (#11): Add bonus to findTrap/disableTrap rolls
- Four-leafed clover (#12): Add bonus to detectSecretDoors rolls

**HP augur (#25 Bountiful harvest)** — In `prepareDerivedData()`, add `birthAugurMod × level` to `hp.max`

## Phase 3: Context-Dependent + Gated Augurs

**Context-dependent** (#4 unarmed, #5 mounted, #9 pack hunter, #14 spell damage, #16 magical healing, #18 trap saves, #19 poison saves, #27 corruption): Require roll-time context flags. Some may remain informational if context can't be determined.

**Gated luck** (#15 turn unholy, #26 crits, #28 fumbles): Add opt-in world setting to only apply luck to these when birth augur matches. Default OFF to preserve current behavior.

**Informational** (#29 birdsong/languages): No automation planned.

## Verification

1. `npm test` — all existing + new tests pass
2. `npm run format` — code passes lint
3. Manual testing in Foundry:
   - Create character, select each of the 14 automated augurs, verify computed values change
   - Toggle static/floating mode, verify modifier source changes
   - Apply Active Effects to same fields, verify they stack correctly
   - Import character via PC parser, verify augur auto-detected
   - Existing characters with text-only augurs continue working unchanged
