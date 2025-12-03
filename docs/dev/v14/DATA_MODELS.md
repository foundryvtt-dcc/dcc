# Data Models Migration

This document covers migrating from `template.json` to `TypeDataModel` for V14.

## Overview

The legacy `template.json` specification is deprecated in V14. Systems must migrate to `TypeDataModel` for schema definition.

**Timeline**: Migration should be completed during V14's lifecycle. Full removal expected in a future version.

## Why TypeDataModel?

Benefits of TypeDataModel over template.json:
- **Type Safety**: Proper field validation and type coercion
- **Migrations**: Built-in data migration support
- **Performance**: Better initialization and update performance
- **Flexibility**: Dynamic schema based on document state
- **Modern API**: Consistent with Foundry's DataModel architecture

## Basic Migration

### Before: template.json

```json
{
  "Actor": {
    "types": ["character", "npc"],
    "character": {
      "attributes": {
        "strength": {
          "value": 10,
          "mod": 0
        },
        "agility": {
          "value": 10,
          "mod": 0
        }
      },
      "health": {
        "value": 10,
        "max": 10
      }
    }
  }
}
```

### After: TypeDataModel

```javascript
// module/data/actor-character.js
const { SchemaField, NumberField } = foundry.data.fields

class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attributes: new SchemaField({
        strength: new SchemaField({
          value: new NumberField({ initial: 10, integer: true }),
          mod: new NumberField({ initial: 0, integer: true })
        }),
        agility: new SchemaField({
          value: new NumberField({ initial: 10, integer: true }),
          mod: new NumberField({ initial: 0, integer: true })
        })
      }),
      health: new SchemaField({
        value: new NumberField({ initial: 10, integer: true, min: 0 }),
        max: new NumberField({ initial: 10, integer: true, min: 1 })
      })
    }
  }
}

export { CharacterData }
```

### Registering the Data Model

```javascript
// module/dcc.js
import { CharacterData } from './data/actor-character.js'
import { NPCData } from './data/actor-npc.js'

Hooks.once('init', () => {
  // Register Actor data models
  CONFIG.Actor.dataModels.character = CharacterData
  CONFIG.Actor.dataModels.npc = NPCData

  // Register Item data models
  CONFIG.Item.dataModels.weapon = WeaponData
  CONFIG.Item.dataModels.spell = SpellData
  // ... etc
})
```

### Declaring Document Types in system.json

**Critical**: When removing `template.json`, you must declare valid document types in `system.json` using the `documentTypes` field. Without this, Foundry will reject documents with errors like `"weapon" is not a valid type for the Item Document class`.

The `documentTypes` field tells Foundry what types are valid **before** the init hook runs where data models are registered.

```json
{
  "id": "dcc",
  "title": "Dungeon Crawl Classics",
  "documentTypes": {
    "Actor": {
      "Player": {},
      "NPC": {},
      "Party": {}
    },
    "Item": {
      "weapon": {},
      "ammunition": {},
      "armor": {},
      "equipment": {},
      "level": {},
      "mount": {},
      "spell": {},
      "treasure": {},
      "skill": {}
    }
  },
  "description": "..."
}
```

Each type can optionally specify additional configuration:

```json
{
  "documentTypes": {
    "Actor": {
      "Player": {
        "htmlFields": ["biography"]
      }
    }
  }
}
```

The type names in `documentTypes` must match the keys used in `CONFIG.Actor.dataModels` and `CONFIG.Item.dataModels`.

## Common Field Types

```javascript
const {
  SchemaField,      // Nested object structure
  NumberField,      // Numeric values
  StringField,      // Text values
  BooleanField,     // True/false
  ArrayField,       // Arrays of values
  SetField,         // Unique value sets
  ObjectField,      // Arbitrary objects
  HTMLField,        // Rich text content
  FilePathField,    // File paths (images, etc.)
  DocumentUUIDField // References to other documents
} = foundry.data.fields
```

## Field Options

```javascript
new NumberField({
  initial: 0,           // Default value
  integer: true,        // Must be integer
  min: 0,               // Minimum value
  max: 100,             // Maximum value
  nullable: false,      // Can be null?
  required: true,       // Must be provided?
  label: 'DCC.Health',  // Localization key
  hint: 'DCC.HealthHint' // Tooltip hint
})

new StringField({
  initial: '',
  blank: true,          // Allow empty string?
  trim: true,           // Trim whitespace?
  choices: ['a', 'b'],  // Allowed values
  textSearch: true      // Include in text search?
})
```

## Data Migrations

TypeDataModel supports built-in migrations for handling legacy data:

```javascript
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Current schema
      attributes: new SchemaField({ /* ... */ })
    }
  }

  /**
   * Migrate legacy data to current schema
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData(source) {
    // Example: Rename old field to new field
    if ('oldFieldName' in source) {
      source.newFieldName = source.oldFieldName
      delete source.oldFieldName
    }

    // Example: Convert flat structure to nested
    if ('str' in source && !source.attributes) {
      source.attributes = {
        strength: { value: source.str, mod: 0 }
      }
      delete source.str
    }

    return super.migrateData(source)
  }
}
```

## Derived Data

Calculate derived values in `prepareDerivedData`:

```javascript
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() { /* ... */ }

  /**
   * Prepare derived data after base data is ready
   */
  prepareDerivedData() {
    // Calculate ability modifiers
    for (const [key, ability] of Object.entries(this.attributes)) {
      ability.mod = Math.floor((ability.value - 10) / 2)
    }

    // Calculate derived stats
    this.health.max = 10 + this.attributes.stamina.mod
  }
}
```

## Embedded Documents

For Items embedded in Actors, use `onEmbed` hook (new in V14):

```javascript
class WeaponData extends foundry.abstract.TypeDataModel {
  /**
   * Called when this document's HTML is embedded in the DOM
   * @param {HTMLElement} html - The embedded HTML element
   */
  onEmbed(html) {
    // Custom behavior when weapon is displayed
  }
}
```

## DCC System Considerations

When migrating the DCC system to TypeDataModel, consider:

### Actor Types
- `Player` - Full character with class templates
- `NPC` - Simplified monster/NPC structure
- `Party` - Party sheet for tracking multiple characters

### Item Types
- `weapon`, `ammunition`, `armor`, `equipment`
- `spell`, `skill`, `level`, `mount`, `treasure`

### DCC-Specific Fields
- Dice chain values (d3, d5, d7, d14, d16, d24, d30)
- Luck modifiers and fleeting luck
- Spell check results
- Occupation data for zero-level characters

## Incremental Migration Strategy

1. **Phase 1**: Create TypeDataModel classes alongside template.json
2. **Phase 2**: Register data models, verify functionality
3. **Phase 3**: Add migrations for any data structure changes
4. **Phase 4**: Remove template.json entries (keep file for backwards compat)
5. **Phase 5**: Full removal after testing

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - V14 breaking changes
- [Active Effects](ACTIVE_EFFECTS.md) - Effect system changes
- [Checklist](CHECKLIST.md) - Migration checklist
- [Official System Data Models Guide](https://foundryvtt.com/article/system-data-models/)
- [TypeDataModel API](https://foundryvtt.com/api/classes/foundry.abstract.TypeDataModel.html)
