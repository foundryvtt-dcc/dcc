# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Dungeon Crawl Classics (DCC)** RPG system for **Foundry Virtual Tabletop**. It's a comprehensive game system implementation that provides character sheets, dice mechanics, spell systems, and game automation for the DCC RPG.

## Development Commands

### Core Development
- `npm test` - Run all unit tests using Vitest
- `npm run format` - Auto-fix code style (Standard.js) and SCSS formatting
- `npm run scss` - Compile SCSS to CSS once
- `npm run scss-watch` - Watch and auto-compile SCSS changes

### Testing
- `npm test -- <pattern>` - Run specific tests (e.g., `npm test -- utilities` runs utilities.test.js)
- Tests are located in `module/__tests__/` and use Vitest framework
- Strong mock foundation exists in `module/__mocks__/` for Foundry VTT APIs

### Pack Management
- `npm run todb` - Compile JSON source files to LevelDB packs
- `npm run tojson` - Extract LevelDB packs to JSON source files
- Pack sources are in `packs/*/src/` directories

## Architecture Overview

### System Entry Point
- `module/dcc.js` - Main system initialization, hooks registration, and global API setup
- `system.json` - Foundry system manifest defining capabilities and metadata

### Core Components

**Actor System:**
- `actor.js` - Core actor class extending Foundry's Actor with DCC-specific mechanics
- `actor-sheet.js` + `actor-sheets-dcc.js` - Character sheet implementations for different classes
- Templates in `templates/actor-sheet-*.html` for class-specific sheets (cleric, dwarf, elf, halfling, thief, warrior, wizard, npc)

**Item System:**
- `item.js` - Core item class with DCC-specific item types (weapons, armor, spells, equipment)
- `item-sheet.js` - Item sheet implementations
- Templates in `templates/item-sheet-*.html` for different item types

**Dice & Rolling:**
- `dcc-roll.js` - Custom roll class extending Foundry's Roll with DCC mechanics
- `dice-chain.js` - DCC's unique dice chain system (d3→d4→d5→d6→d7→d8→d10→d12→d14→d16→d20→d24→d30→d100)
- `roll-modifier.js` - Dialog system for roll modifiers and situational bonuses

**Game Mechanics:**
- `spell-result.js` - Spell check result processing and table lookups
- `fleeting-luck.js` - DCC's fleeting luck mechanic implementation
- `utilities.js` - Formatting helpers and table lookup functions
- `chat.js` - Chat message processing for rolls and spell results

**Parsers:**
- `pc-parser.js` - Import player characters from Purple Sorcerer character generator
- `npc-parser.js` - Parse NPC stat blocks from text format
- `parser.js` - Common parsing utilities

### Data Templates
- `template.json` - Foundry data templates defining actor and item schemas
- Defines the structure for Player/NPC actors and various item types
- Uses template inheritance (common → class-specific)

### Testing Infrastructure
- Comprehensive Foundry VTT API mocks in `__mocks__/foundry.js`
- Test coverage improvement plan documented in `docs/IMPROVE_TEST_COVERAGE.md`
- Current focus on unit testing business logic and integration testing Foundry-dependent code

## Key DCC-Specific Concepts

**Dice Chain:** DCC uses non-standard dice progression. The `dice-chain.js` handles stepping dice up/down the chain based on character advancement or penalties.

**Spell System:** Complex spell mechanics with:
- Spell checks using varying dice based on level/class
- Result tables for spell effects
- Spellburn (sacrificing attributes for bonuses)
- Corruption and patron bonds for wizards

**Class Variations:** Each character class has unique mechanics:
- Clerics: Turn unholy, spell checks
- Wizards: Spellcasting, mercurial magic, corruption
- Thieves: Skill checks, backstab
- Warriors: Deed die mechanics
- Demihumans: Race-as-class with special abilities

**Critical Hits/Fumbles:** Extensive table-based critical hit and fumble systems with pack-based table lookups.

## Development Notes

### Code Style
- Uses JavaScript Standard Style (`standard --fix`)
- SCSS files follow Sass Guidelines (`stylelint`)
- ES6 modules throughout
- Foundry VTT v12 compatibility

### Internationalization
- All user-facing strings must be localized in `lang/en.json`
- PRs without i18n support will not be merged

### Pack Management
- Game content stored as LevelDB packs for performance
- Source files maintained as JSON in `packs/*/src/`
- Use provided npm scripts to convert between formats

### Testing Requirements
- All PRs must pass automated unit tests
- Strong emphasis on testing business logic with mocks
- Visual regression tests exist for UI components in `browser-tests/`

### Git Workflow
- Feature branches required for all changes
- Pre-commit hooks enforce code formatting and tests
- Detailed GitHub Flow process documented in wiki

## Operational Guidelines
- Please run format, lint, and tests before reporting tasks done to the operator.

### Development Styling Guidelines
- CSS Grid is preferred over flexbox for styling where that makes sense. There are grid utility classes in _grid.scss.

### Foundry VTT Workflow
- When you make changes in the Foundry UI, and want to check those in, quit foundry and run tojson.  If you pull down from git, and want to update packs in your world, run todb.