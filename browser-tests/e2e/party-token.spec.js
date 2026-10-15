/* eslint-disable no-undef -- Foundry globals used in page.evaluate callbacks */
const { expect, createSessionTest } = require('./fixtures')

const test = createSessionTest()

test('party aggregate reads live world actor HP without persisting it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const created = []
    try {
      for (const [name, value, max] of [['First', 5, 8], ['Second', 2, 4]]) {
        created.push(await Actor.create({
          name: `PARTY TOKEN ${name}`,
          type: 'Player',
          system: { attributes: { hp: { value, max } } }
        }))
      }
      const [first, second] = created
      const party = await Actor.create({
        name: 'PARTY TOKEN Aggregate',
        type: 'Party',
        flags: { dcc: { partyMembers: [{ id: first.id }, { id: second.id }, { id: first.id }] } }
      })
      created.push(party)
      const before = party.system.aggregate
      await first.update({ 'system.attributes.hp.value': 2 })
      return {
        before,
        after: party.system.aggregate,
        persisted: Object.hasOwn(party.toObject().system, 'aggregate')
      }
    } finally {
      for (const actor of created.reverse()) await actor.delete()
    }
  })

  expect(result.before).toEqual({ hp: { value: 7, max: 12 } })
  expect(result.after).toEqual({ hp: { value: 4, max: 12 } })
  expect(result.persisted).toBe(false)
})

test('party token bars are read-only and refresh live without changing members', async ({ page }) => {
  const ids = await page.evaluate(async () => {
    const first = await Actor.create({ name: 'PARTY TOKEN Bar Member', type: 'Player', system: { attributes: { hp: { value: 5, max: 8 } } } })
    const second = await Actor.create({ name: 'PARTY TOKEN Bar NPC', type: 'NPC', system: { attributes: { hp: { value: 2, max: 4 } } } })
    const party = await Actor.create({ name: 'PARTY TOKEN Bars', type: 'Party', flags: { dcc: { partyMembers: [{ id: first.id }] } } })
    const explicit = await Actor.create({ name: 'PARTY TOKEN Explicit', type: 'Party', prototypeToken: { bar1: { attribute: null }, displayBars: 0 } })
    const scene = await Scene.create({ name: 'PARTY TOKEN Scene', width: 2000, height: 2000, grid: { size: 100, type: 1 } })
    await scene.view()
    const [token] = await scene.createEmbeddedDocuments('Token', [(await party.getTokenDocument({ x: 500, y: 500 })).toObject()])
    return { first: first.id, second: second.id, party: party.id, explicit: explicit.id, scene: scene.id, token: token.id }
  })
  try {
    await page.waitForFunction(ids => canvas.tokens?.get(ids.token)?.bars, ids)
    const initial = await page.evaluate(ids => {
      const token = canvas.scene.tokens.get(ids.token)
      return {
        attribute: token.bar1.attribute,
        bar: token.getBarAttribute('bar1'),
        display: token.displayBars,
        hover: CONST.TOKEN_DISPLAY_MODES.HOVER,
        actorLink: token.actorLink,
        explicit: game.actors.get(ids.explicit).prototypeToken.toObject()
      }
    }, ids)
    expect(initial.attribute).toBe('aggregate.hp')
    expect(initial.bar).toMatchObject({ value: 5, max: 8, editable: false })
    expect(initial.display).toBe(initial.hover)
    expect(initial.actorLink).toBe(true)
    expect(initial.explicit.bar1.attribute).toBeNull()
    expect(initial.explicit.displayBars).toBe(0)

    // Exercise Foundry's actual hover and HUD paths, not just the derived getter.
    await page.evaluate(async ids => {
      const token = canvas.tokens.get(ids.token)
      token.hover = true
      token.renderFlags.set({ refreshBars: true, refreshState: true })
      await canvas.hud.token.bind(token)
    }, ids)
    await expect.poll(() => page.evaluate(ids => canvas.tokens.get(ids.token).bars.visible, ids)).toBe(true)
    const hudBar = page.locator('#token-hud .attribute.bar1 input')
    await expect(hudBar).toBeVisible()
    await expect(hudBar).toBeDisabled()

    await page.evaluate(async ids => {
      await game.actors.get(ids.first).update({ 'system.attributes.hp.value': 3, 'system.attributes.hp.max': 10 })
    }, ids)
    await expect.poll(() => page.evaluate(ids => {
      const { value, max } = canvas.scene.tokens.get(ids.token).bar1
      return { value, max }
    }, ids)).toEqual({ value: 3, max: 10 })
    await expect(hudBar).toHaveValue('3')

    await page.evaluate(async ids => {
      await game.actors.get(ids.party).update({ 'flags.dcc.partyMembers': [{ id: ids.first }, { id: ids.second }] })
    }, ids)
    await expect.poll(() => page.evaluate(ids => {
      const { value, max } = canvas.scene.tokens.get(ids.token).bar1
      return { value, max }
    }, ids)).toEqual({ value: 5, max: 14 })

    await page.evaluate(async ids => {
      await game.actors.get(ids.first).createEmbeddedDocuments('ActiveEffect', [{ name: 'PARTY TOKEN HP Effect', changes: [{ key: 'system.attributes.hp.max', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '2' }] }])
    }, ids)
    await expect.poll(() => page.evaluate(ids => canvas.scene.tokens.get(ids.token).bar1.max, ids)).toBe(16)
    await page.evaluate(async ids => {
      const effect = game.actors.get(ids.first).effects.find(effect => effect.name === 'PARTY TOKEN HP Effect')
      await effect.update({ changes: [{ key: 'system.attributes.hp.max', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '3' }] })
    }, ids)
    await expect.poll(() => page.evaluate(ids => canvas.scene.tokens.get(ids.token).bar1.max, ids)).toBe(17)
    await page.evaluate(async ids => {
      await game.actors.get(ids.first).effects.find(effect => effect.name === 'PARTY TOKEN HP Effect').delete()
    }, ids)
    await expect.poll(() => page.evaluate(ids => canvas.scene.tokens.get(ids.token).bar1.max, ids)).toBe(14)
    // Even a programmatic bar edit must not distribute damage or healing.
    await page.evaluate(async ids => {
      const party = game.actors.get(ids.party)
      await party.modifyTokenAttribute('aggregate.hp', -2, true, true)
      await party.modifyTokenAttribute('aggregate.hp', 2, true, true)
    }, ids)
    const unchanged = await page.evaluate(ids => ({
      first: game.actors.get(ids.first).toObject().system.attributes.hp,
      second: game.actors.get(ids.second).toObject().system.attributes.hp,
      aggregatePersisted: Object.hasOwn(game.actors.get(ids.party).toObject().system, 'aggregate')
    }), ids)
    expect(unchanged.first).toMatchObject({ value: 3, max: 10 })
    expect(unchanged.second).toMatchObject({ value: 2, max: 4 })
    expect(unchanged.aggregatePersisted).toBe(false)

    await page.evaluate(async ids => { await game.actors.get(ids.second).delete() }, ids)
    await expect.poll(() => page.evaluate(ids => {
      const { value, max } = canvas.scene.tokens.get(ids.token).bar1
      return { value, max }
    }, ids)).toEqual({ value: 3, max: 10 })
  } finally {
    await page.evaluate(async ids => {
      await canvas.hud.token.clear()
      await game.scenes.get(ids.scene)?.delete()
      for (const id of [ids.party, ids.explicit, ids.first, ids.second]) await game.actors.get(id)?.delete()
    }, ids)
  }
})

test('v14 resource choices preserve Player and NPC HP and expose Party aggregate', async ({ page }) => {
  const result = await page.evaluate(() => {
    const result = {}
    for (const type of ['Player', 'NPC', 'Party']) {
      const actual = TokenDocument.getTrackedAttributes(type)
      const previous = TokenDocument.getTrackedAttributes(CONFIG.Actor.dataModels[type])
      result[type] = { actual, previous }
    }
    return result
  })
  for (const type of ['Player', 'NPC', 'Party']) {
    for (const key of ['bar', 'value']) expect(result[type].actual[key]).toEqual(expect.arrayContaining(result[type].previous[key]))
  }
  expect(result.Player.actual.bar).toContainEqual(['attributes', 'hp'])
  expect(result.NPC.actual.bar).toContainEqual(['attributes', 'hp'])
  expect(result.Party.actual.bar).toContainEqual(['aggregate', 'hp'])
  for (const type of ['Player', 'NPC']) {
    const id = await page.evaluate(async type => {
      const actor = await Actor.create({ name: `PARTY TOKEN ${type} Resources`, type })
      const PrototypeTokenConfig = CONFIG.Token.prototypeSheetClass
      await new PrototypeTokenConfig({ prototype: actor.prototypeToken }).render(true)
      return actor.id
    }, type)
    try {
      const config = page.locator('.prototype-token-config').last()
      await config.locator('[data-tab="resources"]').first().click()
      const select = config.locator('select[name="bar1.attribute"]')
      await expect(select).toBeVisible()
      await select.selectOption('attributes.hp')
      await expect(select).toHaveValue('attributes.hp')
    } finally {
      await page.evaluate(async id => {
        const actor = game.actors.get(id)
        for (const app of Object.values(actor.apps)) {
          if (app instanceof CONFIG.Token.prototypeSheetClass) await app.close()
        }
        await actor.delete()
      }, id)
    }
  }
})

test('member HP refreshes do not accumulate additive token light effects', async ({ page }) => {
  const ids = await page.evaluate(async () => {
    const member = await Actor.create({ name: 'PARTY TOKEN Light Member', type: 'Player', system: { attributes: { hp: { value: 5, max: 8 } } } })
    const party = await Actor.create({
      name: 'PARTY TOKEN Light Party',
      type: 'Party',
      flags: { dcc: { partyMembers: [{ id: member.id }] } },
      prototypeToken: { light: { bright: 10 } },
      effects: [{ name: 'PARTY TOKEN Additive Light', changes: [{ key: 'token.light.bright', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '5' }] }]
    })
    const scene = await Scene.create({ name: 'PARTY TOKEN Light Scene', width: 2000, height: 2000, grid: { size: 100, type: 1 } })
    await scene.view()
    const [token] = await scene.createEmbeddedDocuments('Token', [(await party.getTokenDocument({ x: 500, y: 500 })).toObject()])
    return { member: member.id, party: party.id, scene: scene.id, token: token.id }
  })
  try {
    await page.waitForFunction(ids => canvas.tokens?.get(ids.token)?.bars, ids)
    const state = () => page.evaluate(ids => {
      const token = canvas.scene.tokens.get(ids.token)
      return { value: token.bar1.value, max: token.bar1.max, bright: token.light.bright, sourceBright: token.toObject().light.bright }
    }, ids)
    expect(await state()).toEqual({ value: 5, max: 8, bright: 15, sourceBright: 10 })
    for (const hp of [4, 3, 2]) {
      await page.evaluate(async ({ ids, hp }) => {
        await game.actors.get(ids.member).update({ 'system.attributes.hp.value': hp })
      }, { ids, hp })
      await expect.poll(state).toEqual({ value: hp, max: 8, bright: 15, sourceBright: 10 })
    }
  } finally {
    await page.evaluate(async ids => {
      await game.scenes.get(ids.scene)?.delete()
      for (const id of [ids.party, ids.member]) await game.actors.get(id)?.delete()
    }, ids)
  }
})
