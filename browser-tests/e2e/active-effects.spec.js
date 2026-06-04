/* eslint-disable no-undef -- Browser globals (game, Actor, Item, CONFIG, etc.) used in page.evaluate callbacks */
const { expect, createSessionTest, openActorSheet, significantConsoleErrors } = require('./fixtures')

/**
 * Active Effects E2E tests (the V14 ActiveEffect V2 layer).
 *
 * Covers effect CRUD + application, dice-chain effects, equipped-item effects,
 * effect transfer from items, and the DCC Effects compendium — end-to-end
 * against a live Foundry. Sheet-tab navigation + status icons live in
 * sheet-ui.spec.js.
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   cd browser-tests/e2e && npm test -- active-effects.spec.js
 */

// Module-scoped console-error capture (cleared in beforeEach, asserted in
// afterEach). The fixture attaches the listener once per worker.
const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
})

test.describe('DCC Active Effects', () => {
  test.beforeAll(async () => {
    let serverUp
    try {
      const response = await fetch('http://localhost:30000/', { signal: AbortSignal.timeout(5000) })
      serverUp = response.ok
    } catch {
      serverUp = false
    }
    if (!serverUp) {
      throw new Error(
        'Could not connect to Foundry VTT at http://localhost:30000.\n\n' +
        'Please start Foundry before running tests:\n' +
        '1. Run: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing\n' +
        '2. Run tests again: npm test'
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    // Login + system boot is handled ONCE per worker by the sessionPage
    // fixture; here we only reset captured console errors and do world-state
    // hygiene between tests.
    consoleErrors.length = 0

    await page.evaluate(async () => {
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
      for (const app of Object.values(ui.windows)) {
        try { await app.close() } catch {}
      }
      for (const actor of game.actors.filter(a => a.name.startsWith('V14 '))) {
        try { await actor.delete() } catch {}
      }
      for (const item of game.items.filter(i => i.name.startsWith('V14 '))) {
        try { await item.delete() } catch {}
      }
    }).catch(() => {})

    // Welcome dialogs are dismissed once in the fixture; re-dismiss only if one
    // reappeared (e.g. after a setting change).
    for (const sel of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
      const dialog = page.locator(sel)
      if (await dialog.isVisible({ timeout: 300 }).catch(() => false)) {
        await page.keyboard.press('Escape')
      }
    }
  })

  test.afterEach(async ({ page }) => {
    // Clean up any remaining test data
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) {
        await app.close()
      }
      for (const actor of game.actors.filter(a => a.name.startsWith('V14 '))) {
        await actor.delete()
      }
      for (const item of game.items.filter(i => i.name.startsWith('V14 '))) {
        await item.delete()
      }
    }).catch(() => {}) // Don't fail cleanup

    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  // ── Active Effects CRUD ──────────────────────────────────────────────

  test.describe('Active Effects CRUD', () => {
    test('can create a new effect on an actor via Effects tab', async ({ page }) => {
      // Create actor via API
      await page.evaluate(async () => {
        await Actor.create({ name: 'V14 Effects Create', type: 'Player' })
      })

      // Open sheet via sidebar click
      await openActorSheet(page, 'V14 Effects Create')

      // Navigate to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify empty state
      await expect(page.locator('.effects-empty')).toBeVisible()

      // Click create effect button
      await page.click('[data-action="effectCreate"]')
      await page.waitForTimeout(1000)

      // Verify effect was created and appears in list
      await expect(page.locator('.effect-item')).toBeVisible()
      const nameText = await page.locator('.effect-name').textContent()
      expect(nameText.trim().length).toBeGreaterThan(0)
    })

    test('can toggle an effect on and off', async ({ page }) => {
      // Create actor with an effect via API
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Effects Toggle', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Toggle Test Effect',
          img: 'icons/svg/aura.svg',
          changes: [],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Effects Toggle')

      // Navigate to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify toggle button is in enabled state (no disabled class)
      const toggleBtn = page.locator('[data-action="effectToggle"]')
      await expect(toggleBtn).toBeVisible()
      await expect(toggleBtn).not.toHaveClass(/effect-disabled/)

      // Click toggle to disable
      await toggleBtn.click()
      await page.waitForTimeout(500)

      // Verify it's now disabled
      await expect(page.locator('[data-action="effectToggle"]')).toHaveClass(/effect-disabled/)
      await expect(page.locator('[data-action="effectToggle"] i')).toHaveClass(/fa-eye-slash/)

      // Click toggle again to re-enable
      await page.click('[data-action="effectToggle"]')
      await page.waitForTimeout(500)

      // Verify it's enabled again
      await expect(page.locator('[data-action="effectToggle"]')).not.toHaveClass(/effect-disabled/)
      await expect(page.locator('[data-action="effectToggle"] i')).toHaveClass(/fa-eye/)
    })

    test('can delete an effect', async ({ page }) => {
      // Create actor with an effect
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Effects Delete', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Delete Me',
          img: 'icons/svg/aura.svg',
          changes: [],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Effects Delete')

      // Navigate to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify effect exists
      await expect(page.locator('.effect-item')).toBeVisible()

      // Click delete button
      await page.click('[data-action="effectDelete"]')

      // Confirm deletion dialog
      await page.waitForSelector('dialog.application', { timeout: 5000 })
      await page.click('button[data-action="yes"]')
      await page.waitForTimeout(500)

      // Verify effect is gone
      expect(await page.locator('.effect-item').count()).toBe(0)

      // Verify empty state is shown
      await expect(page.locator('.effects-empty')).toBeVisible()
    })
  })

  // ── Active Effects Application ───────────────────────────────────────

  test.describe('Active Effects Application', () => {
    test('strength bonus effect modifies displayed ability score', async ({ page }) => {
      // Create actor with STR bonus effect
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 STR Bonus', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'STR +2',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '2',
            type: 'add'
          }],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 STR Bonus')

      // Verify STR value is 12 (10 base + 2 from effect)
      const strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(12)

      // Verify effect shows in Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.effect-name')).toContainText('STR +2')

      // Verify the effects summary shows the change
      await expect(page.locator('.effects-summary')).toBeVisible()
      await expect(page.locator('.change-summary')).toContainText('system.abilities.str.value')
    })

    test('disabling an effect reverts the modified value', async ({ page }) => {
      // Create actor with STR bonus effect
      const actorId = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Effect Revert', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'STR +3',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '3',
            type: 'add'
          }],
          disabled: false
        }])
        return actor.id
      })

      await openActorSheet(page, 'V14 Effect Revert')

      // Verify STR is 13 (10 + 3)
      let strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(13)

      // Disable the effect via API
      await page.evaluate(async (id) => {
        const actor = game.actors.get(id)
        const effect = actor.effects.contents[0]
        await effect.update({ disabled: true })
      }, actorId)
      await page.waitForTimeout(1000)

      // Verify STR reverted to 10
      strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(10)
    })

    test('native token.* override routes to the token, not the actor (#736)', async ({ page }) => {
      // Core Foundry v14 applies token light/vision overrides via `token.*` keys.
      // Our applyActiveEffects() replaces core's, so it must strip the `token.`
      // prefix and stash the change on actor.tokenActiveEffectChanges for
      // TokenDocument#applyActiveEffects to apply — otherwise it crashes writing a
      // non-existent `token` field on the actor. This verifies the module-free,
      // core path end-to-end (the afterEach also asserts no `target is null` error).
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Token Light', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Torch',
          img: 'icons/svg/light.svg',
          changes: [
            { key: 'token.light.dim', value: '60', mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE },
            { key: 'token.light.bright', value: '30', mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE }
          ],
          disabled: false
        }])
        actor.reset() // force a data-preparation cycle

        // A token document reads actor.tokenActiveEffectChanges and applies them.
        const token = await actor.getTokenDocument()

        return {
          stashedKeys: (actor.tokenActiveEffectChanges?.initial ?? []).map(c => c.key),
          dim: Number(token.light?.dim),
          bright: Number(token.light?.bright)
        }
      })

      // Our routing stripped the `token.` prefix and stashed the changes.
      expect(result.stashedKeys).toContain('light.dim')
      expect(result.stashedKeys).toContain('light.bright')
      // Core applied them to the token's light, the native way.
      expect(result.dim).toBe(60)
      expect(result.bright).toBe(30)
    })
  })

  // ── Dice Chain Effects ───────────────────────────────────────────────

  test.describe('Dice Chain Effects', () => {
    test('add effect on dice field bumps die up the chain', async ({ page }) => {
      // Action die default is "1d20", +1 step should give "1d24"
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Dice Chain', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Action Die Upgrade',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.attributes.actionDice.value',
            value: '1',
            type: 'add'
          }],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Dice Chain')

      // Verify action die was bumped from 1d20 to 1d24
      const actionDie = await page.locator('input[name="system.attributes.actionDice.value"]').inputValue()
      expect(actionDie).toBe('1d24')
    })

    test('subtract effect on dice field bumps die down the chain', async ({ page }) => {
      // Action die default "1d20", -1 step should give "1d16"
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Dice Down', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Action Die Downgrade',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.attributes.actionDice.value',
            value: '1',
            type: 'subtract'
          }],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Dice Down')

      // Verify action die was bumped from 1d20 to 1d16
      const actionDie = await page.locator('input[name="system.attributes.actionDice.value"]').inputValue()
      expect(actionDie).toBe('1d16')
    })
  })

  // ── Equipped Item Effects ────────────────────────────────────────────

  test.describe('Equipped Item Effects', () => {
    test('item effect only applies when item is equipped', async ({ page }) => {
      // Create actor with armor item that has a STR +2 transfer effect
      const actorId = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Equip Test', type: 'Player' })

        const [armor] = await actor.createEmbeddedDocuments('Item', [{
          name: 'V14 Magic Armor',
          type: 'armor',
          system: { equipped: true }
        }])

        await armor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'STR Boost',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '2',
            type: 'add'
          }],
          transfer: true,
          disabled: false
        }])

        return actor.id
      })

      await openActorSheet(page, 'V14 Equip Test')

      // STR should be 12 (10 + 2 from equipped armor effect)
      let strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(12)

      // Unequip the armor via API
      await page.evaluate(async (id) => {
        const actor = game.actors.get(id)
        const armor = actor.items.getName('V14 Magic Armor')
        await armor.update({ 'system.equipped': false })
      }, actorId)
      await page.waitForTimeout(1000)

      // STR should revert to 10
      strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(10)

      // Re-equip the armor
      await page.evaluate(async (id) => {
        const actor = game.actors.get(id)
        const armor = actor.items.getName('V14 Magic Armor')
        await armor.update({ 'system.equipped': true })
      }, actorId)
      await page.waitForTimeout(1000)

      // STR should be 12 again
      strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(12)
    })
  })

  // ── Effect Transfer from Items ───────────────────────────────────────

  test.describe('Effect Transfer from Items', () => {
    test('item effect with transfer shows on item effects tab', async ({ page }) => {
      // Create actor with an item that has a transfer effect
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Transfer Test', type: 'Player' })

        const [weapon] = await actor.createEmbeddedDocuments('Item', [{
          name: 'V14 Magic Sword',
          type: 'weapon',
          system: { equipped: true }
        }])

        await weapon.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Sword Attack Bonus',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '1',
            type: 'add'
          }],
          transfer: true,
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Transfer Test')

      // Verify the effect is applied (STR should be 11)
      const strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(11)

      // Navigate to equipment tab
      await page.click('.dcc.actor.sheet nav [data-tab="equipment"]')
      await page.waitForTimeout(500)

      // Open the weapon's item sheet via edit button
      const itemId = await page.evaluate(() => {
        return game.actors.getName('V14 Transfer Test').items.getName('V14 Magic Sword')?.id
      })
      await page.click(`li[data-item-id="${itemId}"] [data-action="itemEdit"]`)
      await page.waitForSelector('.dcc.sheet.item', { timeout: 5000 })
      await page.waitForTimeout(500)

      // Navigate to item's Effects tab
      await page.click('.dcc.sheet.item nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify effect appears on item with transfer status
      await expect(page.locator('.dcc.sheet.item .effect-item')).toBeVisible()
      await expect(page.locator('.dcc.sheet.item .effect-name')).toContainText('Sword Attack Bonus')
      await expect(page.locator('.dcc.sheet.item .effect-transfer')).toBeVisible()
    })
  })

  // ── Effects Compendium ───────────────────────────────────────────────

  test.describe('Effects Compendium', () => {
    test('DCC Effects compendium is registered and contains effects', async ({ page }) => {
      // Verify compendium exists and has entries via API
      const packInfo = await page.evaluate(async () => {
        const pack = game.packs.get('dcc.dcc-effects')
        if (!pack) return null
        const index = await pack.getIndex()
        return {
          label: pack.metadata.label,
          type: pack.metadata.type,
          count: index.size,
          sampleNames: Array.from(index.values()).slice(0, 5).map(e => e.name)
        }
      })

      expect(packInfo).not.toBeNull()
      expect(packInfo.type).toBe('ActiveEffect')
      expect(packInfo.count).toBeGreaterThan(10)
      expect(packInfo.sampleNames.length).toBeGreaterThan(0)
    })

    test('DCC Effects compendium is visible in sidebar', async ({ page }) => {
      // Click the compendium tab
      await page.click('button[data-tab="compendium"]')
      await page.waitForTimeout(500)

      // Find the DCC Effects compendium by data-pack attribute
      const packEntry = page.locator('[data-pack="dcc.dcc-effects"]')
      await expect(packEntry).toBeVisible()

      // Verify the pack entry shows the correct label
      await expect(packEntry).toContainText('DCC Effects')

      // Verify it's an ActiveEffect type pack
      await expect(packEntry).toHaveClass(/activeeffect/)
    })

    test('actor-sheet AE summary builders survive actor-sheet/effects.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor-sheet.js shrinkage): the four #private AE
      // summary builders moved out of actor-sheet.js into pure free functions in
      // module/actor-sheet/effects.mjs, called from _prepareContext. This probe
      // drives the real sheet pipeline end-to-end (actor.sheet._prepareContext)
      // and asserts the effect-summary buckets — covering the actor + equipped /
      // unequipped item-transfer + disabled filtering the extraction must preserve.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({ name: 'P_SheetEffectsProbe', type: 'Player' })
          await actor.createEmbeddedDocuments('ActiveEffect', [
            { name: 'STR Boon', changes: [{ key: 'system.abilities.str.value', value: '2', type: 'add' }], disabled: false },
            { name: 'Ref Boon', changes: [{ key: 'system.saves.ref.value', value: '1', type: 'add' }], disabled: false },
            { name: 'HP Boon', changes: [{ key: 'system.attributes.hp.max', value: '5', type: 'add' }], disabled: false },
            { name: 'Off Boon', changes: [{ key: 'system.abilities.per.value', value: '9', type: 'add' }], disabled: true }
          ])
          // Equipped item with a transferring LCK effect; unequipped item with an AGL effect.
          const [ring, stowed] = await actor.createEmbeddedDocuments('Item', [
            { type: 'equipment', name: 'Lucky Ring', system: { equipped: true } },
            { type: 'equipment', name: 'Stowed Charm', system: { equipped: false } }
          ])
          await ring.createEmbeddedDocuments('ActiveEffect', [
            { name: 'Ring LCK', transfer: true, changes: [{ key: 'system.abilities.lck.value', value: '3', type: 'add' }], disabled: false }
          ])
          await stowed.createEmbeddedDocuments('ActiveEffect', [
            { name: 'Charm AGL', transfer: true, changes: [{ key: 'system.abilities.agl.value', value: '3', type: 'add' }], disabled: false }
          ])

          const ctx = await actor.sheet._prepareContext({})
          const names = (bucket) => (bucket ?? []).map(e => e.name)
          observed.str = names(ctx.abilityEffects?.str)
          observed.lck = names(ctx.abilityEffects?.lck) // equipped item transfer -> present
          observed.agl = names(ctx.abilityEffects?.agl) // unequipped item -> excluded
          observed.per = names(ctx.abilityEffects?.per) // disabled -> excluded
          observed.ref = names(ctx.saveEffects?.ref)
          observed.hp = names(ctx.attributeEffects?.hp)
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      expect(result.str).toEqual(['STR Boon'])
      expect(result.lck).toEqual(['Ring LCK'])
      expect(result.agl).toEqual([])
      expect(result.per).toEqual([])
      expect(result.ref).toEqual(['Ref Boon'])
      expect(result.hp).toEqual(['HP Boon'])
    })
  })
})
