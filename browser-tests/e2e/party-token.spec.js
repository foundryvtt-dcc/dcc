/* eslint-disable no-undef -- Foundry globals used in page.evaluate callbacks */
const { expect, createSessionTest, significantConsoleErrors } = require('./fixtures')

const consoleErrors = []
const test = createSessionTest({ onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) } })

test.beforeEach(() => { consoleErrors.length = 0 })
test.afterEach(() => { expect(significantConsoleErrors(consoleErrors)).toEqual([]) })

async function createSwapFixture (page, gridType = 1) {
  return page.evaluate(async gridType => {
    const members = []
    for (let i = 0; i < 3; i++) members.push(await Actor.create({ name: `PARTY TOKEN UI Member ${i}`, type: 'Player' }))
    const foreign = await Actor.create({ name: 'PARTY TOKEN UI Foreign', type: 'NPC' })
    const party = await Actor.create({ name: 'PARTY TOKEN UI Party', type: 'Party', flags: { dcc: { partyMembers: members.map(member => ({ id: member.id })) } } })
    const scene = await Scene.create({ name: 'PARTY TOKEN UI Source', width: 3000, height: 3000, grid: { size: 100, type: gridType } })
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
  }, gridType)
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
    await expect(page.locator(sheetSwap)).toHaveAccessibleName('Gather / Deploy')
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
    // scene.tokens order depends on the generated token ids, so match members by
    // id instead of trusting the snapshot order.
    const snapshot = gathered.snapshot.members.map(member => member.tokenData)
    expect(snapshot.map(data => data._id).sort()).toEqual(ids.originals.slice(0, 2).map(data => data._id).sort())
    for (const original of ids.originals.slice(0, 2)) {
      expect(snapshot.find(data => data._id === original._id)).toEqual(original)
    }
    expect(gathered.remaining).toContain(ids.tokens[2])
    expect(gathered.remaining).toContain(ids.tokens[3])
    await expect(page.locator(sheetSwap)).toHaveAccessibleName('Gather / Deploy')
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
    await expect(page.locator(hudSwap)).toHaveAccessibleName('Gather / Deploy')
    await page.evaluate(async () => { await canvas.hud.token.render(true); await canvas.hud.token.render(true) })
    await expect(page.locator(hudSwap)).toHaveCount(1)
    await page.locator(hudSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
    const restored = await page.evaluate(ids => ({
      tokens: canvas.scene.tokens.map(token => token.toObject()),
      snapshots: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null
    }), ids)
    expect(restored.snapshots).toBeNull()
    // The party token stays on the scene as the hidden marker instead of being deleted.
    const marker = restored.tokens.find(token => token._id === partyTokenId)
    expect(marker).toMatchObject({ actorId: ids.party, hidden: true })
    for (const original of ids.originals.slice(0, 2)) {
      const token = restored.tokens.find(token => token.actorId === original.actorId)
      expect(token._id).not.toBe(original._id)
      for (const key of ['actorLink', 'width', 'height', 'elevation', 'sight', 'light', 'flags', 'level']) expect(token[key]).toEqual(original[key])
      expect(token.x).toBeGreaterThan(1200)
      expect(token.y).toBeGreaterThan(1200)
    }
    expect(restored.tokens.find(token => token._id === ids.tokens[3])).toEqual(ids.originals[3])
    // The sheet control stays neutral before and after the swap.
    await expect(page.locator(sheetSwap)).toHaveAccessibleName('Gather / Deploy')
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('gather falls back to the whole scene when only the freshly dropped party token is selected', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    // Dropping a token leaves it selected: place the party token, control it and
    // leave every member token unselected, exactly as after dropping it manually.
    const partyTokenId = await page.evaluate(async ids => {
      const scene = game.scenes.get(ids.scene)
      const doc = await game.actors.get(ids.party).getTokenDocument({ x: 1400, y: 1400, level: scene.levels.contents[0].id }, { parent: scene })
      const token = (await scene.createEmbeddedDocuments('Token', [doc.toObject()]))[0]
      canvas.tokens.releaseAll()
      canvas.tokens.get(token.id).control()
      return token.id
    }, ids)
    await page.evaluate(async ids => { await game.actors.get(ids.party).sheet.render(true) }, ids)
    await page.locator(sheetSwap).evaluate(element => element.click())
    // Wait for the whole transition: the snapshot alone is written first, the
    // member tokens are removed only after the anchor has been moved.
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 &&
      ids.members.every(actorId => !canvas.scene.tokens.some(token => token.actorId === actorId)), ids)
    const state = await page.evaluate(ids => {
      const scene = game.scenes.get(ids.scene)
      const partyTokens = scene.tokens.filter(token => token.actorId === ids.party)
      return {
        saved: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots').members.length,
        memberTokensLeft: scene.tokens.filter(token => ids.members.includes(token.actorId)).length,
        partyTokens: partyTokens.map(token => token.id),
        marker: partyTokens.map(token => ({ hidden: token.hidden, x: token.x, y: token.y }))
      }
    }, ids)
    expect(state.saved).toBe(3)
    expect(state.memberTokensLeft).toBe(0)
    expect(state.partyTokens).toEqual([partyTokenId])
    // The reused anchor is moved onto the cluster centre and shown again.
    expect(state.marker).toHaveLength(1)
    expect(state.marker[0].hidden).toBe(false)
    expect(state.marker[0].x).not.toBe(1400)
    expect(state.marker[0].y).not.toBe(1400)
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('a fresh scene deploys the members from their prototype tokens, then gather and lossless deploy cycle', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    // Fresh scene: only a linked party anchor remains, no member tokens at all.
    await page.evaluate(async ids => {
      const scene = game.scenes.get(ids.scene)
      await scene.deleteEmbeddedDocuments('Token', [ids.tokens[0], ids.tokens[1], ids.tokens[2]])
      const document = await game.actors.get(ids.party).getTokenDocument({ x: 1400, y: 1400, level: canvas.level.id }, { parent: scene })
      await scene.createEmbeddedDocuments('Token', [document.toObject()])
      canvas.tokens.releaseAll()
    }, ids)
    await page.evaluate(async ids => { await game.actors.get(ids.party).sheet.render(true) }, ids)

    // Click 1: prototype deploy — one token per member around the anchor, anchor hidden.
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => ids.members.every(actorId => canvas.scene.tokens.some(token => token.actorId === actorId)) &&
      canvas.scene.tokens.some(token => token.actorId === ids.party && token.hidden), ids)
    const deployed = await page.evaluate(ids => ({
      snapshot: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null,
      marker: canvas.scene.tokens.filter(token => token.actorId === ids.party).map(token => ({ hidden: token.hidden, x: token.x, y: token.y })),
      members: canvas.scene.tokens.filter(token => ids.members.includes(token.actorId)).map(token => {
        const prototype = game.actors.get(token.actorId).prototypeToken.toObject()
        return {
          actorId: token.actorId,
          x: token.x,
          y: token.y,
          level: token.level,
          actorLink: token.actorLink,
          width: token.width,
          height: token.height,
          sight: token.sight,
          light: token.light,
          probe: token.flags?.dcc?.partyTokenProbe ?? null,
          prototype: { width: prototype.width, height: prototype.height, sight: prototype.sight, light: prototype.light }
        }
      })
    }), ids)
    // Prototype deployment is deliberately not lossless: prototype values, fresh positions.
    expect(deployed.snapshot).toBeNull()
    expect(deployed.marker).toEqual([expect.objectContaining({ hidden: true, x: 1400, y: 1400 })])
    expect(deployed.members).toHaveLength(3)
    for (const member of deployed.members) {
      expect(member.actorLink).toBe(true)
      expect(member.level).toBe(await page.evaluate(() => canvas.level.id))
      // Prototype values, not the individualized values of the removed tokens.
      expect(member.width).toBe(member.prototype.width)
      expect(member.height).toBe(member.prototype.height)
      expect(member.sight).toMatchObject(member.prototype.sight)
      expect(member.light).toMatchObject(member.prototype.light)
      expect(member.probe).toBeNull()
      // Placed around the anchor, never on it.
      expect([member.x, member.y]).not.toEqual([1400, 1400])
    }

    // Click 2: gather — the prototype tokens are saved, the anchor shows again.
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 &&
      ids.members.every(actorId => !canvas.scene.tokens.some(token => token.actorId === actorId)), ids)
    const gathered = await page.evaluate(ids => ({
      marker: canvas.scene.tokens.filter(token => token.actorId === ids.party).map(token => ({ hidden: token.hidden })),
      sources: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots').members
    }), ids)
    expect(gathered.marker).toEqual([{ hidden: false }])
    expect(gathered.sources.map(member => member.actorId).sort()).toEqual([...ids.members].sort())

    // Click 3: lossless deploy from the saved prototype tokens, anchor hidden again.
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') &&
      ids.members.every(actorId => canvas.scene.tokens.some(token => token.actorId === actorId)), ids)
    const restored = await page.evaluate(ids => ({
      marker: canvas.scene.tokens.filter(token => token.actorId === ids.party).map(token => ({ hidden: token.hidden })),
      members: canvas.scene.tokens.filter(token => ids.members.includes(token.actorId)).map(token => token.toObject())
    }), ids)
    expect(restored.marker).toEqual([{ hidden: true }])
    expect(restored.members).toHaveLength(3)
    for (const source of gathered.sources) {
      const token = restored.members.find(token => token.actorId === source.actorId)
      expect(token._id).not.toBe(source.tokenData._id)
      for (const key of ['actorLink', 'width', 'height', 'elevation', 'sight', 'light', 'flags', 'level']) {
        expect(token[key]).toEqual(source.tokenData[key])
      }
    }
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
    await expect(page.locator('#notifications')).toContainText('No party token exists on the viewed scene')
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
    const members = result.target.filter(token => token.actorId === ids.members[0])
    expect(members).toHaveLength(1)
    expect(members[0].x).toBeGreaterThan(1300)
    expect(members[0].level).toBe(await page.evaluate(() => canvas.level.id))
    // The party token survives on the target scene as the hidden marker.
    expect(result.target.filter(token => token.actorId === ids.party).map(token => token.hidden)).toEqual([true])
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

test('gather skips member tokens in a running combat and leaves them in place', async ({ page }) => {
  const ids = await createSwapFixture(page)
  let combatId
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(() => canvas.tokens.releaseAll())
    combatId = await page.evaluate(async ids => {
      const combat = await Combat.create({ scene: ids.scene, active: true, round: 1 })
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: ids.tokens[0], sceneId: ids.scene, actorId: ids.members[0] }])
      return combat.id
    }, ids)
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 2 &&
      !canvas.scene.tokens.has(ids.tokens[1]) && !canvas.scene.tokens.has(ids.tokens[2]), ids)
    await expect(page.locator('#notifications')).toContainText('Skipped 1 member tokens in running combat')
    const result = await page.evaluate(ids => ({
      gathered: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots').members.map(member => member.actorId),
      remaining: game.scenes.get(ids.scene).tokens.map(token => token.id)
    }), ids)
    expect(result.gathered.sort()).toEqual([ids.members[1], ids.members[2]].sort())
    // The combat member stays untouched; only the gathered pair and the foreign token remain.
    expect(result.remaining).toContain(ids.tokens[0])
    expect(result.remaining).toContain(ids.tokens[3])
    expect(result.remaining).not.toContain(ids.tokens[1])
    expect(result.remaining).not.toContain(ids.tokens[2])
  } finally {
    if (combatId) await page.evaluate(async id => { await game.combats.get(id)?.delete() }, combatId)
    await cleanSwapFixture(page, ids)
  }
})

test('gather aborts without changes when member tokens sit on a different scene level', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(() => canvas.tokens.releaseAll())
    const upperLevelId = await page.evaluate(async ids => {
      const scene = game.scenes.get(ids.scene)
      const [level] = await scene.createEmbeddedDocuments('Level', [{ name: 'PARTY TOKEN UI Upper', elevation: { bottom: 100, top: 300 } }])
      const token = scene.tokens.get(ids.tokens[1])
      // `level` is a movement field: a plain update is stripped, so displace the token.
      await token.move({ x: token.x, y: token.y, elevation: 150, level: level.id, action: 'displace' })
      return level.id
    }, ids)
    await expect.poll(() => page.evaluate(ids => game.scenes.get(ids.scene).tokens.get(ids.tokens[1]).level, ids)).toBe(upperLevelId)
    const before = await page.evaluate(ids => game.scenes.get(ids.scene).tokens.map(token => ({ id: token.id, level: token.level })), ids)
    await page.locator(sheetSwap).evaluate(element => element.click())
    await expect(page.locator('#notifications')).toContainText('share the viewed scene level')
    expect(await page.evaluate(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null, ids)).toBeNull()
    expect(await page.evaluate(ids => game.scenes.get(ids.scene).tokens.map(token => ({ id: token.id, level: token.level })), ids)).toEqual(before)
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('deploy after a same-scene level switch restores members on the party token level', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(() => canvas.tokens.releaseAll())
    await page.locator(sheetSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 &&
      ids.members.every(actorId => !canvas.scene.tokens.some(token => token.actorId === actorId)), ids)
    const levelId = await page.evaluate(async ids => {
      const scene = game.scenes.get(ids.scene)
      const [level] = await scene.createEmbeddedDocuments('Level', [{ name: 'PARTY TOKEN UI Upstairs', elevation: { bottom: 100, top: 300 } }])
      const partyToken = scene.tokens.find(token => token.actorId === ids.party)
      // Move the reusable target to a different level of the same scene: deploy
      // must follow the party token's current level, not the gather level.
      // `level` is a movement field, so a plain update is stripped — displace it.
      await partyToken.move({ x: partyToken.x, y: partyToken.y, elevation: 150, level: level.id, action: 'displace' })
      await scene.view({ level: level.id })
      return level.id
    }, ids)
    await expect.poll(() => page.evaluate(() => canvas.level.id)).toBe(levelId)
    const partyTokenId = await page.evaluate(ids => {
      const token = game.scenes.get(ids.scene).tokens.find(token => token.actorId === ids.party)
      return token.id
    }, ids)
    await page.waitForFunction(id => canvas.tokens.get(id), partyTokenId)
    await page.evaluate(async id => { await canvas.hud.token.bind(canvas.tokens.get(id)) }, partyTokenId)
    await expect(page.locator(hudSwap)).toHaveAccessibleName('Gather / Deploy')
    await page.locator(hudSwap).evaluate(element => element.click())
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
    const restored = await page.evaluate(ids => game.scenes.get(ids.scene).tokens
      .filter(token => ids.members.includes(token.actorId))
      .map(token => token.level), ids)
    expect(restored).toEqual([levelId, levelId, levelId])
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

// CONST.GRID_TYPES: 0 = gridless, 2 = hexagonal (odd rows).
for (const [label, gridType] of [['hexagonal', 2], ['gridless', 0]]) {
  test(`deploy places members on a ${label} scene without overlap and keeps the party centre free`, async ({ page }) => {
    const ids = await createSwapFixture(page, gridType)
    try {
      await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
      await page.evaluate(() => canvas.tokens.releaseAll())
      await page.locator(sheetSwap).evaluate(element => element.click())
      await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 &&
        canvas.scene.tokens.some(token => token.actorId === ids.party), ids)
      const center = await page.evaluate(ids => {
        const partyToken = canvas.scene.tokens.find(token => token.actorId === ids.party)
        return partyToken.getCenterPoint()
      }, ids)
      await page.locator(sheetSwap).evaluate(element => element.click())
      await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
      const members = await page.evaluate(ids => {
        const { sizeX, sizeY } = canvas.scene.grid
        return canvas.scene.tokens
          .filter(token => ids.members.includes(token.actorId))
          .map(token => ({ x: token.x, y: token.y, w: token.width * sizeX, h: token.height * sizeY }))
      }, ids)
      expect(members).toHaveLength(3)
      const overlaps = (a, b) => !(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h)
      for (const [i, rect] of members.entries()) {
        // The party token stood at the centre; no member may cover it.
        expect(center.x > rect.x && center.x < rect.x + rect.w && center.y > rect.y && center.y < rect.y + rect.h).toBe(false)
        for (let j = 0; j < i; j++) expect(overlaps(rect, members[j])).toBe(false)
      }

      // Gather again: this reuses the existing anchor instead of creating one.
      // A fractional hex snap must still land on the integer token coordinates.
      await page.locator(sheetSwap).evaluate(element => element.click())
      await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 &&
        ids.members.every(actorId => !canvas.scene.tokens.some(token => token.actorId === actorId)), ids)
      const reused = await page.evaluate(ids => {
        const token = canvas.scene.tokens.find(token => token.actorId === ids.party)
        return { x: token.x, y: token.y, hidden: token.hidden }
      }, ids)
      expect(Number.isInteger(reused.x)).toBe(true)
      expect(Number.isInteger(reused.y)).toBe(true)
      expect(reused.hidden).toBe(false)
    } finally {
      await cleanSwapFixture(page, ids)
    }
  })
}

test('a legacy unlinked party token on the viewed scene is reported without any change', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(async ids => {
      const scene = game.scenes.get(ids.scene)
      const party = game.actors.get(ids.party)
      const legacy = (await party.getTokenDocument({ x: 2200, y: 2200, level: canvas.level.id }, { parent: scene })).toObject()
      legacy.actorLink = false
      await scene.createEmbeddedDocuments('Token', [legacy])
    }, ids)
    const before = await page.evaluate(ids => game.scenes.get(ids.scene).tokens.map(token => token.toObject()), ids)
    await page.locator(sheetSwap).evaluate(element => element.click())
    await expect(page.locator('#notifications')).toContainText('Link Actor Data')
    expect(await page.evaluate(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null, ids)).toBeNull()
    expect(await page.evaluate(ids => game.scenes.get(ids.scene).tokens.map(token => token.toObject()), ids)).toEqual(before)
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
