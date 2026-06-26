#!/usr/bin/env node
// Sync @moonloch/dcc-core-lib's built dist/ into module/vendor/dcc-core-lib/.
// Foundry loads system files directly (no bundler), so we vendor the lib's
// compiled ESM output and commit it. See the "Working with dcc-core-lib"
// section of CLAUDE.md for the vendor-sync workflow.
//
// Source of truth defaults to the co-evolving checkout at
// /Users/timlwhite/WebstormProjects/dcc-core-lib. Override with
// DCC_CORE_LIB_SRC=/path/to/dcc-core-lib npm run sync-core-lib.

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SYSTEM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB_SRC = process.env.DCC_CORE_LIB_SRC ?? '/Users/timlwhite/WebstormProjects/dcc-core-lib'
const VENDOR_DEST = resolve(SYSTEM_ROOT, 'module/vendor/dcc-core-lib')

function fail (msg) {
  console.error(`sync-core-lib: ${msg}`)
  process.exit(1)
}

// Foundry loads the vendored files directly and never reads source maps; the
// lib's published `.map` files point at original `.ts` sources we don't vendor,
// so Vitest logs a "Sourcemap points to missing source files" warning for every
// transformed module. Drop the `.map` files and strip the trailing
// `//# sourceMappingURL=` comments so vendored output stays self-contained and
// the test log stays clean. Returns the count of files touched.
function stripSourcemaps (dir) {
  let removedMaps = 0
  let strippedComments = 0
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = resolve(current, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (entry.endsWith('.map')) {
        rmSync(full)
        removedMaps++
      } else if (entry.endsWith('.js') || entry.endsWith('.d.ts')) {
        const original = readFileSync(full, 'utf8')
        const stripped = original.replace(/\n?\/\/# sourceMappingURL=.*\n?/g, '\n')
        if (stripped !== original) {
          writeFileSync(full, stripped)
          strippedComments++
        }
      }
    }
  }
  walk(dir)
  return { removedMaps, strippedComments }
}

if (!existsSync(LIB_SRC)) fail(`lib source not found at ${LIB_SRC}`)
if (!existsSync(resolve(LIB_SRC, 'package.json'))) fail(`no package.json at ${LIB_SRC}`)

const pkg = JSON.parse(readFileSync(resolve(LIB_SRC, 'package.json'), 'utf8'))
if (pkg.name !== '@moonloch/dcc-core-lib') {
  fail(`expected @moonloch/dcc-core-lib at ${LIB_SRC}, found ${pkg.name}`)
}

console.log(`sync-core-lib: building ${pkg.name}@${pkg.version} at ${LIB_SRC}`)
execSync('npm run build', { cwd: LIB_SRC, stdio: 'inherit' })

const dist = resolve(LIB_SRC, 'dist')
if (!existsSync(dist)) fail(`build produced no dist/ at ${dist}`)

console.log(`sync-core-lib: copying dist/ → ${VENDOR_DEST}`)
rmSync(VENDOR_DEST, { recursive: true, force: true })
mkdirSync(VENDOR_DEST, { recursive: true })
cpSync(dist, VENDOR_DEST, { recursive: true })

const { removedMaps, strippedComments } = stripSourcemaps(VENDOR_DEST)
console.log(`sync-core-lib: stripped sourcemaps (${removedMaps} .map removed, ${strippedComments} files de-referenced)`)

const commit = execSync('git rev-parse HEAD', { cwd: LIB_SRC }).toString().trim()
const dirty = execSync('git status --porcelain', { cwd: LIB_SRC }).toString().trim().length > 0
const version = {
  name: pkg.name,
  version: pkg.version,
  commit,
  dirty,
  syncedAt: new Date().toISOString()
}
writeFileSync(resolve(VENDOR_DEST, 'VERSION.json'), JSON.stringify(version, null, 2) + '\n')

const shortSha = commit.slice(0, 7)
const dirtyTag = dirty ? ' +dirty' : ''
console.log(`sync-core-lib: synced ${pkg.name}@${pkg.version} (${shortSha}${dirtyTag})`)
