/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

const ADAPTER_TAG = '[DCC adapter]'

// Module-scoped capture arrays. The fixture attaches the console listener ONCE
// per worker (via onConsole below): `adapterLogs` collects the
// `[DCC adapter] …` dispatch lines this spec asserts on, `consoleErrors`
// collects errors. beforeEach clears both. Safe with workers:1; if we ever
// parallelize, move them onto the fixture object.
const adapterLogs = []
const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => {
    const text = msg.text()
    if (text.includes(ADAPTER_TAG)) adapterLogs.push(text)
    if (msg.type() === 'error') consoleErrors.push(text)
  }
})

/**
 * Adapter-dispatch validation — the permanent roll/check/save regression net.
 *
 * For every roll the adapter handles (ability check, save, skill check,
 * initiative, spell check, weapon attack/damage/crit/fumble, …) this spec
 * drives the public `DCCActor` method in a live Foundry, then asserts the
 * `[DCC adapter] <rollType> -> <via adapter|LEGACY path>` console log emitted
 * by `module/adapter/debug.mjs`. The log is the signal used to verify the
 * dispatcher picks the intended branch; this spec makes that check automatic.
 *
 * The dispatch logging is permanent (not a temporary scaffold) — each refactor
 * phase adds its own logDispatch calls and extends this spec. (Formerly
 * `phase1-adapter-dispatch.spec.js`; renamed once it grew past Phase 1.)
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright for Node 24,
 * fvtt CLI installPath/dataPath, and launch command. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   npm test -- adapter-dispatch.spec.js
 */

test.describe('DCC Adapter Dispatch Validation', () => {
  test.beforeAll(async () => {
    let serverUp
    try {
      const response = await fetch('http://localhost:30000/', { signal: AbortSignal.timeout(5000) })
      serverUp = response.ok
    } catch {
      serverUp = false
    }
    if (!serverUp) {
      throw new Error(
        'Could not connect to Foundry VTT at http://localhost:30000.\n\n' +
        'Please start Foundry before running tests:\n' +
        '1. Run: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing\n' +
        '2. Run tests again: npm test'
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    adapterLogs.length = 0
    consoleErrors.length = 0
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { await app.close() }
      for (const actor of game.actors.filter(a => a.name.startsWith('P1 '))) { await actor.delete() }
      // Purge accumulated chat messages from prior tests so `find(m => …)`
      // scans don't grow O(N) with suite size — Foundry doesn't prune
      // them automatically and the session-reuse fixture preserves them
      // across all 70+ tests in the spec.
      const stale = game.messages.contents
        .filter(m => m.speaker?.alias?.startsWith('P1 '))
        .map(m => m.id)
      if (stale.length > 0) await ChatMessage.deleteDocuments(stale)
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
    }).catch(() => {})
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { await app.close() }
      for (const actor of game.actors.filter(a => a.name.startsWith('P1 '))) { await actor.delete() }
    }).catch(() => {})
  })

  // ── helpers ─────────────────────────────────────────────────────────

  /**
   * Await the logDispatch line for a given rollType, up to `timeoutMs`.
   * Returns the first matching log, or throws with a diagnostic dump.
   */
  async function waitForAdapterLog (rollType, { timeoutMs = 6000, pollMs = 50 } = {}) {
    const deadline = Date.now() + timeoutMs
    const tag = `${ADAPTER_TAG} ${rollType}`
    while (Date.now() < deadline) {
      const hit = adapterLogs.find(l => l.startsWith(tag))
      if (hit) return hit
      await new Promise(resolve => setTimeout(resolve, pollMs))
    }
    throw new Error(
      `Timed out waiting for '${tag}' log.\n` +
      `Captured adapter logs:\n${adapterLogs.join('\n') || '  (none)'}`
    )
  }

  function assertPath (logLine, expectedPath, extras = {}) {
    const marker = expectedPath === 'adapter' ? 'via adapter' : 'LEGACY path'
    expect(logLine, `log line: ${logLine}`).toContain(marker)
    for (const [k, v] of Object.entries(extras)) {
      expect(logLine, `expected ${k}=${v} in log: ${logLine}`).toContain(`${k}=${v}`)
    }
  }

  /** Fire-and-forget: kicks off an async action, dismisses any modal it raises. */
  async function fireAndForget (page, bodyFn, arg) {
    await page.evaluate(bodyFn, arg)
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }

  async function makePlayer (page, name, extraSystem = {}) {
    return page.evaluate(async ({ name, extraSystem }) => {
      const actor = await Actor.create({
        name,
        type: 'Player',
        system: extraSystem
      })
      return actor.id
    }, { name, extraSystem })
  }

  // ── roll-dispatch mixin composition ─────────────────────────────────
  // The roll dispatchers were extracted from actor.js into
  // module/actor/rolls-{spell,weapon,check,skill}-mixin.mjs (2026-06-09).
  // This probe asserts the mixin chain composes correctly in live Foundry —
  // every public + representative private dispatcher resolves on a real
  // DCCActor instance's prototype chain. If a mixin failed to wire into the
  // `extends` chain, these would be undefined and every other test below
  // (which drives these methods) would fail with a less localized error.
  test.describe('roll-dispatch mixin composition', () => {
    test('a live DCCActor carries every extracted roll dispatcher', async ({ page }) => {
      await makePlayer(page, 'P1 Composition Probe')
      const surface = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Composition Probe')
        const names = [
          // rolls-spell-mixin
          'rollSpellCheck', '_rollSpellCheckDispatch', '_castViaCastSpell', '_buildSpellCheckFlavor',
          // rolls-weapon-mixin
          'rollWeaponAttack', 'rollCritical', 'rollToHit', '_rollDamage', '_rollFumble',
          // rolls-check-mixin
          'rollAbilityCheck', 'getInitiativeRoll', 'rollInit', 'rollHitDice', 'rollSavingThrow',
          // rolls-skill-mixin
          'rollSkillCheck', '_resolveSkill', '_stripDieCount', '_buildSkillCheckRollTerms'
        ]
        return Object.fromEntries(names.map(n => [n, typeof actor[n]]))
      })
      for (const [name, type] of Object.entries(surface)) {
        expect(type, `DCCActor is missing dispatcher: ${name}`).toBe('function')
      }
    })
  })

  // ── rollAbilityCheck ────────────────────────────────────────────────

  test.describe('rollAbilityCheck', () => {
    test('default options → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Ability Default')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability Default').rollAbilityCheck('lck')
      })
      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'adapter', { abilityId: 'lck' })
    })

    // Phase 7 session 21 (legacy-decom step 1): roll-under (Luck) now
    // flows through the adapter via the lib's rollLuckCheck instead of
    // the legacy DCCRoll term-builder.
    test('rollUnder flag → adapter (Luck check)', async ({ page }) => {
      await makePlayer(page, 'P1 Ability RollUnder')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability RollUnder').rollAbilityCheck('lck', { rollUnder: true })
      })
      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'adapter', { abilityId: 'lck', rollUnder: true })
    })

    // The adapter roll-under path must reproduce the legacy chat
    // contract: the AbilityCheckRollUnder flag + a rolled die tagged
    // with `options.dcc.rollUnder` and thresholds derived from the Luck
    // score (so module/chat.js's highlight hook swaps the success /
    // failure classes — roll ≤ score = success). Naked d20, so no
    // modifier breakdown and no dcc.libResult.
    test('adapter roll-under tags the die for roll-under highlighting', async ({ page }) => {
      await makePlayer(page, 'P1 Ability RollUnderTag', {
        abilities: { lck: { value: 14, max: 14 } }
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability RollUnderTag').rollAbilityCheck('lck', { rollUnder: true })
      })

      const card = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Ability RollUnderTag' &&
              m.getFlag('dcc', 'RollType') === 'AbilityCheckRollUnder'
            )
          if (msg) {
            const term = msg.rolls?.[0]?.terms?.[0]
            return {
              rollType: msg.getFlag('dcc', 'RollType'),
              ability: msg.getFlag('dcc', 'Ability'),
              isAbilityCheck: msg.getFlag('dcc', 'isAbilityCheck'),
              libResult: msg.getFlag('dcc', 'libResult') ?? null,
              dcc: term?.options?.dcc ?? null
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(card, 'roll-under adapter path must post a chat message').not.toBeNull()
      expect(card.rollType).toBe('AbilityCheckRollUnder')
      expect(card.ability).toBe('lck')
      expect(card.isAbilityCheck).toBe(true)
      // Naked d20 — no modifier breakdown captured.
      expect(card.libResult).toBeNull()
      // Die tagged for roll-under highlighting against the Luck score.
      expect(card.dcc).not.toBeNull()
      expect(card.dcc.rollUnder).toBe(true)
      expect(card.dcc.lowerThreshold).toBe(14)
      expect(card.dcc.upperThreshold).toBe(15)
    })

    // Legacy-decom step 2: the modifier dialog no longer routes ability
    // checks to legacy. The adapter surfaces the same RollModifierDialog
    // via `promptRollModifierDialog`, then folds the user's choice into a
    // `rollCheck` pass. Dispatch fires at the start of
    // `_rollAbilityCheckViaAdapter` before the (blocking) dialog shows —
    // fireAndForget dismisses it with Escape so the run continues. (No
    // armor check penalty on a fresh player, so str stays on the adapter.)
    test('showModifierDialog flag → adapter (legacy-decom step 2)', async ({ page }) => {
      await makePlayer(page, 'P1 Ability Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Ability Dialog').rollAbilityCheck('str', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'adapter', { abilityId: 'str' })
    })

    // Phase 7 session 14: the per-modifier breakdown the adapter
    // already captures on `flags.dcc.libResult.modifiers` now renders
    // under the rolled formula in chat (PR #720 resilience item). The
    // lib emits each contributing modifier as a tagged-union
    // `{ kind: 'add', value, origin: { label } }`; the chat-renderer
    // lists them as `<label> <signed value>`.
    test('adapter ability-check chat surfaces the per-modifier breakdown', async ({ page }) => {
      await makePlayer(page, 'P1 Ability Breakdown', {
        abilities: { str: { value: 16, max: 16 } }
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability Breakdown').rollAbilityCheck('str')
      })

      const card = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Ability Breakdown' &&
              m.getFlag('dcc', 'isAbilityCheck') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) {
            return {
              content: msg.content,
              modifiers: msg.getFlag('dcc', 'libResult').modifiers ?? null
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(card, 'ability-check adapter path must post a chat message').not.toBeNull()
      // The captured lib modifiers are the tagged-union shape.
      expect(Array.isArray(card.modifiers)).toBe(true)
      // The breakdown container + localized heading render under the roll.
      expect(card.content).toContain('class="dcc-modifier-breakdown"')
      expect(card.content).toContain('dcc-modifier-breakdown-heading">Modifiers<')
      // STR 16 → +2 ability modifier; it must appear as a labelled,
      // signed value row (the regression this slice closes — the value
      // used to be invisible because the Roll is built from the lib's
      // flat formula string).
      expect(card.content).toMatch(/<span class="dcc-modifier-label">[^<]*<\/span><span class="dcc-modifier-value">\+2<\/span>/)
      // The breakdown renders exactly once (no double-content from the
      // manual roll render).
      expect(card.content.match(/class="dcc-modifier-breakdown"/g)).toHaveLength(1)
    })

    // Phase 7 session 23 (legacy-decom step 3): a non-zero armor check
    // penalty on a str/agl ability check now renders adapter-side. The
    // penalty is NOT applied to the roll — the would-be total is pushed
    // as a secondary roll (rolls[1]) flagged via
    // `system.checkPenaltyRollIndex`, which `emoteAbilityRoll`
    // (module/chat.js) renders as the "If check penalty applies, total is
    // X" note. This was the last gate keeping `_rollAbilityCheckLegacy`
    // reachable; it is the branch only the legacy path previously covered.
    test('non-zero armor check penalty (str) emits the alt-total roll via the adapter', async ({ page }) => {
      const penalty = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Ability CheckPenalty', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1 Heavy Plate',
          type: 'armor',
          system: { equipped: true, checkPenalty: '-4' }
        }])
        // prepareData recomputes ac.checkPenalty from equipped armor
        // (computeCheckPenalty defaults on for a Player).
        return actor.system.attributes.ac.checkPenalty
      })
      expect(Number(penalty), 'equipped armor must yield a non-zero check penalty').not.toBe(0)

      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability CheckPenalty').rollAbilityCheck('str')
      })

      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'adapter', { abilityId: 'str' })

      const card = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Ability CheckPenalty' &&
              m.getFlag('dcc', 'isAbilityCheck')
            )
          if (msg) {
            return {
              checkPenaltyRollIndex: msg.system?.checkPenaltyRollIndex ?? null,
              rollTotals: msg.rolls.map(r => r.total)
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(card, 'ability-check adapter path must post a chat message').not.toBeNull()
      // The penalty is informational — the primary roll (rolls[0]) is
      // clean; the secondary roll (rolls[1]) carries the would-be total.
      expect(card.checkPenaltyRollIndex).toBe(1)
      expect(card.rollTotals).toHaveLength(2)
      expect(card.rollTotals[1]).toBe(card.rollTotals[0] + Number(penalty))
    })
  })

  // ── rollSavingThrow ─────────────────────────────────────────────────

  test.describe('rollSavingThrow', () => {
    test('default options → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Save Default')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Save Default').rollSavingThrow('ref')
      })
      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'adapter', { saveId: 'ref' })
    })

    // Phase 7 session 21 (legacy-decom step 1): DCC saves never use
    // roll-under (only Luck *ability* checks do), so the save gate's
    // dead `options.rollUnder` clause was dropped. A rollUnder option
    // on a save is now inert and the save routes through the adapter.
    test('rollUnder flag is inert on saves → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Save RollUnder')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Save RollUnder').rollSavingThrow('wil', { rollUnder: true })
      })
      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'adapter', { saveId: 'wil' })
    })

    // Legacy-decom step 2: the modifier dialog no longer routes saves to
    // legacy. The adapter surfaces the RollModifierDialog and folds the
    // user's choice into a `rollCheck` pass; dispatch fires before the
    // (blocking) dialog, fireAndForget dismisses it with Escape.
    test('showModifierDialog flag → adapter (legacy-decom step 2)', async ({ page }) => {
      await makePlayer(page, 'P1 Save Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Save Dialog').rollSavingThrow('frt', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'adapter', { saveId: 'frt' })
    })

    // Stronger end-to-end: drive the dialog to completion (click its
    // Roll button) rather than cancelling, and assert the posted chat
    // card carries the flattened `dialog-modifier` in flags.dcc.libResult.
    // Sta 16 → +2 Fortitude save, so the dialog's Modifier term flattens
    // to a single +2 dialog-modifier line on submit.
    test('showModifierDialog completes → adapter chat carries the flattened modifier', async ({ page }) => {
      await makePlayer(page, 'P1 Save Dialog Done', {
        abilities: { sta: { value: 16, max: 16 } }
      })
      // Fire the roll; it blocks on the modifier dialog.
      await page.evaluate(() => {
        window.__saveDialogPromise = game.actors
          .getName('P1 Save Dialog Done')
          .rollSavingThrow('frt', { showModifierDialog: true })
      })
      // Submit the dialog with its default values.
      const rollBtn = page.locator('.dcc-roll-modifier button.roll').first()
      await rollBtn.waitFor({ state: 'visible', timeout: 5000 })
      await rollBtn.click()

      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'adapter', { saveId: 'frt' })

      const card = await page.evaluate(async () => {
        const deadline = Date.now() + 4000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Save Dialog Done' &&
              m.getFlag('dcc', 'isSave') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) {
            const libResult = msg.getFlag('dcc', 'libResult')
            return {
              die: libResult.die,
              modifiers: libResult.modifiers ?? null
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(card, 'completed save dialog must post a chat message').not.toBeNull()
      expect(card.die).toBe('d20')
      // The per-source save modifier collapsed to one flat dialog-modifier
      // line carrying the +2 Fortitude bonus the user saw in the dialog.
      const dialogMod = (card.modifiers || []).find(m => m.origin?.id === 'dialog-modifier')
      expect(dialogMod, 'dialog must flatten to a dialog-modifier line').toBeDefined()
      expect(dialogMod.value).toBe(2)
    })

    // Cheesemaker repro — sheet shows Fortitude +1 (sta 14 → mod +1,
    // no class bonus at level 0); the rolled bonus must also equal +1.
    // Previously, the lib's save definition auto-added the governing
    // ability mod on top of `state.saves.*` (which already includes
    // it), producing `1d20 + 2`. Fixed in dcc-core-lib by dropping
    // `roll.ability` from save definitions.
    test('Fortitude roll bonus equals displayed save (no ability double-count)', async ({ page }) => {
      await page.evaluate(async () => {
        await Actor.create({
          name: 'P1 Save FortBonus',
          type: 'Player',
          system: {
            abilities: {
              str: { value: 15, max: 15 },
              agl: { value: 11, max: 11 },
              sta: { value: 14, max: 14 },
              per: { value: 17, max: 17 },
              int: { value: 16, max: 16 },
              lck: { value: 16, max: 16 }
            },
            details: { level: { value: 0 } }
          }
        })
      })

      const { displayedFort, formula, total, natural } = await page.evaluate(async () => {
        const actor = game.actors.getName('P1 Save FortBonus')
        const displayedFort = actor.system.saves.frt.value
        const roll = await actor.rollSavingThrow('frt')
        const die = roll.dice?.[0]
        return {
          displayedFort,
          formula: roll.formula,
          total: roll.total,
          natural: die?.total ?? null
        }
      })

      // Sanity: with sta 14 and no class, sheet should show +1.
      expect(displayedFort).toBe('+1')
      // Bonus = total - natural; must equal +1 (not +2).
      expect(total - natural, `formula=${formula} natural=${natural} total=${total}`).toBe(1)
    })
  })

  // ── rollSkillCheck ──────────────────────────────────────────────────

  test.describe('rollSkillCheck', () => {
    test('built-in skill (sneakSilently) → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Skill Builtin')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Builtin').rollSkillCheck('sneakSilently')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'sneakSilently' })
    })

    test('cleric skill with useDisapprovalRange + skillTable → adapter (D4 skill-table)', async ({ page }) => {
      // Phase 3 session 25 / D4(skill-table): divineAid (table +
      // useDisapprovalRange) now routes via `_skillTableViaAdapter`
      // instead of legacy `processSpellCheck`. The skillTable lookup,
      // chat emit, and drainDisapproval all live in the adapter.
      await makePlayer(page, 'P1 Skill Cleric')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Cleric').rollSkillCheck('divineAid')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'divineAid', mode: 'skillTable' })
    })

    test('skill item with die → adapter', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Skill Item Die', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Backstab',
          type: 'skill',
          system: {
            die: '1d14',
            ability: 'agl',
            value: '+2',
            config: { useDie: true, useAbility: true, useValue: true, useLevel: false, applyCheckPenalty: false }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Item Die').rollSkillCheck('P1-Backstab')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'P1-Backstab' })
    })

    test('description-only skill item (no die) → adapter (legacy-decom step 4)', async ({ page }) => {
      // Legacy-decom step 4: a skill item with `useDie:false` and no
      // value/ability/level has nothing to roll — it emits a description
      // chat card. This was the last gate keeping `_rollSkillCheckLegacy`
      // reachable; it now routes through `_emitSkillDescriptionViaAdapter`
      // with `mode: 'description'`.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Skill Item NoDie', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Lore',
          type: 'skill',
          system: {
            die: '',
            description: { value: 'Forbidden lore about cosmic indifference.' },
            config: { useDie: false, useAbility: false, useValue: false, useLevel: false }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Item NoDie').rollSkillCheck('P1-Lore')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'P1-Lore', mode: 'description' })

      // End-to-end: the adapter posted a description chat card (not a
      // roll) carrying the legacy flags + skill description.
      const card = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.flags?.dcc?.SkillId === 'P1-Lore')
          if (msg) {
            return {
              rollType: msg.flags?.dcc?.RollType,
              itemId: msg.flags?.dcc?.ItemId,
              isSkillCheck: msg.flags?.dcc?.isSkillCheck,
              hasLibResult: !!msg.flags?.dcc?.libResult,
              rollCount: msg.rolls?.length ?? 0,
              content: msg.content
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        return null
      })
      expect(card, 'description-only skill check must post a chat card').not.toBeNull()
      expect(card.rollType).toBe('SkillCheck')
      expect(card.itemId).toBe('P1-Lore')
      expect(card.isSkillCheck).toBe(true)
      // It is a description card, not a roll — no dice, no lib result.
      expect(card.hasLibResult).toBe(false)
      expect(card.rollCount).toBe(0)
      expect(card.content).toContain('skill-description')
      expect(card.content).toContain('Forbidden lore about cosmic indifference.')
    })

    test('description-only skill item with no description → adapter, posts nothing', async ({ page }) => {
      // Faithful to the legacy early-return: a useDie:false skill item
      // carrying no description value has nothing to roll AND nothing to
      // show, so the adapter route logs dispatch but creates no chat
      // message.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Skill Item Blank', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Blank',
          type: 'skill',
          system: {
            die: '',
            description: { value: '' },
            config: { useDie: false, useAbility: false, useValue: false, useLevel: false }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Item Blank').rollSkillCheck('P1-Blank')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'P1-Blank', mode: 'description' })

      // No chat card for this skill — give any async create a moment, then assert absence.
      const posted = await page.evaluate(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        return game.messages.contents.some(m => m.flags?.dcc?.SkillId === 'P1-Blank')
      })
      expect(posted, 'a description-less skill item must not post a chat card').toBe(false)
    })

    test('NPC skill item (useDie:false + value) → adapter, inherits action die', async ({ page }) => {
      // Regression: imported NPCs carry skill items configured with
      // `useDie: false` but a flat `value` (e.g. an NPC cleric's
      // "Divine Aid +4"). The Die column showed "--" and the check
      // rolled with no action die — it dropped to the legacy
      // description path / produced a die-less roll. The missing-die
      // fallback now also covers rollable skill items, so they inherit
      // the actor's action die and route through the adapter.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'NPC Skill InheritDie', type: 'NPC' })
        await actor.update({ 'system.config.actionDice': '1d20' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'NPC-DivineAid',
          type: 'skill',
          system: {
            die: '1d20',
            ability: 'int',
            value: '4',
            config: { useSummary: true, useDie: false, useAbility: false, useValue: true, useLevel: false, showLastResult: false, applyCheckPenalty: false }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('NPC Skill InheritDie').rollSkillCheck('NPC-DivineAid')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'NPC-DivineAid' })

      // End-to-end: the emitted roll inherited the actor's action die
      // (d20) and carried the flat +4 skill value.
      const result = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.flags?.dcc?.SkillId === 'NPC-DivineAid' && m.flags?.dcc?.libResult)
          if (msg) return msg.flags.dcc.libResult
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        return null
      })
      expect(result, 'NPC skill check must emit a lib roll result').not.toBeNull()
      expect(result.die).toBe('d20')
      const valueMod = (result.modifiers || []).find(m => m.origin?.id === 'skill-value')
      expect(valueMod, 'NPC skill +4 value must carry through').toBeDefined()
      expect(valueMod.value).toBe(4)
    })

    test('showModifierDialog flag → adapter (session 26 / Q7)', async ({ page }) => {
      // Phase 3 session 26 (open question #7): the
      // `showModifierDialog` clause no longer routes to legacy. The
      // adapter path opens the existing `RollModifierDialog` via
      // `promptRollModifierDialog`, then folds the user's choice into
      // the lib pass. Dispatch fires at the start of
      // `_rollSkillCheckViaAdapter` before the (blocking) dialog
      // shows — fireAndForget dismisses the dialog with Escape so
      // the test run continues. The cancel resolves the prompt with
      // null and the adapter returns without rolling, which is fine
      // for this test — we're asserting on the dispatch path, not
      // the chat output.
      await makePlayer(page, 'P1 Skill Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Skill Dialog').rollSkillCheck('sneakSilently', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'sneakSilently' })
    })

    test('skill-table + showModifierDialog → adapter (session 26 / Q7)', async ({ page }) => {
      // Q7 parallel: skill-table routes (divineAid etc.) already
      // forwarded `options` through `DCCRoll.createRoll`, so the
      // dialog has always worked for them — but the dispatcher's
      // `!!options.showModifierDialog → legacy` clause shadowed
      // that. Now the dispatcher routes skill-table dialog calls
      // to `_skillTableViaAdapter` like any other skill-table
      // invocation. Verify the dispatch mode field still carries
      // `skillTable` so downstream telemetry / debugging can tell
      // them apart from plain skill checks.
      await makePlayer(page, 'P1 Skill Cleric Dialog', {
        class: { className: 'Cleric', disapproval: 1 },
        details: { sheetClass: 'Cleric' }
      })
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Skill Cleric Dialog').rollSkillCheck('divineAid', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'divineAid', mode: 'skillTable' })
    })

    // Regression: unknown skillId must NOT crash. Pre-fix the legacy
    // path dereferenced an undefined `skill.value`; now `rollSkillCheck`
    // warns and returns when `_resolveSkill` finds nothing — neither
    // adapter nor legacy fires, no chat is posted.
    test('unknown skill id warns and posts no chat', async ({ page }) => {
      await makePlayer(page, 'P1 Skill Unknown')
      const result = await page.evaluate(async () => {
        const before = game.messages.contents.length
        const errors = []
        const onError = (e) => errors.push(String(e?.error || e))
        window.addEventListener('error', onError)
        try {
          await game.actors.getName('P1 Skill Unknown').rollSkillCheck('thisSkillDoesNotExistAnywhere')
        } catch (e) {
          errors.push('THROW: ' + String(e))
        }
        window.removeEventListener('error', onError)
        await new Promise(resolve => setTimeout(resolve, 300))
        return {
          newMessages: game.messages.contents.length - before,
          errors,
          warnings: Array.from(document.querySelectorAll('#notifications .notification.warning'))
            .map(n => n.textContent.trim())
        }
      })

      expect(result.errors, `unexpected errors: ${result.errors.join(' | ')}`).toEqual([])
      expect(result.newMessages).toBe(0)
      expect(result.warnings.some(w => w.includes('thisSkillDoesNotExistAnywhere')),
        `expected warning mentioning the unknown skill; got: ${result.warnings.join(' | ')}`).toBe(true)
    })
  })

  // ── getInitiativeRoll ───────────────────────────────────────────────

  test.describe('getInitiativeRoll', () => {
    test('default → adapter with die=1d20', async ({ page }) => {
      await makePlayer(page, 'P1 Init Default')
      await page.evaluate(() => {
        game.actors.getName('P1 Init Default').getInitiativeRoll()
      })
      const line = await waitForAdapterLog('rollInit')
      assertPath(line, 'adapter', { die: '1d20' })
    })

    // Legacy-decom step 2: the modifier dialog no longer routes init to
    // legacy. `getInitiativeRoll` stays synchronous for the combat-tracker
    // path, but the dialog branch (reached only via `rollInit`, which
    // awaits) routes through `_getInitiativeRollWithDialogViaAdapter`,
    // which logs `dialog=true` before the (blocking) dialog opens. The
    // afterEach hook closes the open dialog window.
    test('showModifierDialog flag → adapter (legacy-decom step 2)', async ({ page }) => {
      await makePlayer(page, 'P1 Init Dialog')
      await page.evaluate(() => {
        game.actors.getName('P1 Init Dialog').getInitiativeRoll(null, { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollInit')
      assertPath(line, 'adapter', { dialog: true })
    })

    test('pre-built Roll short-circuits without dispatch log', async ({ page }) => {
      await makePlayer(page, 'P1 Init Prebuilt')
      const returned = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Init Prebuilt')
        const preRoll = new Roll('1d20')
        const result = actor.getInitiativeRoll(preRoll)
        return result === preRoll
      })
      expect(returned).toBe(true)
      await page.waitForTimeout(250)
      const initLogs = adapterLogs.filter(l => l.includes('rollInit'))
      expect(initLogs, `expected no rollInit logs, got: ${initLogs.join('\n')}`).toHaveLength(0)
    })

    test('equipped two-handed weapon overrides die → adapter with weapon die', async ({ page }) => {
      const actualDie = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Init TwoHanded', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1 Greataxe',
          type: 'weapon',
          system: {
            equipped: true,
            twoHanded: true,
            initiativeDie: '1d14'
          }
        }])
        return actor.items.getName('P1 Greataxe').system.initiativeDie
      })
      await page.evaluate(() => {
        game.actors.getName('P1 Init TwoHanded').getInitiativeRoll()
      })
      const line = await waitForAdapterLog('rollInit')
      // The weapon's initiativeDie may be normalized by the data model;
      // verify the adapter picked up whatever it ended up as, not 1d20.
      expect(actualDie, 'weapon initiativeDie should not fall back to 1d20').not.toBe('1d20')
      assertPath(line, 'adapter', { die: actualDie })
    })

    test('custom-init-die weapon overrides an equipped two-handed weapon (single-pass fold order)', async ({ page }) => {
      // `_getInitiativeRollViaAdapter` gathers the first equipped two-handed
      // weapon and the first equipped custom-init-die weapon in a single pass
      // over `actor.items`, applying the custom-init weapon last so it WINS
      // when both are equipped. This probe equips BOTH on one live actor (the
      // two-handed item created first, so a naive forward pass would set its
      // die before the override) and asserts the override die — not the
      // two-handed die — reaches the adapter log + the produced Roll, with the
      // `[Weapon]` label rather than the two-handed label.
      const dice = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Init OverrideOrder', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [
          {
            name: 'P1 Greataxe',
            type: 'weapon',
            system: { equipped: true, twoHanded: true, initiativeDie: '1d16' }
          },
          {
            name: 'P1 Quickblade',
            type: 'weapon',
            system: {
              equipped: true,
              initiativeDie: '1d24',
              config: { initiativeDieOverride: '1d24' }
            }
          }
        ])
        return {
          twoHanded: actor.items.getName('P1 Greataxe').system.initiativeDie,
          custom: actor.items.getName('P1 Quickblade').system.initiativeDie
        }
      })
      const result = await page.evaluate(async () => {
        const roll = game.actors.getName('P1 Init OverrideOrder').getInitiativeRoll()
        return { formula: roll.formula }
      })
      const line = await waitForAdapterLog('rollInit')
      // The custom-init weapon's die wins; the two-handed die is suppressed.
      expect(dice.custom, 'custom initiativeDie should not normalize to the two-handed die').not.toBe(dice.twoHanded)
      assertPath(line, 'adapter', { die: dice.custom })
      expect(result.formula, `formula: ${result.formula}`).toContain(dice.custom)
      expect(result.formula).not.toContain(dice.twoHanded)
      // Custom-init weapon → DCC.Weapon label, not the two-handed label.
      expect(result.formula).toContain('[Weapon]')
      expect(result.formula).not.toContain('[Two-Handed]')
    })

    test('compound additive init die (Mutant Horror 1d20+1d3) survives the combat-tracker path', async ({ page }) => {
      // mcc-core-book §9.2a folds the Mutant Horror die into init.die as
      // `1d20+1d3`. The combat-tracker init path (no dialog →
      // `_getInitiativeRollViaAdapter`) used to flatten it through the
      // lib's single-die model and silently drop the `+1d3`, rolling only
      // 1d20; the adapter now re-appends the additive tail Foundry-side.
      // (The sheet "Roll Initiative" button — the legacy/dialog path — was
      // never affected.) This probe drives the live combat-tracker entry
      // point and asserts both dice survive into the produced Roll.
      await makePlayer(page, 'P1 Init Additive', { attributes: { init: { die: '1d20+1d3' } } })
      const result = await page.evaluate(async () => {
        const roll = game.actors.getName('P1 Init Additive').getInitiativeRoll()
        await roll.evaluate()
        return { formula: roll.formula, diceCount: roll.dice.length }
      })
      const line = await waitForAdapterLog('rollInit')
      assertPath(line, 'adapter', { die: '1d20+1d3' })
      // Both dice survive into the combat-tracker roll (lib's leading d20 +
      // the re-appended horror die), not just the flattened 1d20.
      expect(result.formula).toMatch(/1d20/)
      expect(result.formula).toMatch(/1d3/)
      expect(result.diceCount, `formula: ${result.formula}`).toBe(2)
    })
  })

  // ── rollSpellCheck (Phase 2) ────────────────────────────────────────

  test.describe('rollSpellCheck', () => {
    test('generic-castingMode spell item → adapter (generic)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Spell Generic', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Generic-Cantrip',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'generic', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Generic').rollSpellCheck({ spell: 'P1-Generic-Cantrip' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Generic-Cantrip', mode: 'generic' })
    })

    test('wizard-castingMode spell item on a Wizard actor → adapter (wizard)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Wizard',
          type: 'Player',
          system: { class: { className: 'Wizard' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Wizard-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Wizard').rollSpellCheck({ spell: 'P1-Wizard-Spell' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Wizard-Spell', mode: 'wizard' })
    })

    test('failed wizard cast fires onSpellLost → spell item system.lost becomes true (Phase 7 session 29)', async ({ page }) => {
      // PR #720 test-coverage gap: `onSpellLost` was tested as a direct
      // callback (adapter-spell-check.test.js) but never verified to fire
      // during a REAL adapter cast.
      //
      // Forcing a deterministic spell-loss: the adapter builds no per-spell
      // result table (`results: []`), so the lib uses its default tier ladder
      // where total <= 1 → tier 'lost' (cast.js:130). We make the total <= 1
      // for EVERY die outcome. `spellCheck.die` is a DiceField, so it must be
      // a valid chain die (`1d1` would be coerced to the 1d20 default) — use
      // `1d3` (natural 1-3). With INT 3 (modifier -3) and level 1 the
      // wizard's spell-check total is natural + level + intMod = natural - 2
      // ∈ {-1, 0, 1}, all <= 1 → tier 'lost'. (A natural 1 additionally forces
      // a fumble with total → 1, cast.js:252 — still 'lost'.) `spellLost` →
      // the adapter's `createSpellEvents.onSpellLost` runs
      // `spellItem.update({ system.lost: true })`. (`createSpellEvents` wires
      // only onSpellLost / disapproval / spellburn / patronTaint; with no
      // patron and no spellburn, onSpellLost is the only handler that fires.)
      // The update is fire-and-forget (the lib doesn't await it), so poll the
      // item for the flag rather than reading it immediately.
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 SpellLost Wizard',
          type: 'Player',
          system: {
            class: { className: 'Wizard' },
            details: { level: { value: 1 } },
            abilities: { int: { value: 3 } }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Lost-Spell',
          type: 'spell',
          system: {
            // inheritActionDie:false keeps our small spellCheck.die — otherwise
            // item.js:231 overwrites it with the actor's action die (1d20).
            config: { castingMode: 'wizard', inheritCheckPenalty: true, inheritActionDie: false },
            level: 1,
            spellCheck: { die: '1d3', value: '+0', penalty: '-0' },
            lost: false
          }
        }])

        const lostBefore = actor.items.getName('P1-Lost-Spell').system.lost

        let lostAfter = false
        try {
          await actor.rollSpellCheck({ spell: 'P1-Lost-Spell' })

          // onSpellLost → spellItem.update(...) is fire-and-forget (the lib
          // doesn't await it), so poll the item for the flag up to ~3s.
          for (let i = 0; i < 60; i++) {
            if (actor.items.getName('P1-Lost-Spell')?.system?.lost === true) { lostAfter = true; break }
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        } finally {
          // Clean up so the leftover wizard + lost spell can't pollute later
          // tests sharing this world.
          await actor.delete()
        }
        return { lostBefore, lostAfter }
      })

      // Confirm the cast routed through the adapter — onSpellLost lives in
      // createSpellEvents (adapter), not the legacy actor.loseSpell path.
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Lost-Spell', mode: 'wizard' })

      expect(result.lostBefore).toBe(false)
      expect(result.lostAfter, 'onSpellLost should flip the spell item system.lost to true after a failed wizard cast').toBe(true)
    })

    test('wizard-castingMode spell item on a patron-bound wizard → adapter (session 4)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell WizardPatron',
          type: 'Player',
          system: { class: { className: 'Wizard', patron: 'Bobugbubilz' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Patron-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            associatedPatron: 'Bobugbubilz'
          }
        }])
      })
      const beforeChance = await page.evaluate(() => {
        return game.actors.getName('P1 Spell WizardPatron').system.class.patronTaintChance
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell WizardPatron').rollSpellCheck({ spell: 'P1-Patron-Spell' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Patron-Spell', mode: 'wizard' })

      // D3a — lib-driven creeping-chance bump. Starting chance is 1%
      // (template default); a d100 roll rarely hits 1, so almost always
      // misses and the chance increments to 2%. Very occasionally the
      // chance hits and resets to 1% — both outcomes are acceptable
      // (the bump-on-miss behavior is what we're exercising; accept
      // either value to keep the test flake-free).
      const afterChance = await page.evaluate(() => {
        return game.actors.getName('P1 Spell WizardPatron').system.class.patronTaintChance
      })
      const before = parseInt(beforeChance) || 1
      const after = parseInt(afterChance) || 1
      const acceptable = after === before + 1 || after === 1
      expect(acceptable, `patronTaintChance after cast should be ${before + 1}% (miss) or 1% (acquisition reset), got ${afterChance}`).toBe(true)
    })

    // D3a — patron-taint acquisition path. Seeding a high starting
    // chance (99%) means a d100 roll almost certainly hits; the lib
    // returns `newPatronTaintChance = 1` per RAW and the adapter
    // persists it.
    test('patron-bound wizard with high taint chance → acquisition resets chance to 1%', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell WizardPatronHigh',
          type: 'Player',
          system: {
            class: {
              className: 'Wizard',
              patron: 'Bobugbubilz',
              // 99% — virtually any d100 roll (1..99) acquires.
              patronTaintChance: '99%'
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Patron-Spell-High',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            associatedPatron: 'Bobugbubilz'
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell WizardPatronHigh').rollSpellCheck({ spell: 'P1-Patron-Spell-High' })
      })
      await waitForAdapterLog('rollSpellCheck')

      const afterChance = await page.evaluate(() => {
        return game.actors.getName('P1 Spell WizardPatronHigh').system.class.patronTaintChance
      })
      // With 99% chance, d100 roll 1..99 acquires → chance resets to 1%.
      // Only a roll of exactly 100 misses → chance increments to 100%.
      // 99/100 ≈ 1% flake rate; accept either for resilience.
      const acceptable = afterChance === '1%' || afterChance === '100%'
      expect(acceptable, `expected chance to reset to 1% (near-certain acquisition with 99% starting chance) or increment to 100% (100-roll miss), got ${afterChance}`).toBe(true)
    })

    // D3a — non-patron spell on a patron-bound wizard skips the taint
    // check entirely. Starting chance stays unchanged regardless of
    // outcome.
    test('patron-bound wizard casting a non-patron spell → patronTaintChance unchanged', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell WizardPatronNonPatronSpell',
          type: 'Player',
          system: {
            class: {
              className: 'Wizard',
              patron: 'Bobugbubilz',
              patronTaintChance: '5%'
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          // Plain spell name (no "Patron") + no associatedPatron → not
          // a patron-based cast per the adapter's `isPatronSpell` heuristic.
          name: 'P1-Mundane-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell WizardPatronNonPatronSpell').rollSpellCheck({ spell: 'P1-Mundane-Spell' })
      })
      await waitForAdapterLog('rollSpellCheck')

      const afterChance = await page.evaluate(() => {
        return game.actors.getName('P1 Spell WizardPatronNonPatronSpell').system.class.patronTaintChance
      })
      expect(afterChance, 'non-patron casts must not touch patronTaintChance').toBe('5%')
    })

    // D3b — patron-taint manifestation table end-to-end. With
    // `dcc-core-book` installed (it ships 5 core patron-taint
    // manifestation RollTables in `dcc-core-spell-side-effect-tables`
    // and the adapter's `CONFIG.DCC.patronTaintPacks` registers that
    // pack by default), the adapter resolves Bobugbubilz's authored
    // table and the lib's `rollPatronTaint` indexes a d6 on it. A
    // starting chance of 100% guarantees creeping-chance acquisition
    // (d100 roll 1..100 all hit), and the resulting manifestation
    // text surfaces in the `onPatronTaint` chat emote.
    //
    // The loader also accepts a world-level RollTable as fallback;
    // the `loadPatronTaintTable` unit tests cover that path. This
    // integration guard focuses on the default real-content path.
    test('wizard patron-cast with compendium taint table → manifestation text in chat', async ({ page }) => {
      // Skip cleanly when dcc-core-book isn't installed in this world —
      // the adapter wiring is proved by the unit tests in that case.
      const hasCoreBookPack = await page.evaluate(() => {
        return !!game.packs.get('dcc-core-book.dcc-core-spell-side-effect-tables')
      })
      test.skip(!hasCoreBookPack, 'dcc-core-book pack not installed in this world')

      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell WizardTaintManifest',
          type: 'Player',
          system: {
            class: {
              className: 'Wizard',
              patron: 'Bobugbubilz',
              patronTaintChance: '100%'
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Taint-Manifest-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            associatedPatron: 'Bobugbubilz'
          }
        }])
      })

      const before = await page.evaluate(() => game.messages.contents.length)

      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell WizardTaintManifest').rollSpellCheck({ spell: 'P1-Taint-Manifest-Spell' })
      })
      await waitForAdapterLog('rollSpellCheck')

      // Let the onPatronTaint chat message post.
      await page.waitForTimeout(300)

      const { taintMessageContent, isPatronTaintFlag, afterChance } = await page.evaluate((beforeCount) => {
        const newMessages = game.messages.contents.slice(beforeCount)
        const taintMsg = newMessages.find(m => m.flags?.dcc?.isPatronTaint === true)
        return {
          taintMessageContent: taintMsg?.content || null,
          isPatronTaintFlag: !!taintMsg,
          afterChance: game.actors.getName('P1 Spell WizardTaintManifest').system.class.patronTaintChance
        }
      }, before)

      expect(isPatronTaintFlag, 'onPatronTaint chat emote must post when taint is acquired').toBe(true)
      // Every entry on the Bobugbubilz d6 manifestation table mentions
      // "the caster" — the shared anchor lets the assertion stay
      // robust across whichever row the lib rolls.
      expect(taintMessageContent, 'chat emote must carry manifestation text from the compendium table').toMatch(/caster/i)
      // The fallback "Patron taint from Bobugbubilz" message (emitted
      // by the lib when no table resolves) must NOT appear — that
      // would mean the loader didn't find the pack.
      expect(taintMessageContent, 'loader must resolve the compendium table, not fall through to the minimal event')
        .not.toMatch(/Patron taint from Bobugbubilz/i)
      // 100% chance acquires (d100 1..100) → RAW reset to 1%.
      expect(afterChance, 'acquisition must reset chance to 1%').toBe('1%')
    })

    // Regression: programmatic PC with `class.className: 'Cleric'` but
    // no `details.sheetClass` (skips the level-change dialog) must still
    // route a cleric-castingMode cast through the adapter. Pre-fix the
    // dispatcher's `isCleric` gate keyed only on `sheetClass`, so this
    // shape fell through to the legacy path — and `DCCItem.rollSpellCheck`
    // silently no-ops for cleric-mode items without a recognized handler
    // (no chat, no error, user-facing cast vanishes).
    test('cleric-castingMode spell on className-only Cleric (no sheetClass) → adapter + chat', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell ClericNoSheetClass',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1 }
            // details.sheetClass intentionally omitted — simulates
            // programmatic creation without the level-change dialog.
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Cleric-Spell-NoSheet',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'cleric', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })

      const { newMessages, errors, sheetClass } = await page.evaluate(async () => {
        const actor = game.actors.getName('P1 Spell ClericNoSheetClass')
        const sheetClass = actor.system.details?.sheetClass || ''
        const before = game.messages.contents.length
        const errs = []
        const onError = (e) => errs.push(String(e?.error || e))
        window.addEventListener('error', onError)
        try {
          await actor.rollSpellCheck({ spell: 'P1-Cleric-Spell-NoSheet' })
        } catch (e) {
          errs.push('THROW: ' + String(e))
        }
        window.removeEventListener('error', onError)
        await new Promise(resolve => setTimeout(resolve, 300))
        return {
          sheetClass,
          newMessages: game.messages.contents.length - before,
          errors: errs
        }
      })

      // Sanity — this test only matters if sheetClass is empty.
      expect(sheetClass).toBe('')
      expect(errors, `unexpected errors: ${errors.join(' | ')}`).toEqual([])

      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Cleric-Spell-NoSheet', mode: 'cleric' })

      // Adapter fired a real cast — chat message posted (not the
      // pre-fix silent no-op).
      expect(newMessages).toBeGreaterThanOrEqual(1)
    })

    test('cleric-castingMode spell item on a Cleric actor → adapter (cleric)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Cleric',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1 },
            details: { sheetClass: 'Cleric' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Cleric-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'cleric', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Cleric').rollSpellCheck({ spell: 'P1-Cleric-Spell' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Cleric-Spell', mode: 'cleric' })
    })

    // Phase 3 session 24 / D4 — gate-widen via lib `profileOverride`.
    // Wizard-castingMode spell cast by a Cleric actor (and the symmetric
    // cleric-mode-on-non-cleric case) now route through the adapter with
    // a profile override so the lib applies the spell's mechanic-class
    // behavior (spellburn / spell-loss / patron-taint for wizard,
    // disapproval for cleric) regardless of the actor's class.
    test('wizard-castingMode spell on a Cleric actor → adapter (D4 profile override)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell D4 WizardOnCleric',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1, spellCheckAbility: 'per' },
            details: { sheetClass: 'Cleric' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-D4-Wizard-On-Cleric',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell D4 WizardOnCleric').rollSpellCheck({ spell: 'P1-D4-Wizard-On-Cleric' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', {
        spell: 'P1-D4-Wizard-On-Cleric',
        mode: 'wizard',
        profileOverride: 'wizard'
      })
    })

    test('cleric-castingMode spell on a non-Cleric actor → adapter (D4 profile override)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell D4 ClericOnWizard',
          type: 'Player',
          system: {
            class: { className: 'Wizard', spellCheckAbility: 'int' },
            details: { sheetClass: 'Wizard' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-D4-Cleric-On-Wizard',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'cleric', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell D4 ClericOnWizard').rollSpellCheck({ spell: 'P1-D4-Cleric-On-Wizard' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', {
        spell: 'P1-D4-Cleric-On-Wizard',
        mode: 'cleric',
        profileOverride: 'cleric'
      })
    })

    test('naked spell check (no item) → adapter (D4 naked)', async ({ page }) => {
      // Phase 3 session 25 / D4(naked): naked spell-check rolls now
      // route through `_castNakedViaAdapter` (mode=naked) instead of
      // the legacy term-builder + `processSpellCheck({rollTable:null})`.
      await makePlayer(page, 'P1 Spell Naked')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Naked').rollSpellCheck()
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { mode: 'naked' })
    })

    test('naked spell check on a Cleric actor → adapter cleric profile (D4 naked)', async ({ page }) => {
      await page.evaluate(async () => {
        await Actor.create({
          name: 'P1 Spell Naked Cleric',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1, spellCheckAbility: 'per' },
            details: { sheetClass: 'Cleric' }
          }
        })
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Naked Cleric').rollSpellCheck()
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { mode: 'naked' })
    })

    test('naked spell check honors options.checkLabel as the chat flavor (SPELL_CHECK_LABEL_OVERRIDE)', async ({ page }) => {
      // A raw (no-item) spell check can carry a label override so a
      // class/module relabels the chat flavor (e.g. MCC's "Mutation
      // Check") instead of the generic "Spell Check". `checkLabel` is
      // an i18n key or a literal — a literal passes through `localize`
      // unchanged. Downstream MCC wires it from a `data-check-label`
      // cell attribute via the sheet's `#rollSpellCheck` action.
      await makePlayer(page, 'P1 Spell CheckLabel', {
        class: { className: 'Wizard', spellCheckAbility: 'int' },
        details: { sheetClass: 'Wizard' }
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell CheckLabel').rollSpellCheck({ checkLabel: 'Mutation Check' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { mode: 'naked' })

      const flavor = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Spell CheckLabel' &&
              m.getFlag('dcc', 'RollType') === 'SpellCheck'
            )
          if (msg) return msg.flavor
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flavor, 'checkLabel must drive the raw spell-check chat flavor').not.toBeNull()
      expect(flavor.startsWith('Mutation Check')).toBe(true)
      expect(flavor.includes('Spell Check')).toBe(false)
    })

    test('forceCrit shift-click flag pushes natural to 20 on the adapter route (D4 forceCrit)', async ({ page }) => {
      // Phase 3 session 25 / D4(forceCrit): `options.forceCrit` flows
      // through every spell-check adapter route via the shared
      // `applyForceCritToFoundryRoll` helper — the Foundry Roll's
      // natural mutates to 20 (shown in chat) and the lib reads the
      // same value (so its tier classification matches).
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell ForceCrit',
          type: 'Player',
          system: {
            class: { className: 'Wizard', spellCheckAbility: 'int' },
            details: { sheetClass: 'Wizard' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-ForceCrit-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      // `applyForceCritToFoundryRoll` (actor.js:51) forces the natural to 20
      // for every underlying d20 roll EXCEPT a natural 1 — a fumble overrides
      // a forced crit, so the helper returns the natural unchanged. The test
      // casts a real (uncontrolled) d20, so a ~1/20 natural-1 leaves the
      // natural at 1 and the assertion would fail. Retry past that case so the
      // assertion is deterministic. (Before this fix the test failed ~5% of
      // runs; it was mislabeled a "suite-only state-pollution flake" — it's a
      // dice-probability flake, full-suite runs just gave more observations.)
      const libNatural = await page.evaluate(async () => {
        const actor = game.actors.getName('P1 Spell ForceCrit')
        // The forceCrit success can trigger a follow-up Mercurial Magic chat
        // message (success-major tier on a first-cast wizard spell), so read
        // the spell-check message explicitly via its `RollType` flag, scoped
        // to THIS actor (immune to other tests' stale messages).
        const readNatural = () => {
          const spellMsg = [...game.messages.contents].reverse().find(m =>
            m.flags?.dcc?.RollType === 'SpellCheck' &&
            m.flags?.dcc?.libResult &&
            m.speaker?.actor === actor.id
          )
          return spellMsg?.flags?.dcc?.libResult?.natural
        }
        let natural
        for (let i = 0; i < 16; i++) {
          // A retried attempt only happens after a natural-1 fumble, which
          // loses the wizard spell — clear the lost flag so the next cast is
          // not declined.
          await actor.items.getName('P1-ForceCrit-Spell').update({ 'system.lost': false })
          await actor.rollSpellCheck({ spell: 'P1-ForceCrit-Spell', forceCrit: true })
          natural = readNatural()
          if (natural === 20) break // forceCrit applied (underlying roll was 2-20)
        }
        await actor.delete()
        return natural
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-ForceCrit-Spell', mode: 'wizard' })
      expect(libNatural).toBe(20)
    })

    test('wizard cast with options.spellburn reduces physical ability scores (session 5)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Spellburn',
          type: 'Player',
          system: {
            class: { className: 'Wizard' },
            abilities: {
              str: { value: 14, max: 14 },
              agl: { value: 12, max: 12 },
              sta: { value: 13, max: 13 },
              per: { value: 10, max: 10 },
              int: { value: 16, max: 16 },
              lck: { value: 10, max: 10 }
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Spellburn-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })

      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Spellburn').rollSpellCheck({
          spell: 'P1-Spellburn-Spell',
          spellburn: { str: 2, agl: 0, sta: 1 }
        })
      })

      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Spellburn-Spell', mode: 'wizard' })

      // Allow async actor.update to land (onSpellburnApplied bridge).
      await page.waitForTimeout(300)

      const { str, agl, sta } = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Spell Spellburn')
        return {
          str: actor.system.abilities.str.value,
          agl: actor.system.abilities.agl.value,
          sta: actor.system.abilities.sta.value
        }
      })
      // Burn: str -2 → 12, agl unchanged → 12, sta -1 → 12.
      expect(str).toBe(12)
      expect(agl).toBe(12)
      expect(sta).toBe(12)
    })

    test('wizard cast with showModifierDialog → adapter unified prompt (session 27 / Q7-phase2)', async ({ page }) => {
      // Q7-phase2 (2026-05-17): the bespoke `promptSpellburnCommitment`
      // pop-up retired in favor of `promptRollModifierDialog`. Wizard
      // spell-check with `showModifierDialog` now surfaces the same
      // legacy `RollModifierDialog` (Die / Compound / CheckPenalty /
      // Spellburn) the legacy `DCCItem.rollSpellCheck` path showed —
      // adapter-side, with the user's choices threaded through the lib.
      // Dispatch fires at the start of `_rollSpellCheckViaAdapter`
      // before the (blocking) dialog opens; fireAndForget dismisses the
      // dialog with Escape so the test run continues.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Wizard Dialog',
          type: 'Player',
          system: { class: { className: 'Wizard' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Wizard-Dialog-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Spell Wizard Dialog').rollSpellCheck({
          spell: 'P1-Wizard-Dialog-Spell',
          showModifierDialog: true
        })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', {
        spell: 'P1-Wizard-Dialog-Spell',
        mode: 'wizard'
      })
    })

    test('cleric cast with showModifierDialog → adapter unified prompt (session 27 / Q7-phase2)', async ({ page }) => {
      // Q7-phase2 — cleric branch in the dispatcher now opens the
      // unified `RollModifierDialog` too (no Spellburn, no CheckPenalty
      // since idol-magic clerics skip both). Pre-Q7-phase2 the cleric
      // showModifierDialog path silently routed through the adapter
      // without surfacing any dialog.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Cleric Dialog',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1, spellCheckAbility: 'per' },
            details: { sheetClass: 'Cleric' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Cleric-Dialog-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'cleric', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Spell Cleric Dialog').rollSpellCheck({
          spell: 'P1-Cleric-Dialog-Spell',
          showModifierDialog: true
        })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', {
        spell: 'P1-Cleric-Dialog-Spell',
        mode: 'cleric'
      })
    })

    test('naked cast with showModifierDialog → adapter unified prompt (session 27 / Q7-phase2)', async ({ page }) => {
      // Naked path mirrors the wizard / cleric branches — the adapter's
      // showModifierDialog clause now calls `promptRollModifierDialog`
      // with a Spellburn descriptor for non-cleric actors. Cancel via
      // Escape; the adapter returns without rolling.
      await makePlayer(page, 'P1 Spell Naked Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Spell Naked Dialog').rollSpellCheck({
          showModifierDialog: true
        })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { mode: 'naked' })
    })

    test('wizard first-cast pre-rolls mercurial magic (session 5)', async ({ page }) => {
      // CONFIG.DCC.mercurialMagicTable is set from a world setting at
      // init. Skip gracefully when no table is configured in this world
      // — the adapter falls back to silent no-op in that case.
      const tableConfigured = await page.evaluate(() => !!CONFIG.DCC.mercurialMagicTable)
      test.skip(!tableConfigured, 'No mercurialMagicTable configured in this world')

      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Mercurial',
          type: 'Player',
          system: { class: { className: 'Wizard' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Mercurial-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })

      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Mercurial').rollSpellCheck({ spell: 'P1-Mercurial-Spell' })
      })

      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Mercurial-Spell', mode: 'wizard' })

      // Allow the async item.update to land.
      await page.waitForTimeout(400)

      const mercurialValue = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Spell Mercurial')
        const item = actor.items.getName('P1-Mercurial-Spell')
        return item?.system?.mercurialEffect?.value
      })
      // Foundry's spell data model coerces mercurialEffect.value to a
      // string at save time — normalize before the numeric assertion.
      expect(Number(mercurialValue), 'mercurial effect should be rolled and stored on first cast').toBeGreaterThan(0)
    })

    // ── reason=... telemetry for silent adapter→legacy fallbacks ──
    // Each test below asserts a reason-code dispatch log fires at a
    // previously-silent fall-back site so debugging doesn't need a
    // code read. Mirrored 1:1 by vitest cases in
    // `module/__tests__/adapter-spell-check.test.js`.

    test('wizard-castingMode spell on a class the lib does not know → adapter derives the profile from the castingMode (reason=profileFromCastingMode)', async ({ page }) => {
      // Warrior isn't in the lib's caster-profile registry, so
      // `buildSpellCheckArgs` returns null for the class. Pre-Phase-7-s16
      // the dispatcher fell back to `_rollSpellCheckLegacy` (which
      // silently ignored spellburn — PR #720 design-call #1). Now the
      // adapter retries with `castingModeOverride: 'wizard'`, derives the
      // canonical wizard profile, and the cast stays adapter-owned. The
      // `reason=profileFromCastingMode` log is the signal it happened.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell NoCasterProfile',
          type: 'Player',
          system: {
            class: { className: 'Warrior' },
            details: { sheetClass: 'Warrior' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Orphan-Wizard-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell NoCasterProfile').rollSpellCheck({ spell: 'P1-Orphan-Wizard-Spell' })
      })

      // No legacy line — the cast is fully adapter-owned now.
      await waitForAdapterLog('rollSpellCheck')
      const legacyLine = adapterLogs.find(l =>
        l.startsWith(`${ADAPTER_TAG} rollSpellCheck`) &&
        l.includes('LEGACY path')
      )
      expect(legacyLine,
        `expected NO legacy-fallback log; adapterLogs=\n${adapterLogs.join('\n')}`
      ).toBeUndefined()

      // The castingMode-derived fallback emits its own reason marker.
      const derivedLine = adapterLogs.find(l =>
        l.startsWith(`${ADAPTER_TAG} rollSpellCheck`) &&
        l.includes('via adapter') &&
        l.includes('reason=profileFromCastingMode')
      )
      expect(derivedLine,
        `expected reason=profileFromCastingMode adapter log; adapterLogs=\n${adapterLogs.join('\n')}`
      ).toBeTruthy()
      expect(derivedLine).toContain('mode=wizard')
    })

    test('spellburn on a class the lib does not know is HONORED (PR #720 design-call #1 — the burn deducts ability points)', async ({ page }) => {
      // The end-to-end proof that retiring the noCasterProfile→legacy
      // fallback fixed design-call #1: an unregistered-class wizard cast
      // with a pre-committed spellburn now deducts the burned ability
      // points (it routes through `_castViaCalculateSpellCheck`, whose
      // `onSpellburnApplied` bridge subtracts the burn). Pre-s16 the
      // legacy path silently dropped the commitment.
      const strAfter = await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Burn Honored',
          type: 'Player',
          system: {
            class: { className: 'Warrior' },
            details: { sheetClass: 'Warrior' },
            abilities: { str: { value: 12 } }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Burn-Wizard-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
        await actor.rollSpellCheck({ spell: 'P1-Burn-Wizard-Spell', spellburn: { str: 3, agl: 0, sta: 0 } })
        return game.actors.getName('P1 Spell Burn Honored').system.abilities.str.value
      })

      // 12 - 3 = 9. Had the burn been dropped (the pre-s16 bug) it would
      // still read 12.
      expect(strAfter).toBe(9)
    })

    test('spellburn may reduce a physical ability all the way to 0 (DCC RAW, floor-0 design call)', async ({ page }) => {
      // Resolution of the PR #720 floor-1-vs-0 design call: per DCC RAW a
      // caster may burn a physical ability to 0 (burning Stamina to 0 is
      // lethal — an intentional rules feature). The `onSpellburnApplied`
      // bridge now clamps at 0, not 1. Pre-fix the same cast would have
      // floored Stamina at 1; this asserts the burned score reaches 0 live.
      const staAfter = await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Burn To Zero',
          type: 'Player',
          system: {
            class: { className: 'Wizard' },
            details: { sheetClass: 'Wizard' },
            abilities: {
              str: { value: 12, max: 12 },
              agl: { value: 12, max: 12 },
              sta: { value: 3, max: 3 },
              per: { value: 10, max: 10 },
              int: { value: 16, max: 16 },
              lck: { value: 10, max: 10 }
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Burn-To-Zero-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
        await actor.rollSpellCheck({ spell: 'P1-Burn-To-Zero-Spell', spellburn: { str: 0, agl: 0, sta: 3 } })
        return game.actors.getName('P1 Spell Burn To Zero').system.abilities.sta.value
      })

      // 3 - 3 = 0. The old floor-1 behavior would have read 1.
      expect(staAfter).toBe(0)
    })

    test('cleric cast without a configured disapproval table emits reason=noDisapprovalTable', async ({ page }) => {
      // Cleric actor with `disapproval: 1` but no `disapprovalTable`
      // set — adapter path continues (not legacy) but silently skips
      // the disapproval sub-roll. The reason log is the telemetry.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell NoDisapproval',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1 },
            details: { sheetClass: 'Cleric' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-NoDisapproval-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'cleric', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell NoDisapproval').rollSpellCheck({ spell: 'P1-NoDisapproval-Spell' })
      })

      // The first rollSpellCheck log is the adapter dispatch; the
      // reason=noDisapprovalTable telemetry is a second adapter log.
      await waitForAdapterLog('rollSpellCheck')
      const reasonLine = adapterLogs.find(l =>
        l.startsWith(`${ADAPTER_TAG} rollSpellCheck`) &&
        l.includes('reason=noDisapprovalTable')
      )
      expect(reasonLine,
        `expected noDisapprovalTable log; adapterLogs=\n${adapterLogs.join('\n')}`
      ).toBeTruthy()
      expect(reasonLine).toContain('via adapter')
    })

    test('wizard first-cast without a configured mercurial table emits reason=noMercurialTable', async ({ page }) => {
      // Temporarily clear the world's mercurial-magic table so the
      // first-cast pre-roll can't resolve it. Group E session 1
      // introduced `CONFIG.DCC.mercurialMagicTables` (registry) as a
      // second source the resolver consults before the legacy single
      // field — the `setMercurialMagicTable` back-compat shim mirrors
      // the world-setting value into `mercurialMagicTables.default`
      // (when the legacy field was previously unset), so clearing only
      // the legacy field is no longer sufficient. Clear both; restore
      // both after the test so later tests see the original config.
      const savedTable = await page.evaluate(() => {
        const original = {
          legacy: CONFIG.DCC.mercurialMagicTable,
          tables: { ...(CONFIG.DCC.mercurialMagicTables || {}) }
        }
        CONFIG.DCC.mercurialMagicTable = null
        CONFIG.DCC.mercurialMagicTables = {}
        return original
      })

      try {
        await page.evaluate(async () => {
          const actor = await Actor.create({
            name: 'P1 Spell NoMercurial',
            type: 'Player',
            system: { class: { className: 'Wizard' } }
          })
          await actor.createEmbeddedDocuments('Item', [{
            name: 'P1-NoMercurial-Spell',
            type: 'spell',
            system: {
              level: 1,
              config: { castingMode: 'wizard', inheritCheckPenalty: true },
              spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
              lost: false
            }
          }])
        })
        await page.evaluate(async () => {
          await game.actors.getName('P1 Spell NoMercurial').rollSpellCheck({ spell: 'P1-NoMercurial-Spell' })
        })

        await waitForAdapterLog('rollSpellCheck')
        const reasonLine = adapterLogs.find(l =>
          l.startsWith(`${ADAPTER_TAG} rollSpellCheck`) &&
          l.includes('reason=noMercurialTable')
        )
        expect(reasonLine,
          `expected noMercurialTable log; adapterLogs=\n${adapterLogs.join('\n')}`
        ).toBeTruthy()
        expect(reasonLine).toContain('via adapter')

        // Spell item wasn't updated with a rolled mercurial effect
        // (the silent skip the reason log makes observable).
        const mercurialValue = await page.evaluate(() => {
          const actor = game.actors.getName('P1 Spell NoMercurial')
          const item = actor.items.getName('P1-NoMercurial-Spell')
          return item?.system?.mercurialEffect?.value
        })
        expect(Number(mercurialValue) || 0).toBe(0)
      } finally {
        await page.evaluate((saved) => {
          CONFIG.DCC.mercurialMagicTable = saved.legacy
          CONFIG.DCC.mercurialMagicTables = saved.tables
        }, savedTable)
      }
    })

    // ── Group E session 1: per-class mercurial-magic table registry ──
    // `dcc.registerMercurialMagicTable(classKey, value)` lands the
    // sibling-module-facing API that retires XCC's
    // `CONFIG.DCC.mercurialMagicTable = …` monkey-patch
    // (`xcc-core-book/module/xcc-item-sheet.js:49-58`). End-to-end:
    // register a wizard-keyed table via the hook, clear the legacy
    // default-table mirror, then cast a wizard spell — the resolver
    // walks the per-class slot first, so the cast pre-rolls a mercurial
    // effect using the registered table even though no `'default'`
    // entry exists.
    test('registerMercurialMagicTable: per-class registration drives wizard first-cast (Group E session 1)', async ({ page }) => {
      const tableConfigured = await page.evaluate(() => !!CONFIG.DCC.mercurialMagicTable)
      test.skip(!tableConfigured, 'No mercurialMagicTable configured in this world')

      // Capture original registry + legacy field, then swap the world
      // setting into a per-class registration so we can prove the
      // class-keyed lookup picked it (rather than the legacy mirror).
      const saved = await page.evaluate(() => {
        const snapshot = {
          tables: { ...(CONFIG.DCC.mercurialMagicTables || {}) },
          legacy: CONFIG.DCC.mercurialMagicTable
        }
        const tableName = CONFIG.DCC.mercurialMagicTable
        CONFIG.DCC.mercurialMagicTables = {}
        CONFIG.DCC.mercurialMagicTable = null
        Hooks.callAll('dcc.registerMercurialMagicTable', 'wizard', tableName)
        return {
          snapshot,
          registered: CONFIG.DCC.mercurialMagicTables?.wizard
        }
      })

      expect(saved.registered,
        'hook should have populated CONFIG.DCC.mercurialMagicTables.wizard'
      ).toBeTruthy()
      expect(saved.registered).toBe(saved.snapshot.legacy)

      try {
        await page.evaluate(async () => {
          const actor = await Actor.create({
            name: 'P1 Spell RegistryWizard',
            type: 'Player',
            system: { class: { className: 'Wizard' } }
          })
          await actor.createEmbeddedDocuments('Item', [{
            name: 'P1-Registry-Wizard-Spell',
            type: 'spell',
            system: {
              level: 1,
              config: { castingMode: 'wizard', inheritCheckPenalty: true },
              spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
              lost: false
            }
          }])
        })
        await page.evaluate(async () => {
          await game.actors.getName('P1 Spell RegistryWizard')
            .rollSpellCheck({ spell: 'P1-Registry-Wizard-Spell' })
        })

        const line = await waitForAdapterLog('rollSpellCheck')
        assertPath(line, 'adapter', { spell: 'P1-Registry-Wizard-Spell', mode: 'wizard' })

        // Let the async item.update land before reading mercurialEffect.
        await page.waitForTimeout(400)
        const mercurialValue = await page.evaluate(() => {
          const actor = game.actors.getName('P1 Spell RegistryWizard')
          const item = actor.items.getName('P1-Registry-Wizard-Spell')
          return item?.system?.mercurialEffect?.value
        })
        expect(Number(mercurialValue),
          'wizard-keyed registration should have driven the mercurial pre-roll'
        ).toBeGreaterThan(0)
      } finally {
        await page.evaluate((s) => {
          CONFIG.DCC.mercurialMagicTables = s.tables
          CONFIG.DCC.mercurialMagicTable = s.legacy
        }, saved.snapshot)
      }
    })

    test('registerMercurialMagicTable: class registration that does not match falls through to noMercurialTable (Group E session 1)', async ({ page }) => {
      // Symmetric coverage for the negative case: a gnome-keyed
      // registration with no `'default'` entry and a cleared legacy
      // mirror produces a `reason=noMercurialTable` log when a wizard
      // casts — the resolver walks `wizard → default → legacy → null`
      // and stops without picking the unrelated gnome table.
      const saved = await page.evaluate(() => {
        const snapshot = {
          tables: { ...(CONFIG.DCC.mercurialMagicTables || {}) },
          legacy: CONFIG.DCC.mercurialMagicTable
        }
        CONFIG.DCC.mercurialMagicTables = {}
        CONFIG.DCC.mercurialMagicTable = null
        Hooks.callAll('dcc.registerMercurialMagicTable', 'gnome', 'fake.pack.Gnome Mercurial')
        return snapshot
      })

      try {
        await page.evaluate(async () => {
          const actor = await Actor.create({
            name: 'P1 Spell RegistryGnomeOnly',
            type: 'Player',
            system: { class: { className: 'Wizard' } }
          })
          await actor.createEmbeddedDocuments('Item', [{
            name: 'P1-RegistryGnomeOnly-Spell',
            type: 'spell',
            system: {
              level: 1,
              config: { castingMode: 'wizard', inheritCheckPenalty: true },
              spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
              lost: false
            }
          }])
        })
        await page.evaluate(async () => {
          await game.actors.getName('P1 Spell RegistryGnomeOnly')
            .rollSpellCheck({ spell: 'P1-RegistryGnomeOnly-Spell' })
        })

        await waitForAdapterLog('rollSpellCheck')
        const reasonLine = adapterLogs.find(l =>
          l.startsWith(`${ADAPTER_TAG} rollSpellCheck`) &&
          l.includes('reason=noMercurialTable')
        )
        expect(reasonLine,
          `expected noMercurialTable log; adapterLogs=\n${adapterLogs.join('\n')}`
        ).toBeTruthy()
      } finally {
        await page.evaluate((s) => {
          CONFIG.DCC.mercurialMagicTables = s.tables
          CONFIG.DCC.mercurialMagicTable = s.legacy
        }, saved)
      }
    })

    test('wizard cast on a lost spell with automateWizardSpellLoss off → probe surfaces lib error, no mutations', async ({ page }) => {
      // Reachable-from-Foundry error-path coverage for the pass-2
      // probe. With `automateWizardSpellLoss` off the adapter's
      // pre-check lets the cast continue into the lib; the lib's
      // `buildSpellCastInput` then returns `{ error: 'Spell "X" is
      // lost for the day' }` inside `calculateSpellCheck`. The probe
      // pass catches this BEFORE `onSpellburnApplied` would have
      // deducted the str/sta commitment — the whole point of the
      // probe/commit split. ui.notifications.warn fires with the
      // lib's error string, no chat posts, ability scores unchanged.
      const priorSetting = await page.evaluate(async () => {
        const prev = game.settings.get('dcc', 'automateWizardSpellLoss')
        await game.settings.set('dcc', 'automateWizardSpellLoss', false)
        return prev
      })

      try {
        await page.evaluate(async () => {
          const actor = await Actor.create({
            name: 'P1 Spell LostProbe',
            type: 'Player',
            system: {
              class: { className: 'Wizard' },
              abilities: {
                str: { value: 14, max: 14 },
                agl: { value: 12, max: 12 },
                sta: { value: 13, max: 13 },
                per: { value: 10, max: 10 },
                int: { value: 16, max: 16 },
                lck: { value: 10, max: 10 }
              }
            }
          })
          await actor.createEmbeddedDocuments('Item', [{
            name: 'P1-LostProbe-Spell',
            type: 'spell',
            system: {
              level: 1,
              config: { castingMode: 'wizard', inheritCheckPenalty: true },
              spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
              lost: true
            }
          }])
        })

        // Capture chat message count + any notifications around the cast.
        const before = await page.evaluate(() => game.messages.size)

        await page.evaluate(async () => {
          await game.actors.getName('P1 Spell LostProbe').rollSpellCheck({
            spell: 'P1-LostProbe-Spell',
            spellburn: { str: 2, agl: 0, sta: 1 }
          })
        })

        // Allow any async side effects to settle — we WANT to confirm
        // none actually fire, so give them time to misbehave if the
        // probe/commit split regresses.
        await page.waitForTimeout(300)

        // No spell-check chat posted (probe returned error before
        // renderSpellCheck ran).
        const after = await page.evaluate(() => game.messages.size)
        expect(after).toBe(before)

        // Ability scores unchanged — onSpellburnApplied never fired.
        const { str, agl, sta } = await page.evaluate(() => {
          const actor = game.actors.getName('P1 Spell LostProbe')
          return {
            str: actor.system.abilities.str.value,
            agl: actor.system.abilities.agl.value,
            sta: actor.system.abilities.sta.value
          }
        })
        expect(str).toBe(14)
        expect(agl).toBe(12)
        expect(sta).toBe(13)
      } finally {
        await page.evaluate(async (prev) => {
          await game.settings.set('dcc', 'automateWizardSpellLoss', prev)
        }, priorSetting)
      }
    })
  })

  // ── rollWeaponAttack (Phase 3 session 2) ────────────────────────────

  test.describe('rollWeaponAttack', () => {
    test('simplest weapon + automate on → adapter (happy path)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon Happy', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Longsword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Happy').items.getName('P1-Longsword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon Happy').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-Longsword' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-Longsword' })
    })

    test('floored damage: libDamageResult.total rides the min-1 floor and matches the displayed total (PR #720 clamp closure)', async ({ page }) => {
      // PR #720 design call (closed 2026-05-31, resolved-upstream): the
      // backlog premise was that Foundry clamped the displayed total to 1
      // while the lib left `dcc.libDamageResult.total` un-floored, so the
      // flag could carry 0/negative while chat showed 1. The lib has since
      // gained its own min-1 clamp, so the two totals can no longer
      // diverge. `1d3-4` always rolls negative (max 3-4 = -1), so this is a
      // deterministic floored hit regardless of the die. Invoke
      // `_rollDamage` directly against live Foundry and assert both totals
      // floor to 1.
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Floored Damage', type: 'Player' })
        const weapon = { name: 'P1-PenaltyDagger' }
        const dispatch = await actor._rollDamage(weapon, '1d3-4', {})
        return {
          displayedTotal: dispatch.damageRoll.total,
          libTotal: dispatch.libDamageResult.total,
          baseDamage: dispatch.libDamageResult.baseDamage,
          modifierDamage: dispatch.libDamageResult.modifierDamage
        }
      })
      // Both sides floor to 1 — no divergence.
      expect(result.displayedTotal).toBe(1)
      expect(result.libTotal).toBe(1)
      expect(result.libTotal).toBe(result.displayedTotal)
      // The lib leaves the components raw (its deliberate shape), so on a
      // floored hit they sum below the clamped total rather than reconciling.
      expect(result.modifierDamage).toBe(-4)
      expect(result.baseDamage + result.modifierDamage).toBeLessThan(result.libTotal)
    })

    test('options.backstab on a thief → adapter (session 9)', async ({ page }) => {
      // Phase 3 session 9: backstab attack + damage flow through the
      // adapter. `isBackstab: true` drives the lib's auto-crit;
      // `rollWeaponAttack` swaps `damageRollFormula` to the alternate
      // backstab damage formula before reaching the adapter's gate,
      // so the damage path accepts the alternate die naturally.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Weapon Backstab',
          type: 'Player',
          // L3 chaotic thief: Table 1-9 backstab bonus is +7.
          system: { class: { backstab: '+7' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-BackstabDagger',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d4',
            damage: '1d4',
            backstabDamage: '1d10',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Backstab').items.getName('P1-BackstabDagger').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon Backstab').rollWeaponAttack(id, { backstab: true })
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-BackstabDagger' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-BackstabDagger' })
    })

    test('options.backstab populates libResult with auto-crit + class:backstab bonus', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Backstab LibFlag',
          type: 'Player',
          system: { class: { backstab: '+7' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-BackstabShortSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d6',
            damage: '1d6',
            backstabDamage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force d20 to roll exactly 10 — below threatRange (20) so the
        // only crit path is backstab-auto, not threat-range / natural-max.
        // Foundry: Math.ceil((1 - randomUniform) * faces); 0.5 → 10 on d20.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.5
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Backstab LibFlag').items.getName('P1-BackstabShortSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Backstab LibFlag').rollWeaponAttack(id, { backstab: true })
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Backstab LibFlag' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Restore randomUniform BEFORE asserting — if any assertion throws
      // and the deferred restore is skipped, the stub leaks across the
      // session-reuse fixture and downstream tests roll deterministically.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'backstab adapter-path attack must set dcc.libResult').not.toBeNull()
      expect(flag.natural).toBe(10)
      expect(flag.isCriticalThreat).toBe(true)
      expect(flag.critSource).toBe('backstab-auto')
      const backstabEntry = flag.bonuses.find(b => b.id === 'class:backstab')
      expect(backstabEntry, 'class:backstab RollBonus must surface on libResult.bonuses').toBeDefined()
      expect(backstabEntry.effect.value).toBe(7)
    })

    test('in-place mutation of an existing terms[N] flows through Foundry but is NOT captured on libResult (two-pass boundary, Phase 7 session 30)', async ({ page }) => {
      // PR #720 test-coverage gap (terms[N] two-pass divergence). The
      // post-hook re-read captures only terms[0].formula (→ lib action die)
      // and APPENDED Modifier terms (→ lib bonuses, via hookTermsToBonuses on
      // `terms.slice(termsLengthBefore)`). An IN-PLACE mutation of an existing
      // terms[N] (N>0) is captured by NEITHER (documented at
      // attack-input.mjs:139): it flows through the live Foundry Roll (so the
      // chat total reflects it) but never reaches the lib — surfacing only as
      // a divergence. This probe drives that boundary end-to-end with a real
      // hook on a live attack.
      const out = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 InPlaceMut', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-InPlace-Sword',
          type: 'weapon',
          system: { actionDie: '1d20', toHit: '+2', critRange: 20, damage: '1d8', melee: true, equipped: true }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        const id = actor.items.getName('P1-InPlace-Sword').id

        // The Compound to-hit term sits at terms[1] (terms[0] is the action
        // die). Mutate it IN PLACE — do not append a term, do not touch
        // terms[0]. Hooks.call passes (terms, actor, weapon, options).
        const observed = { ran: false, term1Type: null, appendedNothing: null }
        const hookId = Hooks.on('dcc.modifyAttackRollTerms', (terms) => {
          observed.ran = true
          observed.term1Type = terms[1]?.type
          const before = terms.length
          terms[1].formula = '+99'
          observed.appendedNothing = terms.length === before
          return true
        })

        try {
          await actor.rollWeaponAttack(id)
        } finally {
          Hooks.off('dcc.modifyAttackRollTerms', hookId)
        }

        let lib = null
        let foundryTotal = null
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents.slice().reverse().find(m =>
            m.speaker?.alias === 'P1 InPlaceMut' &&
            m.getFlag('dcc', 'isToHit') &&
            m.getFlag('dcc', 'libResult'))
          if (msg) { lib = msg.getFlag('dcc', 'libResult'); foundryTotal = msg.rolls?.[0]?.total; break }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        await actor.delete()
        return { observed, lib, foundryTotal }
      })

      // The hook genuinely mutated an existing Compound term in place (proves
      // the probe exercises the real in-place path, not a no-op).
      expect(out.observed.ran).toBe(true)
      expect(out.observed.term1Type).toBe('Compound')
      expect(out.observed.appendedNothing).toBe(true)
      // Lib side captured nothing from the in-place mutation:
      expect(out.lib, 'attack must set dcc.libResult').not.toBeNull()
      expect(out.lib.die).toBe('d20') // terms[0] untouched
      expect((out.lib.bonuses || []).some(b => /hook/i.test(b.id || '')),
        'an in-place mutation must NOT create a hook-injected bonus').toBe(false)
      // The +99 flowed through the Foundry Roll (chat-authoritative total) but
      // NOT the lib total — the documented divergence the boundary produces.
      expect(out.foundryTotal).toBeGreaterThan(out.lib.total)
    })

    test('NPC melee attack applies attackHitBonus.melee.adjustment to the live roll (Phase 7 session 31)', async ({ page }) => {
      // PR #720 test-coverage gap: the rollToHit NPC branch (actor.js:3669)
      // injects a non-zero NPC melee adjustment as a Modifier term. Prior
      // coverage exercised a test-local reimplementation; this drives the real
      // NPC path end-to-end. A large +50 adjustment makes the assertion robust
      // regardless of the d20 natural: attack total = natural(1-20) + toHit(0)
      // + 50 ≥ 51, whereas an unadjusted attack tops out near 22.
      const out = await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 NPCAdj',
          type: 'NPC',
          system: {
            details: {
              attackHitBonus: {
                melee: { value: '+0', adjustment: 50 },
                missile: { value: '+0', adjustment: 0 }
              }
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-NPCAdj-Claw',
          type: 'weapon',
          system: { actionDie: '1d20', toHit: '+0', critRange: 20, damage: '1d4', melee: true, equipped: true }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        const id = actor.items.getName('P1-NPCAdj-Claw').id
        await actor.rollWeaponAttack(id)

        // The combined attack card carries dcc.isToHit; its rolls[0] is the
        // attack roll (with the adjustment), distinct from the damage roll.
        let total = null
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents.slice().reverse().find(m =>
            m.speaker?.alias === 'P1 NPCAdj' && m.getFlag('dcc', 'isToHit'))
          if (msg) { total = msg.rolls?.[0]?.total; break }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        await actor.delete()
        return { total }
      })

      expect(out.total, 'NPC attack must post an isToHit card with the attack roll').not.toBeNull()
      // total ≥ 51 ⟹ the +50 adjustment reached the live roll (only possible
      // via the NPC adjustment Modifier term).
      expect(out.total).toBeGreaterThanOrEqual(51)
    })

    test('showModifierDialog flag → adapter (session 13 / A6)', async ({ page }) => {
      // A6: modifier-dialog case now routes via adapter with
      // `damageTerms` threaded into `DCCRoll.createRoll`. Dispatch log
      // fires at the start of `rollToHit` before the (blocking) dialog
      // shows — fireAndForget dismisses the dialog with Escape so the
      // test run continues.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon Dialog', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-DialogSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+0',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Dialog').items.getName('P1-DialogSword').id
      })
      await fireAndForget(page, async (id) => {
        game.actors.getName('P1 Weapon Dialog').rollWeaponAttack(id, { showModifierDialog: true })
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-DialogSword' })
    })

    test('warrior deed die → adapter (session 10 / A3)', async ({ page }) => {
      // Phase 3 session 10 (A3): warrior / dwarf deed dice route through
      // the adapter. The actor's `+1d3` attackBonus + the weapon's
      // computed `+1d3+0` toHit both pass `parseDeedAttackBonus`; the
      // adapter feeds `AttackInput.deedDie: 'd3'` to the lib, which
      // rolls the deed via the sequenced roller and emits
      // `onDeedAttempt` with the natural + success flag.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Weapon Warrior',
          type: 'Player',
          // L1 warrior: +1d3 deed die, no flat attack bonus.
          system: { details: { attackBonus: '+1d3' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-WarriorSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            // Pre-bake the deed-die toHit; in real Foundry
            // computeMeleeAndMissileAttackAndDamage wires this for us
            // off the actor's `+1d3` attackBonus + str mod.
            toHit: '+1d3+0',
            critRange: 20,
            damageWeapon: '1d8',
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Warrior').items.getName('P1-WarriorSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon Warrior').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-WarriorSword' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-WarriorSword' })
    })

    test('warrior deed die populates libResult.deedDie + deedNatural + deedSuccess', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Deed LibFlag',
          type: 'Player',
          system: { details: { attackBonus: '+1d3' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-DeedSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1d3+0',
            critRange: 20,
            damageWeapon: '1d8',
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force every die to land on its midpoint (Foundry rounds up):
        // d20 → 10, d3 → 2 (deed fail). Lets us assert deedSuccess === false
        // while keeping the natural visible.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.5
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Deed LibFlag').items.getName('P1-DeedSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Deed LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Deed LibFlag' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'deed-die adapter-path attack must set dcc.libResult').not.toBeNull()
      expect(flag.deedDie).toBe('d3')
      expect(flag.deedNatural).toBe(2)
      expect(flag.deedSuccess).toBe(false)
      // Restore randomUniform BEFORE asserting — see backstab libResult test.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      // The lib emits a `{ source: 'deed die', value: <natural> }`
      // entry on appliedModifiers when a deed is rolled.
      const deedMod = flag.modifiers.find(m => m.source === 'deed die')
      expect(deedMod, 'deed-die modifier must surface on libResult.modifiers').toBeDefined()
      expect(deedMod.value).toBe(2)
    })

    test('two-weapon primary → adapter (session 11 / A4)', async ({ page }) => {
      // Phase 3 session 11 (A4): two-weapon fighting routes through
      // the adapter. DCC's mechanic is a dice-chain reduction baked
      // into `weapon.system.actionDie` at prepareBaseData time
      // (e.g. d20 → d16 with the off-hand label appended); the
      // adapter strips the tag via `normalizeLibDie` and the lib
      // computes the attack on the bumped die. We deliberately do
      // NOT plumb the lib's flat `getTwoWeaponPenalty` — DCC RAW
      // uses dice-chain, not flat mods, so adding a -2 here would
      // double-count.
      //
      // Pre-baking `actionDie: '1d16[2w-primary]'` directly fails
      // schema validation (dice notation field rejects bracket tags
      // on write); set `twoWeaponPrimary: true` and let
      // item.js:prepareBaseData compute the bumped die in-memory.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 TwoWeapon',
          type: 'Player',
          // Agility 12-15 → primary -1 die (1d20 → 1d16).
          system: { abilities: { agl: { value: 13 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-PrimaryDagger',
          type: 'weapon',
          system: {
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d4',
            damage: '1d4',
            melee: true,
            equipped: true,
            twoWeaponPrimary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 TwoWeapon').items.getName('P1-PrimaryDagger').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 TwoWeapon').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-PrimaryDagger' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-PrimaryDagger' })
    })

    test('two-weapon secondary populates libResult.die + isTwoWeaponSecondary', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 OffHand LibFlag',
          type: 'Player',
          // Agility 13 → off-hand -2 dice (1d20 → 1d14 via DiceChain).
          system: { abilities: { agl: { value: 13 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-OffHandHatchet',
          type: 'weapon',
          system: {
            toHit: '+0',
            critRange: 20,
            damageWeapon: '1d6',
            damage: '1d6',
            melee: true,
            equipped: true,
            twoWeaponSecondary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 OffHand LibFlag').items.getName('P1-OffHandHatchet').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 OffHand LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 OffHand LibFlag' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'two-weapon adapter-path attack must set dcc.libResult').not.toBeNull()
      // Die was bumped down from d20 — exact face count depends on
      // DiceChain.bumpDie semantics, but it must NOT be d20.
      expect(flag.die).toMatch(/^d\d+$/)
      expect(flag.die).not.toBe('d20')
      expect(flag.isTwoWeaponSecondary).toBe(true)
      expect(flag.isTwoWeaponPrimary).toBe(false)
      // Sanity: the lib's flat `two-weapon fighting` modifier source
      // must NOT appear — DCC uses dice-chain reductions, not flat mods.
      const flatTwoWeaponMod = flag.modifiers.find(m => m.source === 'two-weapon fighting')
      expect(flatTwoWeaponMod, 'must not introduce flat two-weapon penalty').toBeUndefined()
    })

    test('halfling two-weapon fumble note round-trips through adapter', async ({ page }) => {
      // Halfling RAW: a two-weapon fumble is only "real" if BOTH dice
      // came up natural 1. The chat card embeds a localized note in
      // that state so the player can decide. The note triggers off
      // `attackRollResult.fumble` + `weapon.system.twoWeapon*` +
      // `actor.system.details.sheetClass === 'Halfling'`. This e2e
      // verifies the adapter's `libResult.isFumble → fumble` round-trip
      // doesn't drop the note for the now-adapter-routed two-weapon
      // path.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Halfling Fumble',
          type: 'Player',
          system: {
            abilities: { agl: { value: 13 } },
            details: { sheetClass: 'Halfling' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-HalflingDagger',
          type: 'weapon',
          system: {
            toHit: '+0',
            critRange: 20,
            damageWeapon: '1d4',
            damage: '1d4',
            melee: true,
            equipped: true,
            twoWeaponPrimary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural 1 on the action die so the lib classifies a fumble.
        // Foundry: Math.ceil((1 - randomUniform) * faces); 0.99 → 1 on any die.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.99
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Halfling Fumble').items.getName('P1-HalflingDagger').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Halfling Fumble').rollWeaponAttack(id)
      }, weaponId)

      const noteHtml = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Halfling Fumble' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) return msg.content || ''
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Restore randomUniform BEFORE asserting — if an assertion throws,
      // a deferred restore would leave the global stub in place and
      // pollute subsequent tests via the session-reuse fixture.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(noteHtml, 'halfling two-weapon fumble must produce chat card').not.toBeNull()
      expect(noteHtml).toContain('Fumble only applies if both attack rolls were a natural 1')
    })

    test('halfling two-weapon crit range survives the adapter (1d16, threatRange 16)', async ({ page }) => {
      // Halfling RAW (DCC core): when fighting two-weapon at agl ≤17,
      // halflings score crits AND auto-hit on natural 16. item.js
      // prepareBaseData sets `weapon.system.critRange = 16` on the
      // pre-bumped weapon. The adapter passes that through as
      // `AttackInput.threatRange`. We force a natural 16 (mid-range
      // for a d16) and assert the lib classifies it as a crit.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Halfling Crit',
          type: 'Player',
          system: {
            abilities: { agl: { value: 13 } },
            details: { sheetClass: 'Halfling' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-HalflingHatchet',
          type: 'weapon',
          system: {
            toHit: '+0',
            // critRange omitted — item.js prepareBaseData sets 16 from
            // the halfling-two-weapon branch.
            damageWeapon: '1d4',
            damage: '1d4',
            melee: true,
            equipped: true,
            twoWeaponPrimary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural max on a d16: ceil((1 - 0.001) * 16) = 16.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.001
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Halfling Crit').items.getName('P1-HalflingHatchet').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Halfling Crit').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Halfling Crit' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Restore randomUniform BEFORE asserting — see fumble-note test.
      // randomUniform = 0.001 (always-max-die) leaks catastrophically
      // into downstream tests if a deferred restore is skipped.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'halfling two-weapon crit-on-16 must set dcc.libResult').not.toBeNull()
      expect(flag.die).toBe('d16')
      expect(flag.natural).toBe(16)
      // A natural 16 on a d16 is auto-hit (max-on-die) — and the
      // halfling two-weapon critRange was set to 16 by prepareBaseData,
      // so this should classify as a crit. critSource will be
      // 'natural-max' since 16 IS the max on this die.
      expect(flag.isCriticalThreat).toBe(true)
      expect(flag.critSource).toBe('natural-max')
    })

    test('automate off → adapter (session 12 / A5)', async ({ page }) => {
      // A5: `automateDamageFumblesCrits` gates the downstream damage /
      // crit / fumble chain inside `rollWeaponAttack`, not the attack
      // adapter itself. Attack should still route via adapter and
      // populate `dcc.libResult` on the chat flags; downstream damage
      // falls back to the inline-roll-text prompt with no lib call.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon NoAutomate', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-NoAutomateSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+0',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', false)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon NoAutomate').items.getName('P1-NoAutomateSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon NoAutomate').rollWeaponAttack(id)
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-NoAutomateSword' })
      const { libResult, libDamageResult } = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Weapon NoAutomate' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) {
            return {
              libResult: msg.getFlag('dcc', 'libResult') ?? null,
              libDamageResult: msg.getFlag('dcc', 'libDamageResult') ?? null
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return { libResult: null, libDamageResult: null }
      })
      expect(libResult, 'attack routes via adapter → dcc.libResult set').not.toBeNull()
      expect(libResult.die).toBe('d20')
      // Downstream damage path stays on inline-roll-text fallback with
      // automate off, so no libDamageResult flag.
      expect(libDamageResult).toBeNull()
    })

    test('non-deed dice in toHit → adapter (session 14 / A7)', async ({ page }) => {
      // A7: dice-bearing `attackBonus` / `toHit` patterns that don't
      // match `parseDeedAttackBonus` (e.g. leading flat + trailing
      // die, multiple dice) no longer fall to legacy. Foundry's Roll
      // evaluates the dice portion natively; the lib sees the flat
      // portion via `parseToHitBonus`. `warnIfDivergent` surfaces the
      // mismatch; `attackRoll.total` remains the chat-authoritative
      // total. Closes gate exhaustiveness for D1.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon DiceMid', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-DiceMidSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            // Leading flat + trailing die — legitimate shape for a
            // magical weapon that grants a deed-die-style bonus on
            // top of a base. parseDeedAttackBonus anchors at start
            // and rejects this.
            toHit: '+2+1d3',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon DiceMid').items.getName('P1-DiceMidSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon DiceMid').rollWeaponAttack(id)
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-DiceMidSword' })
      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Weapon DiceMid' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) return msg.getFlag('dcc', 'libResult') ?? null
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })
      expect(flag, 'dice-bearing toHit still surfaces lib libResult').not.toBeNull()
      expect(flag.die).toBe('d20')
    })

    test('two-handed weapon attack → adapter (session 14 / A7 coverage)', async ({ page }) => {
      // Two-handed weapons affect initiative die (bumped down one
      // step) but not the attack formula itself. Adapter coverage
      // here confirms the attack routes identically to a one-handed
      // weapon, closing an explicit gap in dispatch-spec coverage.
      // Initiative-side two-handed coverage lives in the
      // `getInitiativeRoll` section above.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon TwoHanded', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Greatsword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damage: '1d10',
            damageWeapon: '1d10',
            melee: true,
            equipped: true,
            twoHanded: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon TwoHanded').items.getName('P1-Greatsword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon TwoHanded').rollWeaponAttack(id)
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-Greatsword' })
      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Weapon TwoHanded' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) return msg.getFlag('dcc', 'libResult') ?? null
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })
      expect(flag, 'two-handed weapon attack surfaces libResult').not.toBeNull()
      expect(flag.die).toBe('d20')
      // twoWeaponPrimary / twoWeaponSecondary should NOT be set on a
      // two-handed weapon (distinct mechanic from two-weapon fighting).
      expect(flag.isTwoWeaponPrimary).toBe(false)
      expect(flag.isTwoWeaponSecondary).toBe(false)
    })

    test('D1 retirement: _rollToHitLegacy + _canRouteAttackViaAdapter are gone (session 15)', async ({ page }) => {
      // A7 closed the attack gate (always true); D1 collapsed the
      // dispatcher + legacy body. `rollToHit` is now a single path.
      // Guard against regressions that reintroduce the dispatcher
      // scaffold.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          hasRollToHit: typeof proto.rollToHit === 'function',
          hasLegacy: typeof proto._rollToHitLegacy === 'function',
          hasGate: typeof proto._canRouteAttackViaAdapter === 'function',
          hasAdapterAlias: typeof proto._rollToHitViaAdapter === 'function'
        }
      })
      expect(surface.hasRollToHit, 'rollToHit remains the public method').toBe(true)
      expect(surface.hasLegacy, '_rollToHitLegacy retired in D1').toBe(false)
      expect(surface.hasGate, '_canRouteAttackViaAdapter retired in D1').toBe(false)
      expect(surface.hasAdapterAlias, '_rollToHitViaAdapter folded into rollToHit').toBe(false)
    })

    test('legacy-decom step 5: the four _xxxLegacy roll bodies are gone from the live prototype (session 25)', async ({ page }) => {
      // Steps 1–4 moved every gate (roll-under, modifier dialog,
      // check-penalty, description-only skill items) into the adapter;
      // step 5 deleted the now-dead legacy bodies. Each public dispatcher
      // is single-path through the adapter. Guard against regressions that
      // reintroduce a legacy body, verified against the live class.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          // Deleted bodies.
          hasAbilityLegacy: typeof proto._rollAbilityCheckLegacy === 'function',
          hasSaveLegacy: typeof proto._rollSavingThrowLegacy === 'function',
          hasInitLegacy: typeof proto._getInitiativeRollLegacy === 'function',
          hasSkillLegacy: typeof proto._rollSkillCheckLegacy === 'function',
          hasOldTermBuilder: typeof proto._buildSkillCheckLegacyTerms === 'function',
          // Surviving public dispatchers + adapter routes.
          hasAbilityDispatch: typeof proto.rollAbilityCheck === 'function',
          hasSaveDispatch: typeof proto.rollSavingThrow === 'function',
          hasInitDispatch: typeof proto.getInitiativeRoll === 'function',
          hasSkillDispatch: typeof proto.rollSkillCheck === 'function',
          hasDescriptionRoute: typeof proto._emitSkillDescriptionViaAdapter === 'function',
          hasRenamedTermBuilder: typeof proto._buildSkillCheckRollTerms === 'function'
        }
      })
      expect(surface.hasAbilityLegacy, '_rollAbilityCheckLegacy retired').toBe(false)
      expect(surface.hasSaveLegacy, '_rollSavingThrowLegacy retired').toBe(false)
      expect(surface.hasInitLegacy, '_getInitiativeRollLegacy retired').toBe(false)
      expect(surface.hasSkillLegacy, '_rollSkillCheckLegacy retired').toBe(false)
      expect(surface.hasOldTermBuilder, '_buildSkillCheckLegacyTerms renamed away').toBe(false)
      expect(surface.hasAbilityDispatch, 'rollAbilityCheck dispatcher remains').toBe(true)
      expect(surface.hasSaveDispatch, 'rollSavingThrow dispatcher remains').toBe(true)
      expect(surface.hasInitDispatch, 'getInitiativeRoll dispatcher remains').toBe(true)
      expect(surface.hasSkillDispatch, 'rollSkillCheck dispatcher remains').toBe(true)
      expect(surface.hasDescriptionRoute, 'step-4 description route remains').toBe(true)
      expect(surface.hasRenamedTermBuilder, '_buildSkillCheckRollTerms present').toBe(true)
    })

    test('crit with no available table surfaces a look-it-up hint, not a silent miss', async ({ page }) => {
      // Reproduces the "core book module disabled" scenario: with the
      // crit roll automated but no crit table resolvable, the result
      // block must NOT be silently empty. _rollCritical keeps the rolled
      // total and hands back `critTableLookupHint` (the friendly prompt
      // naming the table) instead. A bogus table name guarantees the
      // lookup misses regardless of which packs the world has installed,
      // so the assertion holds whether or not dcc-core-book is enabled.
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Crit NoTable', type: 'Player' })
        actor.system.attributes = actor.system.attributes || {}
        actor.system.abilities = actor.system.abilities || {}
        const dispatch = await actor._rollCritical(
          { name: 'P1-NoTableSword', system: { critDie: '1d10' } },
          { automate: true, luckMod: '+0', critTableName: 'ZZZ' }
        )
        await actor.delete()
        return {
          critResult: dispatch.critResult,
          critRollTotal: dispatch.critRollTotal,
          critTableLookupHint: dispatch.critTableLookupHint,
          unavailableComplaint: game.i18n.localize('DCC.CritTableUnavailable')
        }
      })
      // The roll still resolved (total preserved for the chat anchor) …
      expect(typeof result.critRollTotal, 'crit die still rolled').toBe('number')
      // … the navigable result block is empty (no table to draw from) …
      expect(result.critResult, 'no fabricated crit-table result').toBe('')
      // … and the friendly look-it-up hint is surfaced, naming the table
      // and NOT repeating the old "unavailable" complaint.
      expect(result.critTableLookupHint, 'look-it-up hint is present').toBeTruthy()
      expect(result.critTableLookupHint).toContain('ZZZ')
      expect(result.critTableLookupHint).not.toBe(result.unavailableComplaint)
    })
  })

  // ── rollDamage (Phase 3 session 5, single-path post-session-19) ────

  test.describe('rollDamage', () => {
    test('multi-damage-type formula (`1d6[fire]+1d6[cold]`) routes via adapter (D2 damage sub-slice c)', async ({ page }) => {
      // Phase 3 session 19 broadened the gate to route per-term-flavor
      // formulas. The adapter uses native `new Roll` (not DCCRoll) so
      // Foundry preserves the per-term flavor labels in chat rendering,
      // exactly as legacy did via its `hasPerTermFlavors` branch. The
      // lib sees base `d6` + one `extraDamageDice` entry `{count: 1,
      // die: 'd6', flavor: 'cold'}`; the first term's flavor is dropped
      // for the lib's base breakdown (hardcoded `source: 'weapon'`) but
      // preserved visually in Foundry's chat breakdown.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage MultiType', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FlamingBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d6[fire]+1d6[cold]',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage MultiType').items.getName('P1-FlamingBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage MultiType').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FlamingBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-FlamingBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Damage MultiType' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'multi-type damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough).toBeUndefined()
      // Base d6 (fire) + extra d6 (cold). Both naturals in [1,6].
      expect(Array.isArray(flag.breakdown)).toBe(true)
      const weaponEntry = flag.breakdown.find(b => b.source === 'weapon')
      expect(weaponEntry, 'base-die breakdown entry').toBeDefined()
      expect(weaponEntry.amount).toBeGreaterThanOrEqual(1)
      expect(weaponEntry.amount).toBeLessThanOrEqual(6)
      const coldEntry = flag.breakdown.find(b => b.source === 'cold')
      expect(coldEntry, 'cold-flavored extra die must surface under its flavor').toBeDefined()
      expect(coldEntry.amount).toBeGreaterThanOrEqual(1)
      expect(coldEntry.amount).toBeLessThanOrEqual(6)
    })

    test('adapter path populates dcc.libDamageResult chat flag', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage LibFlag', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-LibFlagSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8+1',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage LibFlag').items.getName('P1-LibFlagSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage LibFlag').rollWeaponAttack(id)
      }, weaponId)

      // Wait for the chat message that rollWeaponAttack created and read
      // back its `flags['dcc.libDamageResult']` structure.
      const flag = await page.evaluate(async () => {
        // Poll briefly — ChatMessage.create is async; the message may
        // appear a tick or two after rollWeaponAttack resolves.
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.getFlag('dcc', 'isToHit') && m.getFlag('dcc', 'libDamageResult'))
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Assert on lib-result invariants rather than concrete numeric
      // values — a fresh Player's ability scores randomize each session,
      // which can rewrite `weapon.system.damage` through item prepareData
      // (str mod folding into the override). The invariants below hold
      // regardless of what specific formula reaches the adapter.
      expect(flag, 'adapter-path damage roll must set dcc.libDamageResult').not.toBeNull()
      expect(typeof flag.damageDie).toBe('string')
      expect(flag.damageDie).toMatch(/d\d+/)
      expect(typeof flag.natural).toBe('number')
      expect(flag.natural).toBeGreaterThanOrEqual(1)
      expect(flag.baseDamage).toBe(flag.natural)
      expect(typeof flag.modifierDamage).toBe('number')
      expect(flag.total).toBe(Math.max(1, flag.baseDamage + flag.modifierDamage))
      expect(Array.isArray(flag.breakdown)).toBe(true)
      expect(flag.breakdown.length).toBeGreaterThan(0)
      const weaponEntry = flag.breakdown.find(b => b.source === 'weapon')
      expect(weaponEntry, 'breakdown must include weapon entry').toBeDefined()
      expect(weaponEntry.amount).toBe(flag.baseDamage)
    })

    test('NPC with attackDamageBonus.melee.adjustment routes via adapter + bonus breakdown', async ({ page }) => {
      // Phase 3 session 7. NPC damage adjustments live on
      // `system.details.attackDamageBonus.{melee,missile}.adjustment` and
      // are baked into the damage formula by `rollWeaponAttack`. The
      // adapter peels the adjustment back off `strengthModifier` and
      // surfaces it as a `RollBonus` in the lib breakdown so the chat
      // flag attributes it correctly (rather than misattributing it as
      // Strength like a flat-fold would).
      await page.evaluate(async () => {
        const npc = await Actor.create({
          name: 'P1 NPC DamageBonus',
          type: 'NPC',
          system: { details: { attackDamageBonus: { melee: { adjustment: '+2' } } } }
        })
        await npc.createEmbeddedDocuments('Item', [{
          name: 'P1-NpcClub',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damage: '1d4',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 NPC DamageBonus').items.getName('P1-NpcClub').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 NPC DamageBonus').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-NpcClub' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-NpcClub' })

      const flag = await page.evaluate(async () => {
        // Chat messages persist across tests in the session-reuse fixture;
        // scope to our NPC by speaker.alias so we don't pick up a prior
        // test's libDamageResult.
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 NPC DamageBonus' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'NPC adapter-path damage roll must set dcc.libDamageResult').not.toBeNull()
      expect(flag.modifierDamage).toBe(2)
      const strEntry = flag.breakdown.find(b => b.source === 'Strength')
      expect(strEntry, 'NPC damage breakdown must NOT credit Strength').toBeUndefined()
      const bonusEntry = flag.breakdown.find(b => b.source === 'bonuses')
      expect(bonusEntry, 'NPC adjustment must surface as a bonus breakdown entry').toBeDefined()
      expect(bonusEntry.amount).toBe(2)
    })

    test('PC with +1 magic weapon routes via adapter + magic breakdown entry', async ({ page }) => {
      // Phase 3 session 8. A weapon with `damageWeaponBonus: '+1'` flows
      // through the adapter's expanded gate. `item.js` bakes the magic
      // bonus into the damage formula as a second trailing modifier
      // (e.g. `1d8+2+1`); the adapter peels it back off strengthModifier
      // and sets `DamageInput.magicBonus`, so the lib breakdown carries
      // separate `Strength` and `magic` entries.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 PC MagicSword',
          type: 'Player',
          system: { abilities: { str: { value: 13, mod: 1 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-MagicSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d8',
            damageWeaponBonus: '+1',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 PC MagicSword').items.getName('P1-MagicSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 PC MagicSword').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-MagicSword' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-MagicSword' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 PC MagicSword' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'PC +1 weapon adapter-path damage roll must set dcc.libDamageResult').not.toBeNull()
      const magicEntry = flag.breakdown.find(b => b.source === 'magic')
      expect(magicEntry, 'magic weapon bonus must surface as a breakdown entry').toBeDefined()
      expect(magicEntry.amount).toBe(1)
    })

    test('trailing bracket-flavor formula (`1d6+2[Slashing]`) routes via adapter (D2 damage sub-slice b)', async ({ page }) => {
      // D2 damage sub-slice (b). A flat-modifier-then-flavor formula
      // (`1d6+2[Slashing]`) is not per-term-flavored — legacy peels the
      // bracket into the `Compound` term's `flavor` field and feeds the
      // cleaned formula to DCCRoll.createRoll. The adapter does the same
      // so the flavor label still renders in chat, and `parseDamageFormula`
      // sees only the clean `1d6+2` and builds a valid `DamageInput`. This
      // formerly fell to legacy via the `includes('[')` gate rejection;
      // sub-slice (b) removes that rejection and peels the flavor first.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage BracketFlavor', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FlavorBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            // Baked-in trailing flavor — simulates homebrew content or
            // modules that annotate damage type inline.
            damage: '1d6+2[Slashing]',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage BracketFlavor').items.getName('P1-FlavorBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage BracketFlavor').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FlavorBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-FlavorBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Damage BracketFlavor' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // libDamageResult populated — parser saw the cleaned `1d6+2` after
      // `peelTrailingFlavor` stripped `[Slashing]`.
      expect(flag, 'bracket-flavor damage must set dcc.libDamageResult').not.toBeNull()
      expect(typeof flag.damageDie).toBe('string')
      expect(flag.damageDie).toMatch(/d\d+/)
      expect(flag.total).toBe(Math.max(1, flag.baseDamage + flag.modifierDamage))
    })

    test('unparseable formula (`(1d8)*2+3`) routes via adapter as lossless passthrough (D2 damage sub-slice a)', async ({ page }) => {
      // D2 damage sub-slice (a). A lance with `doubleIfMounted` produces
      // the formula `(1d8)*2+3` via `item.js:prepareBaseData`, which
      // `parseDamageFormula` can't digest (parens + multiplier). Before
      // this sub-slice the gate rejected on `parseDamageFormula === null`
      // and the damage fell to legacy. The passthrough now routes it via
      // adapter: Foundry evaluates the Roll normally, the lib call is
      // skipped, and `dcc.libDamageResult` carries just `total` with a
      // `passthrough: true` marker so downstream consumers know the
      // breakdown is deliberately empty (not an adapter bug).
      //
      // Note: a real mounted lance needs its rider mounted, which
      // adds setup we don't need — we reproduce the shape directly by
      // overriding `damage` with an unparseable formula via
      // `damageOverride`. That's the other class of unparseable
      // formulas this sub-slice enables (homebrew damage formulas).
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage Passthrough', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-PassthroughWeapon',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damageWeapon: '1d6',
            // damageOverride forces the final damage formula verbatim,
            // bypassing the str-mod fold + magic-bonus stack. Exactly
            // how homebrew / custom content produces arbitrary formulas.
            config: { damageOverride: '(1d8)*2+3' },
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage Passthrough').items.getName('P1-PassthroughWeapon').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage Passthrough').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-PassthroughWeapon' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-PassthroughWeapon' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Damage Passthrough' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'passthrough damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough, 'passthrough marker must be set for unparseable formulas').toBe(true)
      expect(flag.breakdown).toEqual([])
      expect(typeof flag.total).toBe('number')
      expect(flag.total).toBeGreaterThanOrEqual(5) // (1d8 min 1)*2 + 3 = 5 min
      // Fields the lib would populate are null — passthrough contract.
      expect(flag.damageDie).toBeNull()
      expect(flag.natural).toBeNull()
    })

    test('cursed weapon (`damageWeaponBonus: "-1"`) routes via adapter with negative magicBonus (D2 damage sub-slice d)', async ({ page }) => {
      // Phase 3 session 19 broadened the gate to accept negative
      // `damageWeaponBonus`. `item.js` flattens a cursed flat bonus into
      // the damage formula via `Roll.safeEval` (e.g. str +3 + cursed -1
      // → `1d8+2`); the adapter reads `weapon.system.damageWeaponBonus`
      // directly, sets `DamageInput.magicBonus: -1`, and the lib
      // surfaces it as `breakdown[].source === 'cursed'` with a negative
      // amount. Strength is attributed correctly (not silently folded).
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 PC CursedBlade',
          type: 'Player',
          system: { abilities: { str: { value: 16, mod: 2 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-CursedBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d8',
            damageWeaponBonus: '-1',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 PC CursedBlade').items.getName('P1-CursedBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 PC CursedBlade').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-CursedBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-CursedBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 PC CursedBlade' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'cursed weapon adapter-path damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough).toBeUndefined()
      const cursedEntry = flag.breakdown.find(b => b.source === 'cursed')
      expect(cursedEntry, 'cursed bonus must surface as its own breakdown entry').toBeDefined()
      expect(cursedEntry.amount).toBe(-1)
    })

    test('dice-bearing magic bonus (`damageWeaponBonus: "+1d4"`) routes via adapter with extraDamageDice (D2 damage sub-slice d)', async ({ page }) => {
      // Phase 3 session 19 broadened the gate to accept dice-bearing
      // `damageWeaponBonus`. `item.js` concatenates the raw bonus onto
      // the derived damage formula (str +3 + `+1d4` magic → `1d8+3+1d4`);
      // the adapter strips the suffix, parses the base, and feeds the
      // dice as a single `extraDamageDice[]` entry (`source: 'magic'`).
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 PC FlamingBlade',
          type: 'Player',
          system: { abilities: { str: { value: 16, mod: 2 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FlamingDiceBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d8',
            damageWeaponBonus: '+1d4',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 PC FlamingBlade').items.getName('P1-FlamingDiceBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 PC FlamingBlade').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FlamingDiceBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-FlamingDiceBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 PC FlamingBlade' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'dice-bearing magic adapter-path damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough).toBeUndefined()
      const magicEntry = flag.breakdown.find(b => b.source === 'magic')
      expect(magicEntry, 'dice-bearing magic bonus must surface as magic breakdown entry').toBeDefined()
      // Extra d4 natural in [1, 4].
      expect(magicEntry.amount).toBeGreaterThanOrEqual(1)
      expect(magicEntry.amount).toBeLessThanOrEqual(4)
    })
  })

  // ── rollCritical + rollFumble (Phase 3 session 6) ──────────────────

  test.describe('rollCritical', () => {
    test('adapter path fires when attack was adapter + natural crit (forced natural 20)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Crit Adapter', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-CritSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural 20 on every die roll so the attack is always a crit.
        // Foundry's Die#mapRandomFace = Math.ceil((1 - randomUniform) * faces);
        // so randomUniform near 0 → max face (20 on d20).
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.0001
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Crit Adapter').items.getName('P1-CritSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Crit Adapter').rollWeaponAttack(id)
      }, weaponId)
      // Restore randomUniform BEFORE asserting — see backstab libResult test.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-CritSword' })
      const critLine = await waitForAdapterLog('rollCritical')
      assertPath(critLine, 'adapter', { weapon: 'P1-CritSword' })
    })

    test('adapter path populates dcc.libCritResult chat flag', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Crit LibFlag', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-LibCritSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.0001
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Crit LibFlag').items.getName('P1-LibCritSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Crit LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.getFlag('dcc', 'isToHit') && m.getFlag('dcc', 'libCritResult'))
          if (msg) return msg.getFlag('dcc', 'libCritResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'adapter-path crit must set dcc.libCritResult').not.toBeNull()
      expect(typeof flag.critDie).toBe('string')
      expect(flag.critDie).toMatch(/d\d+/)
      expect(typeof flag.natural).toBe('number')
      expect(flag.natural).toBeGreaterThanOrEqual(1)
      expect(typeof flag.total).toBe('number')
      expect(typeof flag.critTable).toBe('string')
      expect(Array.isArray(flag.modifiers)).toBe(true)
    })

    test('gate-style cleanup: crit/fumble/damage accept the post-cleanup signatures live', async ({ page }) => {
      // The vestigial `attackRollResult` middle param was dropped from
      // `_rollDamage` / `_rollCritical` / `_rollFumble` (unused since the
      // D2 retirement). Invoke each private method directly against live
      // Foundry with the new signature — `(weapon, ctx)` for crit/fumble,
      // `(weapon, formula, options)` for damage — to prove the drop holds
      // end-to-end, not just under unit mocks.
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Sig Cleanup', type: 'Player' })
        actor.system.abilities.lck.mod = '+0'
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        const weapon = { name: 'P1-SigWeapon', system: {} }

        const proto = Object.getPrototypeOf(actor)
        const crit = await actor._rollCritical(weapon, { automate: true, luckMod: '+0', critTableName: 'III' })
        const fumble = await actor._rollFumble(weapon, {
          automate: true, luckMod: '+0', inverseLuckMod: '+0', useNPCFumbles: false, fumbleTableName: 'Table 4-2: Fumbles', originalFumbleTableName: 'Table 4-2: Fumbles'
        })
        const damage = await actor._rollDamage(weapon, '1d8+2', {})

        return {
          critArity: proto._rollCritical.length,
          fumbleArity: proto._rollFumble.length,
          damageArity: proto._rollDamage.length,
          critFormula: crit.critRollFormula,
          fumbleFormula: fumble.fumbleRollFormula,
          damageDefined: !!damage.damageRoll
        }
      })

      expect(result.critArity, '_rollCritical is (weapon, ctx)').toBe(2)
      expect(result.fumbleArity, '_rollFumble is (weapon, ctx)').toBe(2)
      expect(result.damageArity, '_rollDamage is (weapon, formula, options)').toBe(2)
      expect(result.critFormula).toMatch(/d\d+/)
      expect(result.fumbleFormula).toMatch(/d\d+/)
      expect(result.damageDefined, 'damage route produced a Roll under the new signature').toBe(true)
    })
  })

  test.describe('rollFumble', () => {
    test('adapter path fires when attack was adapter + natural 1 fumble', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Fumble Adapter', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FumbleSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural 1 → fumble on every die roll.
        // Foundry's Die#mapRandomFace = Math.ceil((1 - randomUniform) * faces);
        // so randomUniform near 1 → min face (1 on d20).
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.9999
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Fumble Adapter').items.getName('P1-FumbleSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Fumble Adapter').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FumbleSword' })
      const fumbleLine = await waitForAdapterLog('rollFumble')
      assertPath(fumbleLine, 'adapter', { weapon: 'P1-FumbleSword' })

      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })
    })

    test('adapter path populates dcc.libFumbleResult chat flag', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Fumble LibFlag', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-LibFumbleSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.9999
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Fumble LibFlag').items.getName('P1-LibFumbleSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Fumble LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.getFlag('dcc', 'isToHit') && m.getFlag('dcc', 'libFumbleResult'))
          if (msg) return msg.getFlag('dcc', 'libFumbleResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'adapter-path fumble must set dcc.libFumbleResult').not.toBeNull()
      expect(typeof flag.fumbleDie).toBe('string')
      expect(flag.fumbleDie).toMatch(/d\d+/)
      expect(typeof flag.natural).toBe('number')
      expect(typeof flag.total).toBe('number')
      expect(Array.isArray(flag.modifiers)).toBe(true)
    })

    test('D2 retirement: crit + fumble gate/legacy/adapter-alias methods are gone (session 16)', async ({ page }) => {
      // Session 16 folded the `!automate` branch into the adapter
      // path and deleted the legacy bodies. Guard against regressions
      // that reintroduce the dispatcher scaffold.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          hasCrit: typeof proto._rollCritical === 'function',
          hasFumble: typeof proto._rollFumble === 'function',
          hasCritGate: typeof proto._canRouteCritViaAdapter === 'function',
          hasFumbleGate: typeof proto._canRouteFumbleViaAdapter === 'function',
          hasCritLegacy: typeof proto._rollCriticalLegacy === 'function',
          hasFumbleLegacy: typeof proto._rollFumbleLegacy === 'function',
          hasCritAdapterAlias: typeof proto._rollCriticalViaAdapter === 'function',
          hasFumbleAdapterAlias: typeof proto._rollFumbleViaAdapter === 'function'
        }
      })
      expect(surface.hasCrit, '_rollCritical remains the public method').toBe(true)
      expect(surface.hasFumble, '_rollFumble remains the public method').toBe(true)
      expect(surface.hasCritGate, '_canRouteCritViaAdapter retired in D2').toBe(false)
      expect(surface.hasFumbleGate, '_canRouteFumbleViaAdapter retired in D2').toBe(false)
      expect(surface.hasCritLegacy, '_rollCriticalLegacy retired in D2').toBe(false)
      expect(surface.hasFumbleLegacy, '_rollFumbleLegacy retired in D2').toBe(false)
      expect(surface.hasCritAdapterAlias, '_rollCriticalViaAdapter folded into _rollCritical').toBe(false)
      expect(surface.hasFumbleAdapterAlias, '_rollFumbleViaAdapter folded into _rollFumble').toBe(false)
    })

    test('D2 damage retirement: gate/legacy/adapter-alias methods are gone (session 19)', async ({ page }) => {
      // Session 19 broadened the damage gate to exhaustion (multi-type,
      // dice-bearing, cursed, passthrough for unparseable) and collapsed
      // the dispatcher. `_rollDamage` is a single path whose body is the
      // former `_rollDamageViaAdapter`; the gate / legacy / via-adapter
      // alias are all deleted. Guard against regressions.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          hasDamage: typeof proto._rollDamage === 'function',
          hasBuildLibDamage: typeof proto._buildLibDamageResult === 'function',
          hasStructure: typeof proto._structureDamageInput === 'function',
          hasDamageGate: typeof proto._canRouteDamageViaAdapter === 'function',
          hasDamageLegacy: typeof proto._rollDamageLegacy === 'function',
          hasDamageAdapterAlias: typeof proto._rollDamageViaAdapter === 'function'
        }
      })
      expect(surface.hasDamage, '_rollDamage remains the single path').toBe(true)
      expect(surface.hasBuildLibDamage, '_buildLibDamageResult helper remains').toBe(true)
      expect(surface.hasStructure, '_structureDamageInput helper remains').toBe(true)
      expect(surface.hasDamageGate, '_canRouteDamageViaAdapter retired in D2 damage').toBe(false)
      expect(surface.hasDamageLegacy, '_rollDamageLegacy retired in D2 damage').toBe(false)
      expect(surface.hasDamageAdapterAlias, '_rollDamageViaAdapter folded into _rollDamage').toBe(false)
    })

    test('C1 cruft: critText/fumbleText shims retired from rollWeaponAttack messageData', async ({ page }) => {
      // C1 cruft slice: the DCC system previously emitted both the
      // canonical `critResult` / `fumbleResult` AND the legacy aliases
      // `critText` / `fumbleText` on the weapon-attack chat
      // `messageData.system`. The aliases were labeled "Legacy name for
      // dcc-qol compatibility" and are now retired. Guard that the
      // canonical fields are still emitted and the shim aliases are not.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 C1 Shim Guard', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-ShimGuardSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+0',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        globalThis.__c1CapturedSystem = null
        globalThis.__c1HookId = Hooks.on('dcc.rollWeaponAttack', (rolls, messageData) => {
          globalThis.__c1CapturedSystem = {
            hasCritResult: 'critResult' in messageData.system,
            hasFumbleResult: 'fumbleResult' in messageData.system,
            hasCritText: 'critText' in messageData.system,
            hasFumbleText: 'fumbleText' in messageData.system
          }
        })
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 C1 Shim Guard').items.getName('P1-ShimGuardSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 C1 Shim Guard').rollWeaponAttack(id)
      }, weaponId)

      const captured = await page.evaluate(() => {
        Hooks.off('dcc.rollWeaponAttack', globalThis.__c1HookId)
        return globalThis.__c1CapturedSystem
      })

      expect(captured, 'dcc.rollWeaponAttack hook must have fired').not.toBeNull()
      expect(captured.hasCritResult, 'messageData.system.critResult stays as the canonical field').toBe(true)
      expect(captured.hasFumbleResult, 'messageData.system.fumbleResult stays as the canonical field').toBe(true)
      expect(captured.hasCritText, 'messageData.system.critText shim retired in C1').toBe(false)
      expect(captured.hasFumbleText, 'messageData.system.fumbleText shim retired in C1').toBe(false)
    })

    test('C2 cruft: V14 world boots past the MINIMUM_SUPPORTED_VERSION floor without a block', async ({ page }) => {
      // C2 added a floor-guard in `checkMigrations` that refuses worlds
      // below the V14 era (< 0.66). A live v14 world either skips
      // migrations (setting already >= 0.67) or runs them (fresh world
      // stamp-bumps to 0.67). Either way, no `DCC.MigrationUnsupportedVersion`
      // error notification should appear. This guard pins the invariant.
      const state = await page.evaluate(() => {
        const version = game.settings.get('dcc', 'systemMigrationVersion')
        const unsupportedNote = Array.from(
          document.querySelectorAll('#notifications .notification.error')
        ).map(n => n.textContent)
          .find(text => text.includes('below the minimum supported version'))
        return { version, unsupportedNote: unsupportedNote || null }
      })
      expect(state.unsupportedNote, 'no MigrationUnsupportedVersion error should be visible on a V14 world').toBeNull()
      expect(state.version, 'V14 worlds store systemMigrationVersion at or above the V14 floor').toBeGreaterThanOrEqual(0.66)
    })
  })

  // ── error boundary (Phase 7 session 20) ────────────────────────────
  //
  // The public dispatchers wrap their bodies in `withRollErrorBoundary`
  // (debug.mjs) so a throw inside an adapter path surfaces to the user
  // (console.error + ui.notifications.error) + rethrows, instead of
  // becoming a silent unhandled rejection. These live tests force a
  // throw on a real actor and assert the user-visible failure.
  test.describe('error boundary', () => {
    test('rollAbilityCheck: a thrown adapter error notifies the user + rejects', async ({ page }) => {
      await makePlayer(page, 'P1 Boundary Ability')
      const result = await page.evaluate(async () => {
        const actor = game.actors.getName('P1 Boundary Ability')
        // Force the adapter sub-path to throw.
        const original = actor._rollAbilityCheckViaAdapter
        actor._rollAbilityCheckViaAdapter = () => { throw new Error('forced adapter failure') }
        let rejected = false
        try {
          await actor.rollAbilityCheck('lck')
        } catch {
          rejected = true
        } finally {
          actor._rollAbilityCheckViaAdapter = original
        }
        // The boundary shows a ui.notifications.error — find its DOM node.
        const errorNote = Array.from(
          document.querySelectorAll('#notifications .notification.error')
        ).some(n => n.textContent && n.textContent.length > 0)
        return { rejected, errorNote }
      })
      // Fail-loud: the error propagated (not swallowed) AND the user saw it.
      expect(result.rejected, 'rollAbilityCheck rejected (rethrow, not swallow)').toBe(true)
      expect(result.errorNote, 'a ui.notifications.error was shown').toBe(true)
    })

    test('getInitiativeRoll: a thrown adapter error throws synchronously (combat-tracker contract)', async ({ page }) => {
      await makePlayer(page, 'P1 Boundary Init')
      const result = await page.evaluate(async () => {
        const actor = game.actors.getName('P1 Boundary Init')
        const original = actor._getInitiativeRollViaAdapter
        actor._getInitiativeRollViaAdapter = () => { throw new Error('forced init failure') }
        let threwSync = false
        let returnedPromise = false
        try {
          const ret = actor.getInitiativeRoll()
          // If we get here it didn't throw synchronously — check whether
          // it handed back a promise (which would break Foundry's sync
          // combat-tracker contract).
          returnedPromise = typeof ret?.then === 'function'
        } catch {
          threwSync = true
        } finally {
          actor._getInitiativeRollViaAdapter = original
        }
        const errorNote = Array.from(
          document.querySelectorAll('#notifications .notification.error')
        ).some(n => n.textContent && n.textContent.length > 0)
        return { threwSync, returnedPromise, errorNote }
      })
      // Synchronous throw — NOT a rejected promise — so the combat tracker
      // sees a thrown error, not an unhandled rejection it never awaits.
      expect(result.threwSync, 'getInitiativeRoll threw synchronously').toBe(true)
      expect(result.returnedPromise, 'did not hand back a promise').toBe(false)
      expect(result.errorNote, 'a ui.notifications.error was shown').toBe(true)
    })
  })
})
