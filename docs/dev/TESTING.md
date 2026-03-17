# Testing Guide

This document covers the testing infrastructure for the DCC system.

## Overview

The DCC system uses **Vitest** with two test tiers:

- **Unit tests** (`module/__tests__/`) — fast, fully mocked, no Foundry install needed
- **Integration tests** (`module/__integration__/`) — use real Foundry VTT common modules for higher fidelity

## Running Tests

```bash
# Run all tests (unit + integration)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run specific test file
npm test module/__tests__/actor.test.js

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

```
module/
├── __tests__/                # Unit tests (mocked Foundry)
│   ├── actor.test.js         # Actor ability and roll tests
│   ├── item.test.js          # Item calculation tests
│   ├── npc-parser.test.js    # NPC stat block parsing
│   ├── pc-parser.test.js     # PC character parsing
│   ├── dice-chain.test.js    # Dice chain mechanics
│   ├── utilities.test.js     # Utility function tests
│   ├── dcc-roll.test.js      # Roll system tests
│   └── fixtures/             # Test data files
├── __integration__/          # Integration tests (real Foundry)
│   ├── setup-foundry.js      # Setup: loads real Foundry modules
│   └── data-models.test.js   # Data model tests against real fields
├── __mocks__/
│   ├── foundry.js            # FoundryVTT API mocks
│   ├── roll.js               # Roll system mocks
│   └── dcc-roll.js           # DCC roll mocks
```

## Mock Infrastructure

The test suite includes comprehensive mocks for the FoundryVTT API:

### Key Mock Features
- Foundry document classes (Actor, Item)
- Roll system with configurable results
- Template data loading utilities
- Collection and game object mocks
- CONFIG.DCC system configuration

### Using Mocks

```javascript
import { vi, describe, it, expect } from 'vitest'

// Access global mocks
global.game.i18n.localize('DCC.SomeKey')

// Configure roll results for tests
global.mockRollResult(15, [15])
```

## Integration Tests (Real Foundry)

Integration tests import real Foundry VTT source code instead of mocks. This catches behavioral differences that mocks hide, which is especially valuable when preparing for Foundry version upgrades (e.g., v13 → v14).

### What's Real vs Mocked

| Real (from Foundry source) | Still Mocked |
|---|---|
| `foundry.utils.*` (mergeObject, expandObject, etc.) | `game` (settings, i18n, user) |
| `foundry.data.fields.*` (SchemaField, NumberField, etc.) | `Actor`, `Item`, `ChatMessage` |
| `foundry.abstract.*` (DataModel, TypeDataModel) | `ApplicationV2`, `DialogV2` |
| `CONST` (ownership levels, chat modes, etc.) | `Roll` (dice engine) |
| `Collection` class | `Hooks`, `ui` |

### Setup

Integration tests require a copy of Foundry's `common/` modules. The setup script populates `.foundry-dev/` (gitignored) with just what's needed (~1.5 MB):

```bash
# Auto-detect from a local Foundry install
npm run setup:foundry

# Or specify a path
node scripts/setup-foundry-dev.js --source ~/Applications/foundry-13

# Or download from foundryvtt.com (see "CI Setup" below)
node scripts/setup-foundry-dev.js --download
```

The resolution order for finding Foundry is:
1. `FOUNDRY_PATH` environment variable
2. `.foundry-dev/` in the project root
3. Known local install paths (`~/Applications/foundry-13`, etc.)

### CI Setup

For GitHub Actions, set these repository secrets:

| Secret | Description |
|---|---|
| `FOUNDRY_RELEASE_URL` | Presigned URL from your [Purchased Licenses](https://foundryvtt.com) page (simplest) |
| **or** `FOUNDRY_USERNAME` | foundryvtt.com username |
| **and** `FOUNDRY_PASSWORD` | foundryvtt.com password |

Then in your workflow:
```yaml
- name: Setup Foundry for integration tests
  run: node scripts/setup-foundry-dev.js --download
  env:
    FOUNDRY_RELEASE_URL: ${{ secrets.FOUNDRY_RELEASE_URL }}
```

### Writing Integration Tests

```javascript
/* global foundry, CONST */
import { describe, test, expect } from 'vitest'
import { PlayerData } from '../data/actor/player-data.mjs'

describe('PlayerData with real Foundry', () => {
  test('constructs with field coercion', () => {
    // Real NumberField coerces strings to numbers
    const data = new PlayerData({
      abilities: { str: { value: '18' } }
    })
    expect(data.abilities.str.value).toBe(18)
    expect(typeof data.abilities.str.value).toBe('number')
  })
})
```

The setup file (`module/__integration__/setup-foundry.js`) runs automatically before integration tests and assigns real Foundry modules to globals.

## Test Categories

### Unit Tests
Pure JavaScript functions with minimal Foundry dependencies:
- `dice-chain.js` - Die progression algorithms
- `utilities.js` - Formatting and helper functions
- Parser regex patterns

### Integration Tests
DCC data models and utilities against real Foundry code:
- Schema definition and validation with real field classes
- TypeDataModel construction and migration pipeline
- `foundry.utils` behavior (mergeObject, expandObject, etc.)
- Field coercion (NumberField, StringField, BooleanField)

## Parser Tests

The parser system has comprehensive test coverage:

### NPC Parser
- Stat block format variations
- Movement speed parsing
- Special ability extraction
- Hit dice and attack parsing

### PC Parser
- Purple Sorcerer JSON format
- Plain text format
- Weapon and equipment parsing
- Class-specific data handling

## Writing Tests

### Test File Convention
```javascript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something specific', () => {
    // Arrange
    const input = setupTestData()

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe(expectedValue)
  })
})
```

### Best Practices
1. **Isolate tests**: Each test should be independent
2. **Clear mocks**: Use `beforeEach` to reset state
3. **Descriptive names**: Test names should explain behavior
4. **Test edge cases**: Include boundary conditions and error cases
5. **Use fixtures**: Store complex test data in `fixtures/` directory

## Coverage Goals

See [Test Coverage](TEST_COVERAGE.md) for:
- Detailed coverage targets by module
- Phase-by-phase implementation plan
- Known issues discovered during testing
- Mock enhancement strategies

### Current Coverage Targets
| Category | Target |
|----------|--------|
| Business Logic | 80-85% |
| UI Components | 40-50% |
| Overall | 65-70% |

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Push to main branch

All PRs must pass tests before merging.

## Related Documentation

- [Test Coverage](TEST_COVERAGE.md) - Comprehensive coverage strategy
- [Development Guide](DEVELOPMENT.md) - Development workflow
- [Architecture](ARCHITECTURE.md) - System structure
