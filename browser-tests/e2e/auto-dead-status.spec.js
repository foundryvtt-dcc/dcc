/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Auto-apply dead status (module/auto-dead-status.mjs) end-to-end against live
 * Foundry. The session is the active GM, so the updateActor reaction fires
 * here: reducing an NPC's HP to 0 (with autoApplyDeadStatus on) applies the
 * dead status; a PC reduced to 0 does not (PCs are dying, not dead).
 */
const test = createSessionTest()

test.describe('Auto-apply dead status', () => {
  test('an NPC dropped to 0 HP gains the dead status; a PC does not', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prev = game.settings.get('dcc', 'autoApplyDeadStatus')
      await game.settings.set('dcc', 'autoApplyDeadStatus', true)

      const npc = await Actor.create({ name: 'DCC Dead Probe NPC', type: 'NPC', system: { attributes: { hp: { value: 5, max: 5 } } } })
      const pc = await Actor.create({ name: 'DCC Dead Probe PC', type: 'Player', system: { attributes: { hp: { value: 5, max: 5 } } } })

      // The dead ActiveEffect (statuses: ['dead']) is the source of truth.
      const isDead = (actor) => actor.effects?.contents?.some(e => e.statuses?.has?.('dead'))
      const deadAfter = async (actor) => {
        await actor.update({ 'system.attributes.hp.value': 0 })
        // updateActor reaction → toggleStatusEffect is async; poll briefly.
        const deadline = Date.now() + 2000
        while (Date.now() < deadline && !isDead(actor)) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return !!isDead(actor)
      }

      const npcDead = await deadAfter(npc)
      const pcDead = await deadAfter(pc)

      await game.settings.set('dcc', 'autoApplyDeadStatus', prev)
      await npc.delete()
      await pc.delete()

      return { npcDead, pcDead }
    })

    expect(result.npcDead).toBe(true) // NPC at 0 HP → dead
    expect(result.pcDead).toBe(false) // PC at 0 HP → not auto-dead
  })
})
