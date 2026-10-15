/* eslint-disable no-undef -- Browser globals (game, Actor, Scene, ui) used in page.evaluate callbacks */
const { expect, createSessionTest, openActorSheet, significantConsoleErrors } = require('./fixtures')

/**
 * Party Sheet E2E tests: Roll Party Initiative (#789), the party actor
 * portrait (#1019), item drops onto member rows (#1023), and the missing
 * Effects tab (#1022).
 *
 * Drives the party sheet DOM → data-action path for the party-header
 * Roll Initiative button:
 *   - the button renders in the party-name header row
 *   - clicking it adds the party token to the combat tracker with a rolled
 *     initiative, using the BEST member's initiative formula (highest derived
 *     init bonus)
 *   - the no-token guard warns instead of silently doing nothing
 *
 * Unit coverage for best-member selection / tie-breaks / the other guards
 * lives in module/__tests__/party-sheet.test.js.
 *
 * Probe actors are prefixed `PARTY `. Combats are deleted before and after
 * each test — the shared session's world is reused across specs.
 */

const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
})

/** Delete probe actors, combats, and open windows left over from a test. */
async function cleanProbeState (page) {
  await page.evaluate(async () => {
    // ApplicationV2 windows (the party sheet) live in foundry.applications.instances,
    // AppV1 windows in ui.windows — close both. Only close FRAMED AppV2 apps:
    // the sidebar/hotbar/etc. are frameless instances in the same registry and
    // closing them breaks the session. The probe scene is deliberately left in
    // place (deleting a viewed scene re-inits the canvas; see fixtures.js).
    for (const app of [...foundry.applications.instances.values()]) {
      try { if (app.hasFrame) await app.close() } catch {}
    }
    for (const app of Object.values(ui.windows)) { try { await app.close() } catch {} }
    document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
    for (const c of [...game.combats.contents]) { try { await c.delete() } catch {} }
    for (const a of game.actors.filter(a => /^PARTY /.test(a.name))) { try { await a.delete() } catch {} }
  }).catch(() => {})
}

/**
 * Create two Player members (Alice agl 17 → init +2 is the best, Bob agl 8 →
 * init -1) and a Party actor containing both, via the default creation path —
 * the preCreate hook must link the party prototype token (#789). Returns
 * their ids and the resulting actorLink so the test can assert the hook ran.
 */
async function createParty (page) {
  return await page.evaluate(async () => {
    const alice = await Actor.create({
      name: 'PARTY Alice',
      type: 'Player',
      system: { abilities: { agl: { value: 17 } } }
    })
    const bob = await Actor.create({
      name: 'PARTY Bob',
      type: 'Player',
      system: { abilities: { agl: { value: 8 } } }
    })
    const party = await Actor.create({
      name: 'PARTY Test Party',
      type: 'Party',
      flags: { dcc: { partyMembers: [{ id: bob.id }, { id: alice.id }] } }
    })
    return {
      aliceId: alice.id,
      bobId: bob.id,
      partyId: party.id,
      partyActorLink: party.prototypeToken.actorLink
    }
  })
}

test.describe('Party Sheet — Roll Party Initiative', () => {
  test.beforeEach(async ({ page }) => {
    await cleanProbeState(page)
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await cleanProbeState(page)
    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('button rolls initiative for the party token using the best member formula', async ({ page }) => {
    const { partyId, partyActorLink } = await createParty(page)

    // The preCreate hook links party prototype tokens by default (#789) —
    // without this, core's Actor#rollInitiative would skip the synthetic
    // token actor and the button would silently not roll.
    expect(partyActorLink).toBe(true)

    // Ensure a viewed scene, then place a party token from its prototype
    // (mirrors dragging the actor onto the map) and wait for its placeable —
    // getActiveTokens() reads canvas placeables.
    await page.evaluate(async (pid) => {
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({
          name: 'DCC Party Probe',
          width: 3000,
          height: 3000,
          grid: { type: 1, size: 100, distance: 5, units: 'ft' }
        })
        await scene.view()
      }
      const party = game.actors.get(pid)
      const tokenData = (await party.getTokenDocument({ x: 1000, y: 1000 })).toObject()
      const [doc] = await game.canvas.scene.createEmbeddedDocuments('Token', [tokenData])
      const deadline = Date.now() + 4000
      while (Date.now() < deadline && !game.canvas.tokens.get(doc.id)) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }, partyId)

    await openActorSheet(page, 'PARTY Test Party')
    const button = page.locator('.dcc.actor.party a[data-action="rollPartyInitiative"]')
    await expect(button).toBeVisible()

    // Record the latest initiative chat card so a stale one from an earlier
    // spec can't satisfy the wait below. In-page click — overlays can hang
    // Playwright pointer clicks (see docs/dev/TESTING.md); the reused session
    // may have chat notifications up.
    const baselineMessageId = await page.evaluate(() => {
      const last = game.messages.contents.findLast(m => m.getFlag('core', 'initiativeRoll'))
      document.querySelector('.dcc.actor.party a[data-action="rollPartyInitiative"]').click()
      return last?.id ?? null
    })

    // Poll for the rolled combatant AND a NEW initiative chat card —
    // ChatMessage.create is fire-and-forget, never read it un-polled.
    await page.waitForFunction(({ pid, baselineId }) => {
      const combat = game.combats.contents[0]
      const combatant = combat?.combatants.find(c => c.actor?.id === pid)
      const initMessage = game.messages.contents.findLast(m => m.getFlag('core', 'initiativeRoll'))
      return !!combatant && combatant.initiative !== null &&
        !!initMessage && initMessage.id !== baselineId
    }, { pid: partyId, baselineId: baselineMessageId }, { timeout: 15000 })

    const result = await page.evaluate((pid) => {
      const combat = game.combats.contents[0]
      const combatant = combat.combatants.find(c => c.actor?.id === pid)
      const initMessage = game.messages.contents.findLast(m => m.getFlag('core', 'initiativeRoll'))
      return {
        initiative: combatant.initiative,
        formula: initMessage?.rolls?.[0]?.formula ?? ''
      }
    }, partyId)

    expect(typeof result.initiative).toBe('number')
    // Best member is Alice: agl 17 → derived init bonus +2 (Bob is -1).
    expect(result.formula).toMatch(/1d20\s*\+\s*2/)
  })

  test('warns instead of rolling when the party has no token in the scene', async ({ page }) => {
    await createParty(page)
    await openActorSheet(page, 'PARTY Test Party')

    const result = await page.evaluate(async () => {
      const warns = []
      const originalWarn = ui.notifications.warn
      ui.notifications.warn = (message) => { warns.push(String(message)) }
      try {
        document.querySelector('.dcc.actor.party a[data-action="rollPartyInitiative"]').click()
        // The handler is async; give the guard a beat to fire.
        const deadline = Date.now() + 3000
        while (Date.now() < deadline && warns.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      } finally {
        ui.notifications.warn = originalWarn
      }
      return {
        warns,
        combats: game.combats.size,
        expectedWarning: game.i18n.localize('DCC.PartyNoTokenWarning')
      }
    })

    expect(result.warns).toContain(result.expectedWarning)
    expect(result.combats).toBe(0)
  })
})

test.describe('Party Sheet — Actor Portrait', () => {
  test.beforeEach(async ({ page }) => {
    await cleanProbeState(page)
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await cleanProbeState(page)
    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('renders the party portrait in the header row, wired for editing', async ({ page }) => {
    await createParty(page)
    await openActorSheet(page, 'PARTY Test Party')

    const portrait = page.locator('.dcc.actor.party .party-name img.party-portrait')
    await expect(portrait).toBeVisible()
    await expect(portrait).toHaveAttribute('data-action', 'editImage')
    await expect(portrait).toHaveAttribute('data-edit', 'img')
    // prepareImage() falls back to the Party default artwork when the actor
    // has no custom image.
    await expect(portrait).toHaveAttribute('src', /party\.webp/)

    // Regression guard: the sheet used to clobber the inherited `editImage`
    // handler with an undefined value, so a click would do nothing.
    const handlerType = await page.evaluate(() =>
      typeof game.actors.getName('PARTY Test Party').sheet.options.actions.editImage)
    expect(handlerType).toBe('function')
  })

  test('persists a portrait change submitted through the sheet form', async ({ page }) => {
    await createParty(page)
    await openActorSheet(page, 'PARTY Test Party')

    const newImg = 'systems/dcc/styles/images/actor.webp'
    await page.evaluate((img) => {
      const sheet = document.querySelector('.dcc.actor.party')
      const portrait = sheet.querySelector('.party-name img.party-portrait')
      // Mirrors the FilePicker callback wired by the editImage action: swap the
      // img src, then submit the sheet form (FormDataExtended reads img[data-edit]).
      portrait.src = img
      sheet.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    }, newImg)

    await page.waitForFunction(
      (img) => game.actors.getName('PARTY Test Party').img === img,
      newImg,
      { timeout: 5000 }
    )
    expect(await page.evaluate(() => game.actors.getName('PARTY Test Party').img)).toBe(newImg)
  })
})

/** Create a Player carrying one weapon; return its ids and a drag payload. */
async function createSourceWithItem (page) {
  return await page.evaluate(async () => {
    const actor = await Actor.create({ name: 'PARTY Dropper', type: 'Player' })
    const [item] = await actor.createEmbeddedDocuments('Item', [{ name: 'PARTY Sword', type: 'weapon', system: { melee: true } }])
    return {
      actorId: actor.id,
      itemId: item.id,
      dragData: JSON.stringify({ type: 'Item', actorId: actor.id, uuid: item.uuid, data: item.toObject() })
    }
  })
}

/**
 * Dispatch a synthetic drag event of `eventType` (default `drop`) on the element
 * matching `selector`, carrying `json` as the `text/plain` drag payload. The
 * party sheet's DropZone is the sheet form itself (its classes include `party`,
 * so `DragDrop.bind` binds `[html]` and not the inner section), so dispatch on a
 * descendant and let the event bubble up to the form.
 */
async function dispatchDrag (page, selector, json, eventType = 'drop') {
  await page.evaluate(({ selector, json, eventType }) => {
    const target = document.querySelector(selector)
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', json)
    target.dispatchEvent(new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer }))
  }, { selector, json, eventType })
}

test.describe('Party Sheet — Item Drops', () => {
  test.beforeEach(async ({ page }) => {
    await cleanProbeState(page)
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await cleanProbeState(page)
    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('rejects a background drop: warns, creates nothing, keeps the source item', async ({ page }) => {
    const { partyId } = await createParty(page)
    const { actorId, dragData } = await createSourceWithItem(page)
    await openActorSheet(page, 'PARTY Test Party')

    // Capture the warning across the dispatch. The reject path warns
    // synchronously inside the handler, so no fixed sleep is needed; poll in
    // case the DragDrop callback ever defers the call.
    await page.evaluate(() => {
      globalThis.__partyDropWarns = []
      globalThis.__partyDropWarn = ui.notifications.warn
      ui.notifications.warn = (message) => { globalThis.__partyDropWarns.push(String(message)) }
    })
    let result
    try {
      await dispatchDrag(page, '.dcc.actor.party .party-body', dragData)
      await page.waitForFunction(() => (globalThis.__partyDropWarns ?? []).length > 0, null, { timeout: 5000 })
      result = await page.evaluate(({ pid, sourceId }) => ({
        warns: globalThis.__partyDropWarns ?? [],
        expected: game.i18n.localize('DCC.PartyNoInventoryHint'),
        partyItems: game.actors.get(pid).items.size,
        sourceItems: game.actors.get(sourceId).items.size
      }), { pid: partyId, sourceId: actorId })
    } finally {
      await page.evaluate(() => {
        ui.notifications.warn = globalThis.__partyDropWarn
        delete globalThis.__partyDropWarn
        delete globalThis.__partyDropWarns
      })
    }

    expect(result.warns).toContain(result.expected)
    expect(result.partyItems).toBe(0)
    expect(result.sourceItems).toBe(1)
  })

  test('routes a drop on a member row to that member and removes it from the source', async ({ page }) => {
    const { aliceId, partyId } = await createParty(page)
    const { actorId, dragData } = await createSourceWithItem(page)
    await openActorSheet(page, 'PARTY Test Party')

    await dispatchDrag(page, `.dcc.actor.party .character-row[data-actor-id="${aliceId}"]`, dragData)

    // The DragDrop callback does not await _onDrop, so the create-then-delete is
    // fire-and-forget: poll for the end state rather than sleeping.
    await page.waitForFunction(({ memberId, sourceId }) =>
      game.actors.get(memberId).items.size === 1 &&
      game.actors.get(sourceId).items.size === 0,
    { memberId: aliceId, sourceId: actorId }, { timeout: 5000 })

    const result = await page.evaluate(({ pid, memberId, sourceId }) => ({
      partyItems: game.actors.get(pid).items.size,
      memberItems: game.actors.get(memberId).items.size,
      sourceItems: game.actors.get(sourceId).items.size
    }), { pid: partyId, memberId: aliceId, sourceId: actorId })

    expect(result.memberItems).toBe(1)
    expect(result.sourceItems).toBe(0)
    // The item must not land on the invisible Party inventory either.
    expect(result.partyItems).toBe(0)
  })

  test('highlights the member row on dragover and clears it on drop', async ({ page }) => {
    const { aliceId } = await createParty(page)
    await openActorSheet(page, 'PARTY Test Party')

    const selector = `.dcc.actor.party .character-row[data-actor-id="${aliceId}"]`
    // An Item payload with no UUID is harmless: the party helper resolves
    // nothing and rejects without warning, while still running the
    // highlight-then-clear path through _onDrop.
    const payload = JSON.stringify({ type: 'Item' })

    await dispatchDrag(page, selector, payload, 'dragover')
    const highlighted = await page.evaluate(sel => document.querySelector(sel).classList.contains('drag-over'), selector)

    await dispatchDrag(page, selector, payload, 'drop')
    const afterDrop = await page.evaluate(sel => document.querySelector(sel).classList.contains('drag-over'), selector)

    expect(highlighted).toBe(true)
    expect(afterDrop).toBe(false)
  })
})

test.describe('Party Sheet — no Effects tab (#1022)', () => {
  test.beforeEach(async ({ page }) => {
    await cleanProbeState(page)
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await cleanProbeState(page)
    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('renders only Party and Notes tabs and refuses an Active Effect drop', async ({ page }) => {
    const { partyId } = await createParty(page)
    await openActorSheet(page, 'PARTY Test Party')
    const sheet = page.locator('.dcc.actor.party')

    // Effects is stripped from the inherited end tabs; Notes stays
    const tabIds = await sheet.locator('nav.sheet-tabs [data-action="tab"]').evaluateAll(
      els => els.map(el => el.dataset.tab)
    )
    expect(tabIds).toEqual(['party', 'notes'])
    await expect(sheet.locator('section.tab[data-tab="effects"]')).toHaveCount(0)

    // Dropping an effect (as from the effects sidebar / another sheet) is
    // refused with a notice and creates nothing on the party actor
    const result = await page.evaluate(async (pid) => {
      const party = game.actors.get(pid)
      const sheet = party.sheet
      const data = {
        type: 'ActiveEffect',
        data: { name: 'PARTY Probe Effect', img: 'icons/svg/aura.svg' }
      }
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })
      event.dataTransfer.setData('text/plain', JSON.stringify(data))
      const returned = await sheet._onDrop(event)
      return {
        returned,
        effects: party.effects.size,
        notice: document.querySelector('#notifications .notification.warning')?.textContent ?? null
      }
    }, partyId)
    expect(result.effects).toBe(0)
    expect(result.notice).toContain(await page.evaluate(() => game.i18n.localize('DCC.PartyNoEffectsHint')))
  })
})
