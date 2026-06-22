/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Friendly fire (module/friendly-fire.mjs) end-to-end against live Foundry.
 * A ranged attacker misses a high-AC target that has a friendly ally engaged
 * in melee with it, with automateFriendlyFire on. The system must post a
 * friendly-fire result card (flag `dcc.isFriendlyFire`) carrying the d100
 * check — unless the attack rolled a natural 20 (a crit auto-hits ~5% of the
 * time, so no stray shot), which the assertion tolerates to stay deterministic.
 */
const test = createSessionTest()

test.describe('Friendly fire', () => {
  test('a missed missile shot into melee posts a friendly-fire card', async ({ page }) => {
    const result = await page.evaluate(async () => {
      let createdSceneId = null
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({ name: 'DCC FF Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
        createdSceneId = scene.id
        await scene.view()
      }
      const scene = game.canvas.scene

      const prevFF = game.settings.get('dcc', 'automateFriendlyFire')
      await game.settings.set('dcc', 'automateFriendlyFire', true)

      // High-AC target so the attack reliably misses (only a natural 20 hits).
      const target = await Actor.create({ name: 'DCC FF Target', type: 'NPC', system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 30 } } }, prototypeToken: { actorLink: true } })
      const allyActor = await Actor.create({ name: 'DCC FF Ally', type: 'NPC', system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 10 } } }, prototypeToken: { actorLink: true } })
      const attacker = await Actor.create({ name: 'DCC FF Attacker', type: 'Player' })
      const [weapon] = await attacker.createEmbeddedDocuments('Item', [{
        name: 'Probe Bow',
        type: 'weapon',
        system: { damage: '1d6', toHit: '+0', melee: false, range: '30/60/120', actionDie: '1d20', equipped: true }
      }])

      // Attacker + ally are FRIENDLY (disposition 1), target is HOSTILE (-1).
      // The ally is one grid step (5 ft) from the target → engaged in melee.
      const [attackerToken] = await scene.createEmbeddedDocuments('Token', [{ name: 'Atk', actorId: attacker.id, actorLink: true, x: 1000, y: 1000, width: 1, height: 1, disposition: 1 }])
      const [targetToken] = await scene.createEmbeddedDocuments('Token', [{ name: 'Tgt', actorId: target.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
      const [allyToken] = await scene.createEmbeddedDocuments('Token', [{ name: 'Ally', actorId: allyActor.id, actorLink: true, x: 600, y: 500, width: 1, height: 1, disposition: 1 }])

      const deadline0 = Date.now() + 3000
      while (Date.now() < deadline0 && !game.canvas.tokens.get(targetToken.id)) await new Promise(resolve => setTimeout(resolve, 50))
      game.canvas.tokens.get(targetToken.id).setTarget(true, { releaseOthers: true })

      const before = game.messages.size
      await attacker.rollWeaponAttack(weapon.id, {})

      // Friendly fire is fire-and-forget (rolls → ChatMessage.create); poll for it.
      let ffMessage = null
      const deadline = Date.now() + 4000
      while (Date.now() < deadline && !ffMessage) {
        ffMessage = game.messages.contents.find(m => m.getFlag('dcc', 'isFriendlyFire'))
        if (!ffMessage) await new Promise(resolve => setTimeout(resolve, 100))
      }

      const lastAttack = game.messages.contents.filter(m => m.getFlag('dcc', 'isToHit')).at(-1)
      const crit = !!lastAttack?.getFlag('dcc', 'isCrit')

      const out = {
        before,
        crit,
        hasFFMessage: !!ffMessage,
        ffContent: ffMessage?.content ?? '',
        ffRollCount: ffMessage?.rolls?.length ?? 0
      }

      // cleanup
      game.canvas.tokens.get(targetToken.id)?.setTarget(false, { releaseOthers: true })
      await game.settings.set('dcc', 'automateFriendlyFire', prevFF)
      await scene.deleteEmbeddedDocuments('Token', [attackerToken.id, targetToken.id, allyToken.id])
      await target.delete()
      await allyActor.delete()
      await attacker.delete()
      if (createdSceneId) await game.scenes.get(createdSceneId)?.delete()

      return out
    })

    if (result.crit) {
      expect(result.hasFFMessage).toBe(false) // crit hit → no stray shot
    } else {
      expect(result.hasFFMessage).toBe(true)
      expect(result.ffContent).toContain('friendly-fire')
      expect(result.ffRollCount).toBeGreaterThanOrEqual(1) // at least the d100
    }
  })
})
