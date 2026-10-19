/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Enhanced attack cards (module/chat/enhanced-attack-card.mjs) end-to-end
 * against live Foundry. With enhancedAttackCards on and automation off, a PC
 * and an NPC attack a targeted, low-AC actor. The rendered chat message must
 * carry the enhanced card with the hit banner, its header artwork must resolve
 * to the weapon type icon (the PC branch) or to the actor default (the NPC
 * branch) when the sheet only has placeholder art, the hit/miss flags must be
 * stored on the message, and (automation off) the Roll Damage button must be
 * present.
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
      let target = null
      let attacker = null
      let monster = null
      let tokenDoc = null
      try {
        await game.settings.set('dcc', 'enhancedAttackCards', true)
        await game.settings.set('dcc', 'automateDamageFumblesCrits', false)

        target = await Actor.create({ name: 'DCC Enh Target', type: 'NPC', system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 1 } } }, prototypeToken: { actorLink: true } })
        attacker = await Actor.create({ name: 'DCC Enh Attacker', type: 'Player' })
        const [weapon] = await attacker.createEmbeddedDocuments('Item', [{
          name: 'Probe Blade',
          type: 'weapon',
          // Placeholder artwork on purpose: the card must show the weapon type
          // icon instead of the mystery-man silhouette (#225).
          img: 'icons/svg/mystery-man.svg',
          system: { damage: '1d6', toHit: '+10', melee: true, actionDie: '1d20', equipped: true }
        }])

        const [createdToken] = await scene.createEmbeddedDocuments('Token', [{ name: 'Tgt', actorId: target.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
        tokenDoc = createdToken
        const deadline0 = Date.now() + 3000
        while (Date.now() < deadline0 && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
        game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })

        // Only cards posted by this attack count: the reused session page keeps
        // the chat log (and its already-rendered cards) from earlier runs.
        const seen = new Set(game.messages.contents.map(m => m.id))
        await attacker.rollWeaponAttack(weapon.id, {})

        // Poll the chat log DOM for the rendered enhanced card.
        let cardHTML = null
        let weaponImgSrc = null
        let message = null
        const deadline = Date.now() + 5000
        while (Date.now() < deadline && !cardHTML) {
          message = game.messages.contents.filter(m => m.getFlag('dcc', 'isToHit') && !seen.has(m.id)).at(-1)
          const el = message ? document.querySelector(`.message[data-message-id="${message.id}"] .dcc-enhanced-card`) : null
          if (el) {
            cardHTML = el.outerHTML
            // Direct child of the header: the backstab icon is nested inside the
            // <h3>, so a bare `img` read would pick the wrong one on that layout.
            weaponImgSrc = el.querySelector('.card-header > img')?.getAttribute('src') ?? null
          }
          if (!cardHTML) await new Promise(resolve => setTimeout(resolve, 100))
        }

        // #225: the same card renders the *actor* artwork on its non-PC branch.
        // A monster carrying the mystery-man placeholder must show the actor
        // default there instead of the silhouette. Same scene, same target and
        // the same poll shape as above - only the attacker differs.
        monster = await Actor.create({
          name: 'DCC Enh Monster',
          type: 'NPC',
          img: 'icons/svg/mystery-man.svg',
          system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 10 } } }
        })
        const [claw] = await monster.createEmbeddedDocuments('Item', [{
          name: 'DCC Claw',
          type: 'weapon',
          system: { damage: '1d6', toHit: '+10', melee: true, actionDie: '1d20', equipped: true }
        }])
        const seenNpc = new Set(game.messages.contents.map(m => m.id))
        await monster.rollWeaponAttack(claw.id, {})

        let npcCardHTML = null
        let npcImgSrc = null
        const npcDeadline = Date.now() + 5000
        while (Date.now() < npcDeadline && !npcCardHTML) {
          const npcMessage = game.messages.contents.filter(m => m.getFlag('dcc', 'isToHit') && !seenNpc.has(m.id)).at(-1)
          const el = npcMessage ? document.querySelector(`.message[data-message-id="${npcMessage.id}"] .dcc-enhanced-card`) : null
          if (el) {
            npcCardHTML = el.outerHTML
            npcImgSrc = el.querySelector('.card-header > img')?.getAttribute('src') ?? null
          }
          if (!npcCardHTML) await new Promise(resolve => setTimeout(resolve, 100))
        }

        return {
          hasCard: !!cardHTML,
          isHitBanner: !!cardHTML && cardHTML.includes('attack-hit'),
          hasDamageButton: !!cardHTML && cardHTML.includes('data-action="roll-damage"'),
          weaponImgSrc,
          hasTargetFlag: !!message?.getFlag('dcc', 'hasTarget'),
          hitsTargetFlag: !!message?.getFlag('dcc', 'hitsTarget'),
          crit: !!message?.getFlag('dcc', 'isCrit'),
          hasNpcCard: !!npcCardHTML,
          npcImgSrc
        }
      } finally {
        // Restore state even when something above throws: the shared world must
        // not keep the flipped setting or the created documents.
        game.canvas.tokens.get(tokenDoc?.id)?.setTarget(false, { releaseOthers: true })
        await game.settings.set('dcc', 'enhancedAttackCards', prevEnhanced)
        await game.settings.set('dcc', 'automateDamageFumblesCrits', prevAutomate)
        if (tokenDoc) await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
        if (target) await target.delete().catch(() => {})
        if (attacker) await attacker.delete().catch(() => {})
        if (monster) await monster.delete().catch(() => {})
      }
    })

    expect(result.hasCard).toBe(true)
    expect(result.isHitBanner).toBe(true) // AC 1 + toHit +10 always hits
    expect(result.hasTargetFlag).toBe(true)
    expect(result.hitsTargetFlag).toBe(true)
    // A hit — crit or not — always offers Roll Damage.
    expect(result.hasDamageButton).toBe(true)
    // The weapon's placeholder artwork is replaced by the type icon (#225).
    expect(result.weaponImgSrc).toBe('systems/dcc/styles/images/weapon.webp')
    // #225: the NPC branch of the same card shows the actor default artwork.
    expect(result.hasNpcCard).toBe(true)
    expect(result.npcImgSrc).toBe('systems/dcc/styles/images/actor.webp')
  })
})
