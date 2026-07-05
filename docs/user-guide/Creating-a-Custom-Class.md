# Creating a Custom Class

The DCC system can level characters of your own homebrew classes, the same
way it levels the built‑in classes. This page explains how the level‑up
machinery actually works and how to author the **Level** items that drive it.

> If you only want the seven core classes, you don't need any of this —
> install the DCC Core Book module and it ships the level data for you. See
> [Level Up](Level-Up.md). This page is for **module authors and GMs building
> their own classes.**

## How leveling works

When you click the **Level** label on a character sheet, the system does *not*
read stats from any item on the actor. Instead it:

1. Reads the character's **Class Name** (`system.class.className`).
2. Looks for a `level`‑type item **named** `<class-name>-<level>` (see the
   naming rules below) — first in every registered *level‑data compendium
   pack*, then, if none is found, among the `level` items sitting loose in
   your world.
3. Parses that item's **Level Data** text field into a list of
   `path = value` changes.
4. Applies those changes to the character and rolls new hit points.

So a custom class is really just **a set of `level`‑type items, one per level,
named by convention** — either bundled in a compendium a module registers, or
simply created in your world's Items sidebar.

There are two mistakes that stop this from working, and they're the ones AI
assistants almost always make:

- **Putting stats in the wrong place.** A `level` item has *no*
  `system.details.attackBonus` field, no `system.saves.*` field, and so on.
  Setting those directly on the item does nothing — Foundry silently discards
  them. Every stat change must go inside the single **Level Data** text field
  as `path = value` lines.
- **Getting the item name wrong.** The lookup lowercases the class name and
  replaces spaces with hyphens. `Blood-Witch-1` or `Blood Witch 1` will **not**
  be found — the item must be named `blood-witch-1`.

## Step 1 — Create the Level items

In an item folder or compendium, create a new item and choose the **Level**
type. Create one per level you want to support.

Set the item's **name** to:

```
<class-name-lowercased-with-spaces-as-hyphens>-<level>
```

| Character's Class Name | Level | Item name       |
|------------------------|-------|-----------------|
| `Bard`                 | 1     | `bard-1`        |
| `Bard`                 | 2     | `bard-2`        |
| `Blood Witch`          | 1     | `blood-witch-1` |
| `Blood Witch`          | 3     | `blood-witch-3` |

The character's **Class Name** field on the sheet must match (case doesn't
matter — it's lowercased before the lookup). It also must not be left as the
default `Generic` / `Zero-Level`, or the level dialog will refuse to run.

## Step 2 — Fill in the Level Data

Everything the level grants goes into the **Level Data** field as newline‑
separated `path = value` lines. Each `path` is an **actor** update path
(always starting with `system.`). For example, a level‑1 spellcaster:

```
system.attributes.hitDice.value=1d6
system.attributes.actionDice.value=1d20
system.attributes.critical.die=1d6
system.attributes.critical.table=I
system.details.attackBonus=+0
system.saves.ref.classBonus=+1
system.saves.frt.classBonus=+0
system.saves.wil.classBonus=+1
```

Notes on values:

- Values that look like plain numbers are stored as numbers; dice (`1d6`) and
  letters (`I`, `III`, `M`) are kept as text. You don't need quotes.
- `system.attributes.actionDice.value` accepts a comma‑separated list for
  characters who get extra action dice (e.g. `1d20,1d14`); the first entry
  becomes the active action die and the full list is offered in the dropdown.

### Valid paths

These are the paths the built‑in classes set at each level. All are relative
to the actor.

| What it sets            | Path                                        |
|-------------------------|---------------------------------------------|
| Hit die                 | `system.attributes.hitDice.value`           |
| Action die(s)           | `system.attributes.actionDice.value`        |
| Critical die            | `system.attributes.critical.die`            |
| Critical table          | `system.attributes.critical.table`          |
| Base attack (deed) bonus| `system.details.attackBonus`                |
| Reflex class bonus      | `system.saves.ref.classBonus`               |
| Fortitude class bonus   | `system.saves.frt.classBonus`               |
| Will class bonus        | `system.saves.wil.classBonus`               |

The save keys are `frt`, `ref`, and `wil` (there is no `fort` or `will`). Use
`classBonus` — with the default "compute saving throws" setting on, it's added
to the relevant ability modifier to produce the save total. If you'd rather set
a save's total directly and bypass the calculation, set
`system.saves.<save>.value` instead.

For the full catalog of actor paths you can target, see
[Attribute Paths for Third‑Party Modules](Attribute-Paths-for-Modules.md).

> **Paths that do _not_ exist:** `system.details.casterLevel` and
> `system.details.spellbook` are commonly guessed but are not fields on the
> actor — writing them does nothing. Caster level is derived automatically from
> `system.details.level.value`.

### Alignment‑specific data (optional)

`level` items also have **Level Data (Lawful)**, **(Neutral)**, and
**(Chaotic)** fields. Whichever one matches the character's alignment is
appended to the shared Level Data before it's applied — handy for classes whose
progression differs by alignment. Leave them blank if you don't need them.

## Step 3 — Make the items findable

The level dialog resolves your `level` items in this order:

1. **Registered level‑data compendiums** (searched first).
2. **Loose `level` items in your world's Items sidebar** (the fallback).

You only need *one* of these. Pick based on how you're distributing the class.

### The simple way: world items (no registration)

If you're building a class just for your own game, **you don't need to register
anything.** Create the `level` items directly in your world's **Items** sidebar,
named by convention (`blood-witch-1`, `blood-witch-2`, …), and the dialog finds
them automatically — the same way a crit or fumble table you drop into the
sidebar just works. This is the recommended path for one‑off homebrew.

### The packaged way: a registered compendium

If you're shipping the class inside a **module**, put the `level` items in a
compendium pack and register that pack's id via the `dcc.registerLevelDataPack`
hook from an `init` hook:

```js
Hooks.once('init', () => {
  Hooks.callAll('dcc.registerLevelDataPack', 'my-module.blood-witch-levels')
})
```

Replace `my-module.blood-witch-levels` with your pack's full id
(`<module-name>.<pack-name>` as declared in your module manifest). Registered
packs are searched **before** world items, so an official pack always wins over a
stray same‑named world item.

If you also want the class's progression picked up by the class‑progression
loader (for features that read it outside the level dialog), register the class
in the same hook:

```js
Hooks.once('init', () => {
  Hooks.callAll('dcc.registerLevelDataPack', 'my-module.blood-witch-levels')
  game.dcc.registerHomebrewClassForProgressionLoad('blood-witch', 'blood-witch')
})
```

## Step 4 — Level a character

Set the character's **Class Name** to your class, then click the **Level**
label on the sheet and step the level up. The dialog previews the changes it
found for the target level; accept it to apply them, log the change to chat, and
roll hit points.

**Dragging a `level` item onto the sheet does nothing** — leveling only happens
through this dialog.

## Troubleshooting

If the level dialog says the level data wasn't found, or nothing changes:

- **Item name.** Must be lowercase, spaces as hyphens, `-<level>` suffix —
  `blood-witch-1`, not `Blood-Witch-1`.
- **Class Name.** The sheet's Class Name must match the item‑name prefix and
  must not still be `Generic` / `Zero-Level`.
- **Where the items live.** World items must be `level`‑type items in the
  **Items** sidebar (items inside a compendium are only searched if that
  compendium was registered). If you went the packaged route, confirm your
  `dcc.registerLevelDataPack` hook ran — in the browser console,
  `CONFIG.DCC.levelDataPacks.packs` should list your pack.
- **Stats in Level Data, not on the item.** Double‑check every change is a
  `path = value` line inside the Level Data field, not a field you tried to set
  on the item itself.
- **Right paths.** Compare against the table above; drop `casterLevel` and
  `spellbook`.
