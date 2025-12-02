# DCC System Architecture

This document describes the architecture of the Dungeon Crawl Classics RPG system for FoundryVTT.

## Overview

This is a **Dungeon Crawl Classics RPG system** for FoundryVTT, implementing the Goodman Games tabletop RPG. The system supports FoundryVTT v13 and uses ES modules.

## Core System Structure

| File | Class | Description |
|------|-------|-------------|
| `module/dcc.js` | - | Main entry point, system initialization, Foundry hooks |
| `module/actor.js` | `DCCActor` | Extends base Actor with DCC-specific logic |
| `module/item.js` | `DCCItem` | Handles weapons, armor, spells, skills, equipment |
| `module/dcc-roll.js` | `DCCRoll` | Custom dice rolling with DCC-specific modifiers |
| `module/config.js` | - | DCC system constants and lookup tables |

## Key DCC Features

### Dice Chain
DCC uses non-standard dice progression: d3, d5, d7, d14, d16, d24, d30.
- Implementation: `module/dice-chain.js`
- Used for: Action dice adjustments, two-weapon fighting penalties, spell checks

### Fleeting Luck
DCC-specific luck mechanics allowing temporary luck expenditure.
- Implementation: `module/fleeting-luck.js`
- Related docs: [User Guide - Fleeting Luck](../user-guide/Fleeting-Luck.md)

### Spell System
Complex spell result tables with mercurial magic effects.
- Implementation: `module/spell-result.js`
- Related docs: [User Guide - Creating Spells](../user-guide/Creating-a-Spell.md)

### Character Classes
Supports all DCC character classes:
- Zero-Level characters
- Cleric, Thief, Warrior, Wizard
- Demi-humans: Dwarf, Elf, Halfling

### Ability Scores
DCC uses 6 abilities (different from D&D standard):
- **STR** - Strength
- **AGL** - Agility
- **STA** - Stamina
- **PER** - Personality
- **INT** - Intelligence
- **LCK** - Luck

## Data Model

### template.json

The `template.json` file defines the data structure for all Actors and Items.

#### Actor Types
- **Player**: Full character sheet with all class templates (cleric, thief, warrior, wizard, dwarf, elf, halfling)
- **NPC**: Simplified structure for monsters and NPCs

#### Item Types
| Type | Description |
|------|-------------|
| `weapon` | Melee and missile weapons |
| `ammunition` | Arrows, bolts, bullets |
| `armor` | Protective equipment |
| `equipment` | General adventuring gear |
| `level` | Character level/class progression |
| `mount` | Horses, mules, etc. |
| `spell` | Wizard and cleric spells |
| `treasure` | Coins, gems, valuables |
| `skill` | Thief skills and other abilities |

## Parser System

The system includes parsers for importing character data:

| File | Purpose |
|------|---------|
| `module/parser.js` | Base parser functionality |
| `module/npc-parser.js` | Parses NPC stat blocks from text |
| `module/pc-parser.js` | Parses PC data (Purple Sorcerer format, plain text) |

Related docs: [Testing - Parser Tests](TESTING.md#parser-tests)

## Sheet System

### Actor Sheets
- `module/actor-sheet.js` - Base actor sheet using ApplicationV2
- Supports tabbed interface with character, equipment, and notes sections

### Item Sheets
- `module/item-sheet.js` - Item editing interface
- Type-specific templates for each item type

For V13 ApplicationV2 migration details, see [V13 ApplicationV2](V13_APP_V2.md).

## Active Effects

The system supports Active Effects for modifying character attributes:
- Conditions (stunned, blessed, cursed)
- Magic item bonuses
- Spell effects
- Class abilities

See [Active Effects](../user-guide/Active-Effects.md) for attribute keys and usage.

## Related Documentation

- [Development Guide](DEVELOPMENT.md) - Commands and workflow
- [Testing Guide](TESTING.md) - Test suite and coverage
- [Pack Management](PACKS.md) - Compendium pack workflow
- [Internationalization](I18N.md) - Translation system
