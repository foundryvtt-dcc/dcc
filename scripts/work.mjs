#!/usr/bin/env node
/**
 * Parallel-issue workflow orchestrator (#893) — one command from a GitHub
 * issue to a working Claude Code session in its own worktree with its own
 * isolated Foundry server (see scripts/e2e-env.mjs).
 *
 * Usage:
 *   pnpm run work:start -- <issue#> [--branch <name>] [--modules a,b] [--no-claude]
 *   pnpm run work:list
 *   pnpm run work:sync -- <issue#> | --all
 *   pnpm run work:finish -- <issue#> [--force]
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
 * Run an e2e-env subcommand against a worktree — always with THIS checkout's
 * copy of e2e-env.mjs, pointed at the worktree via DCC_E2E_ROOT. work.mjs and
 * e2e-env.mjs evolve together (e.g. --modules writes a local-override
 * manifest the paired script knows to read); the worktree's own copy can be
 * older (branched from an earlier main) or missing entirely. Sessions inside
 * the worktree still use its own copy via `pnpm run e2e:env`, which is
 * consistent with that branch by construction.
 */
function e2eEnv (worktree, subcommand) {
  const script = path.join(PROJECT_ROOT, 'scripts', 'e2e-env.mjs')
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
  const ownArtifacts = ['.foundry-server/', 'browser-tests/e2e/test-environment.local.json']
  const porcelain = git(['status', '--porcelain'], { cwd: worktree })
  return porcelain.split('\n').some(line =>
    line && !ownArtifacts.some(artifact => line.slice(3).startsWith(artifact)))
}

/** The primary checkout (worktrees included, we may be running from one). */
function mainCheckout () {
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'])
  return path.dirname(commonDir)
}

function slugify (title) {
  const words = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-').filter(Boolean)
  let slug = ''
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word
    if (next.length > 40) break // keep the slug a contiguous prefix
    slug = next
  }
  return slug || 'issue' // all-non-ASCII titles slugify to nothing
}

function allWorktrees () {
  const porcelain = git(['worktree', 'list', '--porcelain'])
  const out = []
  for (const block of porcelain.split('\n\n')) {
    const wtPath = block.match(/^worktree (.+)$/m)?.[1]
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1]
    if (wtPath && branch) out.push({ path: wtPath, branch })
  }
  return out
}

/**
 * Resolve an issue number to exactly one worktree. Several worktrees can
 * legitimately carry the same issue number (stacked branches, agent
 * worktrees), and sync/finish are destructive — on ambiguity, fail and make
 * the caller disambiguate rather than picking whichever git lists first.
 */
function worktreeFor (issue, { forUse = 'target' } = {}) {
  const matches = allWorktrees().filter(w => w.branch.match(/(?:^|\/)(\d+)-/)?.[1] === String(issue))
  if (matches.length === 0) return null
  if (matches.length > 1) {
    // Prefer a unique match under our own work dir before giving up
    const ours = matches.filter(w => path.resolve(w.path).startsWith(path.resolve(WORK_DIR) + path.sep))
    if (ours.length === 1) return ours[0]
    fail(`Issue #${issue} matches ${matches.length} worktrees — cannot safely pick a ${forUse}:\n` +
      matches.map(w => `  ${w.branch}  ${w.path}`).join('\n') +
      '\nRemove or rename the ones that should not match, or operate on it manually.')
  }
  return matches[0]
}

function parseFlags (args) {
  const flags = { rest: [] }
  const takeValue = (name, i) => {
    const value = args[i]
    if (value === undefined || value.startsWith('--')) fail(`${name} requires a value`)
    return value
  }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--branch': flags.branch = takeValue('--branch', ++i); break
      case '--modules': flags.modules = takeValue('--modules', ++i); break
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
- An isolated Foundry server for this worktree is already running at ${url} (manage it with \`pnpm run e2e:env\`; state lives in .foundry-server/server.json). Use it for E2E validation — never target port 30000, that is the live install.
- Run the unit suite (pnpm test) and the affected Playwright specs (pnpm run e2e:env test -- <spec>) as you work; run the full e2e suite (pnpm run e2e:env test) before pushing anything touching attack/card/roll/sheet paths.
- Commit and push on this branch per the standing authorizations in CLAUDE.md.
- When the work is complete and green, use /pr to open a pull request. The PR body must reference "Fixes #${issue}".
- If you merge origin/main into this branch mid-work, stop the env server first, then rerun \`pnpm run scss\` + \`pnpm run todb\` and restart it (or just run \`pnpm run work:sync -- ${issue}\` from the main checkout).`
}

async function cmdStart (flags) {
  const issue = flags.rest[0]
  if (!issue || !/^\d+$/.test(issue)) fail('Usage: pnpm run work:start -- <issue#> [--branch name] [--modules a,b] [--no-claude]')

  const existing = worktreeFor(issue)
  if (existing) fail(`Issue #${issue} already has a worktree: ${existing.path} (${existing.branch}). Use work:finish first, or just cd there.`)

  console.log(`Fetching issue #${issue}...`)
  const info = JSON.parse(gh(['issue', 'view', issue, '--json', 'title,labels,state']))
  if (info.state !== 'OPEN') console.warn(`Warning: issue #${issue} is ${info.state}`)
  const isBug = info.labels.some(l => /bug/i.test(l.name))
  const branch = flags.branch || `${isBug ? 'fix' : 'feat'}/${issue}-${slugify(info.title)}`
  const worktree = path.join(WORK_DIR, `dcc-${issue}-${slugify(info.title)}`)

  // A checkout inside the live Data dir would be scanned by the live Foundry
  // server as a second system with the duplicate id "dcc". Compare real
  // paths so a symlinked DCC_WORK_DIR can't slip past the prefix check.
  fs.mkdirSync(WORK_DIR, { recursive: true })
  const liveData = path.resolve(mainCheckout(), '..', '..')
  if (fs.realpathSync(WORK_DIR).startsWith(fs.realpathSync(liveData) + path.sep)) {
    fail(`Work dir ${WORK_DIR} is inside the live Foundry Data dir (${liveData}) — set DCC_WORK_DIR elsewhere`)
  }

  console.log(`Creating worktree ${worktree} on ${branch} (from origin/main)...`)
  git(['fetch', 'origin'])
  git(['worktree', 'add', worktree, '-b', branch, 'origin/main'])

  // Everything past this point has state to lose — on failure, say what was
  // left behind and how to clean it instead of dying with a stack trace.
  try {
    // The permission allowlist is gitignored and per-checkout — without it the
    // new session permission-prompts from scratch.
    const localSettings = path.join(mainCheckout(), '.claude', 'settings.local.json')
    if (fs.existsSync(localSettings)) {
      fs.mkdirSync(path.join(worktree, '.claude'), { recursive: true })
      fs.copyFileSync(localSettings, path.join(worktree, '.claude', 'settings.local.json'))
      console.log('Copied .claude/settings.local.json')
    }

    if (flags.modules) {
      // Written to the gitignored local-override manifest, not the tracked
      // test-environment.json — the session would otherwise commit the tweak.
      const overridePath = path.join(worktree, 'browser-tests', 'e2e', 'test-environment.local.json')
      const modules = flags.modules.split(',').map(m => m.trim()).filter(Boolean)
      fs.writeFileSync(overridePath, JSON.stringify({ modules }, null, 2) + '\n')
      console.log(`Extended env module set via test-environment.local.json: +${modules.join(', +')}`)
    }

    console.log('Bootstrapping isolated Foundry environment...')
    e2eEnv(worktree, 'up')
  } catch (err) {
    console.error(`\nBootstrap failed: ${err.message}`)
    fail(`Partial state left behind: worktree ${worktree} on branch ${branch}.\n` +
      `Fix the cause and rerun, or clean up with: pnpm run work:finish -- ${issue} --force`)
  }

  // Claim only once the env actually boots, so a failed start doesn't leave
  // the issue assigned with nothing running.
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

  const state = JSON.parse(fs.readFileSync(path.join(worktree, '.foundry-server', 'server.json'), 'utf-8'))
  const prompt = buildPrompt(issue, info.title, branch, state.url)

  if (flags.noClaude) {
    console.log(`\nReady. Start a session yourself with:\n  cd ${worktree} && claude`)
    console.log(`\nSuggested opening prompt:\n---\n${prompt}\n---`)
    return
  }
  console.log(`\nLaunching Claude in ${worktree}...\n`)
  const result = spawnSync('claude', [prompt], { cwd: worktree, stdio: 'inherit' })
  if (result.error) {
    const hint = result.error.code === 'ENOENT' ? '`claude` CLI not found on PATH' : `could not launch claude: ${result.error.message}`
    fail(`${hint} — the worktree and server are ready; start the session manually:\n  cd ${worktree} && claude`)
  }
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
    const { state, running } = envServerRunning(wtPath)
    let server = 'no env'
    if (state) server = running ? `${state.url} (pid ${state.pid})` : `${state.url} (stopped)`
    else if (fs.existsSync(path.join(wtPath, '.foundry-server'))) server = 'env: unreadable state'
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

/** Is this worktree's env server actually alive (pid identity-checked)? */
function envServerRunning (worktree) {
  const stateFile = path.join(worktree, '.foundry-server', 'server.json')
  if (!fs.existsSync(stateFile)) return { state: null, running: false }
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    if (!state.pid) return { state, running: false }
    // Match e2e-env's isOwnServer: a recycled pid after a reboot must not
    // count as (or be treated like) our server.
    const cmd = execFileSync('ps', ['-o', 'command=', '-p', String(state.pid)], { encoding: 'utf-8' })
    return { state, running: cmd.includes(path.join(worktree, '.foundry-server')) }
  } catch {
    return { state: null, running: false }
  }
}

async function syncOne (worktree, branch) {
  console.log(`\nSyncing ${branch} (${worktree})...`)
  const gitDir = git(['rev-parse', '--path-format=absolute', '--git-dir'], { cwd: worktree })
  if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
    throw new Error(`${worktree} has an unresolved merge in progress — finish it (commit or git merge --abort) first`)
  }
  if (isDirty(worktree)) {
    throw new Error(`${worktree} is dirty — commit or stash before syncing`)
  }
  // todb must not run while the env's server has the system packs open
  const wasRunning = envServerRunning(worktree).running
  if (wasRunning) e2eEnv(worktree, 'down')
  git(['fetch', 'origin'], { cwd: worktree })
  try {
    git(['merge', '--no-edit', 'origin/main'], { cwd: worktree, stdio: 'inherit' })
  } catch {
    throw new Error(`Merge conflict in ${worktree} — resolve and commit there, then restart its server with: pnpm run e2e:env up (it was stopped for the sync)`)
  }
  execSync('pnpm run scss && pnpm run todb', { cwd: worktree, stdio: 'inherit' })
  if (wasRunning) e2eEnv(worktree, 'up')
  console.log(`Synced ${branch}`)
}

async function cmdSync (flags) {
  if (flags.all) {
    // --all only touches worktrees under our own work dir — agent or manual
    // worktrees elsewhere may be mid-use by someone else.
    const targets = allWorktrees().filter(w =>
      w.branch !== 'main' && path.resolve(w.path).startsWith(path.resolve(WORK_DIR) + path.sep))
    if (!targets.length) {
      console.log(`No worktrees under ${WORK_DIR} to sync.`)
      return
    }
    const failures = []
    for (const target of targets) {
      try {
        await syncOne(target.path, target.branch)
      } catch (err) {
        console.error(`Skipping ${target.branch}: ${err.message}`)
        failures.push(target.branch)
      }
    }
    if (failures.length) fail(`Sync incomplete for: ${failures.join(', ')}`)
    return
  }
  const issue = flags.rest[0]
  if (!issue) fail('Usage: pnpm run work:sync -- <issue#> | --all')
  const target = worktreeFor(issue, { forUse: 'sync target' })
  if (!target) fail(`No worktree found for issue #${issue}`)
  try {
    await syncOne(target.path, target.branch)
  } catch (err) {
    fail(err.message)
  }
}

// ============================================================================
// finish
// ============================================================================

async function cmdFinish (flags) {
  const issue = flags.rest[0]
  if (!issue) fail('Usage: pnpm run work:finish -- <issue#> [--force]')
  const target = worktreeFor(issue, { forUse: 'teardown target' })
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
    console.log('Usage: pnpm run work:<start|list|sync|finish> -- [args]')
    process.exit(command ? 1 : 0)
}
