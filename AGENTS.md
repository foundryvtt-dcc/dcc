# AGENTS.md

Instructions for AI coding agents working in this repository live in
[CLAUDE.md](CLAUDE.md). Read it first — it applies to every agent, not just
Claude Code. Contributed PRs are merged as submitted, so also read
[CONTRIBUTING.md](CONTRIBUTING.md). The rules that matter most:

- FoundryVTT v14 only (ApplicationV2); all user-facing text through
  `game.i18n.localize()`, with new keys translated in every `lang/*.json`.
- Rules automation follows [docs/dev/RULES_AUTOMATION.md](docs/dev/RULES_AUTOMATION.md).
- Roll/check/combat bugs that live in `@moonloch/dcc-core-lib` get fixed in
  the lib, not compensated for in this repo.
- Update tests that your change makes stale, and keep new tests
  proportionate — see [Keep tests proportionate](docs/dev/TESTING.md#keep-tests-proportionate).
- Don't bump `version.txt` in a PR.
- One issue per PR, up to date with `main`; open PRs that touch the same
  files must be combined or stacked so each merges cleanly.
