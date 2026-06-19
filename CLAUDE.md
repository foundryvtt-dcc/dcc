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
- **Check dependent modules**: Before PRs, verify no breakage in `../../modules/dcc-qol`, `../../modules/xcc`, `../../modules/mcc-classes`, `../../modules/dcc-crawl-classes`

## Working with dcc-core-lib

We own **`@moonloch/dcc-core-lib`** (scoped npm name — the unscoped
`dcc-core-lib` is **not** published; never `npm install dcc-core-lib`).
The upstream library is at `/Users/timlwhite/WebstormProjects/dcc-core-lib`,
GitHub repo `moonloch/dcc-core-lib`, vendored into this repo at
`module/vendor/dcc-core-lib/`. When the doc/branch/path uses the bare
`dcc-core-lib` token (branch `refactor/dcc-core-lib-adapter`, vendor
directory, repo identifier), it's referring to one of those local
identifiers — the npm package is always the scoped form.

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

- **Auto-commit refactor slices on `refactor/dcc-core-lib-adapter`;
  push per batch.** When a Phase-N session-M slice is complete (code +
  Vitest + docs, Vitest green), **commit** it locally without asking.
  Commit-message format matches the established history on this branch:
  `feat(adapter): Phase <N> session <M> — <short slice description>`
  (optionally followed by a second `docs(adapter): refresh session-start
  prompt for Phase <N> session <M>` commit if `docs/01-session-start.md`
  was updated). **Push is gated on the full E2E suite** (see the batch
  cadence in *Refactor-slice testing requirements* below): commit each
  slice in a batch locally, run the full Playwright suite once at the
  batch end, and only `git push origin refactor/dcc-core-lib-adapter`
  once that run is green. Still pause and ask if: Vitest is failing,
  the batch E2E goes red and the cause isn't a one-commit `git revert`,
  `git status` shows unexpected untracked files, the pre-commit hook
  rewrites code in ways that should be reviewed, or a slice is
  incomplete.

## Refactor-slice testing requirements

Apply to every slice on `refactor/dcc-core-lib-adapter`. These are
preconditions for the auto-commit/push authorization above — if any
fail, don't push.

- **Batch cadence (adopted 2026-06-08).** The full Playwright suite
  takes ~6–12 min, so it no longer runs after every slice. Instead:
  run the **fast Vitest suite (`npm test`, ~3 s) after every slice** —
  that is the primary regression net for behaviour-neutral extractions
  — commit each slice locally, then run the **full E2E suite once at
  the end of the batch** and push only when it is green. This amortizes
  the slow E2E across several slices. Because each slice ships its own
  slice-specific E2E probe (next bullet) and is its own commit, a red
  batch E2E points at the culprit probe and is recoverable with a
  single-commit `git revert`. **Prefer fewer, larger, cohesive slices
  per batch** (e.g. `actor.js` mixin extractions) over many trivial
  ones — that is the better way to amortize the E2E cost.
- **Run the FULL browser-tests/e2e Playwright suite once per batch.**
  Not just `adapter-dispatch.spec.js` — also `active-effects.spec.js`,
  `sheet-ui.spec.js`, `data-models.spec.js`, and every other spec in
  `browser-tests/e2e/`.
  Launch via the standard recipe in
  `docs/dev/TESTING.md#browser-tests-playwright` (Node 24, fvtt CLI
  `installPath=foundry-14` + `dataPath=/Users/timlwhite/FoundryVTT-Next`,
  `--world=v14`), then `cd browser-tests/e2e && npm test` (no spec
  filter). Report any failure, even if apparently unrelated to the
  slice — pre-existing flakes are worth flagging and pin-pointing,
  not ignoring.
- **Extend the browser tests each slice.** Every slice must add
  at least one new browser-test assertion exercising the new
  behavior end-to-end against live Foundry (so a batch E2E failure
  localizes to the slice whose probe went red). For dispatch changes,
  extend `adapter-dispatch.spec.js` with the new branch. For
  data / sheet / chat-template changes, add cases to the appropriate
  spec (`active-effects.spec.js`, `sheet-ui.spec.js`,
  `data-models.spec.js`, or a new spec file if the surface area
  warrants one). The adapter-dispatch
  test count has climbed with each session (26 at Phase 3 session 2
  close → 33 at session 6 close); that trajectory is expected and
  intentional — the suite IS the regression net for the refactor.

## Documentation

### Developer Guides
- [Architecture](docs/dev/ARCHITECTURE.md) - System structure, classes, data model
- [Architecture (reimagined)](docs/dev/ARCHITECTURE_REIMAGINED.md) - 7-phase refactor plan + pain points
- [Class Decomposition](docs/dev/CLASS_DECOMPOSITION.md) - Per-class component map (schema mixin / sheet part / defaults / starting items / lib progression / variant) — read before relocating any class-bound concern
- [Extension API](docs/dev/EXTENSION_API.md) - Stable / internal / dead extension surface
- [Development](docs/dev/DEVELOPMENT.md) - Workflow, commands, code standards
- [Testing](docs/dev/TESTING.md) - Test suite, mocks, coverage
- [Pack Management](docs/dev/PACKS.md) - Compendium JSON/LevelDB workflow
- [Internationalization](docs/dev/I18N.md) - Translation system

### Reference Docs
- [V14](docs/dev/V14.md) - V14 reference: data models, Active Effects V2, API changes
- [V13](docs/dev/V13.md) - ApplicationV2 patterns reference
- [Test Coverage](docs/dev/TEST_COVERAGE.md) - Detailed testing strategy
- [Release Process](docs/dev/RELEASE_PROCESS.md) - How to release
- [Pre-Release Process](docs/dev/PRERELEASE_PROCESS.md) - Foundry-installable test builds off a feature branch (manual, off-`main`)

### User Guides
- [Active Effects](docs/user-guide/Active-Effects.md) - Using effects, attribute keys
- See `docs/user-guide/` for full end-user documentation
