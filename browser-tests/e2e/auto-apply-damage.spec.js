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
      // The GM applies the card's own damage roll and marks the card (#994).
      const cardDamage = lastAttack?.rolls?.find(r => r.options?.dcc?.isDamageRoll)?.total
      const damageApplied = !!lastAttack?.getFlag('dcc', 'damageApplied')

      // cleanup
      placeable.setTarget(false, { releaseOthers: true })
      await game.settings.set('dcc', 'autoApplyDamage', prevAuto)
      await game.settings.set('dcc', 'automateDamageFumblesCrits', prevAutomate)
      await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
      await npc.delete()
      await attacker.delete()

      return { startHp, endHp, fumbled, cardDamage, damageApplied }
    })

    expect(result.startHp).toBe(20)
    if (result.fumbled) {
      expect(result.endHp).toBe(20) // auto-miss: untouched
      expect(result.damageApplied).toBe(false)
    } else {
      // hit: exactly the card's damage roll is applied to the target, once
      expect(result.cardDamage).toBeGreaterThan(0)
      expect(result.endHp).toBe(20 - result.cardDamage)
      expect(result.damageApplied).toBe(true)
    }
  })

  test('the raw dcc.applyDamage socket action no longer exists (#994)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { executeAsGM } = await import(foundry.utils.getRoute('systems/dcc/module/socket.mjs'))
      const npc = await Actor.create({ name: 'DCC RawDmg Target', type: 'NPC', system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 10 } } } })
      // Any client used to be able to damage any actor with this request.
      await executeAsGM('dcc.applyDamage', { actorUuid: npc.uuid, amount: 7 })
      await new Promise(resolve => setTimeout(resolve, 500))
      const hp = npc.system.attributes.hp.value
      await npc.delete()
      return { hp }
    })
    expect(result.hp).toBe(20)
  })

  /**
   * Manual damage (#992): with automation off there is no damage roll at
   * attack time, so the card's own damage roll must apply it — once.
   * Rolls are pinned (natural 10, +10 vs AC 1: a hit, never a fumble) and the
   * damage is a flat 6. Clicks are dispatched in-page (pointer clicks can hang
   * on chat-notification overlays).
   */
  async function manualDamageRun (page, { enhanced }) {
    return page.evaluate(async ({ enhanced }) => {
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({ name: 'DCC AutoDmg Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
        await scene.view()
      }
      const scene = game.canvas.scene
      const keys = ['autoApplyDamage', 'automateDamageFumblesCrits', 'enhancedAttackCards', 'emoteRolls', 'showRollModifierByDefault']
      const prev = Object.fromEntries(keys.map(k => [k, game.settings.get('dcc', k)]))
      const origRandomUniform = CONFIG.Dice.randomUniform
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
      let npc = null
      let attacker = null
      let tokenDoc = null
      try {
        await game.settings.set('dcc', 'autoApplyDamage', true)
        await game.settings.set('dcc', 'automateDamageFumblesCrits', false)
        await game.settings.set('dcc', 'enhancedAttackCards', enhanced)
        await game.settings.set('dcc', 'emoteRolls', false)
        await game.settings.set('dcc', 'showRollModifierByDefault', false)
        ui.sidebar.changeTab('chat', 'primary')

        npc = await Actor.create({ name: 'DCC ManualDmg Target', type: 'NPC', system: { attributes: { hp: { value: 20, max: 20 }, ac: { value: 1 } } }, prototypeToken: { actorLink: true } })
        attacker = await Actor.create({ name: 'DCC ManualDmg Attacker', type: 'Player' })
        const [weapon] = await attacker.createEmbeddedDocuments('Item', [{
          name: 'Probe Blade', type: 'weapon', system: { damage: '6', toHit: '+10', melee: true, actionDie: '1d20', equipped: true }
        }])
        ;[tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'T', actorId: npc.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
        const deadline0 = Date.now() + 3000
        while (Date.now() < deadline0 && !game.canvas.tokens.get(tokenDoc.id)) await wait(50)
        game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })

        const before = new Set(game.messages.contents.map(m => m.id))
        CONFIG.Dice.randomUniform = () => 0.5
        await attacker.rollWeaponAttack(weapon.id, {})
        CONFIG.Dice.randomUniform = origRandomUniform

        let card = null
        const deadline1 = Date.now() + 3000
        while (Date.now() < deadline1 && !card) {
          card = game.messages.contents.find(m => !before.has(m.id) && m.getFlag('dcc', 'isToHit'))
          if (!card) await wait(50)
        }
        const selector = enhanced
          ? '[data-action="roll-damage"]'
          : 'a.inline-roll:not(.inline-result)[data-flavor="Damage"]'
        const findButton = () => document.querySelector(`.message[data-message-id="${card?.id}"] ${selector}`)
        const hpAfterAttack = npc.system.attributes.hp.value

        // First click: damage rolls and is applied.
        let button = null
        const deadline2 = Date.now() + 3000
        while (Date.now() < deadline2 && !(button = findButton())) await wait(50)
        button?.click()
        const deadline3 = Date.now() + 4000
        while (Date.now() < deadline3 && npc.system.attributes.hp.value === hpAfterAttack) await wait(100)
        const hpAfterFirst = npc.system.attributes.hp.value

        // Second click (the GM can re-roll): never applied twice.
        const deadline4 = Date.now() + 3000
        while (Date.now() < deadline4 && !card.getFlag('dcc', 'damageApplied')) await wait(50)
        await wait(300) // let the card re-render after the flag write
        findButton()?.click()
        await wait(1500)

        return {
          hitsTarget: card?.getFlag('dcc', 'hitsTarget'),
          targetUuid: card?.getFlag('dcc', 'targetUuid'),
          foundButton: !!button,
          hpAfterAttack,
          hpAfterFirst,
          hpAfterSecond: npc.system.attributes.hp.value,
          damageApplied: !!card?.getFlag('dcc', 'damageApplied'),
          // The damage roll posts as the attacker, not the clicking user's token.
          damageSpeaker: game.messages.contents.find(m => !before.has(m.id) && m.id !== card?.id && m.rolls?.length)?.speaker?.alias ?? null
        }
      } finally {
        CONFIG.Dice.randomUniform = origRandomUniform
        if (tokenDoc) {
          game.canvas.tokens.get(tokenDoc.id)?.setTarget(false, { releaseOthers: true })
          await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
        }
        for (const [k, v] of Object.entries(prev)) await game.settings.set('dcc', k, v)
        await npc?.delete()
        await attacker?.delete()
      }
    }, { enhanced })
  }

  test('a manual damage roll from the enhanced card is applied once (#992)', async ({ page }) => {
    const out = await manualDamageRun(page, { enhanced: true })
    expect(out.hitsTarget).toBe(true)
    expect(out.targetUuid).toBeTruthy()
    expect(out.foundButton).toBe(true)
    expect(out.hpAfterAttack).toBe(20) // nothing rolled yet with automation off
    expect(out.hpAfterFirst).toBe(14)
    expect(out.damageApplied).toBe(true)
    expect(out.hpAfterSecond).toBe(14)
  })

  test('a manual inline damage roll from the plain card is applied once (#992)', async ({ page }) => {
    const out = await manualDamageRun(page, { enhanced: false })
    expect(out.hitsTarget).toBe(true)
    expect(out.foundButton).toBe(true)
    expect(out.hpAfterAttack).toBe(20)
    expect(out.damageSpeaker).toBe('DCC ManualDmg Attacker')
    expect(out.hpAfterFirst).toBe(14)
    expect(out.damageApplied).toBe(true)
    expect(out.hpAfterSecond).toBe(14)
  })

  /**
   * Lay on Hands heal offer (#966): a cleric lays on hands with one token
   * targeted; the card offers to heal it from the active (core book) table,
   * and the click heals it once through the GM. Dice are pinned (every die
   * rolls half its faces): d20 10 + level 5 + Per 18 (+3) = 18, the "3 dice"
   * same-alignment row, capped at the subject's 2 HD → 2d8 = 8.
   */
  test('Lay on Hands heals the targeted token from the result card, once (#966)', async ({ page }) => {
    const out = await page.evaluate(async () => {
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({ name: 'DCC AutoDmg Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
        await scene.view()
      }
      const scene = game.canvas.scene
      const keys = ['layOnHandsHealButton', 'automateClericDisapproval', 'showRollModifierByDefault', 'multipleActionDice']
      const prev = Object.fromEntries(keys.map(k => [k, game.settings.get('dcc', k)]))
      const origRandomUniform = CONFIG.Dice.randomUniform
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
      let subject = null
      let cleric = null
      let tokenDoc = null
      try {
        await game.settings.set('dcc', 'layOnHandsHealButton', true)
        await game.settings.set('dcc', 'automateClericDisapproval', false)
        await game.settings.set('dcc', 'showRollModifierByDefault', false)
        await game.settings.set('dcc', 'multipleActionDice', false)
        ui.sidebar.changeTab('chat', 'primary')

        subject = await Actor.create({
          name: 'DCC LoH Subject',
          type: 'NPC',
          system: { details: { alignment: 'l' }, attributes: { hp: { value: 5, max: 20 }, hitDice: { value: '2d8' } } },
          prototypeToken: { actorLink: true }
        })
        cleric = await Actor.create({
          name: 'DCC LoH Cleric',
          type: 'Player',
          system: {
            abilities: { per: { value: 18, max: 18 } },
            class: { className: 'Cleric', disapproval: 1 },
            details: { alignment: 'l', level: { value: 5 }, sheetClass: 'Cleric' }
          }
        })
        ;[tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'Bob', actorId: subject.id, actorLink: true, x: 500, y: 500, width: 1, height: 1 }])
        const deadline0 = Date.now() + 3000
        while (Date.now() < deadline0 && !game.canvas.tokens.get(tokenDoc.id)) await wait(50)
        game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })

        const before = new Set(game.messages.contents.map(m => m.id))
        CONFIG.Dice.randomUniform = () => 0.5
        await cleric.rollSkillCheck('layOnHands')

        let card = null
        const deadline1 = Date.now() + 3000
        while (Date.now() < deadline1 && !card) {
          card = game.messages.contents.find(m => !before.has(m.id) && m.getFlag('dcc', 'layOnHands'))
          if (!card) await wait(50)
        }
        const findButton = () => document.querySelector(`.message[data-message-id="${card?.id}"] button[data-action="layOnHandsHeal"].primary`)
        let button = null
        const deadline2 = Date.now() + 3000
        while (Date.now() < deadline2 && !(button = findButton())) await wait(50)
        const buttonText = button?.textContent ?? null
        // Count within one rendering: the chat log and the notification pane both show the card.
        const alternates = button?.closest('.message')?.querySelectorAll('button[data-action="layOnHandsHeal"].alternate').length ?? 0

        button?.click()
        const deadline3 = Date.now() + 4000
        while (Date.now() < deadline3 && subject.system.attributes.hp.value === 5) await wait(100)
        const hpAfterHeal = subject.system.attributes.hp.value

        // The card re-renders as healed; no button is left to heal twice.
        await wait(300)
        findButton()?.click()
        await wait(1000)

        return {
          record: card?.getFlag('dcc', 'layOnHands') ?? null,
          buttonText,
          alternates,
          hpAfterHeal,
          hpAfterSecond: subject.system.attributes.hp.value,
          buttonLeft: !!findButton()
        }
      } finally {
        CONFIG.Dice.randomUniform = origRandomUniform
        if (tokenDoc) {
          game.canvas.tokens.get(tokenDoc.id)?.setTarget(false, { releaseOthers: true })
          await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
        }
        for (const [k, v] of Object.entries(prev)) await game.settings.set('dcc', k, v)
        await subject?.delete()
        await cleric?.delete()
      }
    })

    expect(out.record).toMatchObject({ relation: 'same', hitDie: 'd8', hitDice: 2, dice: { same: 3, adjacent: 2, opposed: 1 } })
    expect(out.buttonText).toContain('Bob')
    expect(out.buttonText).toContain('2d8')
    expect(out.alternates).toBe(2)
    expect(out.hpAfterHeal).toBe(13)
    expect(out.record.healed).toMatchObject({ relation: 'same', hp: 8, formula: '2d8' })
    expect(out.hpAfterSecond).toBe(13)
    expect(out.buttonLeft).toBe(false)
  })
})
