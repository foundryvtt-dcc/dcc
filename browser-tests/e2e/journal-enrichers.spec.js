/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Journal roll-link enrichers (issue #794).
 *
 * [[/check ...]] / [[/save ...]] / [[/skill ...]] text renders as clickable
 * roll links in journals; clicking rolls for the controlled token's actor via
 * the public roll methods; the GM chat-bubble icon posts a roll-request card
 * to chat whose link is enriched (and wired) per-client at render time.
 */
const test = createSessionTest()

const PAGE_CONTENT =
  '<p id="dcc-enricher-probe">' +
  '[[/check agl 10]] ' +
  '[[/save ref 15]] ' +
  '[[/check lck]] ' +
  '[[/save frt 15]]{resist the poison} ' +
  '[[/skill detectSecretDoors]] ' +
  '[[/skill notARealSkill]] ' +
  '[[/check zzz 5]]' +
  '</p>'

/** Create a journal with enricher text, a controllable Player, and open the journal sheet. */
async function setupJournal (page) {
  const setup = await page.evaluate(async (content) => {
    if (!game.canvas?.ready || !game.canvas?.scene) {
      const scene = await Scene.create({ name: 'DCC Enricher Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
      await scene.view()
    }
    const scene = game.canvas.scene

    const actor = await Actor.create({
      name: 'DCC Enricher Roller',
      type: 'Player',
      system: { abilities: { agl: { value: 14 }, lck: { value: 11 } }, saves: { ref: { value: 2 }, frt: { value: 1 } } },
      prototypeToken: { actorLink: true }
    })
    const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'R', actorId: actor.id, actorLink: true, x: 700, y: 700, width: 1, height: 1 }])
    const deadline = Date.now() + 3000
    while (Date.now() < deadline && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
    game.canvas.tokens.get(tokenDoc.id).control({ releaseOthers: true })

    const journal = await JournalEntry.create({
      name: 'DCC Enricher Journal',
      pages: [{ name: 'Rolls', type: 'text', text: { content, format: 1 } }]
    })
    journal.sheet.render(true)

    return { actorId: actor.id, tokenId: tokenDoc.id, sceneId: scene.id, journalId: journal.id }
  }, PAGE_CONTENT)

  await page.waitForSelector('.journal-entry-page', { timeout: 10000 })
  return setup
}

async function cleanupJournal (page, setup) {
  await page.evaluate(async ({ actorId, tokenId, sceneId, journalId }) => {
    game.canvas.tokens.releaseAll()
    const journal = game.journal.get(journalId)
    for (const app of Object.values(journal?.apps ?? {})) await app.close().catch(() => {})
    await journal?.delete()
    await game.scenes.get(sceneId)?.deleteEmbeddedDocuments('Token', [tokenId])
    await game.actors.get(actorId)?.delete()
    // Remove the chat messages these tests post so reruns stay deterministic
    const strays = game.messages.contents.filter(m =>
      m.getFlag('dcc', 'rollRequest') ||
      ['AbilityCheck', 'AbilityCheckRollUnder', 'SavingThrow', 'SkillCheck'].includes(m.getFlag('dcc', 'RollType')))
    for (const message of strays) await message.delete().catch(() => {})
  }, setup)
}

/** Poll until a chat message with the given dcc flag value exists, then return its data. */
function pollForMessage (page, flagKey, flagValue) {
  return expect.poll(() => page.evaluate(({ flagKey, flagValue }) => {
    const message = game.messages.contents.findLast(m => m.getFlag('dcc', flagKey) === flagValue)
    return message ? { id: message.id, flavor: message.flavor, content: message.content } : null
  }, { flagKey, flagValue }), { timeout: 10000 }).not.toBeNull()
}

test.describe('Journal roll-link enrichers', () => {
  test('enricher text renders as roll links with request icons; invalid text stays raw', async ({ page }) => {
    const setup = await setupJournal(page)
    try {
      const probe = page.locator('.journal-entry-page #dcc-enricher-probe')
      await expect(probe).toBeVisible()

      // The four valid links render with labels + dispatch data
      const check = probe.locator('a.dcc-enricher[data-action="dccRoll"][data-roll-type="check"][data-key="agl"]')
      await expect(check).toHaveText(/DC 10 Agility Check/)
      await expect(check).toHaveAttribute('data-dc', '10')

      const save = probe.locator('a[data-action="dccRoll"][data-roll-type="save"][data-key="ref"]')
      await expect(save).toHaveText(/DC 15 Reflex Save/)

      const luck = probe.locator('a[data-action="dccRoll"][data-key="lck"]')
      await expect(luck).toHaveText(/Luck Check/)
      await expect(luck).toHaveAttribute('data-roll-under', 'true')

      await expect(probe.locator('a[data-action="dccRoll"][data-key="frt"]')).toHaveText(/resist the poison/)

      const skill = probe.locator('a[data-action="dccRoll"][data-roll-type="skill"][data-key="detectSecretDoors"]')
      await expect(skill).toHaveText(/Detect Secret Doors Check/)

      // GM session → each valid link grows a chat-bubble request icon
      await expect(probe.locator('a.dcc-enricher-request[data-action="dccRequest"]')).toHaveCount(6)

      // The bad ability key is left as raw text so the author can spot it
      await expect(probe).toContainText('[[/check zzz 5]]')
    } finally {
      await cleanupJournal(page, setup)
    }
  })

  test('clicking a link rolls for the controlled token actor', async ({ page }) => {
    const setup = await setupJournal(page)
    try {
      const probe = page.locator('.journal-entry-page #dcc-enricher-probe')

      // Ability check link → exactly ONE AbilityCheck roll card for the
      // controlled actor (a duplicate would mean double-wired listeners)
      await probe.locator('a[data-action="dccRoll"][data-key="agl"]').click()
      await pollForMessage(page, 'RollType', 'AbilityCheck')
      const ability = await page.evaluate(() => {
        const messages = game.messages.contents.filter(m => m.getFlag('dcc', 'RollType') === 'AbilityCheck')
        const message = messages[messages.length - 1]
        return { count: messages.length, flavor: message.flavor, alias: message.speaker.alias, ability: message.getFlag('dcc', 'Ability') }
      })
      expect(ability.count).toBe(1)
      expect(ability.alias).toBe('DCC Enricher Roller')
      expect(ability.ability).toBe('agl')

      // Save link → SavingThrow card with the DC success/failure suffix
      await probe.locator('a[data-action="dccRoll"][data-roll-type="save"][data-key="ref"]').click()
      await pollForMessage(page, 'RollType', 'SavingThrow')
      const save = await page.evaluate(() => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'RollType') === 'SavingThrow')
        return { flavor: message.flavor }
      })
      expect(save.flavor).toContain('DC 15')
      expect(save.flavor).toMatch(/Success|Failure/)

      // Luck link → roll-under card
      await probe.locator('a[data-action="dccRoll"][data-key="lck"]').click()
      await pollForMessage(page, 'RollType', 'AbilityCheckRollUnder')

      // Built-in skill link → SkillCheck card (falls back to the action die)
      await probe.locator('a[data-action="dccRoll"][data-key="detectSecretDoors"]').click()
      await pollForMessage(page, 'RollType', 'SkillCheck')

      // Unknown skill → rollSkillCheck's warning notification, no roll card
      await probe.locator('a[data-action="dccRoll"][data-key="notARealSkill"]').click()
      await expect(page.locator('.notification.warning', { hasText: 'notARealSkill' })).toBeVisible({ timeout: 10000 })
      const skillCount = await page.evaluate(() =>
        game.messages.contents.filter(m => m.getFlag('dcc', 'RollType') === 'SkillCheck').length)
      expect(skillCount).toBe(1)
    } finally {
      await cleanupJournal(page, setup)
    }
  })

  test('GM chat bubble posts a request card whose link rolls when clicked', async ({ page }) => {
    const setup = await setupJournal(page)
    try {
      const probe = page.locator('.journal-entry-page #dcc-enricher-probe')

      // Post the request from the save link's chat bubble
      await probe.locator('a[data-action="dccRequest"][data-roll-type="save"][data-key="ref"]').click()
      await pollForMessage(page, 'rollRequest', true)

      // Reveal the card: its raw [[/save ref 15]] content is enriched at
      // render into a live roll link (wired per-client by onRender). Drive
      // the sidebar via the API — the open journal window overlaps the
      // sidebar, so a real pointer click on the chat tab never becomes
      // actionable and would hang the test.
      await page.evaluate(() => {
        ui.sidebar.expand()
        ui.sidebar.changeTab('chat', 'primary')
        ui.chat.scrollBottom({ immediate: true })
      })
      const cardLink = page.locator('#chat .dcc-roll-request a[data-action="dccRoll"][data-key="ref"]').last()
      await expect(cardLink).toBeVisible()
      await expect(cardLink).toHaveText(/DC 15 Reflex Save/)

      // Clicking the card link rolls for the clicking user's controlled actor.
      // Dispatch the click in-page: the transient chat-notifications copy of
      // the message overlays the sidebar log at the same position, so a real
      // pointer click can hang forever in Playwright's actionability check
      // (real-pointer link clicking is covered by the journal test above).
      await cardLink.evaluate((el) => el.click())
      await pollForMessage(page, 'RollType', 'SavingThrow')
      const save = await page.evaluate(() => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'RollType') === 'SavingThrow')
        return { alias: message.speaker.alias, flavor: message.flavor }
      })
      expect(save.alias).toBe('DCC Enricher Roller')
      expect(save.flavor).toContain('DC 15')
    } finally {
      await cleanupJournal(page, setup)
    }
  })
})
