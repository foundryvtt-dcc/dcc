/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Missile-weapon range penalties (module/weapon-range.mjs) end-to-end against
 * live Foundry. Proves the system actually registers its handler on its own
 * `dcc.modifyAttackRollTerms` hook and that, driven through `Hooks.call`, the
 * real vendored `dcc-core-lib` range helpers + the canvas distance measurement
 * produce the RAW penalties (rulebook p. 96): medium -2, long -1 die step,
 * beyond-long handled, and the opt-in setting gate respected.
 *
 * Token positions are plain `{x,y,width,height}` docs laid out against the live
 * grid (a throwaway scene is created + viewed only if no canvas is active), so
 * the probe needs no real token placement or attack-roll UI flow. The
 * out-of-range path is exercised via the already-confirmed branch so no modal
 * dialog is opened in the worker-reused session page.
 */
const test = createSessionTest()

test.describe('Missile weapon range penalties', () => {
  test('registered hook applies RAW range penalties and respects the setting', async ({ page }) => {
    const result = await page.evaluate(async () => {
      let createdSceneId = null
      if (!game.canvas?.dimensions) {
        const scene = await Scene.create({
          name: 'DCC Range Probe',
          width: 6000,
          height: 5000,
          grid: { type: 1, size: 100, distance: 5, units: 'ft' }
        })
        createdSceneId = scene.id
        await scene.view()
      }
      const dim = game.canvas.dimensions
      const prevSetting = game.settings.get('dcc', 'checkWeaponRange')
      await game.settings.set('dcc', 'checkWeaponRange', true)

      const weapon = { id: 'probe', name: 'Probe Longbow', system: { melee: false, range: '70/140/210' } }
      const attacker = { x: 2000, y: 2000, width: 1, height: 1 }
      const targetAtFeet = (ft) => ({ x: attacker.x + (ft / dim.distance) * dim.size, y: 2000, width: 1, height: 1 })
      const mkTerms = () => [
        { type: 'Die', label: 'Action Die', formula: '1d20', presets: [] },
        { type: 'Compound', dieLabel: 'Deed', modifierLabel: 'To Hit', formula: '+0' }
      ]
      const mkTargets = (doc) => { const s = new Set([{ document: doc }]); s.first = () => [...s][0]; return s }
      const callHook = (terms, opts) => Hooks.call('dcc.modifyAttackRollTerms', terms, {}, weapon, opts)
      const hookRegistered = (Hooks.events['dcc.modifyAttackRollTerms'] || []).length > 0

      // Medium range (100 ft): -2 attack modifier term appended.
      const mediumTerms = mkTerms()
      const mediumProceed = callHook(mediumTerms, { token: attacker, targets: mkTargets(targetAtFeet(100)) })

      // Long range (180 ft): action die steps down one rung.
      const longTerms = mkTerms()
      const longProceed = callHook(longTerms, { token: attacker, targets: mkTargets(targetAtFeet(180)) })

      // Beyond long range, already confirmed: fires at the long-range penalty
      // (the confirmed branch — no dialog opened here).
      const oorTerms = mkTerms()
      const oorProceed = callHook(oorTerms, { token: attacker, targets: mkTargets(targetAtFeet(300)), _rangeDialogConfirmed: true })

      // Short range (50 ft): no penalty.
      const shortTerms = mkTerms()
      callHook(shortTerms, { token: attacker, targets: mkTargets(targetAtFeet(50)) })

      // Setting off: handler stands down entirely.
      await game.settings.set('dcc', 'checkWeaponRange', false)
      const offTerms = mkTerms()
      const offProceed = callHook(offTerms, { token: attacker, targets: mkTargets(targetAtFeet(100)) })

      await game.settings.set('dcc', 'checkWeaponRange', prevSetting)
      if (createdSceneId) await game.scenes.get(createdSceneId)?.delete()

      return {
        hookRegistered,
        mediumProceed,
        mediumLen: mediumTerms.length,
        mediumLast: mediumTerms[mediumTerms.length - 1],
        longProceed,
        longDie: longTerms[0].formula,
        oorProceed,
        oorDie: oorTerms[0].formula,
        shortLen: shortTerms.length,
        shortDie: shortTerms[0].formula,
        offProceed,
        offLen: offTerms.length
      }
    })

    expect(result.hookRegistered).toBe(true)

    // Medium range → -2 modifier, action die untouched.
    expect(result.mediumProceed).toBe(true)
    expect(result.mediumLen).toBe(3)
    expect(result.mediumLast).toMatchObject({ type: 'Modifier', formula: -2 })

    // Long range → action die steps 1d20 → 1d16, no extra modifier term.
    expect(result.longProceed).toBe(true)
    expect(result.longDie).toBe('1d16')

    // Beyond long, confirmed → fires at the long-range die step.
    expect(result.oorProceed).toBe(true)
    expect(result.oorDie).toBe('1d16')

    // Short range → no change.
    expect(result.shortLen).toBe(2)
    expect(result.shortDie).toBe('1d20')

    // Setting off → no change.
    expect(result.offProceed).toBe(true)
    expect(result.offLen).toBe(2)
  })
})
