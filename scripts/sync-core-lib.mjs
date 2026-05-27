#!/usr/bin/env node
// Sync @moonloch/dcc-core-lib's built dist/ into module/vendor/dcc-core-lib/.
// Foundry loads system files directly (no bundler), so we vendor the lib's
// compiled ESM output and commit it. See docs/dev/ARCHITECTURE_REIMAGINED.md.
//
// Source of truth defaults to the co-evolving checkout at
// /Users/timwhite/WebstormProjects/dcc-core-lib. Override with
// DCC_CORE_LIB_SRC=/path/to/dcc-core-lib npm run sync-core-lib.

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SYSTEM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB_SRC = process.env.DCC_CORE_LIB_SRC ?? '/Users/timwhite/WebstormProjects/dcc-core-lib'
const VENDOR_DEST = resolve(SYSTEM_ROOT, 'module/vendor/dcc-core-lib')

function fail (msg) {
  console.error(`sync-core-lib: ${msg}`)
  process.exit(1)
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
