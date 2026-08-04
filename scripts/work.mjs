#!/usr/bin/env node
/**
 * Parallel-issue workflow orchestrator (#893) — one command from a GitHub
 * issue to a working Claude Code session in its own worktree with its own
 * isolated Foundry server (see scripts/e2e-env.mjs).
 *
 * Usage:
 *   npm run work:start -- <issue#> [--branch <name>] [--modules a,b] [--no-claude]
 *   npm run work:list
 *   npm run work:sync -- <issue#> | --all
 *   npm run work:finish -- <issue#> [--force]
 *
 * work:start
 *   Fetches the issue, derives a branch (fix/<n>-<slug> for bugs, else
 *   feat/<n>-<slug>), creates a worktree OUTSIDE the live Foundry Data dir
 *   (a checkout at Data/systems/<anything> would be scanned by the live
 *   server as a duplicate "dcc" system), copies .claude/settings.local.json
 *   so the session keeps its permission allowlist, claims the issue
 *   (assignee + in-progress label), boots the isolated Foundry env, and
 *   launches `claude` in the worktree with an issue-specific prompt.
 *
 * work:sync
 *   After a PR merges to main, every other active branch should absorb it:
 *   stops the env's server (todb must not run against open packs), merges
 *   origin/main, recompiles scss + packs, and restarts the server if it was
 *   running. Merge conflicts abort with the worktree left mid-merge for a
 *   human (or the worktree's Claude session) to resolve.
 *
 * work:finish
 *   Teardown once the PR is merged: destroys .foundry-server/, removes the
 *   worktree and local branch, and drops the in-progress label. Refuses if
 *   the worktree is dirty or the PR is unmerged (override with --force).
 *
 * Worktree location: $DCC_WORK_DIR, default ~/FoundryVTT-Work.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync, execFileSync, spawnSync } from 'node:child_process'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const WORK_DIR = process.env.DCC_WORK_DIR || path.join(os.homedir(), 'FoundryVTT-Work')

function fail (message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function git (args, opts = {}) {
  const out = execFileSync('git', args, { cwd: opts.cwd || PROJECT_ROOT, encoding: 'utf-8', ...opts })
  return typeof out === 'string' ? out.trim() : '' // stdio:'inherit' yields null
}

function gh (args, opts = {}) {
  return execFileSync('gh', args, { cwd: PROJECT_ROOT, encoding: 'utf-8', ...opts }).trim()
}

/**
 * Run an e2e-env subcommand against a worktree. Uses the worktree's own copy
 * of the script when it has one; a branch cut from a main that predates
 * e2e-env falls back to this checkout's copy, pointed at the worktree via
 * DCC_E2E_ROOT.
 */
function e2eEnv (worktree, subcommand) {
  const own = path.join(worktree, 'scripts', 'e2e-env.mjs')
  const script = fs.existsSync(own) ? own : path.join(PROJECT_ROOT, 'scripts', 'e2e-env.mjs')
  execFileSync('node', [script, subcommand], {
    cwd: worktree,
    stdio: 'inherit',
    env: { ...process.env, DCC_E2E_ROOT: worktree }
  })
}

/**
 * Uncommitted changes in a worktree, ignoring .foundry-server/ — it's our own
 * runtime dir and gitignored once #893 lands, but a branch cut from an older
 * main doesn't have that entry yet and would read as permanently dirty.
 */
function isDirty (worktree) {
  const porcelain = git(['status', '--porcelain'], { cwd: worktree })
  return porcelain.split('\n').some(line => line && !line.slice(3).startsWith('.foundry-server/'))
}

/** The primary checkout (worktrees included, we may be running from one). */
function mainCheckout () {
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'])
  return path.dirname(commonDir)
}

function slugify (title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-').reduce((acc, word) => {
      const next = acc ? `${acc}-${word}` : word
      return next.length <= 40 ? next : acc
    }, '')
}

function worktreeFor (issue) {
  const porcelain = git(['worktree', 'list', '--porcelain'])
  for (const block of porcelain.split('\n\n')) {
    const wtPath = block.match(/^worktree (.+)$/m)?.[1]
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1]
    if (!wtPath || !branch) continue
    if (branch.match(/(?:^|\/)(\d+)-/)?.[1] === String(issue)) return { path: wtPath, branch }
  }
  return null
}

function parseFlags (args) {
  const flags = { rest: [] }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--branch': flags.branch = args[++i]; break
      case '--modules': flags.modules = args[++i]; break
      case '--no-claude': flags.noClaude = true; break
      case '--force': flags.force = true; break
      case '--all': flags.all = true; break
      default: flags.rest.push(args[i])
    }
  }
  return flags
}

// ============================================================================
// start
// ============================================================================

function buildPrompt (issue, title, branch, url) {
  return `You are in a dedicated worktree on branch ${branch}, working on GitHub issue #${issue}: "${title}".

Read the full issue first with: gh issue view ${issue}

Then implement it. Ground rules for this worktree:
- An isolated Foundry server for this worktree is available via \`npm run e2e:env\` (\`up\` prints the URL; state lives in .foundry-server/server.json). Use it for E2E validation — never target port 30000, that is the live install.
- Run the unit suite (npm test) and the affected Playwright specs (npm run e2e:env test -- <spec>) as you work; run the full e2e suite (npm run e2e:env test) before pushing anything touching attack/card/roll/sheet paths.
- Commit and push on this branch per the standing authorizations in CLAUDE.md.
- When the work is complete and green, use /pr to open a pull request. The PR body must reference "Fixes #${issue}".
- If you merge origin/main into this branch mid-work, stop the env server first, then rerun \`npm run scss\` + \`npm run todb\` and restart it (or just run \`npm run work:sync -- ${issue}\` from the main checkout).`
}

async function cmdStart (flags) {
  const issue = flags.rest[0]
  if (!issue || !/^\d+$/.test(issue)) fail('Usage: npm run work:start -- <issue#> [--branch name] [--modules a,b] [--no-claude]')

  const existing = worktreeFor(issue)
  if (existing) fail(`Issue #${issue} already has a worktree: ${existing.path} (${existing.branch}). Use work:finish first, or just cd there.`)

  console.log(`Fetching issue #${issue}...`)
  const info = JSON.parse(gh(['issue', 'view', issue, '--json', 'title,labels,state']))
  if (info.state !== 'OPEN') console.warn(`Warning: issue #${issue} is ${info.state}`)
  const isBug = info.labels.some(l => /bug/i.test(l.name))
  const branch = flags.branch || `${isBug ? 'fix' : 'feat'}/${issue}-${slugify(info.title)}`
  const worktree = path.join(WORK_DIR, `dcc-${issue}-${slugify(info.title)}`)

  // A checkout inside the live Data dir would be scanned by the live Foundry
  // server as a second system with the duplicate id "dcc".
  const liveData = path.resolve(mainCheckout(), '..', '..')
  if (worktree.startsWith(liveData + path.sep)) {
    fail(`Work dir ${WORK_DIR} is inside the live Foundry Data dir (${liveData}) — set DCC_WORK_DIR elsewhere`)
  }

  console.log(`Creating worktree ${worktree} on ${branch} (from origin/main)...`)
  fs.mkdirSync(WORK_DIR, { recursive: true })
  git(['fetch', 'origin'])
  git(['worktree', 'add', worktree, '-b', branch, 'origin/main'])

  // The permission allowlist is gitignored and per-checkout — without it the
  // new session permission-prompts from scratch.
  const localSettings = path.join(mainCheckout(), '.claude', 'settings.local.json')
  if (fs.existsSync(localSettings)) {
    fs.mkdirSync(path.join(worktree, '.claude'), { recursive: true })
    fs.copyFileSync(localSettings, path.join(worktree, '.claude', 'settings.local.json'))
    console.log('Copied .claude/settings.local.json')
  }

  if (flags.modules) {
    const manifestPath = path.join(worktree, 'browser-tests', 'e2e', 'test-environment.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    manifest.modules = [...new Set([...manifest.modules, ...flags.modules.split(',')])]
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    console.log(`Extended env module set: ${manifest.modules.join(', ')}`)
  }

  const quiet = { stdio: ['ignore', 'pipe', 'ignore'] }
  try {
    gh(['issue', 'edit', issue, '--add-assignee', '@me', '--add-label', 'in-progress'], quiet)
    console.log(`Claimed issue #${issue} (assignee + in-progress label)`)
  } catch {
    try {
      gh(['issue', 'edit', issue, '--add-assignee', '@me'], quiet)
      console.log(`Claimed issue #${issue} (assignee; no in-progress label in this repo)`)
    } catch {
      console.warn('Warning: could not claim the issue on GitHub — continuing')
    }
  }

  console.log('Bootstrapping isolated Foundry environment...')
  e2eEnv(worktree, 'up')

  const state = JSON.parse(fs.readFileSync(path.join(worktree, '.foundry-server', 'server.json'), 'utf-8'))
  const prompt = buildPrompt(issue, info.title, branch, state.url)

  if (flags.noClaude) {
    console.log(`\nReady. Start a session yourself with:\n  cd ${worktree} && claude`)
    console.log(`\nSuggested opening prompt:\n---\n${prompt}\n---`)
    return
  }
  console.log(`\nLaunching Claude in ${worktree}...\n`)
  const result = spawnSync('claude', [prompt], { cwd: worktree, stdio: 'inherit' })
  if (result.error?.code === 'ENOENT') fail('`claude` CLI not found on PATH — rerun with --no-claude and start it manually')
  process.exitCode = result.status ?? 0
}

// ============================================================================
// list
// ============================================================================

async function cmdList () {
  const porcelain = git(['worktree', 'list', '--porcelain'])
  const rows = []
  for (const block of porcelain.split('\n\n')) {
    const wtPath = block.match(/^worktree (.+)$/m)?.[1]
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1]
    if (!wtPath || !branch) continue
    const issue = branch.match(/(?:^|\/)(\d+)-/)?.[1] ?? '-'
    const dirty = isDirty(wtPath)
    let server = 'no env'
    const statePath = path.join(wtPath, '.foundry-server', 'server.json')
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
        let alive = false
        if (state.pid) {
          try { process.kill(state.pid, 0); alive = true } catch { alive = false }
        }
        server = alive ? `${state.url} (pid ${state.pid})` : `${state.url} (stopped)`
      } catch { server = 'env: unreadable state' }
    }
    let pr = '-'
    if (branch !== 'main') {
      try {
        const prs = JSON.parse(gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state', '--limit', '1']))
        if (prs.length) pr = `#${prs[0].number} ${prs[0].state}`
      } catch { /* offline or no gh — leave '-' */ }
    }
    rows.push({ issue, branch, dirty: dirty ? 'dirty' : 'clean', server, pr, path: wtPath })
  }
  if (!rows.length) {
    console.log('No worktrees.')
    return
  }
  for (const row of rows) {
    console.log(`#${row.issue}  ${row.branch}  [${row.dirty}]  ${row.server}  PR: ${row.pr}\n    ${row.path}`)
  }
}

// ============================================================================
// sync
// ============================================================================

async function syncOne (worktree, branch) {
  console.log(`\nSyncing ${branch} (${worktree})...`)
  // todb must not run while the env's server has the system packs open
  const stateFile = path.join(worktree, '.foundry-server', 'server.json')
  let wasRunning = false
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    if (state.pid) {
      try { process.kill(state.pid, 0); wasRunning = true } catch { wasRunning = false }
    }
    if (wasRunning) e2eEnv(worktree, 'down')
  }
  git(['fetch', 'origin'], { cwd: worktree })
  try {
    git(['merge', '--no-edit', 'origin/main'], { cwd: worktree, stdio: 'inherit' })
  } catch {
    fail(`Merge conflict in ${worktree} — resolve it there (worktree left mid-merge), then rerun work:sync`)
  }
  execSync('npm run scss && npm run todb', { cwd: worktree, stdio: 'inherit' })
  if (wasRunning) e2eEnv(worktree, 'up')
  console.log(`Synced ${branch}`)
}

async function cmdSync (flags) {
  if (flags.all) {
    const porcelain = git(['worktree', 'list', '--porcelain'])
    for (const block of porcelain.split('\n\n')) {
      const wtPath = block.match(/^worktree (.+)$/m)?.[1]
      const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1]
      if (!wtPath || !branch || branch === 'main') continue
      if (path.resolve(wtPath) === path.resolve(mainCheckout())) continue
      await syncOne(wtPath, branch)
    }
    return
  }
  const issue = flags.rest[0]
  if (!issue) fail('Usage: npm run work:sync -- <issue#> | --all')
  const target = worktreeFor(issue)
  if (!target) fail(`No worktree found for issue #${issue}`)
  await syncOne(target.path, target.branch)
}

// ============================================================================
// finish
// ============================================================================

async function cmdFinish (flags) {
  const issue = flags.rest[0]
  if (!issue) fail('Usage: npm run work:finish -- <issue#> [--force]')
  const target = worktreeFor(issue)
  if (!target) fail(`No worktree found for issue #${issue}`)

  if (!flags.force) {
    if (isDirty(target.path)) {
      fail(`Worktree ${target.path} is dirty — commit/stash first, or use --force`)
    }
    let merged = false
    try {
      const prs = JSON.parse(gh(['pr', 'list', '--head', target.branch, '--state', 'merged', '--json', 'number', '--limit', '1']))
      merged = prs.length > 0
    } catch { /* offline — treat as unmerged */ }
    if (!merged) fail(`No merged PR found for ${target.branch} — is the work done? Use --force to tear down anyway`)
  }

  if (fs.existsSync(path.join(target.path, '.foundry-server'))) {
    e2eEnv(target.path, 'destroy')
  }
  git(['worktree', 'remove', ...(flags.force ? ['--force'] : []), target.path])
  try { git(['branch', '-D', target.branch]) } catch { console.warn(`Note: branch ${target.branch} not deleted (may be checked out elsewhere)`) }
  try { gh(['issue', 'edit', issue, '--remove-label', 'in-progress'], { stdio: ['ignore', 'pipe', 'ignore'] }) } catch { /* label may not exist */ }
  console.log(`Finished #${issue}: removed ${target.path} and branch ${target.branch}`)
}

// ============================================================================
// Main
// ============================================================================

const [command, ...rest] = process.argv.slice(2)
const flags = parseFlags(rest)
switch (command) {
  case 'start': await cmdStart(flags); break
  case 'list': await cmdList(); break
  case 'sync': await cmdSync(flags); break
  case 'finish': await cmdFinish(flags); break
  default:
    console.log('Usage: npm run work:<start|list|sync|finish> -- [args]')
    process.exit(command ? 1 : 0)
}
