# CLAUDE.md

Quick reference for Claude Code working with the DCC system for FoundryVTT.

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests (unit + integration) |
| `npm run test:unit` | Run unit tests only (mocked Foundry) |
| `npm run test:integration` | Run integration tests only (real Foundry) |
| `npm run setup:foundry` | Setup Foundry for integration tests |
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
- **Update tests *with* the code**:
  Any behavior change must update the affected **unit tests** *and* the
  **`browser-tests/e2e/` Playwright specs** in the *same* change. Never leave a
  spec asserting the old behavior. Concretely, before you consider a change
  done: `grep` `browser-tests/e2e/` (and `module/**/__tests__/`) for assertions
  on the output you changed — old DOM classes/text, button selectors, chat-card
  shape, flags, roll formulas — and rewrite them to the new contract, **plus**
  add at least one assertion covering the new behavior. Changing a chat card,
  roll, sheet, data model, or any user-visible output without touching a spec is
  almost always a sign you missed one. The full E2E suite is slow, so it's fine
  to run only the affected spec(s) while iterating, but run the **full
  `browser-tests/e2e` suite before pushing** anything that touches the
  attack / card / roll / sheet paths.
- **FoundryVTT v14**: Target version (v14-only, ApplicationV2 API)
- **Check dependent modules**: Before PRs, verify no breakage in `../../modules/dcc-qol`, `../../modules/xcc`, `../../modules/mcc-classes`, `../../modules/dcc-crawl-classes`

## Working with dcc-core-lib

We own **`@moonloch/dcc-core-lib`** (scoped npm name — the unscoped
`dcc-core-lib` is **not** published; never `npm install dcc-core-lib`).
The upstream library is at `/Users/timlwhite/WebstormProjects/dcc-core-lib`,
GitHub repo `moonloch/dcc-core-lib`, vendored into this repo at
`module/vendor/dcc-core-lib/`. When a doc or path uses the bare
`dcc-core-lib` token (vendor directory, repo identifier), it's referring
to one of those local identifiers — the npm package is always the scoped
form.

When investigating roll/check/save/combat behavior and the bug appears
to be in the lib (not just an adapter translation issue):

- **Fix it in dcc-core-lib.** Open a PR against `moonloch/dcc-core-lib`
  with the fix + a regression test. Do not paper over lib bugs with
  adapter-side compensation as a permanent solution. (Short-lived
  workarounds in the adapter are OK while the lib PR is in flight,
  but the workaround must be removed once the fix lands.)
- **Vendor sync.** The lib's compiled output lives at
  `module/vendor/dcc-core-lib/` and is committed to the system repo
  (Foundry has no bundler). After the lib PR merges and you've pulled
  `main` in the lib checkout, run `npm run sync-core-lib` from the
  system repo. The script (`scripts/sync-core-lib.mjs`) builds the
  lib via `npm run build`, copies `dist/` into the vendor directory,
  and writes `module/vendor/dcc-core-lib/VERSION.json` with the
  source commit SHA + timestamp. Override the source path with
  `DCC_CORE_LIB_SRC=/path/to/dcc-core-lib npm run sync-core-lib`.
  Commit the resulting vendor diff with a message like
  `vendor: sync dcc-core-lib to <version> (<sha7>)`.
- **Adapter cleanup follows the sync.** Once the new vendor copy is
  in place, remove any temporary adapter workaround you added while
  the lib fix was in flight, and update tests that were asserting
  the workaround's compensated values back to the natural contract.

## Standing authorizations

These override the default "never commit/push without being asked"
rule. They apply only to the scoped context described.

- **Commit and push on any non-`main` branch without asking.** On any
  branch other than `main`, when a unit of work is complete and the fast
  Vitest suite (`npm test`) is green, **commit** locally and
  `git push origin <branch>` without asking. This covers feature / fix
  branches, merges of `main` into them, and similar work. Use
  conventional-commit messages matching the branch's existing history.
  For changes touching the core attack / sheet / chat paths, prefer
  running the full Playwright E2E suite before pushing, and say so if you
  pushed without it. Still pause and ask if: `npm test` is failing,
  `git status` shows unexpected untracked files, the pre-commit hook
  rewrites code in ways that should be reviewed, or the work is
  incomplete.
- **Never commit or push directly to `main` without being asked.** The
  default rule still applies to `main`: branch first, and only push to
  `main` (or open a PR into it) when explicitly told to.

- **Never publish or promote a GitHub release.** The `Create GitHub
  Release` workflow (triggered by a `version.txt` bump landing on `main`)
  **always** produces a *draft*, and the maintainer publishes it manually
  — publishing is what fires the `release: published` workflows that push
  the version to Foundry's registry. Do **not** run
  `gh release edit --draft=false`, mark a release latest, or otherwise
  promote/publish a release unless the maintainer **explicitly** tells you
  to in that session. Default: stop at the draft and hand off. See
  `docs/dev/RELEASE_PROCESS.md` and the `/release` skill.

## Documentation

### Developer Guides
- [Architecture](docs/dev/ARCHITECTURE.md) - System structure, classes, data model
- [Extension API](docs/dev/EXTENSION_API.md) - Stable / internal / dead extension surface
- [Development](docs/dev/DEVELOPMENT.md) - Workflow, commands, code standards
- [Testing](docs/dev/TESTING.md) - Test suite, mocks, coverage
- [Pack Management](docs/dev/PACKS.md) - Compendium JSON/LevelDB workflow
- [Internationalization](docs/dev/I18N.md) - Translation system
- [DCC-QOL Integration](docs/dev/DCC_QOL_INTEGRATION.md) - Analysis: folding dcc-qol features into core behind settings

### Reference Docs
- [V14](docs/dev/V14.md) - V14 reference: data models, Active Effects V2, API changes
- [V13](docs/dev/V13.md) - ApplicationV2 patterns reference
- [Test Coverage](docs/dev/TEST_COVERAGE.md) - Detailed testing strategy
- [Release Process](docs/dev/RELEASE_PROCESS.md) - How to release
- [Pre-Release Process](docs/dev/PRERELEASE_PROCESS.md) - Foundry-installable test builds off a feature branch (manual, off-`main`)

### User Guides
- [Active Effects](docs/user-guide/Active-Effects.md) - Using effects, attribute keys
- See `docs/user-guide/` for full end-user documentation
