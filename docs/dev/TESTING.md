# Testing Guide

This document covers the testing infrastructure for the DCC system.

## Overview

The DCC system uses **Vitest** for unit and integration testing. Tests are located in `module/__tests__/` with mocks in `module/__mocks__/`.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test module/__tests__/actor.test.js

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

```
module/
├── __tests__/
│   ├── actor.test.js         # Actor ability and roll tests
│   ├── item.test.js          # Item calculation tests
│   ├── npc-parser.test.js    # NPC stat block parsing
│   ├── pc-parser.test.js     # PC character parsing
│   ├── dice-chain.test.js    # Dice chain mechanics
│   ├── utilities.test.js     # Utility function tests
│   ├── dcc-roll.test.js      # Roll system tests
│   └── fixtures/             # Test data files
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

## Test Categories

### Unit Tests
Pure JavaScript functions with minimal Foundry dependencies:
- `dice-chain.js` - Die progression algorithms
- `utilities.js` - Formatting and helper functions
- Parser regex patterns

### Integration Tests
Classes that extend Foundry APIs:
- Actor methods (rolls, calculations)
- Item system interactions
- Sheet data preparation

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
