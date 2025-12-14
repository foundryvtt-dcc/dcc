/* global foundry, game, ui, isObjectEmpty */

/**
 * Migrate the current world to the current version of the system
 *
 * @return {Promise}    A promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
  ui.notifications.info(game.i18n.format('DCC.MigrationInfo', { systemVersion: game.system.version }, { permanent: true }))

  // Migrate World Actors
  for (const a of game.actors) {
    try {
      const updateData = migrateActorData(a)
      if (!isObjectEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Actor', name: a.name }))
        await a.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Migrate World Items
  for (const i of game.items) {
    try {
      const updateData = migrateItemData(i)
      if (!isObjectEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Item', name: i.name }))
        await i.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Migrate Actor Override Tokens
  for (const s of game.scenes) {
    try {
      const updateData = migrateSceneData(s)
      if (!isObjectEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Scene', name: s.name }))
        await s.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Migrate World Compendium Packs
  const packs = game.packs.filter(p => {
    return (p.metadata.package === 'world') && ['Actor', 'Item', 'Scene'].includes(p.documentName)
  })
  for (const p of packs) {
    await migrateCompendium(p)
  }

  // Set the migration as complete
  // parseFloat will pull out the major and minor version ignoring the patch version
  game.settings.set('dcc', 'systemMigrationVersion', parseFloat(game.system.version))
  ui.notifications.info(game.i18n.format('DCC.MigrationComplete', { systemVersion: game.system.version }, { permanent: true }))
}

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @return {Promise}
 */
const migrateCompendium = async function (pack) {
  const documentName = pack.documentName
  if (!['Actor', 'Item', 'Scene'].includes(documentName)) return

  // Unlock the pack for editing
  const wasLocked = pack.locked
  await pack.configure({ locked: false })

  // Begin by requesting server-side data model migration and get the migrated documents
  await pack.migrate()
  const documents = await pack.getDocuments()

  // Iterate over compendium entries - applying fine-tuned migration functions
  for (const doc of documents) {
    try {
      let updateData = null
      switch (documentName) {
        case 'Item':
          updateData = migrateItemData(doc)
          break
        case 'Actor':
          updateData = migrateActorData(doc)
          break
        case 'Scene':
          updateData = migrateSceneData(doc)
          break
      }

      if (!isObjectEmpty(updateData)) {
        await doc.update(updateData)
        console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Apply the original locked status for the pack
  await pack.configure({ locked: wasLocked })

  console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`)
}

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
const migrateActorData = function (actor) {
  const updateData = {}

  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')

  // If migrating from 0.17 or earlier add useDisapprovalRange to cleric skills
  if ((currentVersion <= 0.17) || (currentVersion == null)) {
    updateData['system.skills.divineAid.useDisapprovalRange'] = true
    updateData['system.skills.turnUnholy.useDisapprovalRange'] = true
    updateData['system.skills.layOnHands.useDisapprovalRange'] = true
  }

  // If migrating from earlier than 0.50.0 copy attackBonus to attackHitBonus
  if ((currentVersion <= 0.50) || (currentVersion == null)) {
    updateData['system.details.attackHitBonus.melee.value'] = actor.system.details.attackBonus
    updateData['system.details.attackHitBonus.missile.value'] = actor.system.details.attackBonus
  }

  if (actor.system.details.luckyRoll) {
    updateData['system.details.birthAugur'] = actor.system.details.luckyRoll
  }

  if (!actor.system?.details?.alignment) {
    updateData['system.details.alignment'] = 'l'
  }

  // If migrating from earlier than 0.65.0, set base speed from current speed if not present
  if (currentVersion < 0.65) {
    if (!actor.system?.attributes?.speed?.base && actor.system?.attributes?.speed?.value) {
      updateData['system.attributes.speed.base'] = actor.system.attributes.speed.value
    }
  }

  // If migrating from earlier than 0.67.0, convert critRange and disapproval from string to number
  // and set sheetClass based on className to prevent class setup from overwriting custom values
  if (currentVersion < 0.67) {
    const critRange = actor.system?.details?.critRange
    if (typeof critRange === 'string') {
      updateData['system.details.critRange'] = parseInt(critRange) || 20
    }
    const disapproval = actor.system?.class?.disapproval
    if (typeof disapproval === 'string') {
      updateData['system.class.disapproval'] = parseInt(disapproval) || 1
    }

    // Set sheetClass from className for existing actors to prevent class setup overwriting values
    if (!actor.system?.details?.sheetClass && actor.system?.class?.className) {
      const className = actor.system.class.className
      // Map class names to internal sheetClass identifiers
      // Includes current locale, English, and all known translations for robustness
      const classMap = {
        // Current locale (dynamic)
        [game.i18n.localize('DCC.Warrior')]: 'Warrior',
        [game.i18n.localize('DCC.Thief')]: 'Thief',
        [game.i18n.localize('DCC.Halfling')]: 'Halfling',
        [game.i18n.localize('DCC.Cleric')]: 'Cleric',
        [game.i18n.localize('DCC.Wizard')]: 'Wizard',
        [game.i18n.localize('DCC.Elf')]: 'Elf',
        [game.i18n.localize('DCC.Dwarf')]: 'Dwarf',
        // English
        Warrior: 'Warrior',
        Thief: 'Thief',
        Halfling: 'Halfling',
        Cleric: 'Cleric',
        Wizard: 'Wizard',
        Elf: 'Elf',
        Dwarf: 'Dwarf',
        // German (de)
        Krieger: 'Warrior',
        Dieb: 'Thief',
        Halbling: 'Halfling',
        Kleriker: 'Cleric',
        Zauberkundiger: 'Wizard',
        Zwerg: 'Dwarf',
        // Spanish (es)
        Guerrero: 'Warrior',
        Ladrón: 'Thief',
        Mediano: 'Halfling',
        Clérigo: 'Cleric',
        Mago: 'Wizard',
        Elfo: 'Elf',
        Enano: 'Dwarf',
        // French (fr)
        Guerrier: 'Warrior',
        Voleur: 'Thief',
        Halfelin: 'Halfling',
        Clerc: 'Cleric',
        Mage: 'Wizard',
        Nain: 'Dwarf',
        Elfe: 'Elf',
        // Italian (it)
        Guerriero: 'Warrior',
        Ladro: 'Thief',
        Chierico: 'Cleric',
        Nano: 'Dwarf',
        // Polish (pl)
        Wojownik: 'Warrior',
        Złodziej: 'Thief',
        Niziołek: 'Halfling',
        Kleryk: 'Cleric',
        Czarodziej: 'Wizard',
        Krasnolud: 'Dwarf',
        // Chinese (cn)
        战士: 'Warrior',
        盗贼: 'Thief',
        半身人: 'Halfling',
        牧师: 'Cleric',
        法师: 'Wizard',
        精灵: 'Elf',
        矮人: 'Dwarf'
      }
      if (classMap[className]) {
        updateData['system.details.sheetClass'] = classMap[className]
      }
    }
  }

  // Migrate Owned Items
  let hasItemUpdates = false
  let items = []
  if (actor.items) {
    items = actor.items.map(i => {
      // Migrate the Owned Item
      const itemUpdate = migrateItemData(i)

      // Update the Owned Item
      if (!isObjectEmpty(itemUpdate)) {
        hasItemUpdates = true
        return foundry.utils.mergeObject(i, itemUpdate, { enforceTypes: false, inplace: false })
      } else {
        return i
      }
    })
  }

  if (hasItemUpdates) {
    updateData.items = items
  }

  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Item document to incorporate latest data model changes
 * @param item
 */
const migrateItemData = function (item) {
  let updateData = {}

  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')

  // If migrating from 0.11 mark all physicalItems as equipped
  if ((currentVersion <= 0.11) || (currentVersion == null)) {
    if (item.equipped !== undefined) {
      updateData = { equipped: true }
    }
  }

  // If migrating from 0.21 mark all spells as inheritActionDie
  if ((currentVersion <= 0.21) || (currentVersion == null)) {
    if (item.type === 'spell' && !item.config.inheritActionDie) {
      updateData = {
        config: {
          inheritActionDie: true
        }
      }
    }
  }

  // If migrating from 0.22 mark all spells as castingMode: wizard
  if ((currentVersion <= 0.22) || (currentVersion == null)) {
    if (item.type === 'spell' && !item.config.castingMode) {
      updateData = {
        config: {
          castingMode: 'wizard'
        }
      }
    }
  }

  if (currentVersion < 0.51) {
    if (item.type === 'weapon') {
      if (item.damage && !item.damageWeapon) {
        item.config.damageOverride = item.damage
      }
    }
  }

  // Return the migrated update data
  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Scene document to incorporate changes to the data model of its actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Object}       The updateData to apply
 */
const migrateSceneData = function (scene) {
  const tokens = scene.tokens.map(token => {
    const t = token.toObject()
    const update = {}
    if (Object.keys(update).length) foundry.utils.mergeObject(t, update)
    if (!t.actorId || t.actorLink) {
      t.actorData = {}
    } else if (!game.actors.has(t.actorId)) {
      t.actorId = null
      t.actorData = {}
    } else if (!t.actorLink) {
      const actorData = foundry.utils.duplicate(t.actorData)
      actorData.type = token.actor?.type
      const update = migrateActorData(actorData);
      ['items', 'effects'].forEach(embeddedName => {
        if (!update[embeddedName]?.length) return
        const updates = new Map(update[embeddedName].map(u => [u._id, u]))
        t.actorData[embeddedName].forEach(original => {
          const update = updates.get(original._id)
          if (update) foundry.utils.mergeObject(original, update)
        })
        delete update[embeddedName]
      })

      foundry.utils.mergeObject(t.actorData, update)
    }
    return t
  })
  return { tokens }
}
