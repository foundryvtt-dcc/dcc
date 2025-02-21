/* global Item, game, ui, ChatMessage, Roll, CONFIG, CONST */

import DiceChain from './dice-chain.js'
import { ensurePlus, getFirstDie } from './utilities.js'

// noinspection JSUnusedGlobalSymbols
/**
 * Extend the base Item entity for DCC RPG
 * @extends {Item}
 */
class DCCItem extends Item {
  prepareBaseData () {
    super.prepareBaseData()

    // Non-actor-owned items
    if (this.type === 'weapon' && !this.actor) {
      this.system.attackBonus = ''
      this.system.toHit = ''
    }

    this.isNPC = (this.actor?.type === 'NPC')
    this.isPC = (this.actor?.type === 'Player')

    // NPC Weapon Items
    if (this.type === 'weapon' && this.isNPC) {
      // Action Die Calculation
      this.system.actionDie = this.actor?.system?.attributes?.actionDice?.value || ''
      if (this.system.config.actionDieOverride) {
        this.system.actionDie = this.system.config.actionDieOverride
      }
      if (!this.system.damage && this.system.damageWeapon) {
        this.system.damage = this.system.damageWeapon
      }
    }

    // PC Weapon Items or Un-owned Items
    if (this.type === 'weapon' && this.isPC) {
      // Initiative Calculation
      this.system.initiativeDie = this.actor?.system?.attributes?.init?.die || '1d20'
      if (this.system.twoHanded) {
        this.system.initiativeDie = DiceChain.bumpDie(this.system.initiativeDie, -1)
      }
      if (this.system.config.initiativeDieOverride) {
        this.system.initiativeDie = this.system.config.initiativeDieOverride
      }
      this.system.initiativeBonus = ensurePlus(this.actor?.system?.attributes?.init?.value || '')
      if (this.system.initiativeWeaponBonus) {
        this.system.initiativeBonus = `${this.system.initiativeBonus}${this.system.initiativeWeaponBonus}`
      }
      if (this.system.config.initiativeBonusOverride) {
        this.system.initiativeBonus = this.system.config.initiativeBonusOverride
      }

      // Action Die Calculation
      this.system.actionDie = this.actor?.system?.attributes?.actionDice?.value || ''
      if (!this.system.trained) {
        this.system.actionDie = `${DiceChain.bumpDie(this.system.actionDie, -1)}[untrained]`
      }
      if (this.system.config.actionDieOverride) {
        this.system.actionDie = this.system.config.actionDieOverride
      }

      // To-Hit Calculation
      if (this.system.melee) {
        this.system.attackBonus = this.actor?.system?.details?.attackHitBonus?.melee?.value || '+0'
      } else {
        this.system.attackBonus = this.actor?.system?.details?.attackHitBonus?.missile?.value || '+0'
      }
      if (this.system.attackBonusWeapon) {
        this.system.attackBonus = `${this.system.attackBonus}${this.system.attackBonusWeapon}`
      }
      if (this.system.attackBonusLucky) {
        this.system.attackBonus = `${this.system.attackBonus}${this.system.attackBonusLucky}`
      }
      this.system.toHit = ensurePlus(this.system.attackBonus.includes('d') ? this.system.attackBonus : Roll.safeEval(this.system.attackBonus))
      if (this.system.config.attackBonusOverride) {
        this.system.toHit = ensurePlus(this.system.config.attackBonusOverride)
      }

      // Damage Calculation
      // First handle older items that may not have damageWeapon set
      if (this.system.damage && !this.system.damageWeapon) {
        // Refresh actor data if this is an owned item
        if (this.actor) {
          this.actor.prepareBaseData()
        }

        // Get the first die of the damage and see if that can be the weapon damage
        // Otherwise set the current damage value as the override
        const damageWeapon = getFirstDie(this.system.damage) || ''
        if (damageWeapon) {
          let total = `${damageWeapon}${this.actor?.system?.details?.attackDamageBonus?.melee?.value || ''}`
          if (!this.system?.melee) {
            total = `${damageWeapon}${this.actor?.system?.details?.attackDamageBonus?.missile?.value || ''}`
          }
          if (this.system.damage === total || this.system.damage === total.replaceAll('+0', '')
          ) {
            this.system.damage = this.actor?.system?.details?.attackDamageBonus?.melee?.value || ''
            this.system.damageWeapon = damageWeapon
          } else {
            this.system.config.damageOverride = this.system.damage
          }
        } else {
          if (this.system.damage !== '+0') {
            this.system.config.damageOverride = this.system.damage
          }
        }
      }

      // Next calculate the correct value from the weapon damage and other settings

      // Start by setting the damage to any bonus from the actor
      if (this.system.melee) {
        this.system.damage = this.actor?.system?.details?.attackDamageBonus?.melee?.value || ''
      } else {
        this.system.damage = this.actor?.system?.details?.attackDamageBonus?.missile?.value || ''
      }

      // Then add in any weapon bonus - formatting dependent on whether there is a deed from the actor
      if (this.system.damageWeaponBonus) {
        if (this.system.damage.includes('d') || this.system.damageWeaponBonus.includes('d')) {
          this.system.damage = `${this.system.damage}${this.system.damageWeaponBonus}`
        } else {
          this.system.damage = ensurePlus(Roll.safeEval(`${this.system.damage}${this.system.damageWeaponBonus}`))
        }
      }
      if (this.system.doubleIfMounted) {
        this.system.damage = `(${this.system.damageWeapon})*2${this.system.damage}`
      } else {
        this.system.damage = `${this.system.damageWeapon}${this.system.damage}`
      }
      if (this.system.subdual) {
        this.system.damage = `${this.system.damage}[subdual]`
      }
      if (this.system.config.damageOverride) {
        this.system.damage = this.system?.config?.damageOverride
      }
    }

    // Crit Calculation
    this.system.critRange = this.system?.config?.critRangeOverride || this.actor?.system?.details?.critRange || 20
    this.system.critDie = this.system?.config?.critDieOverride || this.actor?.system?.attributes?.critical?.die || '1d4'
    this.system.critTable = this.system?.config?.critTableOverride || this.actor?.system?.attributes?.critical?.table || 'I'

    if (this.type === 'spell') {
      // Spells can use the owner's action die for the spell check
      if (this.system.config.inheritActionDie) {
        this.system.spellCheck.die = this.actor?.system?.attributes?.actionDice?.value || '1d20'
        if (this.actor?.system?.class?.spellCheckOverrideDie) {
          this.system.spellCheck.die = this.actor?.system?.class?.spellCheckOverrideDie
        }
      }

      // Spells can inherit the owner's spell check
      if (this.system.config.inheritSpellCheck) {
        this.system.spellCheck.value = this.actor?.system?.class?.spellCheck || '+0'
      }

      // Spells can inherit the owner's check penalty
      if (this.system.config.inheritCheckPenalty) {
        this.system.spellCheck.penalty = this.actor?.system?.attributes?.ac?.checkPenalty || ''
      }
    }
  }

  /**
   * Roll a Spell Check using this item
   * @param {String} abilityId    The ability used for this spell
   * @param options
   */
  async rollSpellCheck (abilityId = '', options = {}) {
    if (this.type !== 'spell') { return }

    const actor = this.actor || this.parent

    if (this.system.lost && game.settings.get('dcc', 'automateWizardSpellLoss') && this.system.config.castingMode === 'wizard') {
      return ui.notifications.warn(game.i18n.format('DCC.SpellLostWarning', {
        actor: actor.name,
        spell: this.name
      }))
    }

    const ability = actor.system.abilities[abilityId] || {}
    ability.label = CONFIG.DCC.abilities[abilityId]
    const spell = this.name
    options.title = game.i18n.format('DCC.RollModifierTitleCasting', { spell })
    const die = this.system.spellCheck.die
    let bonus = this.system.spellCheck.value.toString()

    // Consolidate the spell check value so that the modifier dialog is not too wide
    // Unless people are using variables, in which case the DCC roll parser needs to deal with those
    if (bonus.includes('@')) {
      bonus = Roll.safeEval(bonus)
    }

    // Calculate check penalty if relevant
    let checkPenalty
    if (this.system.config.inheritCheckPenalty) {
      checkPenalty = parseInt(actor.system.attributes.ac.checkPenalty || '0')
    } else {
      checkPenalty = parseInt(this.system.spellCheck.penalty || '0')
    }

    // Determine the casting mode
    const castingMode = this.system.config.castingMode || 'wizard'

    // Collate terms for the roll
    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die
      },
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.SpellCheck'),
        formula: bonus
      },
      {
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: castingMode === 'wizard' // Idol magic does not incur a checkPenalty
      }
    ]

    // Clerics cannot spellburn
    if (castingMode !== 'cleric') {
      terms.push({
        type: 'Spellburn',
        formula: '+0',
        str: actor.system.abilities.str.value,
        agl: actor.system.abilities.agl.value,
        sta: actor.system.abilities.sta.value,
        callback: (formula, term) => {
          // Apply the spellburn
          actor.update({
            'system.abilities.str.value': term.str,
            'system.abilities.agl.value': term.agl,
            'system.abilities.sta.value': term.sta
          })
        }
      })
    }

    // Roll the spell check
    const roll = await game.dcc.DCCRoll.createRoll(terms, actor.getRollData(), options)
    await roll.evaluate()

    if (roll.dice.length > 0) {
      roll.dice[0].options.dcc = {
        lowerThreshold: actor.system.class.disapproval
      }
    }

    // Lookup the appropriate table
    const resultsRef = this.system.results
    if (!resultsRef.table) {
      return ui.notifications.warn(game.i18n.localize('DCC.NoSpellResultsTableWarning'))
    }
    const predicate = t => t.name === resultsRef.table || t._id === resultsRef.table.replace('RollTable.', '')
    let resultsTable
    // If a collection is specified then check the appropriate pack for the spell
    if (resultsRef.collection) {
      const pack = game.packs.get(resultsRef.collection)
      if (pack) {
        await pack.getIndex()
        const entry = pack.index.find(predicate)
        resultsTable = await pack.getDocument(entry._id)
      }
    }
    // Otherwise fall back to searching the world
    if (!resultsTable) {
      resultsTable = game.tables.contents.find(predicate)
    }

    let flavor = spell
    if (ability.label) {
      flavor += ` (${game.i18n.localize(ability.label)})`
    }

    // Tell the system to handle the spell check result
    await game.dcc.processSpellCheck(actor, {
      rollTable: resultsTable,
      roll,
      item: this,
      flavor,
      manifestation: this.system?.manifestation?.displayInChat ? this.system?.manifestation : {},
      mercurial: this.system?.mercurialEffect?.displayInChat ? this.system?.mercurialEffect : {}
    })
  }

  /**
   * Check for an existing manifestation
   * @return
   */
  hasExistingManifestation () {
    return this.system?.manifestation?.value || this.system?.manifestation?.description
  }

  /**
   * Check for an existing mercurial magic effect
   * @return
   */
  hasExistingMercurialMagic () {
    return this.system?.mercurialEffect?.value || this.system?.mercurialEffect?.summary || this.system.mercurialEffect.description
  }

  /**
   * Roll a or lookup new manifestation for a spell item
   * @param {Number} lookup   Optional entry number to lookup instead of rolling
   * @param options
   * @return
   */
  async rollManifestation (lookup = undefined, options = {}) {
    if (this.type !== 'spell') { return }

    const actor = this.actor
    if (!actor) { return }

    let roll

    if (lookup) {
      // Look up a manifestation by value
      roll = new Roll('@value', {
        value: lookup
      })
    } else {
      const terms = [
        {
          type: 'Die',
          formula: '1d100'
        }
      ]

      // Otherwise roll for a manifestation
      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)
    }

    // Lookup the manifestation table if available
    let manifestationResult = null
    const manifestationPackName = game.settings.get('dcc', 'spellSideEffectsCompendium') || 'dcc-core-book.dcc-core-spell-side-effect-tables'
    const manifestationTableName = `${this.name} Manifestation`
    const pack = game.packs.get(manifestationPackName)
    if (pack) {
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find((entity) => entity.name === manifestationTableName)
      if (entry) {
        const table = await pack.getDocument(entry._id)
        manifestationResult = await table.draw({ roll })
      } else {
        console.warn(game.i18n.localize('DCC.SpellSideEffectsCompendiumNotFoundWarning'))
      }
    }

    // Local Lookup
    if (!manifestationResult) {
      const table = game.tables.getName(manifestationTableName)
      if (table) {
        manifestationResult = await table.draw({ roll })
      }
    }

    // Grab the result from the table if present
    if (manifestationResult) {
      roll = manifestationResult.roll
    } else {
      // Fall back to displaying just the roll
      await roll.evaluate()
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: game.i18n.localize('DCC.ManifestationRoll'),
        flags: {
          'dcc.RollType': 'Manifestation'
        }
      })
    }

    // Stow away the data in the appropriate fields
    const updates = {}
    updates['system.manifestation.value'] = roll.total
    updates['system.manifestation.description'] = ''

    if (manifestationResult) {
      try {
        let result = manifestationResult.results[0].text.replace(';', '')
        result = result.charAt(0).toUpperCase() + result.slice(1)
        updates['system.manifestation.description'] = `<p>${result}</p>`
      } catch (err) {
        console.error(`Couldn't extract Manifestation result from table:\n${err}`)
      }
    }

    this.update(updates)
  }

  /**
   * Roll a or lookup new mercurial effect for a spell item
   * @param {Number} lookup   Optional entry number to lookup instead of rolling
   * @param options
   * @return
   */
  async rollMercurialMagic (lookup = undefined, options = {}) {
    if (this.type !== 'spell') { return }

    const actor = this.actor
    if (!actor) { return }

    const abilityId = 'lck'
    const ability = actor.system.abilities[abilityId]
    ability.label = CONFIG.DCC.abilities[abilityId]

    let roll

    if (lookup) {
      // Look up a mercurial effect by value
      roll = new Roll('@value', {
        value: lookup
      })
    } else {
      const modifier = (ability.mod * 10).toString()
      const terms = [
        {
          type: 'Die',
          formula: '1d100'
        },
        {
          type: 'Modifier',
          label: game.i18n.localize('DCC.AbilityLck'),
          formula: ensurePlus(modifier)
        }
      ]

      // Otherwise roll for a mercurial effect
      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)
    }

    // Lookup the mercurial magic table if available
    let mercurialMagicResult = null
    const mercurialMagicTableName = CONFIG.DCC.mercurialMagicTable
    if (mercurialMagicTableName) {
      const mercurialMagicTablePath = mercurialMagicTableName.split('.')
      let pack
      if (mercurialMagicTablePath.length === 3) {
        pack = game.packs.get(mercurialMagicTablePath[0] + '.' + mercurialMagicTablePath[1])
      }
      if (pack) {
        await pack.getIndex() // Load the compendium index
        const entry = pack.index.find((entity) => entity.name === mercurialMagicTablePath[2])
        if (entry) {
          const table = await pack.getDocument(entry._id)
          mercurialMagicResult = await table.draw({ roll })
        }
      }
    }

    // Grab the result from the table if present
    if (mercurialMagicResult) {
      roll = mercurialMagicResult.roll
    } else {
      // Fall back to displaying just the roll
      await roll.evaluate()
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: game.i18n.localize('DCC.MercurialMagicRoll'),
        flags: {
          'dcc.RollType': 'MercurialMagic'
        }
      })
    }

    // Stow away the data in the appropriate fields
    const updates = {}
    updates['system.mercurialEffect.value'] = roll.total
    updates['system.mercurialEffect.summary'] = ''
    updates['system.mercurialEffect.description'] = ''

    if (mercurialMagicResult) {
      try {
        const result = mercurialMagicResult.results[0].text
        const split = result.split('.')
        updates['system.mercurialEffect.summary'] = split[0]
        updates['system.mercurialEffect.description'] = `<p>${result}</p>`
      } catch (err) {
        console.error(`Couldn't extract Mercurial Magic result from table:\n${err}`)
      }
    }

    this.update(updates)
  }

  /**
   * Determine if this item needs to have its treasure value rolled
   * @return {Boolean}  True if any value field contains a rollable formula
   */
  needsValueRoll () {
    for (const currency in CONFIG.DCC.currencies) {
      const formula = this.system.value[currency]
      if (!formula) continue
      try {
        const roll = new Roll(formula.toString())
        if (!roll.isDeterministic) {
          return true
        }
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    return false
  }

  /**
   * Roll to determine the value of this item
   */
  async rollValue () {
    const updates = {}
    const valueRolls = {}

    for (const currency in CONFIG.DCC.currencies) {
      const formula = this.system.value[currency] || '0'
      try {
        const roll = new Roll(formula.toString())
        await roll.evaluate()
        updates['system.value.' + currency] = roll.total
        valueRolls[currency] = `<a class="inline-roll inline-result" data-roll="${encodeURIComponent(JSON.stringify(roll))}" title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}"><i class="fas fa-dice-d20"></i> ${roll.total}</a>`
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    const speaker = { alias: this.actor.name, id: this.actor.id }
    const messageData = {
      user: game.user.id,
      speaker,
      type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: game.i18n.format('DCC.ResolveValueEmote', {
        itemName: this.name,
        pp: valueRolls.pp,
        ep: valueRolls.ep,
        gp: valueRolls.gp,
        sp: valueRolls.sp,
        cp: valueRolls.cp
      }),
      sound: CONFIG.sounds.dice,
      flags: {
        'dcc.RollType': 'LootValue'
      }
    }
    await CONFIG.ChatMessage.documentClass.create(messageData)

    this.update(updates)
  }

  /**
   * Shift currency to the next highest denomination
   */
  async convertCurrencyUpward (currency) {
    const currencyRank = CONFIG.DCC.currencyRank
    const currencyValue = CONFIG.DCC.currencyValue
    // Don't do currency conversions if the value isn't resolved
    if (this.needsValueRoll()) {
      return
    }
    // Find the rank of this currency
    const rank = currencyRank.indexOf(currency)
    // Make sure there's a currency to convert to
    if (rank >= 0 && rank < currencyRank.length - 1) {
      // What are we converting to?
      const toCurrency = currencyRank[rank + 1]
      // Calculate the conversion factor
      const conversionFactor = currencyValue[toCurrency] / currencyValue[currency]
      // Check we have enough currency
      if (this.system.value[currency] >= conversionFactor) {
        // Apply the conversion
        const updates = {}
        updates[`system.value.${currency}`] = parseInt(this.system.value[currency]) - conversionFactor
        updates[`system.value.${toCurrency}`] = parseInt(this.system.value[toCurrency]) + 1
        this.update(updates)
      }
    }
  }

  /**
   * Shift currency to the next lowest denomination
   */
  async convertCurrencyDownward (currency) {
    const currencyRank = CONFIG.DCC.currencyRank
    const currencyValue = CONFIG.DCC.currencyValue
    // Don't do currency conversions if the value isn't resolved
    if (this.needsValueRoll()) {
      return
    }
    // Find the rank of this currency
    const rank = currencyRank.indexOf(currency)
    // Make sure there's a currency to convert to
    if (rank >= 1) {
      // What are we converting to?
      const toCurrency = currencyRank[rank - 1]
      // Check we have enough currency
      if (this.system.value[currency] >= 1) {
        // Calculate the conversion factor
        const conversionFactor = currencyValue[currency] / currencyValue[toCurrency]
        // Apply the conversion
        const updates = {}
        updates[`system.value.${currency}`] = parseInt(this.system.value[currency]) - 1
        updates[`system.value.${toCurrency}`] = parseInt(this.system.value[toCurrency]) + conversionFactor
        this.update(updates)
      }
    }
  }
}

export default DCCItem
