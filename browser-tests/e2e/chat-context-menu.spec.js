/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Apply Damage / Apply Healing via the chat-card context menu (issue #828).
 *
 * The entries were migrated to the v14 ContextMenuEntry shape (label /
 * class-name icon / visible / onClick), so these tests drive the real menu:
 * right-click a damage-roll chat card and assert that core localizes the
 * `label` keys, that `visible` gates on a controlled token, and that clicking
 * Apply Damage actually deducts the rolled amount from the controlled actor.
 */
const test = createSessionTest()

/** Create a controllable token with known HP and post a fixed damage roll. */
async function setupDamageCard (page) {
  return page.evaluate(async () => {
    if (!game.canvas?.ready || !game.canvas?.scene) {
      const scene = await Scene.create({ name: 'DCC ChatCtx Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
      await scene.view()
    }
    const scene = game.canvas.scene

    const actor = await Actor.create({
      name: 'DCC ChatCtx Target',
      type: 'NPC',
      system: { attributes: { hp: { value: 20, max: 20 } } },
      prototypeToken: { actorLink: true }
    })
    const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'T', actorId: actor.id, actorLink: true, x: 500, y: 500, width: 1, height: 1 }])
    const deadline = Date.now() + 3000
    while (Date.now() < deadline && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
    game.canvas.tokens.get(tokenDoc.id).control({ releaseOthers: true })

    // A fixed-total roll so the applied damage is deterministic
    const roll = await new Roll('1d1+4').evaluate()
    const message = await roll.toMessage({ flavor: game.i18n.localize('DCC.Damage') })

    return { actorId: actor.id, tokenId: tokenDoc.id, sceneId: scene.id, messageId: message.id }
  })
}

/** Expand the sidebar onto the chat tab and scroll the card into view. */
async function revealCard (page, messageId) {
  await page.evaluate(() => ui.sidebar.expand())
  await page.click('button[data-tab="chat"]')
  await page.evaluate(() => ui.chat.scrollBottom({ immediate: true }))
  const card = page.locator(`#chat .chat-message[data-message-id="${messageId}"]`)
  await expect(card).toBeVisible()
  return card
}

async function cleanupDamageCard (page, setup) {
  await page.evaluate(async ({ actorId, tokenId, sceneId, messageId }) => {
    game.canvas.tokens.releaseAll()
    await game.scenes.get(sceneId)?.deleteEmbeddedDocuments('Token', [tokenId])
    await game.actors.get(actorId)?.delete()
    await game.messages.get(messageId)?.delete()
  }, setup)
}

test.describe('Chat card Apply Damage / Apply Healing context menu', () => {
  test('right-click on a damage card shows localized entries and applies the damage', async ({ page }) => {
    const setup = await setupDamageCard(page)
    try {
      const card = await revealCard(page, setup.messageId)
      await card.click({ button: 'right' })

      // Core localizes the raw `label` i18n keys; the icon is a class name
      const applyDamage = page.locator('#context-menu li.context-item:has-text("Apply Damage")')
      await expect(applyDamage).toBeVisible()
      await expect(page.locator('#context-menu li.context-item:has-text("Apply Healing")')).toBeVisible()
      await expect(applyDamage.locator('i.fas.fa-user-minus')).toBeAttached()

      await applyDamage.click()

      // applyChatCardDamage is async (applyDamage → actor.update) — poll HP
      await expect.poll(() =>
        page.evaluate((id) => game.actors.get(id).system.attributes.hp.value, setup.actorId)
      ).toBe(15) // 20 - (1d1+4)
    } finally {
      await cleanupDamageCard(page, setup)
    }
  })

  test('entries are hidden when no token is controlled', async ({ page }) => {
    const setup = await setupDamageCard(page)
    try {
      await page.evaluate(() => game.canvas.tokens.releaseAll())

      const card = await revealCard(page, setup.messageId)
      await card.click({ button: 'right' })

      // The core menu opens, but both DCC entries are filtered out by `visible`
      await expect(page.locator('#context-menu')).toBeVisible()
      await expect(page.locator('#context-menu li.context-item:has-text("Apply Damage")')).toHaveCount(0)
      await expect(page.locator('#context-menu li.context-item:has-text("Apply Healing")')).toHaveCount(0)
      await page.keyboard.press('Escape')
    } finally {
      await cleanupDamageCard(page, setup)
    }
  })
})
