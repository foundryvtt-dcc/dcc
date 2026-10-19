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
    const party = await Actor.create({ name: 'PARTY TOKEN UI Party', type: 'Party', flags: { dcc: { partyMembers: members.map(member => ({ id: member.id })) } } })
    const scene = await Scene.create({ name: 'PARTY TOKEN UI Source', width: 3000, height: 3000, grid: { size: 100, type: gridType } })
    // A previous test's scene delete starts an un-awaited blank re-draw; view()
    // is refused while the canvas is loading, so retry until the scene is current.
    const deadline = Date.now() + 15000
    while (Date.now() < deadline && canvas.scene?.id !== scene.id) {
      try { await scene.view() } catch { /* canvas still loading */ }
      if (canvas.scene?.id !== scene.id) await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (canvas.scene?.id !== scene.id) throw new Error('probe scene never became the viewed scene')
    const data = []
    for (const [i, actor] of members.entries()) {
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
    // Create batches are not returned in input order; map by Actor like deploy does.
    const byActor = new Map(tokens.map(token => [token.actorId, token]))
    const ordered = members.map(actor => byActor.get(actor.id))
    await party.sheet.render(true)
    return {
      party: party.id,
      actors: [...members, party].map(actor => actor.id),
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
const click = (page, selector) => page.locator(selector).evaluate(element => element.click())
const LOSSY_KEYS = ['actorLink', 'width', 'height', 'elevation', 'sight', 'light', 'flags', 'level']

test('gather and lossless deploy round-trip keeps individualized member data', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(ids => {
      canvas.tokens.releaseAll()
      for (const id of ids.tokens.slice(0, 2)) canvas.tokens.get(id).control({ releaseOthers: false })
    }, ids)
    await click(page, sheetSwap)
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 2 &&
      !canvas.scene.tokens.has(ids.tokens[0]) && !canvas.scene.tokens.has(ids.tokens[1]), ids)
    const gathered = await page.evaluate(ids => ({
      snapshot: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots').members.map(member => member.tokenData),
      remaining: canvas.scene.tokens.map(token => token.id)
    }), ids)
    for (const original of ids.originals.slice(0, 2)) {
      expect(gathered.snapshot.find(data => data._id === original._id)).toEqual(original)
    }
    const partyTokenId = await page.evaluate(async ids => {
      const token = canvas.scene.tokens.find(token => token.actorId === ids.party)
      await token.move({ x: 1600, y: 1600, action: 'displace' }) // never animate in headless CI
      return token.id
    }, ids)
    await page.evaluate(async id => { await canvas.hud.token.bind(canvas.tokens.get(id)) }, partyTokenId)
    await expect(page.locator(hudSwap)).toHaveAccessibleName('Gather / Deploy')
    await click(page, hudSwap)
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
    const restored = await page.evaluate(() => canvas.scene.tokens.map(token => token.toObject()))
    // The party token survives at the new centre as the hidden marker.
    expect(restored.find(token => token._id === partyTokenId)).toMatchObject({ actorId: ids.party, hidden: true })
    for (const original of ids.originals.slice(0, 2)) {
      const token = restored.find(token => token.actorId === original.actorId)
      expect(token._id).not.toBe(original._id)
      for (const key of LOSSY_KEYS) expect(token[key]).toEqual(original[key])
      expect(token.x).toBeGreaterThan(1200)
      expect(token.y).toBeGreaterThan(1200)
    }
    expect(restored.find(token => token._id === ids.tokens[2])).toEqual(ids.originals[2])
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('fresh scene deploys prototypes once and leaves the marker visible when nothing deploys', async ({ page }) => {
  const ids = await createSwapFixture(page)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    // Fresh scene: only the party anchor remains, no member tokens.
    await page.evaluate(async ids => {
      const scene = game.scenes.get(ids.scene)
      await scene.deleteEmbeddedDocuments('Token', ids.tokens)
      const document = await game.actors.get(ids.party).getTokenDocument({ x: 1400, y: 1400, level: canvas.level.id }, { parent: scene })
      await scene.createEmbeddedDocuments('Token', [document.toObject()])
      canvas.tokens.releaseAll()
      await game.actors.get(ids.party).update({ 'flags.dcc.partyMembers': [] })
    }, ids)
    await page.evaluate(async ids => { await game.actors.get(ids.party).sheet.render(true) }, ids)

    // An empty roster deploys nothing: the visible anchor must stay visible.
    await click(page, sheetSwap)
    await expect(page.locator('#notifications')).toContainText('Nothing to deploy')
    expect(await page.evaluate(ids => ({
      snapshot: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null,
      marker: canvas.scene.tokens.filter(token => token.actorId === ids.party).map(token => token.hidden)
    }), ids)).toEqual({ snapshot: null, marker: [false] })

    await page.evaluate(async ids => {
      await game.actors.get(ids.party).update({ 'flags.dcc.partyMembers': ids.members.map(id => ({ id })) })
    }, ids)
    await click(page, sheetSwap)
    await page.waitForFunction(ids => ids.members.every(actorId => canvas.scene.tokens.some(token => token.actorId === actorId)) &&
      canvas.scene.tokens.some(token => token.actorId === ids.party && token.hidden), ids)
    const { members, marker, snapshot, level } = await page.evaluate(ids => ({
      members: canvas.scene.tokens.filter(token => ids.members.includes(token.actorId)).map(token => ({
        token: token.toObject(), prototype: game.actors.get(token.actorId).prototypeToken.toObject()
      })),
      marker: canvas.scene.tokens.find(token => token.actorId === ids.party).hidden,
      snapshot: game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots') ?? null,
      level: canvas.level.id
    }), ids)
    expect(snapshot).toBeNull()
    expect(marker).toBe(true)
    // One token per member: members already on the scene are never duplicated.
    expect(members.map(({ token }) => token.actorId).sort()).toEqual([...ids.members].sort())
    for (const { token, prototype } of members) {
      expect(token).toMatchObject({
        actorLink: true,
        level,
        width: prototype.width,
        height: prototype.height,
        sight: prototype.sight,
        light: prototype.light
      })
      // Prototype deploy is not lossless: no individualized flags, fresh position.
      expect(token.flags?.dcc?.partyTokenProbe).toBeUndefined()
      expect([token.x, token.y]).not.toEqual([1400, 1400])
    }
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('party HP bar shows the live member sum and never persists it', async ({ page }) => {
  const ids = await page.evaluate(async () => {
    const first = await Actor.create({ name: 'PARTY TOKEN Bar Member', type: 'Player', system: { attributes: { hp: { value: 5, max: 8 } } } })
    const second = await Actor.create({ name: 'PARTY TOKEN Bar NPC', type: 'NPC', system: { attributes: { hp: { value: 2, max: 4 } } } })
    const party = await Actor.create({ name: 'PARTY TOKEN Bars', type: 'Party', flags: { dcc: { partyMembers: [{ id: first.id }, { id: second.id }] } } })
    const scene = await Scene.create({ name: 'PARTY TOKEN Bars Scene', width: 2000, height: 2000, grid: { size: 100, type: 1 } })
    // A previous test's scene delete starts an un-awaited blank re-draw; view()
    // is refused while the canvas is loading, so retry until the scene is current.
    const deadline = Date.now() + 15000
    while (Date.now() < deadline && canvas.scene?.id !== scene.id) {
      try { await scene.view() } catch { /* canvas still loading */ }
      if (canvas.scene?.id !== scene.id) await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (canvas.scene?.id !== scene.id) throw new Error('probe scene never became the viewed scene')
    const [token] = await scene.createEmbeddedDocuments('Token', [(await party.getTokenDocument({ x: 500, y: 500 })).toObject()])
    return { first: first.id, second: second.id, party: party.id, scene: scene.id, token: token.id }
  })
  try {
    await page.waitForFunction(ids => canvas.tokens?.get(ids.token)?.bars, ids)
    const bar = () => page.evaluate(ids => {
      const token = canvas.scene.tokens.get(ids.token)
      return {
        attribute: token.bar1.attribute,
        value: token.bar1.value,
        max: token.bar1.max,
        editable: token.getBarAttribute('bar1').editable
      }
    }, ids)
    expect(await bar()).toEqual({ attribute: 'aggregate.hp', value: 7, max: 12, editable: false })

    await page.evaluate(async ids => {
      await game.actors.get(ids.first).update({ 'system.attributes.hp.value': 3, 'system.attributes.hp.max': 10 })
    }, ids)
    await expect.poll(bar).toEqual({ attribute: 'aggregate.hp', value: 5, max: 14, editable: false })
    const final = await page.evaluate(ids => ({
      aggregatePersisted: Object.hasOwn(game.actors.get(ids.party).toObject().system, 'aggregate'),
      first: game.actors.get(ids.first).toObject().system.attributes.hp
    }), ids)
    expect(final.aggregatePersisted).toBe(false)
    expect(final.first).toMatchObject({ value: 3, max: 10 })
  } finally {
    await page.evaluate(async ids => {
      await canvas.hud.token.clear()
      await game.scenes.get(ids.scene)?.delete()
      for (const id of [ids.party, ids.first, ids.second]) await game.actors.get(id)?.delete()
    }, ids)
  }
})

test('member token HUD gathers the controlled members through the party chooser', async ({ page }) => {
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
      canvas.tokens.get(ids.tokens[1]).control({ releaseOthers: false })
      await canvas.hud.token.bind(canvas.tokens.get(ids.tokens[1]))
      await canvas.hud.token.render(true)
    }, ids)
    await expect(page.locator(hudSwap)).toHaveAccessibleName('Gather')
    await click(page, hudSwap)
    const dialog = page.locator('.dialog').filter({ hasText: 'Which party should gather' })
    await expect(dialog).toBeVisible()
    await dialog.locator(`[data-action="${ids.party}"]`).evaluate(element => element.click())
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 2, ids)
    expect(await page.evaluate(id => game.actors.get(id).getFlag('dcc', 'partyTokenSnapshots') ?? null, other)).toBeNull()
  } finally {
    await cleanSwapFixture(page, ids)
  }
})

test('hex deploy keeps members apart and snaps the reused anchor to integers', async ({ page }) => {
  const ids = await createSwapFixture(page, 2)
  try {
    await page.waitForFunction(ids => ids.tokens.every(id => canvas.tokens.get(id)), ids)
    await page.evaluate(() => canvas.tokens.releaseAll())
    await click(page, sheetSwap)
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3, ids)
    const center = await page.evaluate(ids => canvas.scene.tokens.find(token => token.actorId === ids.party).getCenterPoint(), ids)
    await click(page, sheetSwap)
    await page.waitForFunction(ids => !game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots'), ids)
    const members = await page.evaluate(ids => {
      const { sizeX, sizeY } = canvas.scene.grid // integer snap only reproduced live
      return canvas.scene.tokens
        .filter(token => ids.members.includes(token.actorId))
        .map(token => ({ x: token.x, y: token.y, w: token.width * sizeX, h: token.height * sizeY }))
    }, ids)
    const overlaps = (a, b) => !(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h)
    for (const [i, rect] of members.entries()) {
      expect(center.x > rect.x && center.x < rect.x + rect.w && center.y > rect.y && center.y < rect.y + rect.h).toBe(false)
      for (let j = 0; j < i; j++) expect(overlaps(rect, members[j])).toBe(false)
    }
    await click(page, sheetSwap)
    await page.waitForFunction(ids => game.actors.get(ids.party).getFlag('dcc', 'partyTokenSnapshots')?.members.length === 3 &&
      ids.members.every(actorId => !canvas.scene.tokens.some(token => token.actorId === actorId)), ids)
    expect(await page.evaluate(ids => {
      const token = canvas.scene.tokens.find(token => token.actorId === ids.party)
      return { integers: Number.isInteger(token.x) && Number.isInteger(token.y), hidden: token.hidden }
    }, ids)).toEqual({ integers: true, hidden: false })
  } finally {
    await cleanSwapFixture(page, ids)
  }
})
