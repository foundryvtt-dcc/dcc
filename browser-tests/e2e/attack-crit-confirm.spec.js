/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * A threat-range or backstab crit needs the attack to hit (#978). With a
 * targeted token the system hands its AC to the lib, so a threat-range roll
 * that misses is a plain miss. With no target the crit still rolls, but the
 * card notes that it only counts if the attack hits. Rolls are pinned via
 * CONFIG.Dice.randomUniform: natural = ceil((1 - u) * faces).
 */
const test = createSessionTest()

async function rollPinnedAttack (page, { name, uniform, critRange = 20, targetAC = null, backstab = false, enhanced = false, agility = 10, hand = null }) {
  return page.evaluate(async ({ name, uniform, critRange, targetAC, backstab, enhanced, agility, hand }) => {
    if (!game.canvas?.ready || !game.canvas?.scene) {
      const scene = await Scene.create({ name: 'DCC Crit Confirm Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
      await scene.view()
    }
    const scene = game.canvas.scene
    const prevAutomate = game.settings.get('dcc', 'automateDamageFumblesCrits')
    const prevAutoApply = game.settings.get('dcc', 'autoApplyDamage')
    const prevEnhanced = game.settings.get('dcc', 'enhancedAttackCards')
    const origRandomUniform = CONFIG.Dice.randomUniform
    let actor = null
    let target = null
    let tokenDoc = null
    try {
      await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      await game.settings.set('dcc', 'autoApplyDamage', true)
      await game.settings.set('dcc', 'enhancedAttackCards', enhanced)
      actor = await Actor.create({ name, type: 'Player', system: { abilities: { agl: { value: agility } }, class: { backstab: '+0' }, details: { critRange } } })
      const [weapon] = await actor.createEmbeddedDocuments('Item', [{
        name: `${name} Weapon`,
        type: 'weapon',
        system: { actionDie: '1d20', toHit: '+0', critRange, damage: '1d6', backstabDamage: '1d6', melee: true, equipped: true, ...(hand ? { [hand]: true } : {}) }
      }])
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }))
      if (targetAC !== null) {
        target = await Actor.create({ name: `${name} Target`, type: 'NPC', system: { attributes: { hp: { value: 30, max: 30 }, ac: { value: targetAC } } }, prototypeToken: { actorLink: true } })
        ;[tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'Tgt', actorId: target.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
        const deadline0 = Date.now() + 3000
        while (Date.now() < deadline0 && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
        game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })
      }

      CONFIG.Dice.randomUniform = () => uniform
      // Earlier runs leave cards with the same speaker alias; only read ours.
      const before = new Set(game.messages.contents.map(m => m.id))
      await actor.rollWeaponAttack(weapon.id, { backstab })
      CONFIG.Dice.randomUniform = origRandomUniform

      const deadline = Date.now() + 3000
      while (Date.now() < deadline) {
        const msg = game.messages.contents.slice().reverse().find(m =>
          !before.has(m.id) && m.speaker?.alias === name && m.getFlag('dcc', 'isToHit'))
        if (msg) {
          // Auto-apply is fire-and-forget through the GM socket; give it a beat.
          await new Promise(resolve => setTimeout(resolve, 500))
          let card = null
          if (enhanced) {
            const cardDeadline = Date.now() + 3000
            while (Date.now() < cardDeadline && !card) {
              card = document.querySelector(`.message[data-message-id="${msg.id}"] .dcc-enhanced-card`)
              if (!card) await new Promise(resolve => setTimeout(resolve, 50))
            }
          }
          return {
            die: msg.getFlag('dcc', 'libResult')?.die,
            hasEnhancedCard: !!card,
            enhancedNote: card?.querySelector('.crit-needs-hit-note')?.textContent.trim() ?? null,
            enhancedBanner: card?.querySelector('.roll-result')?.textContent.trim() ?? null,
            natural: msg.getFlag('dcc', 'libResult')?.natural,
            isCrit: !!msg.getFlag('dcc', 'isCrit'),
            critNeedsHit: !!msg.getFlag('dcc', 'critNeedsHit'),
            hitsTarget: msg.getFlag('dcc', 'hitsTarget'),
            isHit: msg.getFlag('dcc', 'libResult')?.isHit,
            critSource: msg.getFlag('dcc', 'libResult')?.critSource ?? null,
            hasCritRoll: msg.rolls.some(r => r.options?.['dcc.isCritRoll'] || r.options?.dcc?.isCritRoll),
            hasNote: msg.content.includes('crit-needs-hit-note'),
            targetHp: target ? game.actors.get(target.id)?.system.attributes.hp.value : null
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return null
    } finally {
      CONFIG.Dice.randomUniform = origRandomUniform
      if (tokenDoc) {
        game.canvas.tokens.get(tokenDoc.id)?.setTarget(false, { releaseOthers: true })
        await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
      }
      await game.settings.set('dcc', 'automateDamageFumblesCrits', prevAutomate)
      await game.settings.set('dcc', 'autoApplyDamage', prevAutoApply)
      await game.settings.set('dcc', 'enhancedAttackCards', prevEnhanced)
      await target?.delete()
      await actor?.delete()
    }
  }, { name, uniform, critRange, targetAC, backstab, enhanced, agility, hand })
}

test.describe('Crits need the attack to hit (#978)', () => {
  test('a threat-range 19 that misses the target is a plain miss', async ({ page }) => {
    // ceil((1 - 0.07) * 20) = 19
    const out = await rollPinnedAttack(page, { name: 'P978 Miss', uniform: 0.07, critRange: 19, targetAC: 40 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.natural).toBe(19)
    expect(out.isHit).toBe(false)
    expect(out.hitsTarget).toBe(false)
    expect(out.isCrit).toBe(false)
    expect(out.hasCritRoll).toBe(false)
    expect(out.targetHp).toBe(30) // no damage auto-applied on a miss
  })

  test('a threat-range 19 that hits the target is a confirmed crit', async ({ page }) => {
    const out = await rollPinnedAttack(page, { name: 'P978 Hit', uniform: 0.07, critRange: 19, targetAC: 10 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.hitsTarget).toBe(true)
    expect(out.isCrit).toBe(true)
    expect(out.critNeedsHit).toBe(false)
    expect(out.hasNote).toBe(false)
    expect(out.hasCritRoll).toBe(true)
    expect(out.targetHp).toBeLessThan(30) // damage auto-applied on the hit
  })

  test('with no target the crit rolls with an "only a crit if this hits" note', async ({ page }) => {
    const out = await rollPinnedAttack(page, { name: 'P978 No Target', uniform: 0.07, critRange: 19 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.isHit).toBeUndefined()
    expect(out.isCrit).toBe(true)
    expect(out.critNeedsHit).toBe(true)
    expect(out.hasNote).toBe(true)
    expect(out.hasCritRoll).toBe(true)
  })

  test('the enhanced card shows the note and "Hits AC", not "Critical hit!", with no target', async ({ page }) => {
    const out = await rollPinnedAttack(page, { name: 'P978 Enhanced', uniform: 0.07, critRange: 19, enhanced: true })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.hasEnhancedCard).toBe(true)
    const [note, hitsAc, critHit] = await page.evaluate(() => [
      game.i18n.localize('DCC.CritNeedsHitNote'),
      game.i18n.format('DCC.AttackHitsAC', { ac: 19 }),
      game.i18n.localize('DCC.AttackHitsCritNoTarget')
    ])
    expect(out.enhancedNote).toBe(note)
    expect(out.enhancedBanner).toBe(hitsAc)
    expect(out.enhancedBanner).not.toBe(critHit)
  })

  test('a backstab that misses the target does not auto-crit', async ({ page }) => {
    // ceil((1 - 0.52) * 20) = 10
    const out = await rollPinnedAttack(page, { name: 'P978 Backstab', uniform: 0.52, targetAC: 40, backstab: true })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.natural).toBe(10)
    expect(out.isCrit).toBe(false)
    expect(out.critSource).toBeNull()
    expect(out.targetHp).toBe(30)
  })
})

test.describe('Two-weapon crits follow Table 4-3 (#996)', () => {
  // natural = ceil((1 - 0.001) * faces) = the die's max face
  test('Agl 16-17 primary: a natural max that misses AC is neither a hit nor a crit', async ({ page }) => {
    const out = await rollPinnedAttack(page, { name: 'P996 Max Miss', uniform: 0.001, agility: 16, hand: 'twoWeaponPrimary', targetAC: 40 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.die).toBe('d16')
    expect(out.natural).toBe(16)
    expect(out.isHit).toBe(false)
    expect(out.hitsTarget).toBe(false)
    expect(out.isCrit).toBe(false)
    expect(out.targetHp).toBe(30)
  })

  test('Agl 16-17 primary: a natural max that beats AC crits', async ({ page }) => {
    const out = await rollPinnedAttack(page, { name: 'P996 Max Hit', uniform: 0.001, agility: 16, hand: 'twoWeaponPrimary', targetAC: 10 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.hitsTarget).toBe(true)
    expect(out.isCrit).toBe(true)
    expect(out.critSource).toBe('natural-max')
    expect(out.hasCritRoll).toBe(true)
  })

  test('Agl 12-15 off-hand: a natural max hits but cannot crit', async ({ page }) => {
    const out = await rollPinnedAttack(page, { name: 'P996 No Crit', uniform: 0.001, agility: 14, hand: 'twoWeaponSecondary', targetAC: 10 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.die).toBe('d14')
    expect(out.natural).toBe(14)
    expect(out.hitsTarget).toBe(true)
    expect(out.isCrit).toBe(false)
    expect(out.hasCritRoll).toBe(false)
  })

  test('Agl 18+ primary keeps an improved threat range', async ({ page }) => {
    // ceil((1 - 0.07) * 20) = 19
    const out = await rollPinnedAttack(page, { name: 'P996 Agl18', uniform: 0.07, critRange: 19, agility: 18, hand: 'twoWeaponPrimary', targetAC: 10 })
    expect(out, 'attack card must be posted').not.toBeNull()
    expect(out.die).toBe('d20')
    expect(out.natural).toBe(19)
    expect(out.isCrit).toBe(true)
    expect(out.critSource).toBe('threat-range')
  })

  test('the weapon sheet shows the hand\'s two-weapon crit rule', async ({ page }) => {
    const out = await page.evaluate(async () => {
      const actor = await Actor.create({ name: 'P996 Sheet', type: 'Player', system: { abilities: { agl: { value: 14 } } } })
      try {
        const [weapon] = await actor.createEmbeddedDocuments('Item', [{
          name: 'P996 Sheet Dagger',
          type: 'weapon',
          system: { actionDie: '1d20', toHit: '+0', damage: '1d4', melee: true, equipped: true, twoWeaponSecondary: true }
        }])
        await weapon.sheet.render(true)
        const rule = game.i18n.localize('DCC.TwoWeaponCritNone')
        const deadline = Date.now() + 3000
        let text = ''
        while (Date.now() < deadline && !text.includes(rule)) {
          text = [...(weapon.sheet.element?.querySelectorAll('.value-display') ?? [])]
            .map(el => el.textContent.replace(/\s+/g, ' ').trim()).join(' | ')
          if (!text.includes(rule)) await new Promise(resolve => setTimeout(resolve, 50))
        }
        await weapon.sheet.close()
        return { text, rule, critRange: weapon.system.critRange }
      } finally {
        await actor.delete()
      }
    })
    expect(out.critRange).toBe(20)
    expect(out.text).toContain(out.rule)
  })
})
