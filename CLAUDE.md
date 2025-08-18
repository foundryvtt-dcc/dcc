# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm test` - Run unit tests using Vitest
- `npm run format` - Format code with StandardJS and StyleLint (includes --fix)
- `npm run scss` - Compile SASS styles from styles/dcc.scss to styles/dcc.css
- `npm run scss-watch` - Watch and auto-compile SASS styles during development
- `npm run todb` - Compile JSON source files to LevelDB packs (run module/compilePacks.js)
- `npm run tojson` - Extract LevelDB packs to JSON source files (run module/extractPacks.js)
- `npm run compare-lang` - Compare all language files with English reference to find missing translation keys

## FoundryVTT System Architecture

This is a **Dungeon Crawl Classics RPG system** for FoundryVTT, implementing the Goodman Games RPG system.

### Core System Structure

- **Entry Point**: `module/dcc.js` - Main system initialization and Foundry hooks
- **Actor System**: `module/actor.js` (DCCActor) - Extends base Actor with DCC-specific logic
- **Item System**: `module/item.js` (DCCItem) - Handles weapons, armor, spells, skills, etc.
- **Rolling System**: `module/dcc-roll.js` (DCCRoll) - Custom dice rolling with DCC-specific modifiers
- **Configuration**: `module/config.js` - DCC system constants and lookup tables

### Key DCC Features

- **Dice Chain**: DCC uses non-standard dice (d3, d5, d7, d14, d16, d24, d30) - handled by `dice-chain.js`
- **Fleeting Luck**: DCC-specific luck mechanics - implemented in `fleeting-luck.js`
- **Spell Results**: Complex spell result tables - handled by `spell-result.js`
- **Character Classes**: Supports Zero-Level, Cleric, Thief, Warrior, Wizard, Dwarf, Elf, Halfling
- **Ability Scores**: Uses DCC's 6 abilities (STR, AGL, STA, PER, INT, LCK) instead of D&D's standard set

### Data Templates

The `template.json` defines the data structure for Actors and Items:
- **Player Actor**: Has all class templates (cleric, thief, warrior, wizard, dwarf, elf, halfling)
- **NPC Actor**: Simplified structure for NPCs
- **Item Types**: weapon, ammunition, armor, equipment, level, mount, spell, treasure, skill

### Pack Management

- **Source Files**: `packs/*/src/*.json` - Human-readable JSON source files
- **Compiled Packs**: `packs/*.db` - LevelDB format for FoundryVTT
- Use `npm run tojson` to extract packs for editing, `npm run todb` to compile back

### Testing

- Tests located in `module/__tests__/`
- Uses Vitest framework with mocks in `module/__mocks__/`
- Test files: `actor.test.js`, `item.test.js`, `npc-parser.test.js`, `pc-parser.test.js`

### Parser System

- `parser.js` - Base parser functionality
- `npc-parser.js` - Parses NPC stat blocks
- `pc-parser.js` - Parses player character data

### Language Files and Internationalization

- **Language Files**: Located in `lang/` directory (en.json, de.json, es.json, etc.)
- **Reference File**: `lang/en.json` is the primary reference - all other language files should have matching keys
- **Translation Utility**: Use `npm run compare-lang` to check all language files or `node module/compare-lang-files.js <reference> <target>` for custom comparisons
- **Key Format**: Nested objects use dot notation (e.g., "DCC.Settings.SomeKey")
- **Adding New Keys**: Always add to en.json first, then translate to other language files

### Important Notes

- This system implements FoundryVTT v13 compatibility
- Uses ES modules (`type: "module"` in package.json)
- Hot reload configured for development (js, css, html, json files)
- StandardJS for code formatting, StyleLint for SASS
- All PRs must pass automated tests and implement i18n support
