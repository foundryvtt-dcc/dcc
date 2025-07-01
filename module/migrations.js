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
    updateData.update({
      'system.skills.divineAid.useDisapprovalRange': true,
      'system.skills.turnUnholy.useDisapprovalRange': true,
      'system.skills.layOnHands.useDisapprovalRange': true
    })
  }

  // If migrating from earlier than 0.50.0 copy attackBonus to attackHitBonus
  if ((currentVersion <= 0.50) || (currentVersion == null)) {
    updateData.update({
      'system.details.attackHitBonus.melee.value': actor.system.details.attackBonus,
      'system.details.attackHitBonus.missile.value': actor.system.details.attackBonus
    })
    if (this.options.template === 'systems/dcc/templates/actor-sheet-npc.html' ||
            this.options.template === 'systems/dcc/templates/actor-sheet-zero-level.html') {
      this.options.template = 'systems/dcc/templates/actor-partial-generic.html'
    }
  }

  if (actor.system.details.luckyRoll) {
    updateData.update({
      'system.details.birthAugur': actor.system.details.luckyRoll
    })
  }

  if (!actor.system?.details?.alignment) {
    updateData.update({
      'system.details.alignment': 'l'
    })
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
