/* global game, ui, Roll, ChatMessage, CONFIG, console */

import { ensurePlus } from '../utilities.js'

/**
 * Spell-behavior mixin for {@link DCCItem}.
 *
 * Phase 7 (Appendix-A item.js shrinkage): the spell-item roll block —
 * casting a spell check and rolling/looking-up a spell's manifestation and
 * mercurial-magic effects — was lifted out of `module/item.js` into this mixin.
 * `DCCItem` composes it as the outermost layer
 * (`extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`), so
 * every member below stays an instance method on `DCCItem` with byte-identical
 * `this` semantics — the consumers (`actor-sheet.js` + `item-sheet.js` action
 * handlers, `macros.mjs` macro commands, the spell/cleric/wizard/elf sheet
 * templates' `data-action="rollSpellCheck"`/`rollManifestation`/
 * `rollMercurialMagic`) call these off a live item and need no change.
 *
 * Adapter reach: these methods delegate to the adapter through the GLOBAL
 * `game.dcc.*` namespace (`game.dcc.DCCRoll.createRoll`,
 * `game.dcc.processSpellCheck`), NOT via direct adapter-module imports, so the
 * mixin reaches them exactly as the class body did. They carry no
 * `logDispatch` of their own — the dispatch-logged spell-check *routing* lives
 * on the actor side (`DCCActor._rollSpellCheckViaAdapter`); this item-level path
 * is the spell-sheet / macro entry point that builds terms and hands off to
 * `processSpellCheck`. The one module dependency is `ensurePlus`
 * (`../utilities.js`), used by `rollMercurialMagic`'s luck-modifier term.
 *
 * @param {typeof Item} Base - the document class to extend (production: a
 *   `CurrencyItemMixin(ContainerItemMixin(Item))`; unit tests: a stub).
 * @returns {typeof Item} a subclass of `Base` carrying the spell surface.
 */
export const SpellItemMixin = (Base) => class extends Base {
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
}

export default SpellItemMixin
