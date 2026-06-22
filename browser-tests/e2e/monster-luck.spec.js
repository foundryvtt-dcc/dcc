/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Monster-vs-PC Luck rules end-to-end against live Foundry, driving the real
 * crit/fumble dispatchers on a live NPC `DCCActor`:
 *
 * - A defending PC's Luck alters a monster's critical hit (RAW): the crit roll
 *   formula gains a -Luck term (positive Luck lowers the roll, negative raises
 *   it).
 * - Optional Monster Fumbles rule (DCC Yearbook #8): a monster's fumble die is
 *   stepped along the dice chain by the targeted PC's Luck (base 1d10), via the
 *   real `dcc-core-lib` `getMonsterFumbleDie`.
 *
 * The dispatchers' `automate: false` branch returns the built formula without
 * rolling, so the wiring is asserted deterministically (a real crit/fumble
 * can't be forced through the RNG). The dispatch-level gating + target-Luck
 * extraction are covered by unit tests.
 */
const test = createSessionTest()

test.describe('Monster vs PC Luck', () => {
  test('crit formula subtracts the defending PC Luck; monster fumble die steps with it', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const npc = await Actor.create({ name: 'DCC Probe Monster', type: 'NPC' })
      const weapon = { id: 'claw', name: 'Claw', system: {} }
      try {
        const critPos = await npc._rollCritical(weapon, { automate: false, luckMod: '+0', defenderLuckMod: 2, critTableName: '' })
        const critNeg = await npc._rollCritical(weapon, { automate: false, luckMod: '+0', defenderLuckMod: -1, critTableName: '' })
        const critNone = await npc._rollCritical(weapon, { automate: false, luckMod: '+0', defenderLuckMod: 0, critTableName: '' })

        const fumbleCtx = { automate: false, luckMod: '+0', inverseLuckMod: '+0', useNPCFumbles: true, fumbleTableName: 'Fumbles', originalFumbleTableName: 'Fumbles' }
        const fumbleStepUp = await npc._rollFumble(weapon, { ...fumbleCtx, monsterFumbleLuckMod: 2 })
        const fumbleStepDown = await npc._rollFumble(weapon, { ...fumbleCtx, monsterFumbleLuckMod: -3 })
        const fumbleFlat = await npc._rollFumble(weapon, { ...fumbleCtx, monsterFumbleLuckMod: null })

        return {
          critPos: critPos.critRollFormula,
          critNeg: critNeg.critRollFormula,
          critNone: critNone.critRollFormula,
          fumbleStepUp: fumbleStepUp.fumbleRollFormula,
          fumbleStepDown: fumbleStepDown.fumbleRollFormula,
          fumbleFlat: fumbleFlat.fumbleRollFormula
        }
      } finally {
        await npc.delete()
      }
    })

    // Defending PC Luck is subtracted from the monster's crit roll.
    expect(result.critPos).toContain('-2')
    expect(result.critNeg).toContain('+1')
    expect(result.critNone).not.toMatch(/[+-]\d+[+-]\d+$/) // no second (defender) term appended

    // Monster fumble die steps along the dice chain (base 1d10).
    expect(result.fumbleStepUp).toBe('1d14') // +2 Luck
    expect(result.fumbleStepDown).toBe('1d6') // -3 Luck
    expect(result.fumbleFlat).toBe('1d10') // rule off / no PC target
  })
})
