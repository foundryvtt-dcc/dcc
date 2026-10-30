/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Auto-apply dead status (module/auto-dead-status.mjs) end-to-end against live
 * Foundry. The session is the active GM, so the updateActor reaction fires
 * here: reducing an NPC's HP to 0 (with autoApplyDeadStatus on) applies the
 * dead status; a PC reduced to 0 does not (PCs are dying, not dead).
 *
 * The same HP-change path drives the half-HP morale prompt (module/morale.mjs,
 * #972): the pre-update HP rides the update options into `updateActor`.
 */
const test = createSessionTest()

test.describe('Auto-apply dead status', () => {
  test('an NPC dropped to 0 HP gains the dead status; a PC does not', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prev = game.settings.get('dcc', 'autoApplyDeadStatus')
      await game.settings.set('dcc', 'autoApplyDeadStatus', true)
      // Pin the PC death clock off: this spec asserts the NPC-only feature in
      // isolation, and a level-0 PC at 0 HP would otherwise be instant-killed
      // by the death clock if the world happens to have it enabled.
      const prevClock = game.settings.get('dcc', 'enableDeathClock')
      await game.settings.set('dcc', 'enableDeathClock', false)

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
      await game.settings.set('dcc', 'enableDeathClock', prevClock)
      await npc.delete()
      await pc.delete()

      return { npcDead, pcDead }
    })

    expect(result.npcDead).toBe(true) // NPC at 0 HP → dead
    expect(result.pcDead).toBe(false) // PC at 0 HP → not auto-dead
  })

  test('an NPC damaged to half HP whispers the GM a Roll Morale prompt that rolls morale (#972)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prev = game.settings.get('dcc', 'moraleHalfHpPrompt')
      await game.settings.set('dcc', 'moraleHalfHpPrompt', true)
      ui.sidebar.changeTab('chat', 'primary')
      const npc = await Actor.create({ name: 'DCC Morale Probe NPC', type: 'NPC', system: { attributes: { hp: { value: 10, max: 10 } } } })
      const poll = async (find) => {
        const deadline = Date.now() + 5000
        let found
        while (Date.now() < deadline && !(found = find())) await new Promise(resolve => setTimeout(resolve, 50))
        return found
      }

      await npc.update({ 'system.attributes.hp.value': 5 })
      const prompt = await poll(() => game.messages.contents.find(m => m.flags?.dcc?.moraleHalfHpPrompt && m.speaker?.actor === npc.id))
      const button = prompt && await poll(() => document.querySelector(`#chat [data-message-id="${prompt.id}"] button[data-action="rollMoraleHalfHp"]`))
      button?.click()
      const card = await poll(() => game.messages.contents.find(m => m.flags?.dcc?.isMoraleCheck && m.speaker?.actor === npc.id))

      const out = {
        whispered: (prompt?.whisper?.length ?? 0) > 0,
        trigger: card?.flags.dcc.libResult.trigger ?? null,
        rollMatchesLib: card ? card.rolls[0].total === card.flags.dcc.libResult.total : null
      }
      await ChatMessage.deleteDocuments([prompt?.id, card?.id].filter(Boolean))
      await npc.delete()
      await game.settings.set('dcc', 'moraleHalfHpPrompt', prev)
      return out
    })

    expect(result.whispered).toBe(true)
    expect(result.trigger).toBe('half-hp-lost')
    expect(result.rollMatchesLib).toBe(true)
  })
})
