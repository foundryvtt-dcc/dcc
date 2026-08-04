# Development Guide

This document covers the development workflow and commands for the DCC system.

## Prerequisites

- Node.js 24+ and pnpm 11+ (`corepack enable`, or `brew install pnpm` — the repo pins the version via the `packageManager` field)
- FoundryVTT installation for testing
- [foundry-cli](https://github.com/foundryvtt/foundryvtt-cli) for pack management

## Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Format code
pnpm run format

# Compile SCSS
pnpm run scss
```

## Commands

The repo is a **pnpm workspace** (root package + `browser-tests/e2e` share one
lockfile and one `pnpm install`). npm is blocked by a `preinstall` guard —
use pnpm.

### Code Quality

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests using Vitest |
| `pnpm run format` | Format code with StandardJS and StyleLint (includes --fix) |

### Styles

| Command | Description |
|---------|-------------|
| `pnpm run scss` | Compile SASS from `styles/dcc.scss` to `styles/dcc.css` |
| `pnpm run scss-watch` | Watch and auto-compile SASS during development |

**Important**: Always edit `styles/dcc.scss`, never edit `dcc.css` directly!

### Pack Management

| Command | Description |
|---------|-------------|
| `pnpm run todb` | Compile JSON source files to LevelDB packs |
| `pnpm run tojson` | Extract LevelDB packs to JSON source files |

See [Pack Management](PACKS.md) for detailed workflow.

### Internationalization

| Command | Description |
|---------|-------------|
| `pnpm run compare-lang` | Compare all language files with English reference |

See [Internationalization](I18N.md) for translation workflow.

### Parallel Issue Workflow (#893)

Work several issues at once, each in its own worktree with its own isolated
Foundry server (see [Testing](TESTING.md) → "Isolated per-worktree
environments" for the underlying `e2e:env` tool):

| Command | Description |
|---------|-------------|
| `pnpm run work:start -- <issue#>` | Issue → branch + worktree (in `$DCC_WORK_DIR`, default `~/FoundryVTT-Work`) → isolated Foundry env → Claude session with an issue-specific prompt. `--no-claude` to skip the session launch, `--branch` to override the derived name (keep an `<issue#>-` token in it, or `work:sync`/`work:finish` won't find the worktree), `--modules a,b` to extend the env's module set (written to the gitignored `browser-tests/e2e/test-environment.local.json`, e.g. for sibling-module compat work). |
| `pnpm run work:list` | Board of active worktrees: issue, branch, dirty/clean, server URL + pid, PR state. |
| `pnpm run work:sync -- <issue#> \| --all` | After a PR merges: stop the env server, merge `origin/main`, recompile scss + packs, restart. Merge conflicts stop with the worktree left mid-merge to resolve. Run it for every active worktree after each merge to `main`. |
| `pnpm run work:finish -- <issue#>` | Teardown after the PR merges: destroy the env, remove worktree + local branch, drop the `in-progress` label. Refuses while dirty or unmerged (`--force` overrides). |

Worktrees are deliberately created **outside** the live Foundry `Data/`
directory — a second checkout under `Data/systems/` would be scanned by the
live server as a duplicate `dcc` system.

## Code Standards

### JavaScript
- **StandardJS** for code formatting
- ES modules (`type: "module"` in package.json)
- No unused variables in catch blocks (use `catch` instead of `catch (e)`)

### SCSS/CSS
- **StyleLint** with SASS guidelines
- Primary styles in `styles/dcc.scss`

### Pull Requests
- All PRs must pass automated tests
- All user-facing text must use i18n (no hardcoded strings)
- Run `pnpm run format` before committing
- **Check dependent modules**: Verify changes don't break these related modules:
  - `../../modules/dcc-qol` - Quality of Life enhancements
  - `../../modules/xcc` - Xcrawl Classics support
  - `../../mcc-classes` - Mutant Crawl Classics classes
  - `../../dcc-crawl-classes` - Additional DCC classes

## Project Structure

```
dcc/
├── module/           # JavaScript source
│   ├── __tests__/    # Test files
│   ├── __mocks__/    # Test mocks
│   ├── dcc.js        # Entry point
│   ├── actor.js      # DCCActor class
│   ├── item.js       # DCCItem class
│   └── ...
├── templates/        # Handlebars templates
├── styles/           # SCSS/CSS styles
├── lang/             # Translation files
├── packs/            # Compendium packs
│   └── */src/*.json  # JSON source files
├── docs/             # Documentation
│   ├── dev/          # Developer docs
│   └── user-guide/   # User docs
└── system.json       # System manifest
```

## Hot Reload

The system is configured for hot reload during development. Changes to these file types trigger automatic refresh:
- `.js` - JavaScript
- `.css` - Stylesheets
- `.html` - Templates
- `.json` - Data files

## FoundryVTT Compatibility

- **Current Target**: FoundryVTT V14 (V14-only)
- **ApplicationV2**: All sheets use the ApplicationV2 API

See [V14 Reference](V14.md) for data models and V14-specific APIs, and [V13 / ApplicationV2 Reference](V13.md) for sheet patterns.

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System structure overview
- [Testing](TESTING.md) - Test suite details
- [Pack Management](PACKS.md) - Compendium workflow
- [Internationalization](I18N.md) - Translation guide
- [Release Process](RELEASE_PROCESS.md) - How to create releases
