/* global game, ui, Token, isObjectEmpty, expandObject, mergeObject, duplicate */

/**
 * Migrate the current world to the current version of the system
 *
 * @return {Promise}    A promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
  ui.notifications.info(game.i18n.format('DCC.MigrationInfo', { systemVersion: game.system.data.version }, { permenant: true }))

  // Migrate World Actors
  for (const a of game.actors.entities) {
    try {
      const updateData = migrateActorData(a.data)
      if (!isObjectEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Actor', name: a.name }))
        await a.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Migrate World Items
  for (const i of game.items.entities) {
    try {
      const updateData = migrateItemData(i.data)
      if (!isObjectEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Item', name: i.name }))
        await i.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Migrate Actor Override Tokens
  for (const s of game.scenes.entities) {
    try {
      const updateData = migrateSceneData(s.data)
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
    return (p.metadata.package === 'world') && ['Actor', 'Item', 'Scene'].includes(p.metadata.entity)
  })
  for (const p of packs) {
    await migrateCompendium(p)
  }

  // Set the migration as complete
  // parseFloat will pull out the major and minor version ignoring the patch version
  game.settings.set('dcc', 'systemMigrationVersion', parseFloat(game.system.data.version))
  ui.notifications.info(game.i18n.format('DCC.MigrationComplete', { systemVersion: game.system.data.version }, { permenant: true }))
}

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @return {Promise}
 */
export const migrateCompendium = async function (pack) {
  const entity = pack.metadata.entity
  if (!['Actor', 'Item', 'Scene'].includes(entity)) return

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate()
  const content = await pack.getContent()

  // Iterate over compendium entries - applying fine-tuned migration functions
  for (const ent of content) {
    try {
      let updateData = null
      if (entity === 'Item') updateData = migrateItemData(ent.data)
      else if (entity === 'Actor') updateData = migrateActorData(ent.data)
      else if (entity === 'Scene') updateData = migrateSceneData(ent.data)
      if (!isObjectEmpty(updateData)) {
        expandObject(updateData)
        updateData.id = ent.id
        await pack.updateEntity(updateData)
        console.log(`Migrated ${entity} entity ${ent.name} in Compendium ${pack.collection}`)
      }
    } catch (err) {
      console.error(err)
    }
  }
  console.log(`Migrated all ${entity} entities from Compendium ${pack.collection}`)
}

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor entity to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
export const migrateActorData = function (actor) {
  const updateData = {
    // Add useDisapprovalRange to cleric skills
    'data.skills.divineAid.useDisapprovalRange': true,
    'data.skills.turnUnholy.useDisapprovalRange': true,
    'data.skills.layOnHands.useDisapprovalRange': true
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
        return mergeObject(i, itemUpdate, { enforceTypes: false, inplace: false })
      } else {
        return i
      }
    })
  }

  // Create new items from legacy weapons and armor
  if (actor.data.items) {
    // Clear out the legacy items to avoid duplication on future migrations
    updateData['data.items'] = null

    // Migrate any legacy weapons...
    if (actor.data.items.weapons) {
      const m1 = _migrateWeapon(actor.data.items.weapons.m1, false)
      const m2 = _migrateWeapon(actor.data.items.weapons.m2, false)
      const r1 = _migrateWeapon(actor.data.items.weapons.r1, true)
      const r2 = _migrateWeapon(actor.data.items.weapons.r2, true)
      if (m1) { items.push(m1) }
      if (m2) { items.push(m2) }
      if (r1) { items.push(r1) }
      if (r2) { items.push(r2) }
    }

    // ... and armor
    if (actor.data.items.armor) {
      const a0 = _migrateArmor(actor.data.items.armor.a0)
      if (a0) {
        items.push(a0)
      }
    }

    hasItemUpdates = true
  }

  if (hasItemUpdates) {
    updateData.items = items
  }
  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Item entity to incorporate latest data model changes
 * @param item
 */
export const migrateItemData = function (item) {
  const updateData = {}

  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')

  // If migrating from 0.11 mark all physicalItems as equipped
  if ((currentVersion <= 0.11) || (currentVersion == null)) {
    if (item.data.equipped !== undefined) {
      updateData.data = { equipped: true }
    }
  }

  // If migrating from 0.21 mark all spells as inheritActionDie
  if ((currentVersion <= 0.21) || (currentVersion == null)) {
    if (item.type === 'spell' && !item.data.config.inheritActionDie) {
      updateData.data = {
        config: {
          inheritActionDie: true
        }
      }
    }
  }

  // If migrating from 0.22 mark all spells as castingMode: wizard
  if ((currentVersion <= 0.22) || (currentVersion == null)) {
    if (item.type === 'spell' && !item.data.config.castingMode) {
      updateData.data = {
        config: {
          castingMode: 'wizard'
        }
      }
    }
  }

  // Return the migrated update data
  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Object}       The updateData to apply
 */
export const migrateSceneData = function (scene) {
  const tokens = duplicate(scene.tokens)
  return {
    tokens: tokens.map(t => {
      if (!t.actorId || t.actorLink || !t.actorData.data) {
        t.actorData = {}
        return t
      }
      const token = new Token(t)
      if (!token.actor) {
        t.actorId = null
        t.actorData = {}
      } else if (!t.actorLink) {
        const updateData = migrateActorData(token.data.actorData)
        t.actorData = mergeObject(token.data.actorData, updateData)
      }
      return t
    })
  }
}

/* -------------------------------------------- */
/*  Migration utilities
/* -------------------------------------------- */

/**
 * Create an embedded object from a legacy weapon object
 *
 * @param {Object} weapon   The legacy weapon object.
 * @param {Object} ranged   Indicate that a ranged weapon should be created.
 * @return {Object}         The newly created item
 */
const _migrateWeapon = function (weapon, ranged = false) {
  if (!weapon.name) { return }
  const weaponData = {
    name: weapon.name,
    type: 'weapon',
    data: {
      config: {
        inheritActionDie: true
      },
      actionDie: '1d20',
      toHit: weapon.toHit,
      damage: weapon.damage,
      range: weapon.range,
      twoHanded: false,
      melee: !ranged,
      backstab: false,
      backstabDamage: null,
      description: {
        value: weapon.notes
      },
      quantity: 1,
      weight: 0,
      equipped: true,
      identified: true,
      value: {
        gp: 0,
        sp: 0,
        cp: 0
      }
    }
  }

  return weaponData
}

/**
 * Create an embedded object from a legacy armor object
 *
 * @param {Object} armor    The legacy armor object.
 * @return {Object}         The newly created item
 */
const _migrateArmor = function (armor) {
  if (!armor.name) { return }
  const armorData = {
    name: armor.name,
    type: 'armor',
    data: {
      acBonus: armor.bonus,
      checkPenalty: armor.checkPenalty,
      speed: '+0',
      fumbleDie: armor.fumbleDie,
      description: {
        value: armor.notes
      },
      quantity: 1,
      weight: 0,
      equipped: true,
      identified: true,
      value: {
        gp: 0,
        sp: 0,
        cp: 0
      }
    }
  }

  return armorData
}
