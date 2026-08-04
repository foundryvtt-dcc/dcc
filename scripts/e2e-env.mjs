#!/usr/bin/env node
/**
 * Isolated per-worktree Foundry environment for parallel development (#893).
 *
 * Builds a self-contained, gitignored .foundry-server/ dir inside this
 * checkout/worktree: its own Config/ (unique port), a Data/ where the system
 * is symlinked entry-by-entry to this checkout (code served live) but modules
 * and the test world are copies (LevelDB pack locks forbid sharing them),
 * then launches Foundry's main.js directly against it. N worktrees = N
 * servers on N ports, each with its own world, GM slot, packs and settings.
 *
 * Usage:
 *   npm run e2e:env up        Bootstrap (idempotent) + launch + wait ready
 *   npm run e2e:env status    Port/pid/health for this worktree's server
 *   npm run e2e:env reset     Fresh world copy + re-applied settings
 *   npm run e2e:env down      Stop the server, keep .foundry-server/
 *   npm run e2e:env destroy   Stop + remove .foundry-server/
 *   npm run e2e:env test [-- <playwright args>]   up + run e2e against it
 *
 * The environment (world, module set, forced world settings) is declared in
 * browser-tests/e2e/test-environment.json.
 *
 * Port: DCC_E2E_PORT env var, else 30000 + <issue#> parsed from the branch
 * name (feat/893-foo -> 30893), else first free port from 30001. Never 30000 —
 * that stays the live install's port.
 *
 * Full-suite `test` runs take a machine-wide lock (~/.dcc-e2e.lock) so only
 * one full Playwright suite runs at a time — the suite has load-sensitive
 * specs that flake when the machine is busy. Single-spec runs skip the lock.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { createRequire } from 'node:module'
import { spawn, execSync, spawnSync } from 'node:child_process'

// DCC_E2E_ROOT lets scripts/work.mjs run this script against a worktree whose
// branch predates it (branched from a main without e2e-env yet).
const PROJECT_ROOT = process.env.DCC_E2E_ROOT
  ? path.resolve(process.env.DCC_E2E_ROOT)
  : path.resolve(import.meta.dirname, '..')
const SERVER_DIR = path.join(PROJECT_ROOT, '.foundry-server')
const SERVER_STATE = path.join(SERVER_DIR, 'server.json')
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'browser-tests', 'e2e', 'test-environment.json')
const E2E_DIR = path.join(PROJECT_ROOT, 'browser-tests', 'e2e')
const E2E_LOCK = path.join(os.homedir(), '.dcc-e2e.lock')
const READY_TIMEOUT_MS = 120000

// Same install search list as scripts/setup-foundry-dev.js
const FOUNDRY_INSTALL_PATHS = [
  process.env.FOUNDRY_PATH,
  path.join(os.homedir(), 'Applications', 'foundry-14'),
  path.join(os.homedir(), 'Applications', 'foundry-13'),
  path.join(os.homedir(), 'Applications', 'foundryvtt'),
  '/Applications/FoundryVTT',
  path.join(os.homedir(), 'foundryvtt'),
  path.join(os.homedir(), '.local', 'share', 'FoundryVTT'),
  '/opt/foundryvtt'
].filter(Boolean)

// Fallbacks when the userdata root can't be derived from the main checkout
const USERDATA_PATHS = [
  process.env.DCC_FOUNDRY_USERDATA,
  path.join(os.homedir(), 'FoundryVTT-Next'),
  path.join(os.homedir(), 'FoundryVTT'),
  path.join(os.homedir(), 'Library', 'Application Support', 'FoundryVTT'),
  path.join(os.homedir(), '.local', 'share', 'FoundryVTT')
].filter(Boolean)

function fail (message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function loadManifest () {
  // Fallback covers a DCC_E2E_ROOT worktree whose branch predates the manifest
  const fallback = path.join(path.resolve(import.meta.dirname, '..'), 'browser-tests', 'e2e', 'test-environment.json')
  for (const p of [MANIFEST_PATH, fallback]) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  }
  fail(`Missing environment manifest: ${MANIFEST_PATH}`)
}

// ============================================================================
// Path resolution
// ============================================================================

function findFoundryInstall () {
  for (const installPath of FOUNDRY_INSTALL_PATHS) {
    const pkgPath = path.join(installPath, 'package.json')
    if (!fs.existsSync(pkgPath)) continue
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const main = path.join(installPath, pkg.main || 'main.js')
    if (fs.existsSync(main)) return { installPath, main, build: pkg.release?.build }
  }
  fail('Could not find a Foundry VTT installation. Set FOUNDRY_PATH.')
}

/**
 * The live Foundry userdata root (the dir holding Config/ + Data/) supplies
 * the license, the module copies and the world template. In the normal layout
 * the main checkout of this repo *is* <userdata>/Data/systems/dcc, and from
 * any worktree the git common dir still points at the main checkout — so the
 * userdata root can be derived no matter where the worktree lives.
 */
function findUserdataRoot () {
  if (process.env.DCC_FOUNDRY_USERDATA) {
    const p = process.env.DCC_FOUNDRY_USERDATA
    if (fs.existsSync(path.join(p, 'Data'))) return p
    fail(`DCC_FOUNDRY_USERDATA=${p} has no Data/ directory`)
  }
  try {
    const commonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
      cwd: PROJECT_ROOT, encoding: 'utf-8'
    }).trim()
    const mainCheckout = path.dirname(commonDir)
    const candidate = path.resolve(mainCheckout, '..', '..', '..')
    if (fs.existsSync(path.join(candidate, 'Config', 'options.json')) &&
        fs.existsSync(path.join(candidate, 'Data'))) {
      return candidate
    }
  } catch { /* not a git checkout of the live system — fall through */ }
  for (const p of USERDATA_PATHS) {
    if (fs.existsSync(path.join(p, 'Config', 'options.json'))) return p
  }
  fail('Could not locate the live Foundry userdata root (Config/ + Data/). Set DCC_FOUNDRY_USERDATA.')
}

// ============================================================================
// Port selection
// ============================================================================

function issueNumberFromBranch () {
  try {
    const branch = execSync('git branch --show-current', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim()
    const match = branch.match(/(?:^|\/)(\d{2,5})-/)
    if (match) return parseInt(match[1], 10)
  } catch { /* detached head etc. */ }
  return null
}

function portIsFree (port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

async function choosePort () {
  if (process.env.DCC_E2E_PORT) {
    const port = Number(process.env.DCC_E2E_PORT)
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 30000) {
      fail(`DCC_E2E_PORT=${process.env.DCC_E2E_PORT} — must be an integer in 1024-65535 and not 30000 (the live install's port)`)
    }
    return port
  }
  const issue = issueNumberFromBranch()
  if (issue && issue + 30000 <= 65535) return 30000 + issue
  for (let port = 30001; port < 30100; port++) {
    if (await portIsFree(port)) return port
  }
  fail('No free port found in 30001-30099')
}

// ============================================================================
// State file + process helpers
// ============================================================================

function readState () {
  if (!fs.existsSync(SERVER_STATE)) return null
  try {
    return JSON.parse(fs.readFileSync(SERVER_STATE, 'utf-8'))
  } catch {
    return null
  }
}

function pidAlive (pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * server.json outlives reboots, and a recycled pid may now belong to an
 * unrelated process — never signal a pid without confirming its command line
 * still references this env's server dir.
 */
function isOwnServer (pid) {
  if (!pidAlive(pid)) return false
  try {
    const cmd = execSync(`ps -o command= -p ${pid}`, { encoding: 'utf-8' })
    return cmd.includes(SERVER_DIR)
  } catch {
    return false
  }
}

async function stopServer (state, { quiet = false } = {}) {
  if (!state?.pid) return false
  if (!isOwnServer(state.pid)) {
    if (pidAlive(state.pid)) {
      fs.writeFileSync(SERVER_STATE, JSON.stringify({ ...state, pid: null }, null, 2) + '\n')
    }
    return false
  }
  process.kill(state.pid, 'SIGTERM')
  for (let i = 0; i < 20 && pidAlive(state.pid); i++) {
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  if (pidAlive(state.pid)) process.kill(state.pid, 'SIGKILL')
  if (!quiet) console.log(`Stopped Foundry (pid ${state.pid})`)
  fs.writeFileSync(SERVER_STATE, JSON.stringify({ ...state, pid: null }, null, 2) + '\n')
  return true
}

// ============================================================================
// Bootstrap: Config, Data copies, world settings, npm deps
// ============================================================================

/** Copy-on-write copy where the filesystem supports it (APFS clonefile). */
function cloneCopy (src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (process.platform === 'darwin') {
    const result = spawnSync('cp', ['-Rc', src, dest], { stdio: 'pipe' })
    if (result.status === 0) return
  }
  fs.cpSync(src, dest, { recursive: true })
}

function writeOptions (port, world) {
  const optionsPath = path.join(SERVER_DIR, 'Config', 'options.json')
  fs.mkdirSync(path.dirname(optionsPath), { recursive: true })
  fs.writeFileSync(optionsPath, JSON.stringify({
    port,
    upnp: false,
    telemetry: false,
    hotReload: false,
    compressStatic: true,
    language: 'en.core',
    world
  }, null, 2) + '\n')
}

function copyLicense (userdataRoot) {
  const src = path.join(userdataRoot, 'Config', 'license.json')
  const dest = path.join(SERVER_DIR, 'Config', 'license.json')
  if (fs.existsSync(dest)) return
  if (!fs.existsSync(src)) {
    console.warn(`Warning: no license.json at ${src} — Foundry will ask for a license key on first boot`)
    return
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

/**
 * Expose this checkout as Data/systems/dcc via a shadow dir of per-entry
 * symlinks rather than one symlink to the checkout root — the root contains
 * .foundry-server/ itself, and a whole-dir symlink creates a cycle that
 * recursive tools (standard's glob, IDE indexers, find) follow until they
 * die. Entries Foundry never serves are skipped. Re-synced on every `up`,
 * so a new top-level file only needs an `up` to appear.
 */
function linkSystem () {
  const systemDir = path.join(SERVER_DIR, 'Data', 'systems', 'dcc')
  if (fs.lstatSync(systemDir, { throwIfNoEntry: false })?.isSymbolicLink()) {
    fs.rmSync(systemDir)
  }
  fs.mkdirSync(systemDir, { recursive: true })
  // packs/ is copied below, not symlinked: when this script runs from the
  // main checkout the live server on 30000 has these pack LevelDBs open, and
  // two servers cannot share them (LOCK contention).
  const exclude = new Set(['.foundry-server', '.git', '.claude', '.idea', '.foundry-dev', 'node_modules', 'browser-tests', 'packs'])
  const wanted = fs.readdirSync(PROJECT_ROOT).filter(name => !exclude.has(name))
  for (const existing of fs.readdirSync(systemDir)) {
    if (existing !== 'packs' && !wanted.includes(existing)) {
      fs.rmSync(path.join(systemDir, existing), { recursive: true, force: true })
    }
  }
  for (const name of wanted) {
    const link = path.join(systemDir, name)
    if (!fs.lstatSync(link, { throwIfNoEntry: false })) {
      fs.symlinkSync(path.join(PROJECT_ROOT, name), link)
    }
  }
  // Refresh the pack copy on every up (cheap: APFS clone) so a todb rerun in
  // the checkout reaches the env after a restart.
  const packsDest = path.join(systemDir, 'packs')
  fs.rmSync(packsDest, { recursive: true, force: true })
  const packsSrc = path.join(PROJECT_ROOT, 'packs')
  if (fs.existsSync(packsSrc)) cloneCopy(packsSrc, packsDest)
}

function copyModules (manifest, userdataRoot) {
  const sourceDir = process.env.DCC_MODULE_SOURCE || path.join(userdataRoot, 'Data', 'modules')
  const modulesDir = path.join(SERVER_DIR, 'Data', 'modules')
  fs.mkdirSync(modulesDir, { recursive: true })
  for (const name of manifest.modules || []) {
    const dest = path.join(modulesDir, name)
    if (fs.existsSync(dest)) continue
    const src = path.join(sourceDir, name)
    if (!fs.existsSync(src)) fail(`Module "${name}" not found at ${src}`)
    console.log(`  Copying module ${name}...`)
    cloneCopy(src, dest)
  }
}

function copyWorld (manifest, userdataRoot, { force = false } = {}) {
  const world = manifest.world
  const dest = path.join(SERVER_DIR, 'Data', 'worlds', world)
  if (fs.existsSync(dest)) {
    if (!force) return false
    fs.rmSync(dest, { recursive: true, force: true })
  }
  const src = path.join(userdataRoot, 'Data', 'worlds', world)
  if (!fs.existsSync(src)) fail(`World "${world}" not found at ${src}`)
  console.log(`  Copying world ${world}...`)
  cloneCopy(src, dest)
  return true
}

/**
 * Force the manifest's world settings into the copied world's settings db —
 * e.g. dcc-qol must be inactive for the combat specs. Values that are plain
 * objects are shallow-merged into the existing setting (so a
 * core.moduleConfiguration override only touches the modules it names);
 * anything else replaces it.
 */
async function applyWorldSettings (manifest) {
  const settings = manifest.settings || {}
  if (Object.keys(settings).length === 0) return
  const require = createRequire(path.join(PROJECT_ROOT, 'package.json'))
  const { ClassicLevel } = require('classic-level')
  const dbPath = path.join(SERVER_DIR, 'Data', 'worlds', manifest.world, 'data', 'settings')
  const db = new ClassicLevel(dbPath, { keyEncoding: 'utf8', valueEncoding: 'utf8' })
  try {
    const entries = []
    for await (const [key, value] of db.iterator()) entries.push([key, value])
    for (const [name, override] of Object.entries(settings)) {
      const existing = entries.find(([, value]) => {
        try { return JSON.parse(value).key === name } catch { return false }
      })
      let doc
      let dbKey
      if (existing) {
        dbKey = existing[0]
        doc = JSON.parse(existing[1])
      } else {
        const id = Array.from({ length: 16 }, () =>
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
        ).join('')
        dbKey = `!settings!${id}`
        doc = { _id: id, key: name, value: '{}' }
      }
      // Setting values are stored JSON-encoded; merge plain objects, else replace
      const current = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value
      const isMergeable = current && typeof current === 'object' && !Array.isArray(current) &&
        override && typeof override === 'object' && !Array.isArray(override)
      const next = isMergeable ? { ...current, ...override } : override
      doc.value = JSON.stringify(next)
      await db.put(dbKey, JSON.stringify(doc))
      console.log(`  Set world setting ${name}`)
    }
  } finally {
    await db.close()
  }
}

/**
 * Copying a LevelDB the live server is actively writing is not an atomic
 * snapshot — a mid-compaction copy can reference missing .ldb files. Can't
 * detect writes, but can warn when a live server is even running.
 */
async function warnIfLiveServerRunning () {
  try {
    await fetch('http://localhost:30000/', { signal: AbortSignal.timeout(1500) })
    console.warn('Warning: a Foundry server is running on port 30000 — if it is actively writing the source world/modules, the copies made now could be torn. Prefer bootstrapping while it is idle or stopped.')
  } catch { /* not running — the good case */ }
}

/** Fresh worktrees lack every gitignored build artifact — install and compile them. */
function ensureBuildArtifacts () {
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'))) {
    console.log('  Installing root dependencies (npm install)...')
    execSync('npm install --no-audit --no-fund', { cwd: PROJECT_ROOT, stdio: 'inherit' })
  }
  const packsCompiled = fs.existsSync(path.join(PROJECT_ROOT, 'packs', 'dcc-macros', 'CURRENT'))
  if (!packsCompiled) {
    console.log('  Compiling system packs (npm run todb)...')
    execSync('npm run todb', { cwd: PROJECT_ROOT, stdio: 'inherit' })
  }
  if (!fs.existsSync(path.join(E2E_DIR, 'node_modules'))) {
    console.log('  Installing e2e dependencies (npm ci)...')
    execSync('npm ci --no-audit --no-fund', { cwd: E2E_DIR, stdio: 'inherit' })
  }
  // Idempotent + fast when the machine cache already has this Playwright
  // version's browsers; a fresh worktree may pin a newer revision than the
  // main checkout ever downloaded.
  execSync('npx playwright install chromium chromium-headless-shell', { cwd: E2E_DIR, stdio: 'inherit' })
}

// ============================================================================
// Launch + readiness
// ============================================================================

function launchFoundry (install, port, world) {
  const logsDir = path.join(SERVER_DIR, 'logs')
  fs.mkdirSync(logsDir, { recursive: true })
  const logFd = fs.openSync(path.join(logsDir, 'foundry.log'), 'a')
  const child = spawn(process.execPath, [
    install.main,
    `--dataPath=${SERVER_DIR}`,
    `--port=${port}`,
    `--world=${world}`,
    '--noupnp'
  ], { detached: true, stdio: ['ignore', logFd, logFd] })
  child.unref()
  fs.closeSync(logFd)
  const state = {
    pid: child.pid,
    port,
    url: `http://localhost:${port}`,
    world,
    foundryBuild: install.build,
    startedAt: new Date().toISOString()
  }
  fs.writeFileSync(SERVER_STATE, JSON.stringify(state, null, 2) + '\n')
  return state
}

async function probe (url) {
  try {
    const res = await fetch(`${url}/join`, { signal: AbortSignal.timeout(5000), redirect: 'follow' })
    if (!res.ok) return { state: 'error', detail: `HTTP ${res.status}` }
    const finalPath = new URL(res.url).pathname
    if (finalPath.startsWith('/join') || finalPath.startsWith('/game')) return { state: 'ready' }
    if (finalPath.startsWith('/license')) return { state: 'license' }
    if (finalPath.startsWith('/setup')) return { state: 'setup' }
    if (finalPath.startsWith('/auth')) return { state: 'auth' }
    return { state: 'unknown', detail: finalPath }
  } catch {
    return { state: 'down' }
  }
}

/**
 * A fresh Config can park the boot on the EULA screen even with a valid
 * license.json (the agreement signature is machine/state dependent). Accept
 * it the same way global-setup.js does — tick #eula-agree, click #sign —
 * using the e2e suite's own Playwright.
 */
async function acceptEula (url) {
  const require = createRequire(path.join(E2E_DIR, 'package.json'))
  const { chromium } = require('@playwright/test')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`${url}/license`, { waitUntil: 'domcontentloaded' })
    const eulaAgree = page.locator('#eula-agree')
    if (await eulaAgree.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eulaAgree.check()
      await page.locator('#sign').click()
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      return true
    }
    if (await page.locator('input[name="licenseKey"]').isVisible({ timeout: 1000 }).catch(() => false)) {
      fail(`Foundry at ${url}/license wants a license key — copy a valid Config/license.json into .foundry-server/Config/ (normally done automatically from the live install).`)
    }
    return false
  } finally {
    await browser.close()
  }
}

async function waitReady (state) {
  const started = Date.now()
  let eulaTried = false
  while (Date.now() - started < READY_TIMEOUT_MS) {
    if (!pidAlive(state.pid)) {
      fail(`Foundry exited during startup — see ${path.join(SERVER_DIR, 'logs', 'foundry.log')}`)
    }
    const { state: bootState, detail } = await probe(state.url)
    if (bootState === 'ready') return
    if (bootState === 'license') {
      if (!eulaTried) {
        eulaTried = true
        console.log('  License/EULA screen detected — accepting...')
        await acceptEula(state.url)
        continue
      }
      // Give the accepted EULA a beat to take effect, then fail fast instead
      // of spinning to the generic timeout.
      await new Promise(resolve => setTimeout(resolve, 3000))
      if ((await probe(state.url)).state === 'license') {
        fail(`Foundry is stuck on the license screen at ${state.url}/license after an EULA accept attempt — check .foundry-server/Config/license.json and the log at ${path.join(SERVER_DIR, 'logs', 'foundry.log')}`)
      }
      continue
    }
    if (bootState === 'setup') {
      fail(`Foundry booted to /setup instead of launching world "${state.world}" — check ${path.join(SERVER_DIR, 'logs', 'foundry.log')}`)
    }
    if (bootState === 'auth') fail('Foundry is asking for an admin password — remove it from the copied Config')
    if (bootState === 'error' || bootState === 'unknown') {
      console.log(`  Waiting (${bootState}${detail ? `: ${detail}` : ''})...`)
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  fail(`Foundry did not become ready within ${READY_TIMEOUT_MS / 1000}s — see ${path.join(SERVER_DIR, 'logs', 'foundry.log')}`)
}

// ============================================================================
// Machine-wide full-suite lock
// ============================================================================

async function acquireE2eLock () {
  for (;;) {
    try {
      fs.writeFileSync(E2E_LOCK, JSON.stringify({ pid: process.pid, cwd: PROJECT_ROOT }), { flag: 'wx' })
      return
    } catch { /* held — examine below */ }
    let raw = null
    try { raw = fs.readFileSync(E2E_LOCK, 'utf-8') } catch { continue } // vanished — retry wx
    let holder = null
    try { holder = JSON.parse(raw) } catch { /* corrupt */ }
    if (!holder || !pidAlive(holder.pid)) {
      // Stale. Remove only if unchanged since we read it, so a concurrent
      // waiter that already recreated the lock isn't clobbered.
      try {
        if (fs.readFileSync(E2E_LOCK, 'utf-8') === raw) fs.rmSync(E2E_LOCK, { force: true })
      } catch { /* already gone */ }
      continue
    }
    console.log(`Waiting for e2e lock (held by pid ${holder.pid}, ${holder.cwd})...`)
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}

function releaseE2eLock () {
  try {
    const holder = JSON.parse(fs.readFileSync(E2E_LOCK, 'utf-8'))
    if (holder.pid === process.pid) fs.rmSync(E2E_LOCK, { force: true })
  } catch { /* already gone */ }
}

// ============================================================================
// Commands
// ============================================================================

async function cmdUp () {
  const existing = readState()
  if (existing && isOwnServer(existing.pid)) {
    const { state } = await probe(existing.url)
    if (state === 'ready') {
      console.log(`Already running: ${existing.url} (world ${existing.world}, pid ${existing.pid})`)
      return existing
    }
    // Our own server, but stuck (license/setup/mid-boot/wedged) — replace it
    // rather than bootstrapping underneath it.
    console.log(`Existing server (pid ${existing.pid}) is ${state} — restarting it`)
    await stopServer(existing, { quiet: true })
  }
  const manifest = loadManifest()
  const install = findFoundryInstall()
  const userdataRoot = findUserdataRoot()
  const port = existing?.port ?? await choosePort()

  console.log(`Bootstrapping .foundry-server/ (Foundry build ${install.build}, port ${port})`)
  const needsCopies = !fs.existsSync(path.join(SERVER_DIR, 'Data', 'worlds', manifest.world)) ||
    (manifest.modules || []).some(m => !fs.existsSync(path.join(SERVER_DIR, 'Data', 'modules', m)))
  if (needsCopies) await warnIfLiveServerRunning()
  ensureBuildArtifacts()
  writeOptions(port, manifest.world)
  copyLicense(userdataRoot)
  linkSystem()
  copyModules(manifest, userdataRoot)
  copyWorld(manifest, userdataRoot)
  // Re-applied on every cold start so manifest settings edits take effect
  // without a full reset (the world db is closed here — server is down).
  await applyWorldSettings(manifest)

  if (!await portIsFree(port)) fail(`Port ${port} is in use by another process`)
  console.log('Launching Foundry...')
  const state = launchFoundry(install, port, manifest.world)
  await waitReady(state)
  console.log(`\nReady: ${state.url} (world ${state.world}, pid ${state.pid})`)
  return state
}

async function cmdStatus () {
  const state = readState()
  if (!state) {
    console.log('No environment. Run: npm run e2e:env up')
    return
  }
  const alive = isOwnServer(state.pid)
  const { state: bootState } = alive ? await probe(state.url) : { state: 'down' }
  console.log(`URL:     ${state.url}`)
  console.log(`World:   ${state.world}`)
  console.log(`PID:     ${state.pid ?? '-'} (${alive ? 'running' : 'not running'})`)
  console.log(`Health:  ${bootState}`)
  console.log(`Build:   ${state.foundryBuild}`)
  console.log(`Logs:    ${path.join(SERVER_DIR, 'logs', 'foundry.log')}`)
  if (!alive && state.pid) {
    fs.writeFileSync(SERVER_STATE, JSON.stringify({ ...state, pid: null }, null, 2) + '\n')
  }
}

async function cmdDown () {
  const stopped = await stopServer(readState())
  if (!stopped) console.log('Not running.')
}

async function cmdDestroy () {
  await stopServer(readState(), { quiet: true })
  fs.rmSync(SERVER_DIR, { recursive: true, force: true })
  console.log('Removed .foundry-server/')
}

async function cmdReset () {
  const state = readState()
  const wasRunning = await stopServer(state, { quiet: true })
  const manifest = loadManifest()
  const userdataRoot = findUserdataRoot()
  copyWorld(manifest, userdataRoot, { force: true })
  await applyWorldSettings(manifest)
  console.log(`World ${manifest.world} reset to a fresh copy.`)
  if (wasRunning) await cmdUp()
}

async function cmdTest (args) {
  const state = await cmdUp()
  const isFullSuite = !args.some(a => a.includes('.spec.'))
  if (isFullSuite) {
    await acquireE2eLock()
    process.on('exit', releaseE2eLock)
    // 'exit' doesn't run on signal death — release explicitly on Ctrl-C etc.
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => {
        releaseE2eLock()
        process.exit(130)
      })
    }
  }
  try {
    const result = spawnSync('npx', ['playwright', 'test', ...args], {
      cwd: E2E_DIR,
      stdio: 'inherit',
      env: { ...process.env, FOUNDRY_URL: state.url }
    })
    process.exitCode = result.status ?? 1
  } finally {
    if (isFullSuite) releaseE2eLock()
  }
}

// ============================================================================
// Main
// ============================================================================

const [command, ...rest] = process.argv.slice(2)
switch (command) {
  case 'up': await cmdUp(); break
  case 'status': await cmdStatus(); break
  case 'down': await cmdDown(); break
  case 'destroy': await cmdDestroy(); break
  case 'reset': await cmdReset(); break
  case 'test': await cmdTest(rest); break
  default:
    console.log('Usage: npm run e2e:env <up|status|reset|down|destroy|test> [-- <playwright args>]')
    process.exit(command ? 1 : 0)
}
