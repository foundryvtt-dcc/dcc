# Attribute Paths for Third-Party Modules

Many FoundryVTT modules (such as Aeris Tokens, Token Action HUD, Always HP, etc.) need to know the data paths used by the DCC system to read values like movement speed, hit points, or armor class from your tokens. This page lists the most commonly needed paths.

All paths are relative to the actor and use the `system.` prefix.

## Quick Reference

These are the paths most commonly requested by modules:

| Value | Path | Type | Example |
|-------|------|------|---------|
| **Movement Speed** | `system.attributes.speed.value` | String | `"30"` |
| **Hit Points (current)** | `system.attributes.hp.value` | Number | `12` |
| **Hit Points (max)** | `system.attributes.hp.max` | Number | `16` |
| **Armor Class** | `system.attributes.ac.value` | Number | `14` |
| **Initiative Bonus** | `system.attributes.init.value` | String | `"+2"` |
| **Level** | `system.details.level.value` | Number | `3` |
| **Alignment** | `system.details.alignment` | String | `"l"`, `"n"`, or `"c"` |

> **Note:** Movement speed is a **string**, not a number. It may contain unit markers like `"30'"` or multiple values like `"25/50/100"`. Modules that expect a numeric value may need the speed entered without units.

## Movement

| Value | Path | Notes |
|-------|------|-------|
| Current Speed | `system.attributes.speed.value` | Computed from base + armor penalties (if auto-compute is on) |
| Base Speed | `system.attributes.speed.base` | Before armor penalties |
| Swim Speed | `system.attributes.speed.swim` | Empty if not set; enable "Show Swim/Fly Speed" in Advanced Settings |
| Fly Speed | `system.attributes.speed.fly` | Empty if not set; enable "Show Swim/Fly Speed" in Advanced Settings |
| Special Movement | `system.attributes.speed.special` | Free-text for notes like "Infravision 60'" |

**For Aeris Tokens and similar modules:** Use `system.attributes.speed.value` for all actor types (Player, NPC, and Party).

## Hit Points

| Value | Path | Notes |
|-------|------|-------|
| Current HP | `system.attributes.hp.value` | |
| Maximum HP | `system.attributes.hp.max` | |
| Minimum HP | `system.attributes.hp.min` | Usually 0 |
| Temporary HP | `system.attributes.hp.temp` | |

## Armor Class

| Value | Path | Notes |
|-------|------|-------|
| AC Value | `system.attributes.ac.value` | Total AC (auto-computed or manual) |
| Check Penalty | `system.attributes.ac.checkPenalty` | Armor check penalty |
| Speed Penalty | `system.attributes.ac.speedPenalty` | Armor speed penalty |

## Initiative

| Value | Path | Notes |
|-------|------|-------|
| Initiative Bonus | `system.attributes.init.value` | Formatted as string like `"+2"` |
| Initiative Die | `system.attributes.init.die` | Usually `"1d20"` |

## Ability Scores

DCC uses six abilities: `str`, `agl`, `sta`, `per`, `int`, `lck`.

| Value | Path Pattern | Example |
|-------|-------------|---------|
| Score | `system.abilities.<ability>.value` | `system.abilities.str.value` |
| Maximum | `system.abilities.<ability>.max` | `system.abilities.str.max` |
| Modifier | `system.abilities.<ability>.mod` | `system.abilities.str.mod` |

Replace `<ability>` with: `str` (Strength), `agl` (Agility), `sta` (Stamina), `per` (Personality), `int` (Intelligence), `lck` (Luck).

## Saving Throws

DCC uses three saves: `frt` (Fortitude), `ref` (Reflex), `wil` (Will).

| Value | Path Pattern | Example |
|-------|-------------|---------|
| Save Total | `system.saves.<save>.value` | `system.saves.frt.value` |

## Attack Bonuses

| Value | Path | Notes |
|-------|------|-------|
| Base Attack Bonus | `system.details.attackBonus` | May contain dice like `"1d3"` for warriors |
| Melee To-Hit | `system.details.attackHitBonus.melee.value` | Computed total |
| Missile To-Hit | `system.details.attackHitBonus.missile.value` | Computed total |
| Melee Damage Bonus | `system.details.attackDamageBonus.melee.value` | Computed total |
| Missile Damage Bonus | `system.details.attackDamageBonus.missile.value` | Computed total |

## Combat Dice

| Value | Path | Notes |
|-------|------|-------|
| Action Die | `system.attributes.actionDice.value` | e.g. `"1d20"` |
| Hit Die | `system.attributes.hitDice.value` | e.g. `"1d8"` |
| Critical Die | `system.attributes.critical.die` | e.g. `"1d10"` |
| Critical Table | `system.attributes.critical.table` | e.g. `"III"` or `"M"` |
| Fumble Die | `system.attributes.fumble.die` | e.g. `"1d4"` |

## Character Details

| Value | Path |
|-------|------|
| Level | `system.details.level.value` |
| Class Name | `system.class.className` (Players only) |
| Occupation | `system.details.occupation.value` |
| Title | `system.details.title.value` |
| Experience Points | `system.details.xp.value` |
| Alignment | `system.details.alignment` |
| Languages | `system.details.languages` |

## Currency

| Value | Path |
|-------|------|
| Platinum | `system.currency.pp` |
| Electrum | `system.currency.ep` |
| Gold | `system.currency.gp` |
| Silver | `system.currency.sp` |
| Copper | `system.currency.cp` |

## Tips for Module Authors

- **Speed is a string.** Unlike many systems, `system.attributes.speed.value` returns a string (e.g. `"30"`) not a number. Parse it if you need numeric comparisons.
- **Same paths for all actor types.** Player, NPC, and Party actors all share the same base attribute paths. You can use the same path for all "Movement Property Path" fields.
- **Some values are computed.** Values like `system.attributes.ac.value`, `system.abilities.str.mod`, and `system.saves.frt.value` are automatically recalculated when their inputs change. They will always reflect the current state including Active Effects.
- **Modules can extend the schema.** The DCC system fires a `dcc.defineBaseActorSchema` hook that lets modules add custom fields to the actor data model.