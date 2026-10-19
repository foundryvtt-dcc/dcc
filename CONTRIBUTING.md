# Contributing to the DCC system for FoundryVTT

Thanks for helping. Bug reports with a verified root cause and focused fix
PRs are very welcome.

## PRs are merged as submitted

The maintainer reviews a PR and then either **merges it as-is** or **asks
for changes**. We do not cherry-pick fixes out of PRs, trim their tests, or
resolve their conflicts on your behalf. A PR is ready to merge when:

- it fixes one issue (or adds one feature), and nothing else;
- `pnpm run check` passes (format, unit + integration tests, translation
  coverage);
- the tests follow
  [Keep tests proportionate](docs/dev/TESTING.md#keep-tests-proportionate);
- it is up to date with `main` and merges without conflicts;
- the PR description says what changed, why, and how you tested it.

If a review asks for changes, push them to the same branch and reply on the
PR.

## Before you open a PR

- **Read [CLAUDE.md](CLAUDE.md).** It is the working guide for everyone, not
  just AI agents. The [developer docs](docs/dev/) cover architecture,
  testing, packs and i18n.
- **FoundryVTT v14 only**, ApplicationV2 APIs.
- **All user-facing text goes through `game.i18n`.** Add new keys to
  `lang/en.json` and translate them in every other `lang/*.json`
  (`pnpm run compare-lang` checks coverage).
- **Rules logic belongs in
  [dcc-core-lib](https://github.com/moonloch/dcc-core-lib).** If a roll,
  check or combat bug is in the lib, fix it there (see its CONTRIBUTING.md),
  not with a workaround in this repo's adapter.
- **Automating a rule?** Follow
  [docs/dev/RULES_AUTOMATION.md](docs/dev/RULES_AUTOMATION.md).
- **Don't bump `version.txt`.** Versions are bumped on `main` at release
  time.
- **Check the sibling modules** (xcc, mcc-classes, dcc-crawl-classes) if you
  change anything they extend: sheets, data models, roll entry points, the
  [extension API](docs/dev/EXTENSION_API.md).

## Tests

Every behavior change updates the tests that assert the old behavior, unit
and `browser-tests/e2e/` alike. New coverage should be one regression test
that fails before the fix and passes after, at the cheapest layer that can
see the bug. Add a Playwright E2E case only when the bug needs a live
Foundry to show up, and extend an existing spec before building new setup.
See [docs/dev/TESTING.md](docs/dev/TESTING.md) for the full guidance and for
running E2E against an isolated Foundry server.

## Several PRs at once

Batches of small fixes are fine, as long as each one can merge on its own:

- **PRs that touch the same files must not conflict.** Either combine them
  into one PR or stack them (open the second against the first's branch and
  say so in the description). Two independent PRs that edit the same lines
  can't both merge as submitted.
- After one of your PRs merges, rebase the others onto `main` before asking
  for review again.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a
scope, matching the existing history, and reference the issue:

```
fix(item-sheet): remove the V1 data.data image fallback (#1043)
feat(party): gather and deploy party tokens (#911)
```

PRs are squash-merged, so the PR title becomes the commit message on `main`.

## AI and LLM-assisted contributions

AI coding assistants are welcome. The maintainers use them too. The
[AI section of dcc-core-lib's CONTRIBUTING.md](https://github.com/moonloch/dcc-core-lib/blob/main/CONTRIBUTING.md#ai-and-llm-assisted-contributions)
applies here as well. In short:

- **You are the author.** Review every line, run the checks yourself, and be
  able to explain the change in review.
- **Check that tests test something.** Revert the fix locally and confirm
  the regression test fails.
- **Keep the change focused.** Drop unrelated refactors, renames and comment
  churn, and keep generated tests in proportion (see above).
- **Disclose substantial AI use** in the PR description.
- **No rulebook text.** Don't ask a model to recall DCC RPG tables or rules
  text, and rewrite generated prose that reads like the book.
- **No unattended bots.** Automated or bulk PRs (hardening sweeps, lint or
  typo passes across the codebase) will be closed. Open an issue first.

## Reporting bugs

Open an issue with steps to reproduce, the expected and actual result, and
your Foundry and system versions. A verified root cause (file and line) is a
big help. Rules-logic bugs that live in the lib can go to
[dcc-core-lib](https://github.com/moonloch/dcc-core-lib/issues).
