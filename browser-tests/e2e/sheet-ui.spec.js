/* eslint-disable no-undef -- Browser globals (game, Actor, ui, CONFIG) used in page.evaluate callbacks */
const { expect, createSessionTest, openActorSheet, significantConsoleErrors } = require('./fixtures')

/**
 * Sheet UI E2E tests — the click-through layer a player actually uses:
 *   - roll smoke: open a sheet, click an ability/save control, assert a chat card
 *   - class-specific tab sets render with the expected tabs
 *   - tab navigation switches and each tab renders
 *   - DCC status effects are registered and toggleable
 *
 * `adapter-dispatch.spec.js` drives the DCCActor roll *methods* directly; this
 * spec exercises the actual sheet DOM → data-action path. Active-effect
 * behaviour lives in `active-effects.spec.js`.
 *
 * Roll smoke tests force `showRollModifierByDefault` off so a plain click rolls
 * directly (no modifier dialog). Probe actors are prefixed `SMOKE ` (rolls) or
 * `V14 ` (tab/status tests).
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   cd browser-tests/e2e && npm test -- sheet-ui.spec.js
 */

const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
})

test.describe('DCC Sheet UI', () => {
  test.beforeEach(async ({ page }) => {
    // World hygiene + force direct rolls (no roll-modifier dialog) so a plain
    // click on a roll control produces a chat card deterministically. Probe
    // actors/items are prefixed `SMOKE ` (rolls) or `V14 ` (tab/status tests).
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { try { await app.close() } catch {} }
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
      for (const a of game.actors.filter(a => /^(SMOKE|V14) /.test(a.name))) { try { await a.delete() } catch {} }
      for (const i of game.items.filter(i => /^(SMOKE|V14) /.test(i.name))) { try { await i.delete() } catch {} }
      try { await game.settings.set('dcc', 'showRollModifierByDefault', false) } catch {}
    }).catch(() => {})
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { try { await app.close() } catch {} }
      for (const a of game.actors.filter(a => /^(SMOKE|V14) /.test(a.name))) { try { await a.delete() } catch {} }
      for (const i of game.items.filter(i => /^(SMOKE|V14) /.test(i.name))) { try { await i.delete() } catch {} }
    }).catch(() => {})
    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  /** Create a Player, open its sheet, and wait for the body to render. */
  async function openSmokeSheet (page, name) {
    await page.evaluate(async (n) => {
      await Actor.create({
        name: n,
        type: 'Player',
        system: {
          abilities: {
            str: { value: 14 },
            agl: { value: 12 },
            sta: { value: 13 },
            per: { value: 10 },
            int: { value: 11 },
            lck: { value: 9 }
          }
        }
      })
    }, name)
    await page.click('button[data-tab="actors"]')
    await page.waitForSelector('#actors.active', { timeout: 5000 })
    await page.click(`.entry-name:has-text("${name}")`)
    await page.waitForSelector('.dcc.actor.sheet', { timeout: 10000 })
    await page.waitForSelector('.dcc.actor.sheet [data-action]', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(750)
  }

  /** Click a roll control and assert a new chat message carrying a roll appears. */
  async function clickRollAndExpectChat (page, selector, label) {
    const before = await page.evaluate(() => game.messages.size)
    await page.locator(selector).first().click()
    await page.waitForFunction(
      n => game.messages.size > n,
      before,
      { timeout: 10000 }
    )
    const last = await page.evaluate(() => {
      const m = game.messages.contents[game.messages.size - 1]
      return {
        hasRolls: (m?.rolls?.length ?? 0) > 0,
        contentLen: (m?.content ?? '').length,
        flavor: m?.flavor ?? ''
      }
    })
    expect(
      last.hasRolls || last.contentLen > 0,
      `${label}: expected a chat card with roll content (flavor="${last.flavor}")`
    ).toBeTruthy()
  }

  test('ability check from the sheet posts a chat card', async ({ page }) => {
    await openSmokeSheet(page, 'SMOKE Ability')
    await clickRollAndExpectChat(
      page,
      '.dcc.actor.sheet .ability-box[data-ability="str"] [data-action="rollAbilityCheck"]',
      'Strength check'
    )
  })

  test('saving throw from the sheet posts a chat card', async ({ page }) => {
    await openSmokeSheet(page, 'SMOKE Save')
    await clickRollAndExpectChat(
      page,
      '.dcc.actor.sheet .saving-throw-box[data-save="ref"] [data-action="rollSavingThrow"]',
      'Reflex save'
    )
  })

  // ── Class-Specific Sheet Tabs ────────────────────────────────────────

  test.describe('Class-Specific Sheet Tabs', () => {
    const classConfigs = [
      {
        sheetClass: 'dcc.DCCActorSheetCleric',
        name: 'Cleric',
        expectedTabs: ['character', 'equipment', 'cleric', 'clericSpells', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetWarrior',
        name: 'Warrior',
        expectedTabs: ['character', 'equipment', 'warrior', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetWizard',
        name: 'Wizard',
        expectedTabs: ['character', 'equipment', 'wizard', 'wizardSpells', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetThief',
        name: 'Thief',
        expectedTabs: ['character', 'equipment', 'thief', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetElf',
        name: 'Elf',
        expectedTabs: ['character', 'equipment', 'elf', 'wizardSpells', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetDwarf',
        name: 'Dwarf',
        expectedTabs: ['character', 'equipment', 'dwarf', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetHalfling',
        name: 'Halfling',
        expectedTabs: ['character', 'equipment', 'halfling', 'effects', 'notes']
      }
    ]

    for (const { sheetClass, name, expectedTabs } of classConfigs) {
      test(`${name} sheet has correct tabs`, async ({ page }) => {
        // Create actor with specific sheet class
        await page.evaluate(async ({ sheetClass, name }) => {
          await Actor.create({
            name: `V14 ${name} Tabs`,
            type: 'Player',
            flags: { core: { sheetClass } }
          })
        }, { sheetClass, name })

        await openActorSheet(page, `V14 ${name} Tabs`)

        // Get all tab IDs from the sheet navigation
        const tabIds = await page.evaluate(() => {
          const sheet = document.querySelector('.dcc.actor.sheet')
          const tabs = sheet.querySelectorAll('nav [data-tab]')
          return Array.from(tabs).map(t => t.dataset.tab)
        })

        // Verify expected tabs are present
        expect(tabIds).toEqual(expectedTabs)
      })
    }
  })

  // ── Sheet Tab Navigation ─────────────────────────────────────────────

  test.describe('Sheet Tab Navigation', () => {
    test('can switch between all tabs and each renders content', async ({ page }) => {
      // Create a Cleric actor (has many tabs)
      await page.evaluate(async () => {
        await Actor.create({
          name: 'V14 Tab Navigate',
          type: 'Player',
          flags: { core: { sheetClass: 'dcc.DCCActorSheetCleric' } }
        })
      })

      await openActorSheet(page, 'V14 Tab Navigate')

      // Character tab (default active)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="character"]')).toHaveClass(/active/)

      // Switch to Equipment tab
      await page.click('.dcc.actor.sheet nav [data-tab="equipment"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="equipment"]')).toHaveClass(/active/)

      // Switch to Cleric tab
      await page.click('.dcc.actor.sheet nav [data-tab="cleric"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="cleric"]')).toHaveClass(/active/)

      // Switch to Spells tab
      await page.click('.dcc.actor.sheet nav [data-tab="clericSpells"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="clericSpells"]')).toHaveClass(/active/)

      // Switch to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="effects"]')).toHaveClass(/active/)

      // Switch to Notes tab
      await page.click('.dcc.actor.sheet nav [data-tab="notes"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="notes"]')).toHaveClass(/active/)

      // Switch back to Character tab and verify ability scores are visible
      await page.click('.dcc.actor.sheet nav [data-tab="character"]')
      await page.waitForTimeout(500)
      await expect(page.locator('input[name="system.abilities.str.value"]')).toBeVisible()
    })
  })

  // ── Status Icons ─────────────────────────────────────────────────────

  test.describe('Status Icons', () => {
    test('DCC-specific status effects are registered', async ({ page }) => {
      // Check for specific known DCC status effect IDs
      const statusEffects = await page.evaluate(() => {
        const dccStatusIds = [
          'armor-seized', 'battle-rage', 'disarmed', 'grip-disrupted',
          'kneecapped', 'off-balance', 'stumbling', 'turtled',
          'weapon-tangled-armor', 'weapon-damaged'
        ]
        return CONFIG.statusEffects
          .filter(s => dccStatusIds.includes(s.id))
          .map(s => ({ id: s.id, name: s.name, img: s.img }))
      })

      // Verify DCC-specific status effects exist
      expect(statusEffects.length).toBeGreaterThan(0)

      const statusIds = statusEffects.map(s => s.id)
      expect(statusIds).toContain('armor-seized')
      expect(statusIds).toContain('battle-rage')
      expect(statusIds).toContain('disarmed')
      expect(statusIds).toContain('weapon-damaged')

      // Verify each has an image path and name
      for (const effect of statusEffects) {
        expect(effect.img).toBeTruthy()
        expect(effect.name).toBeTruthy()
      }
    })

    test('can toggle a status effect on an actor', async ({ page }) => {
      // Create actor and toggle a status effect via API
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Status Test', type: 'Player' })

        // Check initial status - no effects with armor-seized status
        const before = actor.effects.contents.some(e => e.statuses.has('armor-seized'))

        // Toggle status on using the status ID directly
        await actor.toggleStatusEffect('armor-seized')
        const after = actor.effects.contents.some(e => e.statuses.has('armor-seized'))

        // Toggle status off
        await actor.toggleStatusEffect('armor-seized')
        const afterOff = actor.effects.contents.some(e => e.statuses.has('armor-seized'))

        return { before, after, afterOff }
      })

      expect(result.before).toBe(false)
      expect(result.after).toBe(true)
      expect(result.afterOff).toBe(false)
    })
  })

  // ── Inventory preparation ────────────────────────────────────────────
  test.describe('Inventory Preparation', () => {
    test('actor-sheet #prepareItems survives actor-sheet/items.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor-sheet.js shrinkage): #prepareItems moved out of
      // actor-sheet.js into a free function in module/actor-sheet/items.mjs, called
      // from _prepareContext. This probe drives the real sheet pipeline end-to-end
      // (actor.sheet._prepareContext) on a live actor carrying one item of each
      // major category — a melee + ranged weapon, armor, equipment, a spell with a
      // description, a skill, a container with a contained item, and a resolved
      // coin treasure — and asserts the inventory buckets, the contained-item
      // nesting, spell grouping, and the carried-weight totals the extraction must
      // preserve.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({ name: 'V14 Inventory Probe', type: 'Player' })
          const [, , , , , , container] = await actor.createEmbeddedDocuments('Item', [
            { type: 'weapon', name: 'Probe Sword', system: { melee: true, weight: 3, quantity: 1 } },
            { type: 'weapon', name: 'Probe Bow', system: { melee: false, weight: 2, quantity: 1 } },
            { type: 'armor', name: 'Probe Mail', system: { weight: 10, quantity: 1 } },
            { type: 'equipment', name: 'Probe Torch', system: { weight: 1, quantity: 2 } },
            { type: 'spell', name: 'Probe Bolt', system: { level: 1, description: { value: 'A bolt.' } } },
            { type: 'skill', name: 'Probe Skill', system: { config: { useDie: true }, die: '1d16' } },
            { type: 'container', name: 'Probe Pack', system: { capacity: { weight: 20, items: 5 } } }
          ])
          await actor.createEmbeddedDocuments('Item', [
            { type: 'equipment', name: 'Probe Stowed', system: { weight: 4, quantity: 1, container: container.id } }
          ])

          // The contained-item linkage can lag a tick behind the awaited
          // createEmbeddedDocuments under the shared-session page, so the
          // container's `contents` getter (parent.items.filter by container id)
          // occasionally reports empty if read immediately — which flaked
          // containedCount to 0 in full-suite runs. Wait for the container to
          // actually see its stowed item before driving _prepareContext.
          const probeContainer = actor.items.get(container.id)
          for (let i = 0; i < 40 && probeContainer.contents.length < 1; i++) {
            await new Promise(resolve => setTimeout(resolve, 25))
          }

          // _prepareContext merges #prepareItems' return via foundry.utils.mergeObject,
          // which expands the dotted keys: 'equipment.weapons' -> ctx.equipment.weapons.
          // The non-dotted `spells` / `skills` stay top-level on the context.
          const ctx = await actor.sheet._prepareContext({})
          const eq = ctx.equipment ?? {}
          const names = (bucket) => (bucket ?? []).map(i => i.name)
          observed.melee = names(eq.weapons?.melee)
          observed.ranged = names(eq.weapons?.ranged)
          observed.armor = names(eq.armor)
          observed.equipment = names(eq.equipment) // contained item must NOT appear here
          observed.containers = names(eq.containers)
          observed.containerSummary = eq.containers?.[0]?.capacitySummary ?? ''
          observed.containedCount = eq.containers?.[0]?.containerContents?.length ?? 0
          observed.spellLevels = Object.keys(ctx.spells ?? {})
          observed.spellEnriched = !!ctx.spells?.['1']?.[0]?.descriptionHTML
          observed.skillDie = ctx.skills?.[0]?.displayDie ?? null
          observed.meleeWeight = eq.weights?.melee ?? null
          observed.totalWeightPositive = (eq.weights?.total ?? 0) > 0
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      expect(result.melee).toEqual(['Probe Sword'])
      expect(result.ranged).toEqual(['Probe Bow'])
      expect(result.armor).toEqual(['Probe Mail'])
      // The contained "Probe Stowed" is nested under its container, not standalone.
      expect(result.equipment).toEqual(['Probe Torch'])
      expect(result.containers).toEqual(['Probe Pack'])
      expect(result.containerSummary).toContain('/20')
      expect(result.containerSummary).toContain('/5')
      expect(result.containedCount).toBe(1)
      expect(result.spellLevels).toEqual(['1'])
      expect(result.spellEnriched).toBe(true)
      expect(result.skillDie).toBe('1d16')
      expect(result.meleeWeight).toBe(3)
      expect(result.totalWeightPositive).toBe(true)
    })
  })

  test.describe('Context Field Preparation', () => {
    test('actor-sheet presentation fields survive actor-sheet/presentation.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor-sheet.js shrinkage): the four small context-field
      // helpers (#prepareNotes / #prepareCorruption / #prepareImage /
      // #prepareCompendiumLinks) moved out of actor-sheet.js into free functions in
      // module/actor-sheet/presentation.mjs, called from _prepareContext. This probe
      // drives the real sheet pipeline end-to-end on a live actor and asserts each
      // field the extraction must preserve: enriched notes + corruption HTML, the
      // display-image fallback, and the compendium-links config passthrough.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({
            name: 'V14 Context Probe',
            type: 'Player',
            // A real core Foundry icon (exists, so no 404 in the directory thumbnail)
            // that is neither empty nor the mystery-man placeholder — so prepareImage
            // keeps it verbatim.
            img: 'icons/svg/aura.svg',
            system: {
              details: { notes: { value: '<p>Probe notes body</p>' } },
              class: { corruption: '<p>Probe corruption body</p>' }
            }
          })

          const ctx = await actor.sheet._prepareContext({})
          observed.notesHTML = ctx.notesHTML
          observed.corruptionHTML = ctx.corruptionHTML
          observed.customImg = ctx.img
          // _prepareContext runs every value through foundry.utils.mergeObject,
          // which deep-clones a non-null object — so compare by structure, not by
          // reference, against the CONFIG.DCC source the helper reads.
          observed.compendiumLinks = ctx.compendiumLinks ?? null
          observed.configLinks = CONFIG.DCC.coreBookCompendiumLinks ?? null

          // Drop to the mystery-man placeholder to exercise the default-image fallback.
          await actor.update({ img: 'icons/svg/mystery-man.svg' })
          const ctx2 = await actor.sheet._prepareContext({})
          observed.fallbackImg = ctx2.img
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      // Notes + corruption are TextEditor.enrichHTML output — assert the source text
      // round-trips through enrichment.
      expect(result.notesHTML).toContain('Probe notes body')
      expect(result.corruptionHTML).toContain('Probe corruption body')
      // A real custom image is kept verbatim.
      expect(result.customImg).toBe('icons/svg/aura.svg')
      // compendiumLinks is the CONFIG.DCC passthrough — structurally identical.
      expect(result.compendiumLinks).toEqual(result.configLinks)
      // The mystery-man placeholder resolves to a non-empty default that is no longer
      // the placeholder itself.
      expect(result.fallbackImg).toBeTruthy()
      expect(result.fallbackImg).not.toBe('icons/svg/mystery-man.svg')
    })
  })

  test.describe('Drag Start Data', () => {
    test('actor-sheet _onDragStart survives actor-sheet/drag-drop.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor-sheet.js shrinkage): _onDragStart's ~210-line
      // switch moved out of actor-sheet.js into the buildDragStartData free function
      // in module/actor-sheet/drag-drop.mjs; the sheet's thin _onDragStart now calls
      // it and owns the lone side effect (event.dataTransfer.setData). This probe
      // drives the real sheet method end-to-end on a live actor — synthesizing the
      // dragstart event for several drag actions and capturing the JSON payload
      // actually written to the drag event — and asserts the payloads the extraction
      // must preserve: a simple roll drag, the weapon drag (toDragData merge +
      // backstab flag), the spell-item drag's 'DCC Item' type, and the
      // non-draggable no-op.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({ name: 'V14 Drag Probe', type: 'Player' })
          const [weapon, spell] = await actor.createEmbeddedDocuments('Item', [
            { type: 'weapon', name: 'Drag Sword', system: { melee: true } },
            { type: 'spell', name: 'Drag Bolt', system: { level: 1 } }
          ])
          const sheet = actor.sheet

          // Synthesize a dragstart event whose setData call we capture. _onDragStart
          // reads only currentTarget.dataset, target.classList/getAttribute, and the
          // actor — no live DOM render required.
          const fire = (dataset, classes = []) => {
            let captured
            sheet._onDragStart({
              currentTarget: { dataset, parentElement: null },
              target: {
                classList: { contains: (c) => classes.includes(c) },
                getAttribute: () => null
              },
              dataTransfer: { setData: (_type, val) => { captured = val } }
            })
            return captured === undefined ? null : JSON.parse(captured)
          }

          observed.actorId = actor.id
          observed.initiative = fire({ drag: 'true', dragAction: 'initiative' })
          observed.weapon = fire({ drag: 'true', dragAction: 'weapon', itemId: weapon.id }, ['backstab-button'])
          observed.spellItem = fire({ drag: 'true', dragAction: 'item', itemId: spell.id })
          observed.nonDraggable = fire({ dragAction: 'initiative' })
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      expect(result.initiative).toMatchObject({ type: 'Initiative', actorId: result.actorId, data: {} })
      expect(result.weapon).toMatchObject({ dccType: 'Weapon', actorId: result.actorId })
      expect(result.weapon.dccData.backstab).toBe(true)
      // Spells drag as 'DCC Item' (suppresses Foundry's default macro creation).
      expect(result.spellItem.type).toBe('DCC Item')
      expect(result.spellItem.uuid).toBeTruthy()
      // A non-draggable element writes nothing to the drag event.
      expect(result.nonDraggable).toBeNull()
    })
  })

  test.describe('Drop Handlers', () => {
    test('actor-sheet drop handlers survive actor-sheet/drop.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor-sheet.js shrinkage): the two self-contained
      // drop-side handlers (_handleContainerDrop / _onDropActiveEffect) moved out
      // of actor-sheet.js into free functions in module/actor-sheet/drop.mjs; the
      // sheet's thin wrappers now call them with this.options.document. This probe
      // drives the real sheet methods end-to-end on a live actor — dropping an
      // item already on the actor onto a container element, and dropping an
      // ActiveEffect onto the actor — and asserts the state changes the extraction
      // must preserve: the item's container reference is set, and the dropped
      // effect is copied onto the actor with origin/transfer/img normalized.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({ name: 'V14 Drop Probe', type: 'Player' })
          const [container, stowable] = await actor.createEmbeddedDocuments('Item', [
            { type: 'container', name: 'V14 Drop Pack', system: { capacity: { weight: 50, items: 10 } } },
            { type: 'equipment', name: 'V14 Drop Torch', system: { weight: 1, quantity: 1 } }
          ])
          const sheet = actor.sheet

          // _handleContainerDrop resolves the dropped item via fromUuid, whose
          // global index can lag a tick behind the awaited createEmbeddedDocuments
          // under the loaded shared session — flaking containerResult to false.
          // Wait for the stowable to be resolvable before driving the handler.
          for (let i = 0; i < 40 && !(await fromUuid(stowable.uuid)); i++) {
            await new Promise(resolve => setTimeout(resolve, 25))
          }

          // Container drop: synthesize an event whose target resolves to the
          // container element via closest('[data-container-id]'). The item is
          // already on the actor, so the handler just sets system.container.
          const containerEvent = {
            target: { closest: () => ({ dataset: { containerId: container.id } }) }
          }
          observed.containerResult = await sheet._handleContainerDrop(containerEvent, { type: 'Item', uuid: stowable.uuid })
          observed.containerRef = actor.items.get(stowable.id)?.system?.container ?? null
          observed.containerId = container.id

          // Non-container drop target returns undefined (caller falls through).
          observed.noContainer = await sheet._handleContainerDrop(
            { target: { closest: () => null } },
            { type: 'Item', uuid: stowable.uuid }
          )

          // ActiveEffect drop: copy an inline effect onto the actor. event is unused.
          const effectBefore = actor.effects.size
          observed.effectResult = await sheet._onDropActiveEffect({}, {
            type: 'ActiveEffect',
            data: { _id: 'sourceid', name: 'V14 Drop Effect', changes: [], transfer: true }
          })
          observed.effectAdded = actor.effects.size - effectBefore
          const created = actor.effects.find(e => e.name === 'V14 Drop Effect')
          observed.effectOrigin = created?.origin ?? null
          observed.effectTransfer = created?.transfer ?? null
          observed.effectImg = created?.img ?? null
          observed.actorUuid = actor.uuid
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      // Container drop handled, item's container reference now points at the pack.
      expect(result.containerResult).toBe(true)
      expect(result.containerRef).toBe(result.containerId)
      // A drop not over a container returns undefined so the caller can fall through.
      expect(result.noContainer).toBeUndefined()
      // The dropped ActiveEffect is copied onto the actor with normalized fields.
      expect(result.effectAdded).toBe(1)
      expect(result.effectOrigin).toBe(result.actorUuid)
      expect(result.effectTransfer).toBe(false)
      expect(result.effectImg).toBeTruthy()
    })
  })
})
