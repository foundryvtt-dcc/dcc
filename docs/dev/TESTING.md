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

# Run the unit suite with coverage + enforce the ratchet thresholds
npm run test:coverage
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
│   ├── setup-dice.js         # Setup: loads real Foundry dice engine
│   ├── data-models.test.js   # Data model tests against real fields
│   └── dice-engine.test.js   # Dice engine tests (Roll, Die, parsing)
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

> **Mocks can't see schema-level validation.** The unit-test `foundry.js`
> mock has no real `NumberField`, so `min`/`max` clamping, type coercion,
> and other DataModel `clean`/validation behavior are **invisible** to
> `module/__tests__/`. A change like "an ability score should be able to
> reach 0" can pass every unit test while the live data model silently
> clamps the persisted value back to the field's `min`. This actually
> happened with the spellburn floor-0 work (Phase 7 session 17):
> `AbilityField.value` had `min: 1`, so the adapter's `0`-write was clamped
> to `1` — the mocked unit tests were green, and only the **burn-to-0
> browser test** (running real schema validation) caught it. **Rule of
> thumb:** any "this value should now be able to be X" behavior that
> depends on a schema field bound (`min`/`max`/`integer`/`choices`) needs
> an integration test (`module/__integration__/`, real fields) *or* a
> browser test — a unit test alone proves nothing about the floor/ceiling.

### What's Real vs Mocked

| Real (from Foundry source) | Still Mocked |
|---|---|
| `foundry.utils.*` (mergeObject, expandObject, etc.) | `game` (settings, i18n, user) |
| `foundry.data.fields.*` (SchemaField, NumberField, etc.) | `Actor`, `Item`, `ChatMessage` |
| `foundry.abstract.*` (DataModel, TypeDataModel) | `ApplicationV2`, `DialogV2` |
| `CONST` (ownership levels, chat modes, etc.) | `Hooks`, `ui` |
| `Collection` class | |
| `Roll`, `Die`, `RollParser`, `MersenneTwister` (dice engine) | |

### Setup

Integration tests require a copy of Foundry's `common/` modules. The setup script populates `.foundry-dev/` (gitignored) with what's needed:

- `common/` — utilities, data fields, constants (~1.5 MB)
- `client/dice/` — dice engine with pre-compiled PEG grammar (when available)
- `common/primitives/` — prototype extensions (Array.filterJoin, Number.isNumeric, etc.)

Both Foundry v13 and v14 are supported. v14 is preferred when both are available.

```bash
# Auto-detect from a local Foundry install
npm run setup:foundry

# Or specify a path
node scripts/setup-foundry-dev.js --source ~/Applications/foundry-14

# Or download from foundryvtt.com (see "CI Setup" below)
node scripts/setup-foundry-dev.js --download

# Force re-setup (e.g., after installing a new Foundry version)
npm run setup:foundry -- --force
```

The resolution order for finding Foundry is:
1. `FOUNDRY_PATH` environment variable
2. `.foundry-dev/` in the project root
3. Known local install paths (`~/Applications/foundry-14`, `~/Applications/foundry-13`, etc.)

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
- Real dice engine: Roll evaluation, formula parsing, variable substitution
- DCC-specific dice (d3, d5, d7, d14, d16, d24, d30)
- Seeded determinism with MersenneTwister PRNG

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
6. **Don't trust a unit test for schema-bound behavior**: `min`/`max`/coercion live in real Foundry fields the unit mock doesn't implement. If a change is "value X should now be reachable/rejected," cover it with an integration test (real fields) or a browser test — see the callout under [Integration Tests](#integration-tests-real-foundry).

## Coverage Goals

See [Test Coverage](TEST_COVERAGE.md) for:
- Detailed coverage targets by module
- Phase-by-phase implementation plan
- Known issues discovered during testing
- Mock enhancement strategies

### Coverage tooling + ratchet

`npm run test:coverage` runs the **unit** project (deterministic — no
Foundry dependency) under the `v8` provider and enforces the thresholds in
`vitest.config.js`. They are a **ratchet floor**, set just below the measured
baseline so coverage can only hold or climb:

| Metric | Floor | Baseline (2026-06-09) |
|--------|-------|-----------------------|
| Statements | 60% | 60.5% |
| Branches | 60% | 60.65% |
| Functions | 63% | 64.22% |
| Lines | 60% | 60.95% |

Raise the floors as coverage improves; **never lower them to make a red run
pass** — a drop means new code shipped untested. The default `npm test` does
**not** measure coverage (kept fast for the pre-commit hook); coverage is
opt-in via `test:coverage` and is the natural gate to wire into CI. Reports
land in `coverage/` (gitignored); open `coverage/index.html` for the
line-by-line view. The integration project (when Foundry is present) only
*adds* coverage, so basing the floor on unit-only stays safe everywhere.

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

## Browser tests (Playwright)

End-to-end tests that drive a live Foundry instance live in `browser-tests/e2e/` — five functional specs, all Playwright against a real Foundry server (no mocks, no Vitest):

- `adapter-dispatch.spec.js` — every roll/check/save branch dispatches to the intended path (the permanent regression net; formerly `phase1-adapter-dispatch.spec.js`)
- `extension-api.spec.js` — the stable `game.dcc.*` extension surface
- `active-effects.spec.js` — Active Effects (CRUD, application, dice-chain & equipped-item effects, effect transfer, the DCC Effects compendium)
- `data-models.spec.js` — TypeDataModel validation + persistence via the sheet UI
- `sheet-ui.spec.js` — sheet click-through: roll an ability/save → chat card, class-specific tab sets, tab navigation, and status-effect registration

Shared login/session plumbing lives in `browser-tests/e2e/fixtures.js` (`createSessionTest`). Specs create their own test actors/items via `page.evaluate` and clean up in `beforeEach`, so the world only needs to be a valid DCC world. (A v12-era visual-regression suite was removed — it can be re-added against v14 if screenshot diffing is wanted.)

### One-time setup

```bash
# From browser-tests/e2e/
npm install
npx playwright install chromium chromium-headless-shell
```

> **Playwright ≥ 1.60 is required on macOS 26 ("Tahoe").** Older builds
> (≤ ~1.56) hang during browser **extraction** — the download reaches 100%
> and then the install freezes mid-unzip (`oopDownloadBrowserMain` stuck on
> the first extracted file). The download itself is fine; only the old
> extractor wedges. If you hit this: `pkill -f oopDownloadBrowserMain`,
> remove the stale lock + partial dir
> (`rm -rf ~/Library/Caches/ms-playwright/__dirlock ~/Library/Caches/ms-playwright/chromium*-*`),
> upgrade (`npm i -D @playwright/test@latest`), and retry. `browser-tests/e2e`
> is pinned to `^1.60.0`.

### Running a suite

Foundry must be running before Playwright starts. The fvtt CLI config is global — set it to match the worktree you're testing:

```bash
# One-time per worktree: tell the fvtt CLI which Foundry install and
# which user-data dir to use. --dataPath as a launch flag is silently
# ignored — the CLI reads the persisted config instead.
npx @foundryvtt/foundryvtt-cli configure set installPath ~/Applications/foundry-14
npx @foundryvtt/foundryvtt-cli configure set dataPath /Users/timlwhite/FoundryVTT-Next

# Every run: Node 24 (required by V14), then launch + test.
nvm use 24
nohup npx @foundryvtt/foundryvtt-cli launch --world=v14 \
  >/tmp/foundry-v14.log 2>&1 & disown

# From browser-tests/e2e/:
npm test                                      # full suite
npm test -- adapter-dispatch.spec.js   # one spec
npm run test:headed                           # watch it drive the browser
```

### Gotchas

- **Node 24 is required.** V14 Foundry refuses to boot on older Node. `.nvmrc` pins 24; `nvm use` in the project dir picks it up.
- **`installPath` default is `foundry-13`.** Running a V14 world on that install fails with `World "…" is not available to auto-launch` plus cryptic data-model validation errors. Always `configure view` first.
- **`dataPath` matters per worktree.** The main repo lives under `/Users/timlwhite/FoundryVTT/Data/systems/dcc`; the `refactor/*` worktrees usually live under `/Users/timlwhite/FoundryVTT-Next/Data/systems/dcc`. Pointing the CLI at the wrong dataPath silently loads the OTHER copy of the system and your code changes don't show up. Verify by `curl http://localhost:30000/systems/dcc/module/actor.js | head` and check for an expected recent edit.
- **World name is `v14`, not `automated_testing`.** The worlds in `FoundryVTT-Next/Data/worlds/` are `v14`, `v13`, and `secrets-of-the-spectral-summoner`. Use `v14`.
- **Close your manual Foundry browser tab first.** If a Gamemaster is already logged in there, the join-page select disables the "Gamemaster" option and Playwright can't claim a GM session. A `globalSetup` smoke check (`browser-tests/e2e/global-setup.js`) now catches this and **aborts the whole run in ~10 s with an actionable message** ("A Gamemaster is already logged into Foundry … close the tab") instead of letting every test burn its 60 s setup timeout (~25 min total). The same check fast-fails when Foundry is down or no world is launched. It waits up to 20 s for the JS-rendered user picker, so a slow world boot won't false-fail.

### Session-reuse fixture (why the suite is fast)

All four functional specs use a **worker-scoped `sessionPage` fixture**: each worker logs into Foundry **once** and reuses the same page across every test, instead of re-navigating to `/join` + re-booting the system per test. This cut the e2e suite from ~840 s to ~340 s (e.g. `extension-api` 239 s → 34 s). `adapter-dispatch.spec.js` is the reference implementation. Implications when writing or editing these specs:

- The `page` in `async ({ page }) => …` is the **shared** session page — it is NOT reset between tests. Do all per-test cleanup in `beforeEach`: close `ui.windows`, delete your probe actors/items, remove `#notifications` banners. Name probe actors with a per-spec prefix (`P1 …`, `V14 …`, `Test …`) so cleanup can find leftovers from a crashed run.
- Attach the `page.on('console', …)` listener **in the fixture** (once), pushing into a module-scoped array that `beforeEach` clears. Never attach it in `beforeEach` — on a reused page that leaks a listener per test.
- For specs with a zero-console-error gate in `afterEach`, clear the error buffer at the **end** of `beforeEach` (after cleanup + a short settle), so a prior test's un-awaited teardown (e.g. a UI-driven actor delete) can't trip the next test's gate.
- `workers: 1` (playwright.config.js) keeps the module-scoped arrays safe. If you ever parallelize, move them onto the fixture object.
- Prefer deterministic waits (`waitForSelector`/`waitForFunction`/locator auto-wait) over `waitForTimeout`; the latter is pure fixed wall-clock and the bulk of what remains to optimize.

### Adapter dispatch validation

`adapter-dispatch.spec.js` validates every Phase-1 roll branch by capturing the `[DCC adapter] <rollType> → <via adapter|LEGACY path>` console line emitted by `module/adapter/debug.mjs`. The dispatch logging is kept permanently (not a phase-close scaffold) precisely so this spec has a stable signal to assert against. Later phases add their own logDispatch calls and extend the spec.

## Related Documentation

- [Test Coverage](TEST_COVERAGE.md) - Comprehensive coverage strategy
- [Development Guide](DEVELOPMENT.md) - Development workflow
- [Architecture](ARCHITECTURE.md) - System structure
