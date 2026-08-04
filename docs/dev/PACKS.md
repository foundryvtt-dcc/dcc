# Pack Management

This document covers working with compendium packs in the DCC system.

## Overview

FoundryVTT uses LevelDB for compendium storage, but we maintain human-readable JSON source files in git. The system provides tools to convert between formats.

## Directory Structure

```
packs/
├── creatures/
│   └── src/
│       ├── monster1.json
│       └── monster2.json
├── spells/
│   └── src/
│       ├── spell1.json
│       └── spell2.json
└── ... (other pack folders)
```

- **Source Files**: `packs/*/src/*.json` - Human-readable JSON (tracked in git)
- **Compiled Packs**: `packs/*.db` - LevelDB format (not tracked in git)

## Commands

| Command | Description |
|---------|-------------|
| `pnpm run tojson` | Extract LevelDB packs → JSON source files |
| `pnpm run todb` | Compile JSON source files → LevelDB packs |

## Development Workflow

### Making Changes to Pack Content

1. **Extract current data** (if needed):
   ```bash
   pnpm run tojson
   ```

2. **Edit JSON source files** in `packs/*/src/`

3. **Compile to LevelDB**:
   ```bash
   pnpm run todb
   ```

4. **Test in FoundryVTT**

5. **Commit JSON changes** to git

### Working with FoundryVTT UI

If you prefer editing content in FoundryVTT's UI:

1. Clone repo and run `pnpm install`
2. Run `pnpm run todb` to compile packs
3. Start FoundryVTT and create a test world
4. Enable the DCC system
5. Make changes in Foundry UI
6. Unlock compendium(s) you modified
7. Open the Adventure containing the modified content
8. Right-click Adventure → "Rebuild Adventure"
9. Drag updated folders onto Rebuild dialog
10. Click "Rebuild Adventure"
11. Exit world and quit FoundryVTT
12. Run `pnpm run tojson` to extract changes
13. Commit JSON changes to git

## Important Notes

### Git Tracking
- **DO commit**: JSON source files (`packs/*/src/*.json`)
- **DO NOT commit**: LevelDB files (`*.db`) - these are in `.gitignore`

### Release Process
The GitHub release workflow automatically runs `pnpm run todb` before packaging, so releases always have compiled packs.

### Prerequisites
Install the [foundry-cli](https://github.com/foundryvtt/foundryvtt-cli) for pack compilation:
```bash
pnpm install -g @foundryvtt/foundryvtt-cli
```

## Pack Types

| Pack | Contents |
|------|----------|
| `creatures` | NPCs and monsters |
| `spells` | Wizard and cleric spells |
| `equipment` | Weapons, armor, gear |
| `tables` | Rollable tables (crits, fumbles, etc.) |

## Troubleshooting

### Pack not showing in Foundry
- Ensure you ran `pnpm run todb` after editing JSON
- Check that the pack is listed in `system.json`
- Restart FoundryVTT if needed

### JSON extraction failing
- Make sure FoundryVTT is not running
- Check for locked files in the packs directory

### Merge conflicts in pack files
- Always work with JSON source files
- Run `pnpm run tojson` before pulling changes
- Resolve conflicts in JSON, then run `pnpm run todb`

## Related Documentation

- [Development Guide](DEVELOPMENT.md) - General development workflow
- [Release Process](RELEASE_PROCESS.md) - How to create releases
- [LevelDB Workflow](LEVELDB_WORKFLOW.md) - Original detailed workflow
