/* global Item, foundry, game, ui, Roll, Dialog */

import DiceChain from './dice-chain.js'
import { ensurePlus, getFirstDie } from './utilities.js'
import { ContainerItemMixin } from './item/container-mixin.mjs'
import { CurrencyItemMixin } from './item/currency-mixin.mjs'
import { SpellItemMixin } from './item/spell-mixin.mjs'

// noinspection JSUnusedGlobalSymbols
/**
 * Extend the base Item entity for DCC RPG.
 * Spell-roll members (spell check + manifestation + mercurial magic) live in
 * {@link SpellItemMixin}; container-support members (weight/capacity/depth
 * getters + containment validation) live in {@link ContainerItemMixin};
 * treasure-value / currency members live in {@link CurrencyItemMixin}.
 * See `module/item/`.
 * @extends {Item}
 */
class DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item))) {
  /**
   * True while a charged magic item cast is awaiting its roll dialog,
   * so a second click cannot start a concurrent cast (issue #500)
   * @type {boolean}
   */
  #castInFlight = false

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

  /**
   * Attach a spell to this equipment item, making it a charged magic item
   * (e.g. a wand of magic missiles, issue #500). Stores a snapshot of the
   * spell's data so the item is self-contained and tradeable.
   * @param {DCCItem} spell    The spell item to attach
   * @return {Promise}
   */
  async attachSpell (spell) {
    if (this.type !== 'equipment') { return }
    if (spell?.type !== 'spell') { return }

    const spellData = spell.toObject ? spell.toObject() : foundry.utils.duplicate(spell)
    // The snapshot is independent of the source spell document
    delete spellData._id
    if (spellData.system) {
      // A magic item's spell is never 'lost' - the charge is the cost
      spellData.system.lost = false
    }

    // Clear any existing snapshot first - object updates merge recursively,
    // so replacing a spell directly would leak the old snapshot's keys
    if (this.system.spell) {
      await this.update({ 'system.spell': null })
    }
    return this.update({ 'system.spell': spellData })
  }

  /**
   * Remove the attached spell from this equipment item
   * @return {Promise}
   */
  async removeAttachedSpell () {
    if (this.type !== 'equipment') { return }
    return this.update({ 'system.spell': null })
  }

  /**
   * Cast the spell attached to this equipment item, spending a charge.
   * A charge is spent per cast regardless of the spell check result;
   * casting is blocked at zero charges. Items with a charge maximum of
   * zero do not track charges and cast freely.
   * @param options
   * @return {Promise}
   */
  async castSpell (options = {}) {
    if (this.type !== 'equipment') { return }

    // Only one pending cast per item - the roll dialog can stay open
    // indefinitely, and concurrent casts would race on the charge count
    if (this.#castInFlight) { return }
    this.#castInFlight = true
    try {
      return await this._castSpell(options)
    } finally {
      this.#castInFlight = false
    }
  }

  /**
   * Inner implementation of castSpell, guarded by the in-flight flag
   * @param options
   * @return {Promise}
   * @private
   */
  async _castSpell (options = {}) {
    const actor = this.actor
    if (!actor) {
      return ui.notifications.warn(game.i18n.format('DCC.CastSpellNoActorWarning', { item: this.name }))
    }

    const spellData = this.system.spell
    if (!spellData?.name) {
      return ui.notifications.warn(game.i18n.format('DCC.NoSpellAttachedWarning', { item: this.name }))
    }

    const charges = this.system.charges || {}
    if (charges.max > 0 && charges.value <= 0) {
      return ui.notifications.warn(game.i18n.format('DCC.NoChargesRemainingWarning', { item: this.name }))
    }

    // rollSpellCheck refuses spells without a results table; check up front
    // so a misconfigured item doesn't burn a charge on the warning
    if (!spellData.system?.results?.table) {
      return ui.notifications.warn(game.i18n.localize('DCC.NoSpellResultsTableWarning'))
    }

    // Build an ephemeral owned copy of the attached spell to roll with
    const data = foundry.utils.duplicate(spellData)
    delete data._id
    data.system = data.system || {}
    data.system.lost = false
    // The charge is the casting cost: no wizard spell loss or cleric
    // disapproval automation for magic item casts
    data.system.config = Object.assign({}, data.system.config, { castingMode: 'generic' })
    if (this.system.spellCheckOverride) {
      // The item casts at its own fixed spell check instead of the
      // attached spell's configuration
      data.system.config.inheritSpellCheck = false
      data.system.spellCheck = Object.assign({}, data.system.spellCheck, { value: this.system.spellCheckOverride })
    }
    let spell
    try {
      spell = new this.constructor(data, { parent: actor })
    } catch (err) {
      // A stale snapshot can fail schema validation after a system upgrade
      console.error(`DCC | Invalid attached spell data on "${this.name}"`, err)
      return ui.notifications.warn(game.i18n.format('DCC.NoSpellAttachedWarning', { item: this.name }))
    }

    // The charge is the entire cost of an item cast - no patron taint
    // either, unless the caller explicitly opts back in
    options.suppressPatronTaint = options.suppressPatronTaint ?? true

    const abilityId = actor.system.class?.spellCheckAbility || ''
    try {
      await spell.rollSpellCheck(abilityId, options)
    } catch (err) {
      // The roll modifier dialog rejects with null on cancel - no cast, no charge
      if (err !== null) { throw err }
      return
    }

    // Spend a charge per cast attempt (when charges are tracked). Re-read
    // the charge count - the roll dialog can stay open indefinitely and
    // another cast may have spent charges in the meantime
    const freshCharges = this.system.charges || {}
    if (freshCharges.max > 0) {
      await this.update({ 'system.charges.value': Math.max(0, (freshCharges.value || 0) - 1) })
    }
  }
}

export default DCCItem
