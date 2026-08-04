---
name: sync-core-lib
description: Sync the vendored dcc-core-lib copy after a lib fix merges upstream, then clean up temporary adapter workarounds. Use after a moonloch/dcc-core-lib PR lands, or when asked to update module/vendor/dcc-core-lib.
---

# Vendor sync for dcc-core-lib

The lib's compiled output lives at `module/vendor/dcc-core-lib/` and is
committed to the system repo (Foundry has no bundler). The upstream
checkout is at `/Users/timlwhite/WebstormProjects/dcc-core-lib`
(GitHub repo `moonloch/dcc-core-lib`).

## Sync procedure

1. After the lib PR merges, pull `main` in the lib checkout.
2. From the system repo, run `pnpm run sync-core-lib`. The script
   (`scripts/sync-core-lib.mjs`) builds the lib via `pnpm run build`,
   copies `dist/` into the vendor directory, and writes
   `module/vendor/dcc-core-lib/VERSION.json` with the source commit
   SHA + timestamp.
   - Override the source path with
     `DCC_CORE_LIB_SRC=/path/to/dcc-core-lib pnpm run sync-core-lib`.
3. Commit the resulting vendor diff with a message like
   `vendor: sync dcc-core-lib to <version> (<sha7>)`.

## Adapter cleanup follows the sync

Once the new vendor copy is in place, remove any temporary adapter
workaround added while the lib fix was in flight, and update tests
that were asserting the workaround's compensated values back to the
natural contract.
