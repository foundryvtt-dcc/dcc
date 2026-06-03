/* global Item, game, ui, ChatMessage, Roll, CONFIG, CONST, Dialog */

import DiceChain from './dice-chain.js'
import { ensurePlus, getFirstDie } from './utilities.js'
import { ContainerItemMixin } from './item/container-mixin.mjs'
import { CurrencyItemMixin } from './item/currency-mixin.mjs'

// noinspection JSUnusedGlobalSymbols
/**
 * Extend the base Item entity for DCC RPG.
 * Container-support members (weight/capacity/depth getters + containment
 * validation) live in {@link ContainerItemMixin}; treasure-value / currency
 * members live in {@link CurrencyItemMixin}. See `module/item/`.
 * @extends {Item}
 */
class DCCItem extends CurrencyItemMixin(ContainerItemMixin(Item)) {
  prepareBaseData () {
    super.prepareBaseData()

    // Backwards compatibility: set useSummary if freeform is true
    if (this.type === 'skill' && this.system.config.freeform && !this.system.config.useSummary) {
      this.system.config.useSummary = true
    }

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
        this.system.actionDie = `${DiceChain.bumpDie(this.system.actionDie, -1)}[${game.i18n.localize('DCC.untrained')}]`
      }

      // Two-Weapon Fighting Dice Modifications
      if (this.system.twoWeaponPrimary || this.system.twoWeaponSecondary) {
        const agilityScore = this.actor?.system?.abilities?.agl?.value || 0
        const isHalfling = this.actor?.classId === 'halfling'

        // Calculate dice penalty based on agility and weapon hand
        let dicePenalty = 0
        let effectiveAgility = agilityScore

        // Halflings have special rules - minimum effective agility of 16
        if (isHalfling) {
          effectiveAgility = Math.max(agilityScore, 16)
        }

        // Determine dice penalty based on agility and weapon type
        if (effectiveAgility <= 8) {
          dicePenalty = this.system.twoWeaponPrimary ? -3 : -4
        } else if (effectiveAgility >= 9 && effectiveAgility <= 11) {
          dicePenalty = this.system.twoWeaponPrimary ? -2 : -3
        } else if (effectiveAgility >= 12 && effectiveAgility <= 15) {
          dicePenalty = this.system.twoWeaponPrimary ? -1 : -2
        } else if (effectiveAgility >= 16 && effectiveAgility <= 17) {
          dicePenalty = -1 // Both hands get -1 die
        } else if (effectiveAgility >= 18) {
          dicePenalty = this.system.twoWeaponPrimary ? 0 : -1
        }

        // Apply the dice penalty
        if (dicePenalty !== 0) {
          const tag = this.system.twoWeaponPrimary ? game.i18n.localize('DCC.2w-primary') : game.i18n.localize('DCC.2w-off-hand')
          this.system.actionDie = `${DiceChain.bumpDie(this.system.actionDie, dicePenalty)}[${tag}]`
        }

        // Two-Weapon Fighting Critical Hit Adjustments (after dice modifications)
        let twoWeaponCritSet = false
        if (isHalfling && effectiveAgility <= 17) {
          // Halflings score crit and automatic hit on natural 16 when fighting two-weapon
          // BUT if agility is 18+, they use normal two-weapon fighting rules instead
          this.system.critRange = 16
          twoWeaponCritSet = true
        } else {
          // Non-halflings have restricted critical hit ability when fighting two-handed
          if (effectiveAgility <= 15) {
            // Cannot score critical hits
            this.system.critRange = 21 // No critical hits possible (impossible to roll >= 21 on d20)
            twoWeaponCritSet = true
          } else if (effectiveAgility >= 16 && effectiveAgility <= 17) {
            // Primary hand scores critical on max die roll that also beats AC
            if (this.system.twoWeaponPrimary) {
              // Get the current action die size to determine max roll (after penalties)
              const actionDie = this.system.actionDie || '1d20'
              const dieFaces = parseInt(actionDie.match(/d(\d+)/)?.[1] || '20')
              this.system.critRange = dieFaces
              twoWeaponCritSet = true
            } else {
              this.system.critRange = 51 // Secondary hand cannot crit
              twoWeaponCritSet = true
            }
          } else if (effectiveAgility >= 18) {
            // Primary hand scores crits as normal, secondary cannot
            if (this.system.twoWeaponPrimary) {
              // Keep original crit range (no change needed, let actor's value be used below)
            } else {
              this.system.critRange = 51 // Secondary hand cannot crit
              twoWeaponCritSet = true
            }
          }
        }

        // Store flag to prevent later override
        this.system._twoWeaponCritSet = twoWeaponCritSet
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
    // Only set critRange if it hasn't already been set by two-weapon fighting logic
    if (!this.system._twoWeaponCritSet) {
      this.system.critRange = this.system?.config?.critRangeOverride ?? this.actor?.system?.details?.critRange ?? 20
    }
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

    // Add spell-specific other bonus if present
    const otherBonus = this.system.spellCheck.otherBonus
    if (otherBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.SpellOtherBonus'),
        formula: otherBonus
      })
    }

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
      mercurial: this.system?.mercurialEffect?.displayInChat ? this.system?.mercurialEffect : {},
      forceCrit: options.forceCrit
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
        let result = manifestationResult.results[0].description.replace(';', '')
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

    // Lookup the mercurial magic table if available — per-class
    // registry first (via `dcc.registerMercurialMagicTable`), then the
    // `'default'` registration, then the legacy single-table mirror.
    // Variants like XCC's blaster / gnome register their own tables
    // and get class-keyed lookups; canonical DCC casters keep using
    // the world-setting default.
    let mercurialMagicResult = null
    const classKey = actor.system?.details?.sheetClass || undefined
    const registry = CONFIG.DCC.mercurialMagicTables || {}
    const mercurialMagicTableName = (classKey && registry[classKey]) ||
      registry.default ||
      CONFIG.DCC.mercurialMagicTable
    if (mercurialMagicTableName) {
      const mercurialMagicTablePath = mercurialMagicTableName.split('.')
      let pack
      if (mercurialMagicTablePath.length === 3) {
        pack = game.packs.get(mercurialMagicTablePath[0] + '.' + mercurialMagicTablePath[1])
      }
      if (pack) {
        const entry = pack.index.find((entity) => entity.name === mercurialMagicTablePath[2])
        if (entry) {
          const table = await pack.getDocument(entry._id)
          mercurialMagicResult = await table.draw({ roll })
        }
      }
    }

    // Fall back to searching world tables by name
    if (!mercurialMagicResult) {
      const worldTableName = mercurialMagicTableName
        ? mercurialMagicTableName.split('.').pop()
        : 'Table 5-2: Mercurial Magic'
      const table = game.tables.getName(worldTableName)
      if (table) {
        mercurialMagicResult = await table.draw({ roll })
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
        const result = mercurialMagicResult.results[0].description
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
   * After creation, fix up orphaned container references from transfers.
   * When a container and its contents are transferred via Item Piles, the contents
   * arrive with system.container pointing to the old container ID. This method
   * re-associates them with the new container by matching on the sourceContainerName flag.
   * @param {object} data
   * @param {object} options
   * @param {string} userId
   */
  async _onCreate (data, options, userId) {
    await super._onCreate(data, options, userId)
    if (this.isContainer && this.parent) {
      // Check for orphaned items from Item Piles TRANSFER handler
      // These items were transferred alongside the container but have stale
      // system.container refs pointing to the old container ID
      const orphaned = this.parent.items.filter(i => {
        if (!i.system.container) return false
        if (this.parent.items.get(i.system.container)) return false
        return i.flags?.dcc?.sourceContainerName === this.name
      })
      if (orphaned.length > 0) {
        const updates = orphaned.map(i => ({
          _id: i.id,
          'system.container': this.id,
          'flags.dcc.-=sourceContainerName': null
        }))
        try {
          await this.parent.updateEmbeddedDocuments('Item', updates)
        } catch (err) {
          console.error(`DCC | Failed to re-associate ${orphaned.length} items with container "${this.name}"`, err)
        }
      }
    }
  }

  /**
   * Before deletion, release contained items so they aren't orphaned.
   * This handles programmatic deletion (API, macros, modules) where deleteDialog is bypassed.
   * @param {object} options
   * @param {object} user
   */
  async _preDelete (options, user) {
    await super._preDelete(options, user)
    if (this.isContainer && this.parent && this.contents.length > 0) {
      const updates = this.contents.map(i => ({
        _id: i.id,
        'system.container': null
      }))
      await this.parent.updateEmbeddedDocuments('Item', updates)
    }
  }

  /**
   * Override deleteDialog for containers with contents.
   * Warns the user that contained items will also be deleted and requires confirmation.
   * @param {object} [options] - Options passed to the parent deleteDialog
   * @returns {Promise<Item|false|null>}
   */
  async deleteDialog (options = {}) {
    if (!this.isContainer || !this.parent || this.contents.length === 0) {
      return super.deleteDialog(options)
    }
    const contentsCount = this.contents.length
    return Dialog.confirm({
      title: `${game.i18n.localize('DOCUMENT.Delete')}: ${this.name}`,
      content: `<p>${game.i18n.format('DCC.ContainerDeleteConfirm', { count: contentsCount })}</p>`,
      yes: async () => {
        const deleteIds = this.contents.map(i => i.id)
        deleteIds.push(this.id)
        try {
          await this.parent.deleteEmbeddedDocuments('Item', deleteIds)
        } catch (err) {
          console.error(`DCC | Failed to delete container "${this.name}" and its contents`, err)
          return null
        }
        return this
      },
      no: () => null,
      defaultYes: false
    })
  }
}

export default DCCItem
