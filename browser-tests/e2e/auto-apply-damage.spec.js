/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Auto-apply damage (module/auto-apply-damage.mjs) end-to-end against live
 * Foundry. A GM-rolled attacker (the session is the active GM, so the apply
 * runs locally through the live socket) strikes a targeted NPC with AC 1 and
 * known HP, with autoApplyDamage on. After the attack, the NPC's HP must have
 * dropped — unless the attack fumbled (a natural 1 auto-misses ~5% of the
 * time), which the assertion tolerates so the test stays deterministic.
 */
const test = createSessionTest()

test.describe('Auto-apply damage', () => {
  test('damage from a hit is applied to the targeted token via the GM', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({ name: 'DCC AutoDmg Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
        await scene.view()
      }
      const scene = game.canvas.scene

      const prevAuto = game.settings.get('dcc', 'autoApplyDamage')
      const prevAutomate = game.settings.get('dcc', 'automateDamageFumblesCrits')
      await game.settings.set('dcc', 'autoApplyDamage', true)
      await game.settings.set('dcc', 'automateDamageFumblesCrits', true)

      // Target NPC: linked token so its HP reads back off the base actor.
      const npc = await Actor.create({
        name: 'DCC AutoDmg Target',
        type: 'NPC',
        system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 1 } } },
        prototypeToken: { actorLink: true }
      })
      const attacker = await Actor.create({ name: 'DCC AutoDmg Attacker', type: 'Player' })
      const [weapon] = await attacker.createEmbeddedDocuments('Item', [{
        name: 'Probe Blade',
        type: 'weapon',
        system: { damage: '6', toHit: '+10', melee: true, actionDie: '1d20', equipped: true }
      }])

      const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'T', actorId: npc.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
      const deadline0 = Date.now() + 3000
      while (Date.now() < deadline0 && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
      const placeable = game.canvas.tokens.get(tokenDoc.id)
      placeable.setTarget(true, { releaseOthers: true })

      const startHp = npc.system.attributes.hp.value
      await attacker.rollWeaponAttack(weapon.id, {})

      // Auto-apply is fire-and-forget (socket → applyDamage → actor.update);
      // poll for the HP change.
      const deadline = Date.now() + 4000
      while (Date.now() < deadline && npc.system.attributes.hp.value === startHp) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const endHp = npc.system.attributes.hp.value

      // Did this attack fumble? (natural-1 auto-miss — no damage expected.)
      const lastAttack = game.messages.contents.filter(m => m.getFlag('dcc', 'isToHit')).at(-1)
      const fumbled = !!lastAttack?.getFlag('dcc', 'isFumble')

      // cleanup
      placeable.setTarget(false, { releaseOthers: true })
      await game.settings.set('dcc', 'autoApplyDamage', prevAuto)
      await game.settings.set('dcc', 'automateDamageFumblesCrits', prevAutomate)
      await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
      await npc.delete()
      await attacker.delete()

      return { startHp, endHp, fumbled }
    })

    expect(result.startHp).toBe(20)
    if (result.fumbled) {
      expect(result.endHp).toBe(20) // auto-miss: untouched
    } else {
      expect(result.endHp).toBeLessThan(20) // hit: damage applied to the target
    }
  })
})
