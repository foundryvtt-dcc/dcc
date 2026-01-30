# CLAUDE.md

Quick reference for Claude Code working with the DCC system for FoundryVTT.

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests (Vitest) |
| `npm run format` | Format code (StandardJS + StyleLint) |
| `npm run scss` | Compile SASS to CSS |
| `npm run todb` | Compile JSON → LevelDB packs (Foundry must be shut down) |
| `npm run tojson` | Extract LevelDB → JSON packs |
| `npm run compare-lang` | Check translation coverage |

## Key Files

| File | Purpose |
|------|---------|
| `module/dcc.js` | Entry point, system init |
| `module/actor.js` | DCCActor class |
| `module/item.js` | DCCItem class |
| `template.json` | Data model definition |
| `styles/dcc.scss` | Main styles (edit this, not .css) |

## Critical Rules

- **SCSS only**: Edit `styles/dcc.scss`, never `styles/dcc.css`
- **i18n required**: All user text must use `game.i18n.localize()`
- **Translate new keys**: When adding to language files, translate them
- **Tests must pass**: All PRs require passing tests
- **FoundryVTT v13**: Uses ApplicationV2 API

## Documentation

### Developer Guides
- [Architecture](docs/dev/ARCHITECTURE.md) - System structure, classes, data model
- [Development](docs/dev/DEVELOPMENT.md) - Workflow, commands, code standards
- [Testing](docs/dev/TESTING.md) - Test suite, mocks, coverage
- [Pack Management](docs/dev/PACKS.md) - Compendium JSON/LevelDB workflow
- [Internationalization](docs/dev/I18N.md) - Translation system

### Reference Docs
- [V13 ApplicationV2](docs/dev/V13_APP_V2.md) - Migration patterns
- [Test Coverage](docs/dev/TEST_COVERAGE.md) - Detailed testing strategy
- [Release Process](docs/dev/RELEASE_PROCESS.md) - How to release

### User Guides
- [Active Effects](docs/user-guide/Active-Effects.md) - Using effects, attribute keys
- See `docs/user-guide/` for full end-user documentation
