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
 * Create two controllable Players — one with a custom skill item — and
 * control only the first one's token.
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
    const deadline = Date.now() + 3000
    while (Date.now() < deadline && !game.canvas.tokens.get(tokens[0].id)) await new Promise(resolve => setTimeout(resolve, 50))
    game.canvas.tokens.get(tokens[0].id).control({ releaseOthers: true })

    return {
      actorId: target.id,
      allyId: ally.id,
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

/** Open the DCC sidebar tab and launch the Request Roll dialog. */
async function openDialog (page) {
  await page.evaluate(() => {
    ui.sidebar.expand()
    ui.sidebar.changeTab('dcc', 'primary')
  })
  // In-page click: floating windows can overlap the sidebar and hang a
  // real pointer click in Playwright's actionability check.
  await page.locator('#sidebar button[data-tool="requestRoll"]').evaluate((el) => el.click())
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

/** Reveal the chat log and click the last actor-targeted roll link. */
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
      await openDialog(page)

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
      await openDialog(page)
      await page.selectOption('#dcc-roll-request-check', 'check:agl')
      await page.fill('#dcc-roll-request-dc', '10')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      // Request card posts with the actor-targeted enricher link
      await pollForMessage(page, 'rollRequest', true)
      const cardLink = await clickRequestCardLink(page, '[data-roll-type="check"][data-key="agl"]')
      await expect(cardLink).toHaveText(/DC 10 Agility Check/)
      const actorUuid = await cardLink.getAttribute('data-actor-uuid')
      expect(actorUuid).toBe(`Actor.${setup.actorId}`)

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
      await openDialog(page)
      await page.selectOption('#dcc-roll-request-check', 'skill:Nature Lore')
      await page.fill('#dcc-roll-request-dc', '12')
      await clickInPage(page.locator('#dcc-roll-request-dialog button[type="submit"]'))

      await pollForMessage(page, 'rollRequest', true)
      const cardLink = await clickRequestCardLink(page, '[data-roll-type="skill"]')
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
      await openDialog(page)
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
      await openDialog(page)
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

  test('a skill only one selected character has is requested from that character alone (#914)', async ({ page }) => {
    const setup = await setupActors(page)
    try {
      await openDialog(page)
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
