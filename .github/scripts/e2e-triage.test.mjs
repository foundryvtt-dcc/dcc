import { test } from 'node:test'
import assert from 'node:assert/strict'
import { protectedFiles, specialModeFiles, parseClaudeResult, decide } from './e2e-triage.mjs'

test('protected paths always need a maintainer, including renames out of them', () => {
  const files = [
    { filename: 'module/actor.js' },
    { filename: 'browser-tests/e2e/sheet-ui.spec.js' },
    { filename: 'pnpm-lock.yaml' },
    { filename: 'module/renamed.js', previous_filename: 'scripts/e2e-env.mjs' }
  ]
  assert.deepEqual(protectedFiles(files), ['pnpm-lock.yaml', 'scripts/e2e-env.mjs'])
})

test('symlinks and submodules are flagged from the diff headers', () => {
  const diff = [
    'diff --git a/module/link.js b/module/link.js',
    'new file mode 120000',
    'diff --git a/module/ok.js b/module/ok.js',
    'index 1111111..2222222 100644',
    'diff --git a/vendor/sub b/vendor/sub',
    'index 0000000..3333333 160000'
  ].join('\n')
  assert.deepEqual(specialModeFiles(diff), ['module/link.js', 'vendor/sub'])
})

test('a failed or schema-less Claude run fails closed', () => {
  assert.ok(parseClaudeResult('not json').error)
  assert.ok(parseClaudeResult(JSON.stringify({ subtype: 'error_max_turns', is_error: true })).error)
  assert.ok(parseClaudeResult(JSON.stringify({ subtype: 'success', is_error: false, structured_output: { verdict: 'yes' } })).error)
  const ok = parseClaudeResult(JSON.stringify({
    subtype: 'success', is_error: false, structured_output: { verdict: 'approve', summary: 'fine', concerns: [] }
  }))
  assert.equal(ok.verdict, 'approve')
})

test('mechanical blockers override an approval but never soften a reject', () => {
  const approve = { verdict: 'approve', summary: '', concerns: [] }
  assert.equal(decide({ blockers: [], claude: approve }), 'approve')
  assert.equal(decide({ blockers: ['lockfile'], claude: approve }), 'needs_human')
  assert.equal(decide({ blockers: ['lockfile'], claude: { ...approve, verdict: 'reject' } }), 'reject')
  assert.equal(decide({ blockers: [], claude: { error: 'token' } }), 'needs_human')
  assert.equal(decide({ blockers: [], claude: null }), 'needs_human')
})
