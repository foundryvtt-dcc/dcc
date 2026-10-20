#!/usr/bin/env node
/**
 * E2E gate triage: decide whether a PR's code may run on the self-hosted E2E
 * runner (see deploy/e2e-runner/README.md).
 *
 * The runner executes everything a PR controls — pnpm install (lifecycle
 * scripts), the Node-side Playwright specs, the system code inside Chromium —
 * on a box that holds the Foundry license and the dcc-core-book module. So a
 * PR from someone without write access only reaches it after Claude has read
 * the diff and found nothing that tries to escape the test sandbox, or after a
 * maintainer adds the `e2e-approved` label.
 *
 * This script never executes PR code. It reads the diff and the head versions
 * of the changed files through git/the API, lays them out in a scratch
 * directory, and runs the Claude Code CLI there in --restricted mode with only
 * Read/Grep/Glob (no settings files, hooks, MCP servers or shell). Claude's
 * answer is constrained by --json-schema; anything unparseable fails closed to
 * `needs_human`.
 *
 * Env:
 *   REPO, PR, HEAD_SHA   target PR (HEAD_SHA must already be fetched locally)
 *   GH_TOKEN             read access for `gh api`
 *   CLAUDE_BIN           path to the pinned claude CLI
 *   TRIAGE_DIR           scratch dir (outside any git checkout)
 *   GITHUB_OUTPUT        decision / summary outputs
 * Writes $TRIAGE_DIR/comment.md for the PR comment.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

// Paths the runner executes outside the browser sandbox, or that change how it
// installs and launches things. A PR touching any of these always needs a
// maintainer, whatever Claude thinks — a reviewer model is not the last line
// of defence for the runner's own tooling.
export const PROTECTED_PATTERNS = [
  /^\.github\//,
  /^\.husky\//,
  /^deploy\//,
  /^scripts\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^\.npmrc$/,
  /^\.nvmrc$/,
  /^[^/]+\.(c|m)?js$/, // root-level JS (vitest/eslint configs etc.)
  /^module\/compilePacks\.js$/,
  /^browser-tests\/e2e\/package\.json$/,
  /^browser-tests\/e2e\/playwright\.config\.js$/,
  /^browser-tests\/e2e\/global-setup\.js$/,
  /^browser-tests\/e2e\/test-environment[^/]*\.json$/
]

// Larger than this and Claude would be reviewing a truncated picture; send it
// to a human instead of pretending.
export const MAX_DIFF_CHARS = 400000
export const MAX_FILES = 300

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'needs_human', 'reject'] },
    summary: { type: 'string' },
    concerns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          detail: { type: 'string' }
        },
        required: ['file', 'detail'],
        additionalProperties: false
      }
    }
  },
  required: ['verdict', 'summary', 'concerns'],
  additionalProperties: false
}

export function protectedFiles (files) {
  return files
    .flatMap(f => [f.filename, f.previous_filename].filter(Boolean))
    .filter(name => PROTECTED_PATTERNS.some(re => re.test(name)))
}

/** Symlinks and submodules can point the served system dir at host files. */
export function specialModeFiles (diff) {
  const found = []
  let current = null
  for (const line of diff.split('\n')) {
    const header = line.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (header) current = header[2]
    else if (/^(new file mode|new mode|old mode|index [0-9a-f]+\.\.[0-9a-f]+) .*\b1[26]0000\b/.test(line) && current) {
      found.push(current)
    }
  }
  return [...new Set(found)]
}

/** Pull Claude's verdict out of the CLI's --output-format json result. */
export function parseClaudeResult (stdout) {
  let result
  try {
    result = JSON.parse(stdout)
  } catch {
    return { error: 'Claude CLI output was not JSON' }
  }
  if (result.is_error || result.subtype !== 'success') {
    return { error: `Claude run failed (subtype=${result.subtype}, is_error=${result.is_error}) — check the CLAUDE_CODE_OAUTH_TOKEN secret` }
  }
  const out = result.structured_output
  if (!out || !['approve', 'needs_human', 'reject'].includes(out.verdict) || typeof out.summary !== 'string') {
    return { error: 'Claude returned no valid structured verdict' }
  }
  return { verdict: out.verdict, summary: out.summary, concerns: Array.isArray(out.concerns) ? out.concerns : [] }
}

/**
 * Combine the mechanical checks with Claude's verdict. Mechanical blockers can
 * only make the decision stricter; a Claude `reject` always stands.
 */
export function decide ({ blockers, claude }) {
  if (claude?.verdict === 'reject') return 'reject'
  if (blockers.length > 0) return 'needs_human'
  if (!claude || claude.error) return 'needs_human'
  return claude.verdict
}

export function renderComment ({ decision, blockers, claude, headSha }) {
  const headline = {
    approve: '✅ **Approved for E2E.** The suite is queued on the self-hosted runner.',
    needs_human: '⏸️ **Needs a maintainer.** A maintainer can start E2E by adding the `e2e-approved` label.',
    reject: '⛔ **Not run.** The triage found changes that look unsafe to execute on the E2E runner. A maintainer can still override with the `e2e-approved` label.'
  }[decision]
  const lines = [
    '<!-- e2e-triage -->',
    '### E2E gate',
    '',
    headline,
    '',
    `Commit: \`${headSha.slice(0, 7)}\``
  ]
  if (blockers.length) {
    lines.push('', '**Checks that always need a maintainer:**')
    for (const b of blockers) lines.push(`- ${b}`)
  }
  if (claude?.error) {
    lines.push('', `**Automated review unavailable:** ${claude.error}`)
  } else if (claude) {
    lines.push('', `**Automated review (${claude.verdict}):** ${claude.summary}`)
    for (const c of claude.concerns) lines.push(`- \`${c.file}\`: ${c.detail}`)
  }
  lines.push('', '<sub>This check reviews whether the code is safe to run on the test server, not whether it is correct. New pushes are triaged again.</sub>')
  return lines.join('\n') + '\n'
}

function gh (args, opts = {}) {
  return execFileSync('gh', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, ...opts })
}

function setOutput (name, value) {
  if (!process.env.GITHUB_OUTPUT) return
  const delim = `EOF_${Math.random().toString(36).slice(2)}`
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delim}\n${value}\n${delim}\n`)
}

/** Lay out what Claude reviews. Nothing here is executed. */
function buildReviewDir (dir, { pr, files, diff, headSha }) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(path.join(dir, 'head'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'pr.diff'), diff)
  fs.writeFileSync(path.join(dir, 'pr.json'), JSON.stringify({
    title: pr.title,
    body: pr.body,
    author: pr.user?.login,
    author_association: pr.author_association,
    files: files.map(f => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions }))
  }, null, 2))
  for (const f of files) {
    if (f.status === 'removed') continue
    const dest = path.resolve(dir, 'head', f.filename)
    if (!dest.startsWith(path.join(dir, 'head') + path.sep)) continue
    const blob = spawnSync('git', ['show', `${headSha}:${f.filename}`], { maxBuffer: 16 * 1024 * 1024 })
    if (blob.status !== 0) continue
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, blob.stdout)
  }
}

function runClaude (dir, promptPath) {
  const result = spawnSync(process.env.CLAUDE_BIN || 'claude', [
    '-p', fs.readFileSync(promptPath, 'utf-8'),
    '--restricted',
    '--strict-mcp-config',
    '--tools', 'Read,Grep,Glob',
    '--model', process.env.TRIAGE_MODEL || 'claude-opus-5-5',
    '--effort', process.env.TRIAGE_EFFORT || 'high',
    '--max-turns', '60',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(VERDICT_SCHEMA)
  ], {
    cwd: dir,
    // Only what the CLI needs: the job's GH_TOKEN can dispatch e2e.yml, so it
    // must not be reachable from the model's process.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN || '',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
    },
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000
  })
  if (result.error) return { error: `Claude CLI did not run: ${result.error.message}` }
  return parseClaudeResult(result.stdout)
}

async function main () {
  const { REPO, PR, HEAD_SHA, TRIAGE_DIR } = process.env
  if (!REPO || !/^\d+$/.test(PR || '') || !/^[0-9a-f]{40}$/.test(HEAD_SHA || '') || !TRIAGE_DIR) {
    throw new Error('REPO, PR, HEAD_SHA and TRIAGE_DIR are required')
  }
  // The file list and diff come from the API's current view of the PR, so
  // check it still describes the commit this run approves, against main,
  // both before and after reading them.
  const fetchPr = () => {
    const pr = JSON.parse(gh(['api', `repos/${REPO}/pulls/${PR}`]))
    if (pr.head.sha !== HEAD_SHA || pr.base.ref !== 'main') {
      throw new Error(`PR is now ${pr.head.sha} against ${pr.base.ref}, not ${HEAD_SHA} against main`)
    }
    return pr
  }
  const pr = fetchPr()
  const files = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${REPO}/pulls/${PR}/files?per_page=100`])).flat()

  const blockers = []
  let diff = ''
  if (files.length >= MAX_FILES) {
    blockers.push(`The PR changes ${files.length} files, more than the automated review handles (${MAX_FILES}).`)
  } else {
    try {
      diff = gh(['api', '-H', 'Accept: application/vnd.github.diff', `repos/${REPO}/pulls/${PR}`])
    } catch {
      blockers.push('GitHub would not produce a diff for this PR (too large).')
    }
  }
  if (diff.length > MAX_DIFF_CHARS) {
    blockers.push(`The diff is ${diff.length} characters, more than the automated review handles (${MAX_DIFF_CHARS}).`)
  }
  const prot = protectedFiles(files)
  if (prot.length) blockers.push(`Changes runner tooling or dependencies: ${prot.map(f => `\`${f}\``).join(', ')}`)
  const special = specialModeFiles(diff)
  if (special.length) blockers.push(`Adds a symlink or submodule: ${special.map(f => `\`${f}\``).join(', ')}`)
  fetchPr()

  // Always ask Claude when the diff fits — even with blockers, a `reject` is
  // worth surfacing and the summary helps the maintainer review.
  let claude = null
  if (diff && diff.length <= MAX_DIFF_CHARS) {
    const reviewDir = path.join(TRIAGE_DIR, 'review')
    buildReviewDir(reviewDir, { pr, files, diff, headSha: HEAD_SHA })
    claude = runClaude(reviewDir, path.join(import.meta.dirname, '..', 'prompts', 'e2e-triage.md'))
  }

  const decision = decide({ blockers, claude })
  fs.writeFileSync(path.join(TRIAGE_DIR, 'comment.md'), renderComment({ decision, blockers, claude, headSha: HEAD_SHA }))
  setOutput('decision', decision)
  console.log(`Decision: ${decision}`)
  if (claude?.error) console.log(`::warning::${claude.error}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
