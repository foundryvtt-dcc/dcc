/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Enhanced attack cards (module/chat/enhanced-attack-card.mjs) end-to-end
 * against live Foundry. With enhancedAttackCards on and automation off, a PC
 * attacks a targeted, low-AC NPC. The rendered chat message must carry the
 * enhanced card with the hit banner, the hit/miss flags must be stored on the
 * message, and (automation off) the Roll Damage button must be present.
 */
const test = createSessionTest()

test.describe('Enhanced attack cards', () => {
  test('an attack renders the enhanced card with a hit banner + damage button', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({ name: 'DCC Enhanced Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
        await scene.view()
      }
      const scene = game.canvas.scene

      const prevEnhanced = game.settings.get('dcc', 'enhancedAttackCards')
      const prevAutomate = game.settings.get('dcc', 'automateDamageFumblesCrits')
      await game.settings.set('dcc', 'enhancedAttackCards', true)
      await game.settings.set('dcc', 'automateDamageFumblesCrits', false)

      const target = await Actor.create({ name: 'DCC Enh Target', type: 'NPC', system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 1 } } }, prototypeToken: { actorLink: true } })
      const attacker = await Actor.create({ name: 'DCC Enh Attacker', type: 'Player' })
      const [weapon] = await attacker.createEmbeddedDocuments('Item', [{
        name: 'Probe Blade',
        type: 'weapon',
        system: { damage: '1d6', toHit: '+10', melee: true, actionDie: '1d20', equipped: true }
      }])

      const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'Tgt', actorId: target.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
      const deadline0 = Date.now() + 3000
      while (Date.now() < deadline0 && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
      game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })

      await attacker.rollWeaponAttack(weapon.id, {})

      // Poll the chat log DOM for the rendered enhanced card.
      let cardHTML = null
      let message = null
      const deadline = Date.now() + 5000
      while (Date.now() < deadline && !cardHTML) {
        message = game.messages.contents.filter(m => m.getFlag('dcc', 'isToHit')).at(-1)
        const el = message ? document.querySelector(`.message[data-message-id="${message.id}"] .dcc-enhanced-card`) : null
        if (el) cardHTML = el.outerHTML
        if (!cardHTML) await new Promise(resolve => setTimeout(resolve, 100))
      }

      const out = {
        hasCard: !!cardHTML,
        isHitBanner: !!cardHTML && cardHTML.includes('attack-hit'),
        hasDamageButton: !!cardHTML && cardHTML.includes('data-action="roll-damage"'),
        hasTargetFlag: !!message?.getFlag('dcc', 'hasTarget'),
        hitsTargetFlag: !!message?.getFlag('dcc', 'hitsTarget'),
        crit: !!message?.getFlag('dcc', 'isCrit')
      }

      // cleanup
      game.canvas.tokens.get(tokenDoc.id)?.setTarget(false, { releaseOthers: true })
      await game.settings.set('dcc', 'enhancedAttackCards', prevEnhanced)
      await game.settings.set('dcc', 'automateDamageFumblesCrits', prevAutomate)
      await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
      await target.delete()
      await attacker.delete()

      return out
    })

    expect(result.hasCard).toBe(true)
    expect(result.isHitBanner).toBe(true) // AC 1 + toHit +10 always hits
    expect(result.hasTargetFlag).toBe(true)
    expect(result.hitsTargetFlag).toBe(true)
    // A crit shows the Crit button instead of (well, alongside) damage; on a
    // normal hit the Roll Damage button must be present.
    if (!result.crit) expect(result.hasDamageButton).toBe(true)
  })
})
