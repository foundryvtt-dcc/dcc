# Schema Slimming — §2.1 Resolution (architecturally-bounded)

> **Status: RESOLVED 2026-06-08.** The §2.1 "monolithic Player schema" pain
> point is closed as *architecturally-bounded*. This is the decision record:
> what was hoped for, why the headline goal is blocked by Foundry, what the
> achievable resolution is, and what would reopen it.
>
> Cross-references:
> - Pain point: [`ARCHITECTURE_REIMAGINED.md`](ARCHITECTURE_REIMAGINED.md) §2.1, §7 (Phase 4)
> - Component map: [`CLASS_DECOMPOSITION.md`](CLASS_DECOMPOSITION.md)
> - Read-side projection: `module/adapter/character-accessors.mjs` (`actorToCharacter`)
> - Guard test: `module/__tests__/schema-slimming-guard.test.js`

## 1. The question

§2.1: *every Player actor — Warrior, Wizard, or an XCC Archaeologist — carries
**every** DCC class's fields* (cleric disapproval + spells 1–5, thief's 13 skills
+ luck die, wizard patron/corruption/familiar, halfling `sneakAndHide`, dwarf
`shieldBash`, warrior `luckyWeapon`, elf `detectSecretDoors`). The Phase 7 §7
sketch imagined the slim end-state as *"future characters only get the mixins
their class needs"* and *"fields for classes you're not playing stop existing."*

Halfling was picked as the testbed: could a halfling actor carry only the halfling
field (`skills.sneakAndHide`) and not the other six classes' fields?

## 2. Why the headline goal is blocked: Foundry's static schema

**Foundry's `DataModel.defineSchema()` is static — one schema per document
*subtype*, not per *instance*.** Actor subtypes (`Player` / `NPC` / `Party`) are
declared in `system.json` `documentTypes` and bound to their `TypeDataModel`
classes on `CONFIG.Actor.dataModels` in the `init` hook (`module/dcc.js`, where
`CONFIG.Actor.dataModels = { Player: PlayerData, NPC: NPCData, Party: PartyData }`).
`PlayerData.defineSchema()` runs **once**, when the class is defined, with no
access to any actor instance.

Consequences:

- A halfling and a wizard are **both `type: 'Player'`**, so they share the **one**
  `PlayerData` schema. There is no per-instance schema variance in Foundry's API
  (confirmed against `docs/dev/V14.md` / `V13.md` — no conditional-field or
  per-subtype-split mechanism beyond the document-type boundary).
- `applyClassMixins(schema)` (`module/extension-api.mjs`) attaches **all seven**
  registered class mixins' fields to that single shared schema in deterministic
  classId order. Every Player therefore declares every class's fields.
- Foundry bakes each field's `.initial` default into **every** new actor's
  `_source` at create time, so even a bare `Actor.create({ type: 'Player' })`
  starts with the full union of class fields (see
  [`PROGRAMMATIC_ACTOR_CREATION.md`](PROGRAMMATIC_ACTOR_CREATION.md)).

So "a halfling's schema carries only `sneakAndHide`" is **not reachable by editing
the schema or the mixin registry**. The mixin relocation (Phase 4) moved *where
the fields are declared* (a per-class registry instead of one static body) and made
them *removable/restructurable by the owning registration* — but it did not, and
under Foundry's model **could not**, make a given actor stop carrying the other
classes' fields.

## 3. The lib is already the class-clean read-side source of truth

The §7 line *"Foundry's `system.*` shape becomes a projection of the lib's
`Character` type"* is, on the **read side, already true**:

- `actorToCharacter(actor)` (`module/adapter/character-accessors.mjs`) — the bridge
  every adapter roll path uses — reads **only cross-class fields**:
  `system.abilities`, `system.saves`, `system.details.level.value`, and
  `system.class.className` (solely to derive `classId`). It returns
  `{ identity, state: { abilities, saves }, classInfo: { level, classId? } }` and
  touches **zero** class-specific schema fields.
- The lib's `Character` type makes class-specific state **optional**
  (`ClassSpecificState` with every class sub-state optional). The lib never
  requires a Foundry actor to carry a foreign class's fields.

The guard test `module/__tests__/schema-slimming-guard.test.js` locks this in:
`actorToCharacter` produces a complete, valid `Character` from an actor carrying
**no** class-specific fields, and produces **structurally identical** output whether
or not a pile of foreign-class fields is present. The roll path needs zero schema
class fields.

**The schema's class fields are therefore a Foundry-forced *compatibility
projection*, not a source of truth.** They exist to satisfy Foundry's static-schema
model and the ecosystem (§4), not because the rules engine reads them.

## 4. Why pruning / subtyping are rejected

Two mechanisms *could* make an actor stop carrying foreign-class fields; both break
constraints the refactor holds inviolable (see the `02-slice-backlog.md` stop
conditions and `ARCHITECTURE_REIMAGINED.md` §2.12).

### Runtime / derived pruning (delete foreign-class sub-objects per class)
- **System breakage:** ~15 **unguarded** reads in `module/actor.js` access
  class-specific fields without optional chaining or a class branch — e.g. thief
  `system.class.luckDie` (`actor.js:1765`), cleric `system.class.disapproval`
  (`actor.js:3859`) and `disapprovalTable` (`actor.js:3924`/`3938`), and the
  spell-check ability reads (`actor.js:2201`/`2251`+). Pruning makes these throw on
  a wrong-class actor instead of returning a harmless default.
- **Sibling breakage:** XCC has **8+ unguarded reads** (e.g.
  `xcc-actor-sheet.js:608-623` reads wizard/elf `knownSpells` / `maxSpellLevel`
  and indexes abilities by `spellCheckAbility`) that would crash its sheets for
  non-caster actors. "No sibling module needs a code change" is a hard stop
  condition.
- **Migration fragility:** `player-data.mjs` `migrateFieldsToInteger(source.class…)`
  / `migrateWorld` (`migrations.js:341/346`) assume the sub-objects exist.

### Per-class Actor document subtypes (a slim `halfling` `DataModel`)
This is the only way to get a *truly* slim schema — but it changes `actor.type`
from `'Player'` to `'halfling'`, which:
- Breaks every `type === 'Player'` check across the system **and all four sibling
  modules** (`dcc-qol`, `xcc`, `mcc-classes`, `dcc-crawl-classes`), plus packs,
  macros, and Token Action HUD.
- Requires a destructive world migration re-typing every existing Player.
- Changes a Foundry-facing shape (`actor.type`) — another hard stop condition.

Both are rejected. The benefit (a slimmer in-memory `system` object) does not come
close to justifying an ecosystem-wide breaking change for a field set the rules
engine already ignores.

## 5. Resolution

§2.1 is **resolved to its achievable bound**:

1. **Extensibility half — DONE (Phase 4).** The original §2.1 complaint was that
   spinoffs *"can add via hooks but cannot remove or restructure."* The
   `registerClassMixin` registry fixes exactly that: a sibling can now
   last-write-wins **replace** a built-in class's field contribution, or register a
   homebrew class's fields, through the same registry the system dogfoods — no fork,
   no monkey-patch. (Validated live by `dcc-crawl-classes` PR #40 + `mcc-classes`
   PR #38.)
2. **Source-of-truth half — DONE (Phases 1–3).** The lib's `Character` is the
   class-clean read-side authority; the Foundry schema's class fields are a
   compatibility projection. The guard test pins this.
3. **Full per-instance field removal — REJECTED.** Blocked by Foundry's static
   schema; the only mechanism (per-class subtypes) is an ecosystem-breaking change
   that fails the stop conditions.

The worked halfling example: a halfling actor still *declares* `shieldBash`,
`knownSpells`, etc. (Foundry-forced), but nothing in the rules path reads them —
`actorToCharacter(halfling)` yields a class-clean `Character` with
`classInfo.classId === 'halfling'` and no foreign-class state. That is as "slim" as
Foundry permits without breaking the ecosystem.

## 6. What would reopen this

- **Foundry adds per-instance / conditional schema fields.** If a future Foundry
  release lets a `TypeDataModel` vary its schema by source data, runtime field
  removal becomes viable and §2.1 can be revisited.
- **A planned major release accepts a typed-subtype migration.** If the project
  ever decides the slim is worth a destructive `Player` → per-class-subtype
  migration (with coordinated sibling-module updates and a grace period), §4's
  subtype option is the path — but that is a deliberate major-version project, not
  a refactor slice.

Until then, do **not** prune class fields at runtime or split Player into per-class
subtypes. Read class data defensively (optional chaining / class branch) and treat
the lib's `Character` as authoritative for rules.
