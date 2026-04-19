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
- **FoundryVTT v14**: Target version (v14-only, ApplicationV2 API)
- **Check dependent modules**: Before PRs, verify no breakage in `../../modules/dcc-qol`, `../../modules/xcc`, `../../mcc-classes`, `../../dcc-crawl-classes`

## Standing authorizations

These override the default "never commit/push without being asked"
rule. They apply only to the scoped context described.

- **Auto-commit and push refactor slices on `refactor/dcc-core-lib-adapter`.**
  When a Phase-N session-M slice is complete (code + tests + docs,
  all green), commit and push without asking. Commit-message format
  matches the established history on this branch:
  `feat(adapter): Phase <N> session <M> — <short slice description>`
  (optionally followed by a second `docs(adapter): refresh session-start
  prompt for Phase <N> session <M>` commit if `docs/01-session-start.md`
  was updated). Push to `origin refactor/dcc-core-lib-adapter` after
  the commit(s) land. Still pause and ask if: tests are failing,
  `git status` shows unexpected untracked files, the pre-commit hook
  rewrites code in ways that should be reviewed, or the slice is
  incomplete.

## Refactor-slice testing requirements

Apply to every slice on `refactor/dcc-core-lib-adapter`. These are
preconditions for the auto-commit authorization above — if any fail,
don't commit.

- **Run the FULL browser-tests/e2e Playwright suite each session.**
  Not just `phase1-adapter-dispatch.spec.js` — also `v14-features.spec.js`,
  `data-models.spec.js`, and every other spec in `browser-tests/e2e/`.
  Launch via the standard recipe in
  `docs/dev/TESTING.md#browser-tests-playwright` (Node 24, fvtt CLI
  `installPath=foundry-14` + `dataPath=/Users/timwhite/FoundryVTT-Next`,
  `--world=v14`), then `cd browser-tests/e2e && npm test` (no spec
  filter). Also run the visual-regression suite in
  `browser-tests/visual-regression/` if the slice touches sheet
  markup / chat templates / CSS. Report any failure, even if
  apparently unrelated to the slice — pre-existing flakes are worth
  flagging and pin-pointing, not ignoring.
- **Extend the browser tests each session.** Every slice must add
  at least one new browser-test assertion exercising the new
  behavior end-to-end against live Foundry. For dispatch changes,
  extend `phase1-adapter-dispatch.spec.js` with the new branch. For
  data / sheet / chat-template changes, add cases to the appropriate
  spec (`v14-features.spec.js`, `data-models.spec.js`, or a new
  spec file if the surface area warrants one). The adapter-dispatch
  test count has climbed with each session (26 at Phase 3 session 2
  close → 27 at session 5 close); that trajectory is expected and
  intentional — the suite IS the regression net for the refactor.

## Documentation

### Developer Guides
- [Architecture](docs/dev/ARCHITECTURE.md) - System structure, classes, data model
- [Development](docs/dev/DEVELOPMENT.md) - Workflow, commands, code standards
- [Testing](docs/dev/TESTING.md) - Test suite, mocks, coverage
- [Pack Management](docs/dev/PACKS.md) - Compendium JSON/LevelDB workflow
- [Internationalization](docs/dev/I18N.md) - Translation system

### Reference Docs
- [V14](docs/dev/V14.md) - V14 reference: data models, Active Effects V2, API changes
- [V13](docs/dev/V13.md) - ApplicationV2 patterns reference
- [Test Coverage](docs/dev/TEST_COVERAGE.md) - Detailed testing strategy
- [Release Process](docs/dev/RELEASE_PROCESS.md) - How to release

### User Guides
- [Active Effects](docs/user-guide/Active-Effects.md) - Using effects, attribute keys
- See `docs/user-guide/` for full end-user documentation
