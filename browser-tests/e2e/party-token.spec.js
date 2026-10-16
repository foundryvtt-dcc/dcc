/* eslint-disable no-undef -- Foundry globals used in page.evaluate callbacks */
const { expect, createSessionTest, significantConsoleErrors } = require('./fixtures')

const consoleErrors = []
const test = createSessionTest({ onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) } })

test.beforeEach(() => { consoleErrors.length = 0 })
test.afterEach(() => { expect(significantConsoleErrors(consoleErrors)).toEqual([]) })

async function createSwapFixture (page) {
  return page.evaluate(async () => {
    const members = []
    for (let i = 0; i < 3; i++) members.push(await Actor.create({ name: `PARTY TOKEN UI Member ${i}`, type: 'Player' }))
    const foreign = await Actor.create({ name: 'PARTY TOKEN UI Foreign', type: 'NPC' })
    const party = await Actor.create({ name: 'PARTY TOKEN UI Party', type: 'Party', flags: { dcc: { partyMembers: members.map(member => ({ id: member.id })) } } })
    const scene = await Scene.create({ name: 'PARTY TOKEN UI Source', width: 3000, height: 3000, grid: { size: 100, type: 1 } })
    await scene.view()
    const data = []
    for (const [i, actor] of [...members, foreign].entries()) {
      data.push((await actor.getTokenDocument({
        actorLink: true,
        level: canvas.level.id,
        x: 400 + i * 300,
        y: 600,
        width: i === 0 ? 2 : 1,
        height: i === 1 ? 2 : 1,
        elevation: 11 + i,
        sight: { enabled: true, range: 30 + i },
        light: { bright: 10 + i, dim: 20 + i },
        flags: { dcc: { partyTokenProbe: `individual-${i}` } }
      }, { parent: scene })).toObject())
    }
    const tokens = await scene.createEmbeddedDocuments('Token', data)
    // Foundry does not guarantee that a create batch is returned in input
    // order, so map the created Tokens back to their Actor instead of trusting
    // the return order — the same reason deployPartyTokens matches by ID.
    const byActor = new Map(tokens.map(token => [token.actorId, token]))
    const ordered = [...members, foreign].map(actor => byActor.get(actor.id))
    await party.sheet.render(true)
    return {
      party: party.id,
      actors: [...members, foreign, party].map(actor => actor.id),
      members: members.map(actor => actor.id),
      scene: scene.id,
      scenes: [scene.id],
      tokens: ordered.map(token => token.id),
      originals: ordered.map(token => token.toObject())
    }
  })
}

async function cleanSwapFixture (page, ids) {
  await page.evaluate(async ids => {
    await canvas.hud.token.clear()
    for (const id of ids.scenes) await game.scenes.get(id)?.delete()
    for (const id of ids.actors) await game.actors.get(id)?.delete()
    document.querySelectorAll('#notifications .notification').forEach(element => element.remove())
  }, ids)
}

const sheetSwap = '.dcc.actor.party [data-action="togglePartyTokens"]'
const hudSwap = '#token-hud [data-action="partyTokenAction"]'

test('sheet gathers selected individualized members; moved party HUD restores them with fresh IDs', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(ids => {
      canvas.tokens.releaseAll()
      for (const id of [ids.tokens[0], ids.tokens[1], ids.tokens[3]]) canvas.tokens.get(id).control({ releaseOthers: false })
    }, ids)
    await expect(page.locator(sheetSwap)).toHaveAccessibleName('Gather')
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => {
      const scene = game.scenes.get(ids.scene)
      return game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 2 &&
        !scene.tokens.has(ids.tokens[0]) && !scene.tokens.has(ids.tokens[1])
    }, ids)
    const gathered = await page.evaluate(ids => {
      const scene = game.scenes.get(ids.scene)
      return { snapshot: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), remaining: scene.tokens.map(token => token.id) }
    }, ids)
    expect(gathered.snapshot.members.map(member => member.tokenData)).toEqual(ids.originals.slice(0, 2))
    expect(gathered.remaining).toContain(ids.tokens[2])
    expect(gathered.remaining).toContain(ids.tokens[3])
    await expect(page.locator(sheetSwap)).toHaveAccessibleName('Deploy')
    const partyTokenId = await page.evaluate(async ids => {
      const token = canvas.scene.tokens.find(token => token.actorId === ids.party)
      // Displace, don't walk: v14 token movement is animated by default and its
      // completion depends on the canvas ticker, which is unreliable in headless
      // CI. `displace` teleports instantly so the ring is computed around the
      // token's final position.
      await token.move({ x: 1600, y: 1600, action: 'displace' })
      return token.id
    }, ids)
    expect(await page.evaluate(id => {
      const token = canvas.scene.tokens.get(id)
      return { x: token.x, y: token.y }
    }, partyTokenId)).toEqual({ x: 1600, y: 1600 })
    await page.evaluate(async id => { await canvas.hud.token.bind(canvas.tokens.get(id)) }, partyTokenId)
    await expect(page.locator(hudSwap)).toHaveAccessibleName('Deploy')
    await page.evaluate(async () => { await canvas.hud.token.render(true); await canvas.hud.token.render(true) })
    await expect(page.locator(hudSwap)).toHaveCount(1)
    await page.locator(hudSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
    const restored = await page.evaluate(ids => ({
      tokens: canvas.scene.tokens.map(token => token.toObject()),
      snapshots: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null
    }), ids)
    expect(restored.snapshots).toBeNull()
    expect(restored.tokens.some(token => token._id === partyTokenId)).toBe(false)
    for (const original of ids.originals.slice(0, 2)) {
      const token = restored.tokens.find(token => token.actorId === original.actorId)
      expect(token._id).not.toBe(original._id)
      for (const key of ['actorLink', 'width', 'height', 'elevation', 'sight', 'light', 'flags', 'level']) expect(token[key]).toEqual(original[key])
      expect(token.x).toBeGreaterThan(1200)
      expect(token.y).toBeGreaterThan(1200)
    }
    expect(restored.tokens.find(token => token._id === ids.tokens[3])).toEqual(ids.originals[3])
    await expect(page.locator(sheetSwap)).toHaveAccessibleName('Gather')
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('UI travel requires target token, blocks combat and skips departed or deleted saved members', async ({ page }) => {
  const ids = await createSwapFixture(page)
  let combatId
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(() => canvas.tokens.releaseAll())
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 && canvas.scene.tokens.size === 2, ids)
    const targetId = await page.evaluate(async () => {
      const target = await Scene.create({ name: 'PARTY TOKEN UI Target', width: 3000, height: 3000, grid: { size: 100, type: 1 } })
      await target.view()
      return target.id
    })
    ids.scenes.push(targetId)
    await page.locator(sheetSwap).evaluate(element => element.click())
    await expect(page.locator('#notifications')).toContainText('Place a linked token')
    expect(await page.evaluate(() => canvas.scene.tokens.size)).toBe(0)
    const targetTokenId = await page.evaluate(async ids => {
      const party = game.actors.get(ids.party)
      await party.update({ 'flags.dcc.partyMembers': [{ id: ids.members[0] }, { id: ids.members[2] }] })
      await game.actors.get(ids.members[2]).delete()
      const [token] = await canvas.scene.createEmbeddedDocuments('Token', [(await party.getTokenDocument({ x: 1700, y: 1700, level: canvas.level.id }, { parent: canvas.scene })).toObject()])
      return token.id
    }, ids)
    combatId = await page.evaluate(async id => {
      const combat = await Combat.create({ scene: canvas.scene.id, active: true, round: 1 })
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: id, sceneId: canvas.scene.id, actorId: canvas.scene.tokens.get(id).actorId }])
      return combat.id
    }, targetTokenId)
    await page.waitForFunction(id => canvas.tokens.get(id), targetTokenId)
    await page.evaluate(async id => { await canvas.hud.token.bind(canvas.tokens.get(id)) }, targetTokenId)
    await page.locator(hudSwap).evaluate(element => element.click())
    await expect(page.locator('#notifications')).toContainText('party token is in running combat')
    expect(await page.evaluate(() => canvas.scene.tokens.size)).toBe(1)
    await page.evaluate(async id => { await game.combats.get(id).delete() }, combatId)
    combatId = null
    await page.locator(hudSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
    await expect(page.locator('#notifications')).toContainText('Skipped 2 saved members')
    const result = await page.evaluate(ids => ({
      target: canvas.scene.tokens.map(token => token.toObject()),
      source: game.scenes.get(ids.scene).tokens.map(token => token.actorId)
    }), ids)
    expect(result.target).toHaveLength(1)
    expect(result.target[0].actorId).toBe(ids.members[0])
    expect(result.target[0].x).toBeGreaterThan(1300)
    expect(result.target[0].level).toBe(await page.evaluate(() => canvas.level.id))
    expect(result.source).not.toContain(ids.members[0])
  } finally {
    if (combatId) await page.evaluate(async id => { await game.combats.get(id)?.delete() }, combatId)
    await cleanSwapFixture(page, ids)
  }
})

test('member HUD offers gather for two controlled members with a cancellable party chooser', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    const other = await page.evaluate(async ids => {
      const other = await Actor.create({ name: 'PARTY TOKEN UI Other', type: 'Party', flags: { dcc: { partyMembers: ids.members.map(id => ({ id })) } } })
      await game.actors.get(ids.party).sheet.close()
      return other.id
    }, ids)
    ids.actors.push(other)
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(async ids => {
      canvas.tokens.releaseAll()
      canvas.tokens.get(ids.tokens[0]).control()
      await canvas.hud.token.bind(canvas.tokens.get(ids.tokens[0]))
    }, ids)
    await expect(page.locator(hudSwap)).toHaveCount(0)
    await page.evaluate(async ids => {
      canvas.tokens.get(ids.tokens[1]).control({ releaseOthers: false })
      await canvas.hud.token.render(true)
    }, ids)
    await expect(page.locator(hudSwap)).toHaveAccessibleName('Gather')
    await page.locator(hudSwap).evaluate(element => element.click())
    const dialog = page.locator('.dialog').filter({ hasText: 'Which party should gather' })
    await expect(dialog).toBeVisible()
    await dialog.locator('[data-action="close"]').evaluate(element => element.click())
    expect(await page.evaluate(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null, ids)).toBeNull()
    expect(await page.evaluate(() => canvas.scene.tokens.size)).toBe(4)
    await page.locator(hudSwap).evaluate(element => element.click())
    await dialog.locator(`[data-action="${ids.party}"]`).evaluate(element => element.click())
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 2 && !canvas.scene.tokens.has(ids.tokens[0]), ids)
    expect(await page.evaluate(id => game.actors.get(id).getFlag('dcc', 'partyTokenSnapshots') ?? null, other)).toBeNull()
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

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
