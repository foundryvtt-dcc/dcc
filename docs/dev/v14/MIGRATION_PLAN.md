# TypeDataModel Migration Plan

This document provides a detailed plan for migrating the DCC system from `template.json` to `TypeDataModel`.

## Key Insight: Incremental Migration is Supported

**template.json and TypeDataModel can coexist!** This enables incremental migration:

- When you register a TypeDataModel via `CONFIG.Actor.dataModels.Player = PlayerData`, it **overrides** the template.json schema for that specific type
- Types without a registered DataModel continue to use template.json
- You can migrate one type at a time, testing thoroughly before moving to the next

```javascript
// Example: Partial migration - only equipment uses DataModel
Hooks.once('init', () => {
  // Only equipment is migrated - all others use template.json
  CONFIG.Item.dataModels.equipment = EquipmentData
})
```

**Important**: template.json is still required to register type names until you migrate to the `documentTypes` property in system.json (the final step).

## Current State Analysis

### Actor Types (3)

| Type | Templates Used | Complexity |
|------|----------------|------------|
| `Player` | common, config, player, cleric, thief, halfling, warrior, wizard, dwarf, elf | High |
| `NPC` | common, config | Medium |
| `Party` | common | Low |

### Item Types (9)

| Type | Templates Used | Complexity |
|------|----------------|------------|
| `weapon` | itemDescription, physicalItem, currency | High |
| `ammunition` | itemDescription, physicalItem, currency | Low |
| `armor` | itemDescription, physicalItem, currency | Medium |
| `equipment` | itemDescription, physicalItem, currency | Low |
| `level` | (none) | Low |
| `mount` | itemDescription, physicalItem, currency | Low |
| `spell` | itemDescription | High |
| `treasure` | itemDescription, currency | Low |
| `skill` | itemDescription | Medium |

## Proposed File Structure

```
module/
├── data/
│   ├── _module.mjs              # Export all data models
│   ├── fields/
│   │   ├── ability-field.mjs    # Reusable ability score field
│   │   ├── currency-field.mjs   # Reusable currency field
│   │   └── dice-field.mjs       # DCC dice chain field
│   ├── actor/
│   │   ├── base-actor.mjs       # Common actor fields
│   │   ├── player-data.mjs      # Player character data
│   │   ├── npc-data.mjs         # NPC data
│   │   └── party-data.mjs       # Party data
│   └── item/
│       ├── base-item.mjs        # Common item fields (description, physical)
│       ├── weapon-data.mjs      # Weapon data
│       ├── ammunition-data.mjs  # Ammunition data
│       ├── armor-data.mjs       # Armor data
│       ├── equipment-data.mjs   # Equipment data
│       ├── level-data.mjs       # Level/class data
│       ├── mount-data.mjs       # Mount data
│       ├── spell-data.mjs       # Spell data
│       ├── treasure-data.mjs    # Treasure data
│       └── skill-data.mjs       # Skill data
```

## Phase 1: Create Reusable Field Types

### 1.1 Ability Score Field

```javascript
// module/data/fields/ability-field.mjs
const { SchemaField, NumberField, StringField } = foundry.data.fields

/**
 * A reusable schema for DCC ability scores
 */
export class AbilityField extends SchemaField {
  constructor(options = {}) {
    super({
      label: new StringField({ initial: options.label || '' }),
      value: new NumberField({ initial: 10, integer: true, min: 1 }),
      max: new NumberField({ initial: 10, integer: true, min: 1 })
    })
  }
}
```

### 1.2 Currency Field

```javascript
// module/data/fields/currency-field.mjs
const { SchemaField, NumberField } = foundry.data.fields

export class CurrencyField extends SchemaField {
  constructor(fields = {}) {
    super({
      pp: new NumberField({ initial: 0, integer: true, min: 0 }),
      ep: new NumberField({ initial: 0, integer: true, min: 0 }),
      gp: new NumberField({ initial: 0, integer: true, min: 0 }),
      sp: new NumberField({ initial: 0, integer: true, min: 0 }),
      cp: new NumberField({ initial: 0, integer: true, min: 0 }),
      ...fields
    })
  }
}
```

### 1.3 Dice Field (DCC-specific)

```javascript
// module/data/fields/dice-field.mjs
const { StringField } = foundry.data.fields

/**
 * A field for DCC dice chain values
 * Valid values: d3, d4, d5, d6, d7, d8, d10, d12, d14, d16, d20, d24, d30
 */
export class DiceField extends StringField {
  constructor(options = {}) {
    super({
      initial: options.initial || '1d20',
      blank: false,
      ...options
    })
  }

  _validateType(value) {
    // Allow standard dice notation
    if (!/^\d*d\d+([+-]\d+)?$/.test(value)) {
      return 'Invalid dice notation'
    }
  }
}
```

## Phase 2: Item Data Models

### Priority Order
1. **equipment** - Simplest, good starting point
2. **ammunition** - Simple, similar to equipment
3. **mount** - Simple physical item
4. **treasure** - Simple with currency
5. **armor** - Medium complexity
6. **skill** - Medium complexity
7. **level** - Unique structure
8. **weapon** - High complexity, many fields
9. **spell** - Highest complexity

### 2.1 Base Item Data

```javascript
// module/data/item/base-item.mjs
const { SchemaField, StringField, HTMLField, NumberField, BooleanField } = foundry.data.fields
import { CurrencyField } from '../fields/currency-field.mjs'

export class BaseItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new SchemaField({
        value: new HTMLField({ initial: '' }),
        chat: new HTMLField({ initial: '' }),
        unidentified: new HTMLField({ initial: '' }),
        summary: new StringField({ initial: '' }),
        judge: new SchemaField({
          value: new HTMLField({ initial: '' })
        })
      }),
      source: new StringField({ initial: '' })
    }
  }
}

export class PhysicalItemData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: new NumberField({ initial: 1, integer: true, min: 0 }),
      weight: new NumberField({ initial: 0, min: 0 }),
      equipped: new BooleanField({ initial: true }),
      identified: new BooleanField({ initial: true }),
      value: new CurrencyField()
    }
  }
}
```

### 2.2 Equipment Data (Example Complete Implementation)

```javascript
// module/data/item/equipment-data.mjs
import { PhysicalItemData } from './base-item.mjs'

export class EquipmentData extends PhysicalItemData {
  static defineSchema() {
    return {
      ...super.defineSchema()
      // Equipment has no additional fields beyond physical item
    }
  }
}
```

### 2.3 Weapon Data (Complex Example)

```javascript
// module/data/item/weapon-data.mjs
import { PhysicalItemData } from './base-item.mjs'
import { DiceField } from '../fields/dice-field.mjs'

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields

export class WeaponData extends PhysicalItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      // Configuration overrides
      config: new SchemaField({
        actionDieOverride: new StringField({ initial: '' }),
        critDieOverride: new StringField({ initial: '' }),
        critRangeOverride: new StringField({ initial: '' }),
        critTableOverride: new StringField({ initial: '' }),
        damageOverride: new StringField({ initial: '' }),
        attackBonusOverride: new StringField({ initial: '' }),
        initiativeBonusOverride: new StringField({ initial: '' }),
        initiativeDieOverride: new StringField({ initial: '' })
      }),

      // Combat stats
      actionDie: new DiceField({ initial: '1d20' }),
      attackBonus: new StringField({ initial: '' }),
      attackBonusWeapon: new StringField({ initial: '' }),
      attackBonusLucky: new StringField({ initial: '' }),
      backstabDamage: new StringField({ initial: '' }),
      critDie: new StringField({ initial: '' }),
      critRange: new NumberField({ initial: 20, integer: true, min: 1, max: 20 }),
      critTable: new StringField({ initial: '' }),
      damage: new StringField({ initial: '' }),
      damageWeapon: new StringField({ initial: '' }),
      damageBonus: new StringField({ initial: '' }),
      damageWeaponBonus: new StringField({ initial: '' }),

      // Weapon properties
      doubleIfMounted: new BooleanField({ initial: false }),
      initiativeBonus: new StringField({ initial: '' }),
      initiativeDie: new DiceField({ initial: '1d20' }),
      initiativeWeaponBonus: new StringField({ initial: '' }),
      melee: new BooleanField({ initial: false }),
      range: new StringField({ initial: '' }),
      shortRangeStrength: new BooleanField({ initial: false }),
      subdual: new BooleanField({ initial: false }),
      toHit: new StringField({ initial: '+0' }),
      trained: new BooleanField({ initial: true }),
      twoHanded: new BooleanField({ initial: false }),
      twoWeaponPrimary: new BooleanField({ initial: false }),
      twoWeaponSecondary: new BooleanField({ initial: false })
    }
  }
}
```

## Phase 3: Actor Data Models

### Priority Order
1. **Party** - Simplest
2. **NPC** - Medium complexity
3. **Player** - Highest complexity (all class templates)

### 3.1 Base Actor Data

```javascript
// module/data/actor/base-actor.mjs
const { SchemaField, StringField, NumberField, BooleanField, ArrayField, ObjectField } = foundry.data.fields
import { AbilityField } from '../fields/ability-field.mjs'
import { CurrencyField } from '../fields/currency-field.mjs'
import { DiceField } from '../fields/dice-field.mjs'

export class BaseActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      abilities: new SchemaField({
        str: new AbilityField({ label: 'DCC.AbilityStr' }),
        agl: new AbilityField({ label: 'DCC.AbilityAgl' }),
        sta: new AbilityField({ label: 'DCC.AbilitySta' }),
        per: new AbilityField({ label: 'DCC.AbilityPer' }),
        int: new AbilityField({ label: 'DCC.AbilityInt' }),
        lck: new AbilityField({ label: 'DCC.AbilityLck' })
      }),

      attributes: new SchemaField({
        ac: new SchemaField({
          value: new NumberField({ initial: 10, integer: true }),
          checkPenalty: new NumberField({ initial: 0, integer: true }),
          otherMod: new NumberField({ initial: 0, integer: true }),
          speedPenalty: new NumberField({ initial: 0, integer: true })
        }),
        actionDice: new SchemaField({
          value: new DiceField({ initial: '1d20' }),
          options: new ArrayField(new SchemaField({
            value: new StringField(),
            label: new StringField()
          }))
        }),
        critical: new SchemaField({
          die: new DiceField({ initial: '1d4' }),
          table: new StringField({ initial: 'I' })
        }),
        fumble: new SchemaField({
          die: new DiceField({ initial: '1d4' })
        }),
        hitDice: new SchemaField({
          value: new DiceField({ initial: '1d4' })
        }),
        hp: new SchemaField({
          value: new NumberField({ initial: 10, integer: true }),
          min: new NumberField({ initial: 0, integer: true }),
          max: new NumberField({ initial: 10, integer: true }),
          temp: new NumberField({ initial: 0, integer: true }),
          tempmax: new NumberField({ initial: 0, integer: true })
        }),
        init: new SchemaField({
          die: new DiceField({ initial: '1d20' }),
          otherMod: new NumberField({ initial: 0, integer: true }),
          value: new StringField({ initial: '+0' })
        }),
        speed: new SchemaField({
          value: new NumberField({ initial: 30, integer: true, min: 0 }),
          base: new NumberField({ initial: 30, integer: true, min: 0 }),
          special: new StringField({ initial: '' }),
          swim: new NumberField({ initial: 0, integer: true, min: 0 }),
          fly: new NumberField({ initial: 0, integer: true, min: 0 })
        })
      }),

      details: new SchemaField({
        alignment: new StringField({ initial: 'l' }),
        attackBonus: new StringField({ initial: '+0' }),
        // ... additional detail fields
      }),

      saves: new SchemaField({
        frt: new SaveField({ label: 'DCC.SavesFortitude', abbr: 'DCC.SavesFortitudeAbbr' }),
        ref: new SaveField({ label: 'DCC.SavesReflex', abbr: 'DCC.SavesReflexAbbr' }),
        wil: new SaveField({ label: 'DCC.SavesWill', abbr: 'DCC.SavesWillAbbr' })
      }),

      currency: new CurrencyField()
    }
  }
}
```

### 3.2 Player Data (Complex - All Class Templates)

The Player actor includes all class templates merged together. Strategy options:

**Option A: Flat Structure (Recommended)**
Keep all class fields in a single flat structure, with `config` flags determining visibility.

```javascript
// module/data/actor/player-data.mjs
import { BaseActorData } from './base-actor.mjs'

export class PlayerData extends BaseActorData {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      class: new SchemaField({
        className: new StringField({ initial: 'Zero-Level' }),

        // Cleric fields
        spellCheck: new NumberField({ initial: 1, integer: true }),
        spellCheckAbility: new StringField({ initial: 'per' }),
        spellsLevel1: new NumberField({ initial: 0, integer: true }),
        // ... levels 2-5
        deity: new StringField({ nullable: true }),
        disapproval: new StringField({ initial: '1' }),
        disapprovalTable: new StringField({ initial: 'Disapproval' }),

        // Thief fields
        luckDie: new DiceField({ initial: '1d3' }),
        backstab: new StringField({ initial: '0' }),

        // Warrior fields
        luckyWeapon: new StringField({ nullable: true }),
        luckyWeaponMod: new StringField({ initial: '+0' }),

        // Wizard fields
        knownSpells: new NumberField({ initial: 0, integer: true }),
        maxSpellLevel: new NumberField({ initial: 0, integer: true }),
        patron: new StringField({ nullable: true }),
        patronTaintChance: new StringField({ initial: '1%' }),
        familiar: new StringField({ nullable: true }),
        corruption: new HTMLField({ initial: '' })
      }),

      skills: new SchemaField({
        // All class skills in one place
        detectSecretDoors: new SkillField({ label: 'DCC.DetectSecretDoors' }),
        sneakSilently: new ThiefSkillField({ label: 'DCC.SneakSilently', ability: 'agl' }),
        hideInShadows: new ThiefSkillField({ label: 'DCC.HideInShadows', ability: 'agl' }),
        // ... all other skills
      }),

      config: new SchemaField({
        // Configuration flags
        attackBonusMode: new StringField({ initial: 'flat' }),
        showSpells: new BooleanField({ initial: false }),
        showSkills: new BooleanField({ initial: false }),
        showBackstab: new BooleanField({ initial: false }),
        // ... other config options
      })
    }
  }
}
```

**Option B: Nested Class Structure**
Group fields by class for cleaner organization.

```javascript
class: new SchemaField({
  className: new StringField({ initial: 'Zero-Level' }),
  cleric: new SchemaField({ /* cleric fields */ }),
  thief: new SchemaField({ /* thief fields */ }),
  warrior: new SchemaField({ /* warrior fields */ }),
  wizard: new SchemaField({ /* wizard fields */ }),
  dwarf: new SchemaField({ /* dwarf fields */ }),
  elf: new SchemaField({ /* elf fields */ }),
  halfling: new SchemaField({ /* halfling fields */ })
})
```

**Recommendation**: Option A (flat) maintains backwards compatibility with existing data paths.

## Phase 4: Registration

```javascript
// module/dcc.js
import { PlayerData, NPCData, PartyData } from './data/actor/_module.mjs'
import {
  WeaponData, AmmunitionData, ArmorData, EquipmentData,
  LevelData, MountData, SpellData, TreasureData, SkillData
} from './data/item/_module.mjs'

Hooks.once('init', () => {
  // Register Actor data models
  CONFIG.Actor.dataModels = {
    Player: PlayerData,
    NPC: NPCData,
    Party: PartyData
  }

  // Register Item data models
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    ammunition: AmmunitionData,
    armor: ArmorData,
    equipment: EquipmentData,
    level: LevelData,
    mount: MountData,
    spell: SpellData,
    treasure: TreasureData,
    skill: SkillData
  }
})
```

## Phase 5: Migration Support

```javascript
// Example migration for any schema changes
export class PlayerData extends BaseActorData {
  static migrateData(source) {
    // Example: Migrate old flat skills to new structure
    if (source.sneakSilently && !source.skills?.sneakSilently) {
      source.skills = source.skills || {}
      source.skills.sneakSilently = {
        label: 'DCC.SneakSilently',
        ability: 'agl',
        value: source.sneakSilently
      }
      delete source.sneakSilently
    }

    return super.migrateData(source)
  }
}
```

## Phase 6: Remove template.json (Final Step)

Once all types have TypeDataModels, migrate type definitions to `system.json`:

### Before: template.json defines types

```json
// template.json
{
  "Actor": {
    "types": ["Player", "NPC", "Party"]
  },
  "Item": {
    "types": ["weapon", "ammunition", "armor", ...]
  }
}
```

### After: system.json defines types

```json
// system.json
{
  "documentTypes": {
    "Actor": {
      "Player": {
        "htmlFields": ["system.details.notes.value", "system.class.corruption"]
      },
      "NPC": {
        "htmlFields": ["system.details.notes.value"]
      },
      "Party": {}
    },
    "Item": {
      "weapon": {
        "htmlFields": ["system.description.value"]
      },
      "ammunition": {
        "htmlFields": ["system.description.value"]
      }
      // ... all item types
    }
  }
}
```

After adding `documentTypes` to system.json, you can delete template.json entirely.

## Implementation Timeline

### Sprint 1: Foundation (Can start now in V13)
- [ ] Create `module/data/` directory structure
- [ ] Implement reusable field types (AbilityField, CurrencyField, DiceField)
- [ ] Implement BaseItemData and PhysicalItemData
- [ ] Implement simple items: EquipmentData, AmmunitionData, MountData

### Sprint 2: Remaining Items
- [ ] Implement TreasureData
- [ ] Implement ArmorData
- [ ] Implement SkillData
- [ ] Implement LevelData
- [ ] Implement WeaponData
- [ ] Implement SpellData (most complex)

### Sprint 3: Actor Data Models
- [ ] Implement BaseActorData with common fields
- [ ] Implement PartyData
- [ ] Implement NPCData
- [ ] Implement PlayerData with all class fields

### Sprint 4: Integration & Testing
- [ ] Register all data models in CONFIG
- [ ] Test with new document creation
- [ ] Test with existing world data
- [ ] Implement any necessary migrations
- [ ] Performance testing

### Sprint 5: Final Migration
- [ ] Add `documentTypes` to system.json
- [ ] Delete template.json
- [ ] Update documentation
- [ ] Final testing before V14

## Testing Checklist

- [ ] Create new Actor of each type
- [ ] Create new Item of each type
- [ ] Load existing world with data
- [ ] Verify all fields have correct initial values
- [ ] Verify derived data calculations work
- [ ] Test Active Effects application
- [ ] Test drag/drop operations
- [ ] Test roll mechanics
- [ ] Verify no console errors

## Related Documentation

- [Data Models Overview](DATA_MODELS.md) - General TypeDataModel guide
- [Breaking Changes](BREAKING_CHANGES.md) - V14 breaking changes
- [Checklist](CHECKLIST.md) - Overall V14 checklist
- [Official System Data Models](https://foundryvtt.com/article/system-data-models/)
