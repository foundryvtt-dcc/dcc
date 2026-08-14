/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * GM roll requests (issues #855, #914).
 *
 * The DCC sidebar tab's GM-only "Request Roll" tool opens a dialog: tick
 * one, several, or all characters (preselecting the controlled PC
 * tokens' actors), pick a check — abilities first, then the union of the
 * selected characters' class skills and custom skill items — and
 * optionally a DC. Submitting posts one actor-targeted enricher card to
 * chat; clicking a link rolls for exactly that character and the result
 * card shows the DC and Success/Failure.
 */
const test = createSessionTest()

/**
 * Create two controllable Players — one with a custom skill item — plus a
 * token for each. Which tokens are *controlled* is decided by
 * {@link openDialog}, right before the dialog reads them.
 */
async function setupActors (page) {
  return page.evaluate(async () => {
    if (!game.canvas?.ready || !game.canvas?.scene) {
      const newScene = await Scene.create({ name: 'DCC Roll Request Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
      await newScene.view()
    }
    const scene = game.canvas.scene

    const target = await Actor.create({
      name: 'DCC Request Target',
      type: 'Player',
      system: { abilities: { agl: { value: 14 } } },
      prototypeToken: { actorLink: true },
      items: [{ name: 'Nature Lore', type: 'skill' }]
    })
    const ally = await Actor.create({
      name: 'DCC Request Ally',
      type: 'Player',
      system: { abilities: { agl: { value: 12 } } },
      prototypeToken: { actorLink: true }
    })
    const tokens = await scene.createEmbeddedDocuments('Token', [
      { name: 'T', actorId: target.id, actorLink: true, x: 700, y: 700, width: 1, height: 1 },
      { name: 'A', actorId: ally.id, actorLink: true, x: 900, y: 700, width: 1, height: 1 }
    ])
    const deadline = Date.now() + 5000
    while (Date.now() < deadline && tokens.some(token => !game.canvas.tokens.get(token.id))) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // `createEmbeddedDocuments` does not promise to return documents in
    // the order they were requested, so key the tokens by their actor
    // rather than by position — picking `tokens[0]` controlled the wrong
    // character about half the time.
    const tokenFor = (actor) => tokens.find(token => token.actorId === actor.id).id
    return {
      actorId: target.id,
      allyId: ally.id,
      targetTokenId: tokenFor(target),
      allyTokenId: tokenFor(ally),
      tokenIds: tokens.map(token => token.id),
      sceneId: scene.id
    }
  })
}

async function cleanup (page, setup) {
  await page.evaluate(async ({ actorId, allyId, tokenIds, sceneId }) => {
    game.canvas.tokens.releaseAll()
    for (const app of foundry.applications.instances.values()) {
      if (app.id === 'dcc-roll-request-dialog') await app.close().catch(() => {})
    }
    await game.scenes.get(sceneId)?.deleteEmbeddedDocuments('Token', tokenIds)
    await game.actors.get(actorId)?.delete()
    await game.actors.get(allyId)?.delete()
    const strays = game.messages.contents.filter(m =>
      m.getFlag('dcc', 'rollRequest') ||
      ['AbilityCheck', 'SkillCheck'].includes(m.getFlag('dcc', 'RollType')))
    for (const message of strays) await message.delete().catch(() => {})
  }, setup)
}

/**
 * Control `tokenIds` (none by default) and launch the Request Roll dialog
 * from the DCC sidebar tab.
 *
 * The control step lives here, not in `setupActors`: pending canvas work
 * from actor/token creation (or the previous test's cleanup) can drop
 * control after the fact, and the dialog reads `canvas.tokens.controlled`
 * to decide what to preselect. Confirm control and click the tool in one
 * evaluate, with no awaits in between, so nothing can land between them.
 */
async function openDialog (page, tokenIds = []) {
  await page.evaluate(() => {
    ui.sidebar.expand()
    ui.sidebar.changeTab('dcc', 'primary')
  })
  await page.evaluate(async ({ tokenIds }) => {
    let controlled = []
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      game.canvas.tokens.releaseAll()
      for (const id of tokenIds) game.canvas.tokens.get(id)?.control({ releaseOthers: false })
      controlled = game.canvas.tokens.controlled.map(token => token.id)
      if (tokenIds.every(id => controlled.includes(id)) && controlled.length === tokenIds.length) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (controlled.length !== tokenIds.length || !tokenIds.every(id => controlled.includes(id))) {
      throw new Error(`Token control never settled: wanted ${tokenIds}, got ${controlled}`)
    }
    // In-page click: floating windows can overlap the sidebar and hang a
    // real pointer click in Playwright's actionability check.
    document.querySelector('#sidebar button[data-tool="requestRoll"]').click()
  }, { tokenIds })
  await page.waitForSelector('#dcc-roll-request-dialog', { timeout: 10000 })
}

/** The character checkbox for one actor id. */
function actorCheckbox (page, actorId) {
  return page.locator(`#dcc-roll-request-actors input[name="actorIds"][value="${actorId}"]`)
}

/**
 * Click in-page rather than with a real pointer: chat-notification
 * toasts left over by earlier requests can float over the dialog and
 * hang Playwright's actionability check until the test times out.
 */
async function clickInPage (locator) {
  await expect(locator).toBeAttached()
  await locator.evaluate((el) => el.click())
}

/** Poll until a chat message with the given dcc flag value exists. */
function pollForMessage (page, flagKey, flagValue) {
  return expect.poll(() => page.evaluate(({ flagKey, flagValue }) => {
    const message = game.messages.contents.findLast(m => m.getFlag('dcc', flagKey) === flagValue)
    return message ? { id: message.id, flavor: message.flavor, content: message.content } : null
  }, { flagKey, flagValue }), { timeout: 10000 }).not.toBeNull()
}

/**
 * Reveal the chat log and click the last actor-targeted roll link.
 *
 * Always pin `selector` to the requested actor's uuid: the card's
 * ChatMessage exists before its DOM lands (creation is fire-and-forget),
 * so an unpinned `.last()` can resolve against the previous card while
 * this one is still rendering. With the uuid in the selector the
 * `toBeVisible()` retry waits for the right link instead.
 */
async function clickRequestCardLink (page, selector) {
  await page.evaluate(() => {
    ui.sidebar.changeTab('chat', 'primary')
    ui.chat.scrollBottom({ immediate: true })
  })
  const cardLink = page.locator(`#chat .dcc-roll-request a[data-action="dccRoll"]${selector}`).last()
  await expect(cardLink).toBeVisible()
  // In-page click — the transient chat-notification copy of the message
  // overlays the log and can hang a real pointer click forever.
  await cardLink.evaluate((el) => el.click())
  return cardLink
}

test.describe('Roll requests', () => {
  test('sidebar tool opens the dialog preselecting the controlled PC; abilities come before skills', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])

      // Controlled PC token's actor is ticked, the uncontrolled one is not
      await expect(actorCheckbox(page, setup.actorId)).toBeChecked()
      await expect(actorCheckbox(page, setup.allyId)).not.toBeChecked()
      await expect(page.locator('#dcc-roll-request-all')).not.toBeChecked()

      // Abilities optgroup first, then skills with the custom skill item
      const groups = await page.evaluate(() => {
        const select = document.querySelector('#dcc-roll-request-check')
        return [...select.querySelectorAll('optgroup')].map(g => ({
          label: g.label,
          options: [...g.querySelectorAll('option')].map(o => ({ value: o.value, label: o.textContent.trim() }))
        }))
      })
      expect(groups[0].options.map(o => o.value)).toEqual(
        ['check:str', 'check:agl', 'check:sta', 'check:per', 'check:int', 'check:lck']
      )
      expect(groups[0].options[1].label).toBe('Agility Check')
      const skillValues = groups[1].options.map(o => o.value)
      // Base Player body skill + the custom skill item from the skills tab
      expect(skillValues).toContain('skill:detectSecretDoors')
      expect(skillValues).toContain('skill:Nature Lore')
      expect(skillValues.indexOf('skill:detectSecretDoors')).toBeLessThan(skillValues.indexOf('skill:Nature Lore'))
    } finally {
      await cleanup(page, setup)
    }
  })

  test('an ability check request posts a card whose link rolls for the target actor with the DC result', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      await page.selectOption('#dcc-roll-request-check', 'check:agl')
      await page.fill('#dcc-roll-request-dc', '10')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      // Request card posts with the actor-targeted enricher link
      await pollForMessage(page, 'rollRequest', true)
      const cardLink = await clickRequestCardLink(
        page, `[data-roll-type="check"][data-key="agl"][data-actor-uuid="Actor.${setup.actorId}"]`)
      await expect(cardLink).toHaveText(/DC 10 Agility Check/)

      // The roll lands for the requested actor and shows the DC verdict
      await pollForMessage(page, 'RollType', 'AbilityCheck')
      const ability = await page.evaluate(() => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'RollType') === 'AbilityCheck')
        return { alias: message.speaker.alias, flavor: message.flavor, ability: message.getFlag('dcc', 'Ability') }
      })
      expect(ability.alias).toBe('DCC Request Target')
      expect(ability.ability).toBe('agl')
      expect(ability.flavor).toContain('DC 10')
      expect(ability.flavor).toMatch(/Success|Failure/)
    } finally {
      await cleanup(page, setup)
    }
  })

  test('a multi-word custom skill request round-trips through the quoted enricher link', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      await page.selectOption('#dcc-roll-request-check', 'skill:Nature Lore')
      await page.fill('#dcc-roll-request-dc', '12')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      await pollForMessage(page, 'rollRequest', true)
      const cardLink = await clickRequestCardLink(
        page, `[data-roll-type="skill"][data-actor-uuid="Actor.${setup.actorId}"]`)
      await expect(cardLink).toHaveText(/DC 12 Nature Lore Check/)
      expect(await cardLink.getAttribute('data-key')).toBe('Nature Lore')

      await pollForMessage(page, 'RollType', 'SkillCheck')
      const skill = await page.evaluate(() => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'RollType') === 'SkillCheck')
        return { alias: message.speaker.alias, flavor: message.flavor, skillId: message.getFlag('dcc', 'SkillId') }
      })
      expect(skill.alias).toBe('DCC Request Target')
      expect(skill.skillId).toBe('Nature Lore')
      expect(skill.flavor).toContain('DC 12')
      expect(skill.flavor).toMatch(/Success|Failure/)
    } finally {
      await cleanup(page, setup)
    }
  })

  test('requesting from two characters posts one card with a working link each (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      // Add the uncontrolled ally to the controlled target
      await clickInPage(actorCheckbox(page, setup.allyId))
      await expect(actorCheckbox(page, setup.allyId)).toBeChecked()
      await page.selectOption('#dcc-roll-request-check', 'check:agl')
      await page.fill('#dcc-roll-request-dc', '10')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      await pollForMessage(page, 'rollRequest', true)
      await page.evaluate(() => {
        ui.sidebar.changeTab('chat', 'primary')
        ui.chat.scrollBottom({ immediate: true })
      })

      // One card, one named row per character
      const card = page.locator('#chat .dcc-roll-request').last()
      await expect(card.locator('.dcc-roll-request-row')).toHaveCount(2)
      await expect(card.locator('.dcc-roll-request-name')).toHaveText([
        'DCC Request Ally', 'DCC Request Target'
      ])

      // The ally's own link rolls for the ally, not for the controlled token
      const allyLink = card.locator(`a[data-action="dccRoll"][data-actor-uuid="Actor.${setup.allyId}"]`)
      await expect(allyLink).toHaveText(/DC 10 Agility Check/)
      await allyLink.evaluate((el) => el.click())

      await pollForMessage(page, 'RollType', 'AbilityCheck')
      const ability = await page.evaluate(() => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'RollType') === 'AbilityCheck')
        return { alias: message.speaker.alias, flavor: message.flavor }
      })
      expect(ability.alias).toBe('DCC Request Ally')
      expect(ability.flavor).toContain('DC 10')
    } finally {
      await cleanup(page, setup)
    }
  })

  test('the All Players toggle ticks every character and requests a roll from each (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      await clickInPage(page.locator('#dcc-roll-request-all'))

      // The toggle may swap in a wider skill union (re-render), so poll
      // rather than counting a snapshot of the checkbox list
      await expect.poll(() => page.evaluate(() => {
        const boxes = [...document.querySelectorAll('#dcc-roll-request-actors input[name="actorIds"]')]
        return boxes.length && boxes.every(box => box.checked) ? boxes.length : 0
      })).toBeGreaterThanOrEqual(2)
      const total = await page.locator('#dcc-roll-request-actors input[name="actorIds"]').count()

      await page.selectOption('#dcc-roll-request-check', 'check:sta')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      await pollForMessage(page, 'rollRequest', true)
      await page.evaluate(() => {
        ui.sidebar.changeTab('chat', 'primary')
        ui.chat.scrollBottom({ immediate: true })
      })
      const card = page.locator('#chat .dcc-roll-request').last()
      await expect(card.locator('.dcc-roll-request-row')).toHaveCount(total)
      for (const actorId of [setup.actorId, setup.allyId]) {
        await expect(card.locator(`a[data-action="dccRoll"][data-actor-uuid="Actor.${actorId}"]`)).toHaveCount(1)
      }
    } finally {
      await cleanup(page, setup)
    }
  })

  test('controlling several PC tokens preselects all of them (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId, setup.allyTokenId])
      await expect(actorCheckbox(page, setup.actorId)).toBeChecked()
      await expect(actorCheckbox(page, setup.allyId)).toBeChecked()
    } finally {
      await cleanup(page, setup)
    }
  })

  test('with no PC token controlled the dialog opens with nothing ticked (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [])
      await expect(actorCheckbox(page, setup.actorId)).not.toBeChecked()
      await expect(actorCheckbox(page, setup.allyId)).not.toBeChecked()
      await expect(page.locator('#dcc-roll-request-all')).not.toBeChecked()
      await expect(page.locator('#dcc-roll-request-dialog button[type="submit"]')).toBeDisabled()
    } finally {
      await cleanup(page, setup)
    }
  })

  test('unticking every character disables Request Roll instead of losing the form (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      const submit = page.locator('#dcc-roll-request-dialog button[type="submit"]')
      await expect(submit).toBeEnabled()

      // Unticking the only ticked character also drops its custom skill
      // from the union, so this exercises the re-render path
      await clickInPage(actorCheckbox(page, setup.actorId))
      await expect(submit).toBeDisabled()

      // Ticking a character back re-enables it without a re-render
      await clickInPage(actorCheckbox(page, setup.allyId))
      await expect(submit).toBeEnabled()
      await expect(page.locator('#dcc-roll-request-dialog')).toBeVisible()
    } finally {
      await cleanup(page, setup)
    }
  })

  test('a request card only keeps live links for characters the viewer owns (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      await clickInPage(actorCheckbox(page, setup.allyId))
      await expect(actorCheckbox(page, setup.allyId)).toBeChecked()
      await page.selectOption('#dcc-roll-request-check', 'check:agl')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))
      await pollForMessage(page, 'rollRequest', true)

      // Render the card twice off-screen: once as its owner (the GM owns
      // every actor, and a player owning several requested characters
      // sees the same thing), once with one character made un-owned.
      const views = await page.evaluate(async ({ allyId }) => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'rollRequest') === true)
        const ally = game.actors.get(allyId)

        async function renderRows () {
          const holder = document.createElement('div')
          holder.style.display = 'none'
          document.body.appendChild(holder)
          holder.appendChild(await message.renderHTML())
          // `<enriched-content>` wires (and trims) on connection
          await new Promise(resolve => setTimeout(resolve, 100))
          const rows = [...holder.querySelectorAll('.dcc-roll-request-row')].map(row => ({
            name: row.querySelector('.dcc-roll-request-name')?.textContent?.trim(),
            mine: row.classList.contains('dcc-roll-request-mine'),
            theirs: row.classList.contains('dcc-roll-request-theirs'),
            hasLink: !!row.querySelector('a[data-action="dccRoll"]'),
            mutedText: row.querySelector('.dcc-roll-request-muted')?.textContent?.trim() ?? null
          }))
          holder.remove()
          return rows
        }

        const owned = await renderRows()
        Object.defineProperty(ally, 'isOwner', { get: () => false, configurable: true })
        try {
          return { owned, partial: await renderRows() }
        } finally {
          delete ally.isOwner
        }
      }, setup)

      // Owning both requested characters keeps a live link for each
      expect(views.owned).toHaveLength(2)
      expect(views.owned.every(row => row.mine && row.hasLink)).toBe(true)

      // With one character un-owned, only the owned row stays clickable
      const ally = views.partial.find(row => row.name === 'DCC Request Ally')
      const target = views.partial.find(row => row.name === 'DCC Request Target')
      expect(ally).toMatchObject({ theirs: true, mine: false, hasLink: false })
      expect(ally.mutedText).toMatch(/Agility Check/)
      expect(target).toMatchObject({ mine: true, theirs: false, hasLink: true })
    } finally {
      await cleanup(page, setup)
    }
  })

  test('a skill only one selected character has is requested from that character alone (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page, [setup.targetTokenId])
      await clickInPage(actorCheckbox(page, setup.allyId))
      await expect(actorCheckbox(page, setup.allyId)).toBeChecked()
      // The union offers Nature Lore even though only the target has it
      await page.selectOption('#dcc-roll-request-check', 'skill:Nature Lore')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      await pollForMessage(page, 'rollRequest', true)
      const content = await page.evaluate(() => {
        const message = game.messages.contents.findLast(m => m.getFlag('dcc', 'rollRequest') === true)
        return message.content
      })
      expect(content).toContain(`actor=Actor.${setup.actorId}`)
      expect(content).not.toContain(`actor=Actor.${setup.allyId}`)
      // A single surviving target renders the plain one-line card
      expect(content).toContain('DCC Request Target')
      expect(content).not.toContain('dcc-roll-request-list')
    } finally {
      await cleanup(page, setup)
    }
  })
})
