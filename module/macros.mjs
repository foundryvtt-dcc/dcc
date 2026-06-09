/* global ChatMessage, CONFIG, game, Macro, ui */

/**
 * Hotbar macro factories extracted from `module/dcc.js`.
 *
 * Each `_createDCCXxxMacro` function is pure — it inspects the dropped data,
 * returns a `{ name, command, img }` config object, and never touches Foundry
 * state. The dispatcher `createDCCMacro` matches on `data.type`, delegates,
 * and creates / reuses the macro on the user's hotbar.
 *
 * `rollDCCWeaponMacro`, `getMacroActor`, and `getMacroOptions` are the
 * runtime macro surface published to end-user macro scripts via
 * `game.dcc.*` — see `docs/dev/EXTENSION_API.md` "Internal (no external
 * references)" for the de-facto-stable contract.
 */

import EntityImages from './entity-images.js'

/**
 * Create a macro from an ability check drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCAbilityMacro (data) {
  if (data.type !== 'Ability') return

  // Create the macro command
  const abilityId = data.data.abilityId
  const rollUnder = data.data.rollUnder
  const macroData = {
    name: game.i18n.localize(CONFIG.DCC.abilities[abilityId]),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollAbilityCheck("${abilityId}", Object.assign({ rollUnder: ${rollUnder} }, game.dcc.getMacroOptions())) }`,
    img: EntityImages.imageForMacro(abilityId, rollUnder ? 'abilityRollUnder' : 'ability')
  }

  // If this is a roll under check make it clear in the macro name
  if (rollUnder) {
    macroData.name = game.i18n.format('DCC.RollUnder', { name: macroData.name })
  }

  return macroData
}

/**
 * Create a macro from an initiative drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCInitiativeMacro (data) {
  if (data.type !== 'Initiative') return

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.Initiative'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollInit(event, token) }`,
    img: EntityImages.imageForMacro('initiative')
  }
}

/**
 * Create a macro from a hit dice drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCHitDiceMacro (data) {
  if (data.type !== 'Hit Dice') return

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.HitDiceRoll'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollHitDice(game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(data.data.dice), 'hitDice')
  }
}

/**
 * Create a macro from a saving throw drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCSaveMacro (data) {
  if (data.type !== 'Save') return

  // Create the macro command
  const saveId = data.data
  return {
    name: game.i18n.localize(CONFIG.DCC.saves[saveId]),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSavingThrow("${saveId}", game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(saveId, 'savingThrow')
  }
}

/**
 * Create a macro from a skill roll drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCSkillMacro (data) {
  if (data.type !== 'Skill') return

  // Create the macro command
  const skillId = data.data.skillId
  const skillName = game.i18n.localize(data.data.skillName)
  return {
    name: skillName,
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSkillCheck("${skillId}", game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(skillId, 'skillCheck')
  }
}

/**
 * Create a macro from a luck die drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCLuckDieMacro (data) {
  if (data.type !== 'Luck Die') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.LuckDie'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollLuckDie(game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'luckDie')
  }
}

/**
 * Create a macro from a spell check drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCSpellCheckMacro (data) {
  if (data.type !== 'Spell Check') return

  // Create the macro command
  const spell = data.data.name || null
  const img = data.data.img || null
  const itemId = data.data.itemId || null

  const macroData = {
    name: spell || game.i18n.localize('DCC.SpellCheck'),
    img: img || EntityImages.imageForMacro('spellCheck')
  }

  // If we have an itemId, create an item-based macro
  if (itemId) {
    const uuid = `Actor.${data.actorId}.Item.${itemId}`
    macroData.command = `const _item = await fromUuid("${uuid}"); if (_item) { _item.rollSpellCheck() }`
  } else if (spell) {
    // Fallback to actor-based spell check with spell name
    macroData.command = `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSpellCheck(Object.assign({ spell: "${spell}" }, game.dcc.getMacroOptions())) }`
  } else {
    // Generic spell check
    macroData.command = `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSpellCheck() }`
  }

  return macroData
}

/**
 * Create a macro from an attack bonus drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCAttackBonusMacro (data) {
  if (data.type !== 'Attack Bonus') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.AttackBonus'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollAttackBonus(game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'attackBonus')
  }
}

/**
 * Create a macro from an action die drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCActionDiceMacro (data) {
  if (data.type !== 'Action Dice') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.format('DCC.ActionDiceMacroName', { die }),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.setActionDice('${die}') }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'defaultDice')
  }
}

/**
 * Create a Macro from a weapon drop.
 * Get an existing macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCWeaponMacro (data) {
  if (data.type !== 'Weapon') return
  const weapon = data.system.weapon
  const backstab = data.system?.backstab
  const options = {
    backstab
  }

  const macroData = {
    name: weapon.name,
    command: `game.dcc.rollDCCWeaponMacro("${weapon._id}", "${data.actorId}", Object.assign(${JSON.stringify(options)}, game.dcc.getMacroOptions()));`,
    img: weapon.img
  }

  // Replace missing or default weapon icon with our default
  if (!macroData.img || macroData.img === 'icons/svg/mystery-man.svg') {
    macroData.img = EntityImages.imageForItem(weapon.type)
  }

  // If dragging a backstab use the backstab icon
  if (backstab) {
    macroData.img = EntityImages.imageForMacro('backstab')
  }

  return macroData
}

/**
 * Create a macro from an item drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCItemMacro (data) {
  if (data.type !== 'Item' && data.type !== 'DCC Item') return

  const item = data.system.item || data.data
  if (!item) return

  // Generate the UUID for the item
  const uuid = `Actor.${data.actorId}.Item.${item._id}`

  // Handle spell items
  if (item.type === 'spell') {
    return {
      name: item.name,
      command: `const _item = await fromUuid("${uuid}"); if (_item) { _item.rollSpellCheck() }`,
      img: item.img
    }
  }

  // For other item types, create a generic macro
  return {
    name: item.name,
    command: `const _item = await fromUuid("${uuid}"); if (_item) { _item.roll() }`,
    img: item.img || EntityImages.imageForItem(item.type)
  }
}

/**
 * Apply disapproval to an actor
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCApplyDisapprovalMacro (data) {
  if (data.type !== 'Apply Disapproval') return

  // Create the macro command
  return {
    name: game.i18n.format('DCC.ApplyDisapprovalMacroName'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.applyDisapproval() }`,
    img: EntityImages.imageForMacro('applyDisapproval')
  }
}

/**
 * Roll disapproval for an actor
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
export function _createDCCRollDisapprovalMacro (data) {
  if (data.type !== 'Roll Disapproval') return

  // Create the macro command
  return {
    name: game.i18n.format('DCC.RollDisapprovalMacroName'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollDisapproval() }`,
    img: EntityImages.imageForMacro('rollDisapproval')
  }
}

/**
 * Dispatch table mapping each `data.type` to the factory that builds its
 * macro config. Exposed for unit tests; production code reaches it via
 * `createDCCMacro`.
 */
export const MACRO_FACTORIES = {
  Ability: _createDCCAbilityMacro,
  Initiative: _createDCCInitiativeMacro,
  'Hit Dice': _createDCCHitDiceMacro,
  Save: _createDCCSaveMacro,
  Skill: _createDCCSkillMacro,
  'Luck Die': _createDCCLuckDieMacro,
  'Spell Check': _createDCCSpellCheckMacro,
  'Attack Bonus': _createDCCAttackBonusMacro,
  'Action Dice': _createDCCActionDiceMacro,
  Weapon: _createDCCWeaponMacro,
  Item: _createDCCItemMacro,
  'DCC Item': _createDCCItemMacro,
  'Apply Disapproval': _createDCCApplyDisapprovalMacro,
  'Roll Disapproval': _createDCCRollDisapprovalMacro
}

/**
 * Create a Macro from a hotbar drop.
 * Dispatch to the appropriate function for the item type
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createDCCMacro (data, slot) {
  // Pull out the DCC data from the drop handler (it may be packaged inside Foundry Item data)
  if (data.dccType) {
    data.type = data.dccType
    delete data.dccType
  }
  if (data.dccData) {
    data.system = data.dccData
    delete data.dccData
  }
  if (!data.type || data.type === 'Macro') return true
  if (!('data' in data)) return true
  if (!MACRO_FACTORIES[data.type]) return true

  // Call the appropriate function to generate a macro
  const macroData = MACRO_FACTORIES[data.type](data, slot)
  if (macroData) {
    // Create or reuse existing macro
    let macro = game.macros.contents.find(m => (m.name === macroData.name) && (m.command === macroData.command))
    if (!macro) {
      macro = await Macro.create({
        name: `${macroData.name}-${data.actorId}`,
        type: 'script',
        img: macroData.img,
        command: macroData.command,
        flags: { 'dcc.itemMacro': true }
      })
    }

    // Assign the macro to the hotbar slot
    await game.user.assignHotbarMacro(macro, slot)
    return false // Prevent Foundry's default behavior
  }
  return true
}

/**
 * Roll a weapon attack from a macro.
 * @param {string} itemId
 * @param {string} actorId
 * @param {Object} options
 * @return {Promise}
 */
export function rollDCCWeaponMacro (itemId, actorId, options = {}) {
  /** @type {DCCActor} */
  const actor = game.actors.get(actorId)

  // Trigger the weapon roll
  return actor.rollWeaponAttack(itemId, options)
}

/**
 * Get the current actor - for use in macros
 * @return {Object}
 */
export function getMacroActor (actorId = null) {
  if (actorId) {
    return game.actors.get(actorId)
  }
  const speaker = ChatMessage.getSpeaker()
  let actor
  if (speaker.token) actor = game.actors.tokens[speaker.token]
  if (!actor) actor = game.actors.get(speaker.actor)
  if (!actor) return ui.notifications.warn(game.i18n.localize('DCC.MacroNoTokenSelected'))

  // Return the actor if found
  return actor
}

/**
 * Get global options for use in macros
 * @return {Object}
 */
export function getMacroOptions () {
  const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
  return {
    showModifierDialog: rollModifierDefault ^ game.dcc.KeyState.ctrlKey
  }
}
