/* global game, ui, Roll, ChatMessage, CONFIG, console */

import { logSpellburn } from '../ability-score-log.js'
import { ensurePlus, findPackEntryByName, getMercurialSpecial, getNameCandidates } from '../utilities.js'
import {
  planActionDie,
  actionDicePresetsFromPlan,
  reconcilePlannedActionDie,
  spendPlannedActionDie,
  formatActionDiceChatLine,
  slotRollFormula
} from '../action-dice-tracker.mjs'

/**
 * Determine the die formula to roll for a manifestation table.
 *
 * Manifestation tables are small dice (1d3/1d4/1d5/1d6/1d8/1d10), one per spell.
 * `table.draw` matches `roll.total` against the table's result *ranges*, so the
 * die has to stay inside those ranges — size it to the highest range and every
 * roll lands on a real row. We deliberately derive `1dN` from the ranges rather
 * than trusting `table.formula`: several core-book side-effect tables ship a
 * stray `formula` (e.g. `1d100`) that can roll well past the manifestation rows,
 * and returning it verbatim reproduces the original "always rolls d100, no
 * manifestation" bug even after the roll was pointed at the right table. Fall
 * back to the table's own `formula` only when it exposes no usable ranges, and
 * to `1d100` when there's no table at all. See issue #773.
 *
 * @param {RollTable|null} table - the resolved manifestation table, if any
 * @returns {string} a die formula such as `1d4`
 */
function manifestationDieFormula (table) {
  if (!table) { return '1d100' }
  const max = (table.results?.contents ?? table.results ?? [])
    .reduce((hi, r) => Math.max(hi, r.range?.[1] ?? 0), 0)
  if (max > 0) { return `1d${max}` }
  if (table.formula && table.formula.trim()) { return table.formula }
  return '1d100'
}

/**
 * Recursion cap when expanding special (roll-again) mercurial entries —
 * a sub-roll can land on another special entry (99 again, or 100+); past
 * this depth the literal instruction text is stored instead so a
 * pathological table cannot loop forever. Mirrors the lib's
 * MAX_MERCURIAL_SPECIAL_DEPTH (dcc-core-lib spells/mercurial).
 */
const MAX_MERCURIAL_SPECIAL_DEPTH = 5

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
 * `processSpellCheck`. The module dependencies are `../ability-score-log.js`
 * (`logSpellburn`); the `../utilities.js` helpers `ensurePlus` (luck-modifier
 * term), `getMercurialSpecial` (roll-again expansion, #339), and
 * `getNameCandidates` / `findPackEntryByName` (Babele-aware table resolution,
 * #799); and `../action-dice-tracker.mjs` for the multiple-action-dice budget
 * (#857) — the same direct import the six other roll paths use, and not an
 * adapter module.
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

    // Multiple action dice (#834) — this is the sheet/macro entry point for an
    // owned spell, so it owns the same plan → override → reconcile → spend
    // cycle the weapon and check paths run. Without it a caster's second cast
    // in a round silently re-rolled `spellCheck.die`, which
    // `DCCItem.prepareBaseData` derives via `getSingleActionDie` — i.e. always
    // the FIRST action die — and never spent a slot, so the tracker pips never
    // advanced either (#857).
    //
    // Only an extra die (slot index > 0) overrides the spell's own die, so the
    // first cast of a round stays byte-identical; `planActionDie` returns null
    // off-path (setting off / not in combat / no budget), which leaves the
    // whole block inert. A spells-only die IS eligible here — that is the
    // canonical wizard "cast with the second action die" case.
    // The slot only replaces a die that WAS derived from the action die.
    // `DCCItem.prepareBaseData` composes `spellCheck.die`: it reads the action
    // die only when `config.inheritActionDie` is set, and a class's
    // `spellCheckOverrideDie` wins over it. Either of those is a deliberate
    // authoring choice, so stepping to another slot must not silently discard it
    // — the same "re-apply relative to the chosen base die, don't discard it"
    // rule #834 established for the two-weapon penalty.
    let die = this.system.spellCheck.die
    const dieFollowsActionDie = !!this.system.config.inheritActionDie &&
      !actor.system.class?.spellCheckOverrideDie
    let actionDicePlan = planActionDie(actor, 'spell')
    if (dieFollowsActionDie && actionDicePlan?.choice && actionDicePlan.choice.index > 0) {
      die = slotRollFormula(actionDicePlan.choice.slot)
    }
    // The die the roll uses with no player intervention — passed to the
    // reconcile below so landing on it is never mistaken for a slot choice.
    const defaultActionDieFaces = parseInt(String(die).match(/d(\d+)/)?.[1] || '') || null
    // Slot-aware presets (#834 §3) so the modifier dialog is a real action-die
    // chooser. Null when there is only one slot (or off-path), in which case
    // the Die term carries no presets exactly as before.
    const actionDicePresets = actionDicePlan
      ? actionDicePresetsFromPlan(actionDicePlan, { action: 'spell' })
      : null

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
        formula: die,
        // Only on-path with two or more slots; absent otherwise, so the dialog
        // renders the plain die field it always has. No untrained 1d10 here —
        // that is an attack/skill concept, not a spell-check one.
        ...(actionDicePresets?.length ? { presets: actionDicePresets } : {})
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

    // Clerics cannot spellburn.
    // Track the total points burned so the result handler can surface it via
    // the `dcc.afterSpellCheckResult` payload — MCC glowburn IS spellburn, and
    // its patron manifestation keys off the amount burned.
    let spellburnTotal = 0
    if (castingMode !== 'cleric') {
      const sbStr = actor.system.abilities.str.value
      const sbAgl = actor.system.abilities.agl.value
      const sbSta = actor.system.abilities.sta.value
      terms.push({
        type: 'Spellburn',
        formula: '+0',
        str: sbStr,
        agl: sbAgl,
        sta: sbSta,
        callback: (formula, term) => {
          // Record the points burned (original minus the dialog's reduced
          // values), then apply the spellburn (logged in the ability score
          // log when enabled).
          spellburnTotal = (sbStr - term.str) + (sbAgl - term.agl) + (sbSta - term.sta)
          logSpellburn(actor, term, this.name)
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

    // The player may have picked a different slot in the modifier dialog, so
    // re-point the plan at the die actually rolled before spending it, then
    // spend (the tracker pip flips on the flag write). Null plan ⇒ off-path ⇒
    // empty line, and the card renders exactly as it does today. Deliberately
    // after the no-results-table bail-out above: that path posts nothing at all,
    // so — as before this change — it must cost nothing either.
    actionDicePlan = reconcilePlannedActionDie(actionDicePlan, roll.dice?.[0]?.faces, {
      action: 'spell',
      defaultFaces: defaultActionDieFaces
    })
    const actionDiceChatLine = formatActionDiceChatLine(await spendPlannedActionDie(actionDicePlan))

    // Tell the system to handle the spell check result
    await game.dcc.processSpellCheck(actor, {
      rollTable: resultsTable,
      roll,
      item: this,
      flavor,
      manifestation: this.system?.manifestation?.displayInChat ? this.system?.manifestation : {},
      mercurial: this.system?.mercurialEffect?.displayInChat ? this.system?.mercurialEffect : {},
      forceCrit: options.forceCrit,
      forceFumble: options.forceFumble,
      suppressPatronTaint: options.suppressPatronTaint,
      spellburn: spellburnTotal,
      actionDiceChatLine
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

    // Resolve the manifestation table first (compendium first, then world) so we
    // can roll its own die. Each manifestation table is a small die (1d3/1d4/etc.),
    // never 1d100 — rolling a hardcoded 1d100 lands outside the table's range and
    // never matches a result. See issue #773.
    const manifestationPackName = game.settings.get('dcc', 'spellSideEffectsCompendium') || 'dcc-core-book.dcc-core-spell-side-effect-tables'
    let table = null

    // An explicit reference on the spell wins: language-independent, so it
    // survives Babele translation the same way `system.results.table` does.
    const manifestationRef = this.system.manifestation ?? {}
    if (manifestationRef.table) {
      const predicate = t => t.name === manifestationRef.table || t._id === manifestationRef.table.replace('RollTable.', '')
      const refPack = game.packs.get(manifestationRef.collection || manifestationPackName)
      if (refPack) {
        const entry = refPack.index.find(predicate)
        if (entry) {
          table = await refPack.getDocument(entry._id)
        }
      }
      if (!table) {
        table = game.tables.contents.find(predicate)
      }
      if (!table) {
        // A configured reference that resolves nowhere (renamed/deleted table)
        // should not masquerade as "this spell has no manifestation" — leave a
        // trace before falling back to the naming convention.
        console.warn(`DCC | Spell "${this.name}": manifestation table reference "${manifestationRef.table}" did not resolve; falling back to name lookup`)
      }
    }

    // Fall back to the `<spell name> Manifestation` naming convention. Both
    // sides of that comparison are language-sensitive in a Babele world (the
    // spell's name translates while the table pack may not, or vice versa), so
    // try the untranslated original names on both sides too (issue #799).
    const manifestationTableNames = getNameCandidates(this).map((name) => `${name} Manifestation`)
    if (!table) {
      const pack = game.packs.get(manifestationPackName)
      if (pack) {
        const entry = findPackEntryByName(pack, manifestationTableNames)
        if (entry) {
          table = await pack.getDocument(entry._id)
        }
      } else {
        // The compendium itself is missing — tell the user to install/activate it.
        console.warn(game.i18n.localize('DCC.SpellSideEffectsCompendiumNotFoundWarning'))
      }
    }
    if (!table) {
      table = manifestationTableNames.map((name) => game.tables.getName(name)).find(Boolean) ?? null
    }

    // Many DCC spells (e.g. Invisibility) have no manifestation at all, so no
    // `<name> Manifestation` table ships for them. When rolling (not looking up a
    // value) with no table, don't roll a meaningless 1d100 and stow a bogus value
    // with an empty description — tell the user this spell has no manifestation
    // and stop. See issue #773 follow-up.
    if (!table && !lookup) {
      return ui.notifications.warn(game.i18n.format('DCC.NoManifestationTableWarning', { spell: this.name }))
    }

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
          formula: manifestationDieFormula(table)
        }
      ]

      // Otherwise roll for a manifestation on the table's own die
      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)
    }

    // Draw the manifestation from the table using our roll
    let manifestationResult = null
    if (table) {
      manifestationResult = await table.draw({ roll })
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
    let table = null
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
        // Tolerate a Babele-translated pack index (issue #799)
        const entry = findPackEntryByName(pack, mercurialMagicTablePath[2])
        if (entry) {
          table = await pack.getDocument(entry._id)
        }
      }
    }

    // Fall back to searching world tables by name
    if (!table) {
      const worldTableName = mercurialMagicTableName
        ? mercurialMagicTableName.split('.').pop()
        : 'Table 5-2: Mercurial Magic'
      table = game.tables.getName(worldTableName)
    }

    let mercurialMagicResult = null
    if (table) {
      mercurialMagicResult = await table.draw({ roll })
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
        const effect = await this._extractMercurialEffect(mercurialMagicResult, table, ability, 0)
        updates['system.mercurialEffect.summary'] = effect.summary
        updates['system.mercurialEffect.description'] = effect.blocks.join('')
      } catch (err) {
        console.error(`Couldn't extract Mercurial Magic result from table:\n${err}`)
      }
    }

    this.update(updates)
  }

  /**
   * Turn a drawn mercurial-magic table result into displayable data,
   * expanding special (roll-again) entries — issue #339.
   *
   * An ordinary entry returns its literal text (summary = first
   * sentence, one `<p>` block). A special entry (see
   * {@link getMercurialSpecial}) instead makes `count` sub-rolls of
   * `formula + luck×10`, draws each on the same table (every sub-draw
   * posts its own chat card via `table.draw`), and combines them:
   * joined summaries, one block per sub-effect labeled with its roll
   * total. A sub-roll landing on another special entry recurses, capped
   * at MAX_MERCURIAL_SPECIAL_DEPTH — past the cap the literal
   * instruction text is kept.
   *
   * @param {Object} drawResult - result of `table.draw` ({roll, results})
   * @param {Object} table - the resolved mercurial-magic RollTable
   * @param {Object} ability - the actor's luck ability (for `mod`)
   * @param {Number} depth - current expansion depth
   * @returns {Promise<{summary: String, blocks: Array<String>, leaf: Boolean}>}
   * @private
   */
  async _extractMercurialEffect (drawResult, table, ability, depth) {
    const tableResult = drawResult.results[0]

    // `table.draw` can resolve with no results when the roll lands
    // outside every entry's range (narrow homebrew tables, or a special
    // formula that outruns the table's coverage). Keep this node as a
    // labeled miss instead of throwing — an exception here would discard
    // every already-drawn sub-effect in the expansion tree while their
    // chat cards remain posted.
    if (!tableResult) {
      const text = game.i18n.format('DCC.MercurialMagicNoResult', { roll: drawResult.roll?.total })
      return {
        summary: text,
        blocks: [`<p>${text}</p>`],
        // Not marked as a leaf: the message already carries the roll
        // value, so the caller must not prepend its "(roll)" label too
        leaf: false
      }
    }

    const text = tableResult.description
    const special = getMercurialSpecial(tableResult)

    if (!special || depth >= MAX_MERCURIAL_SPECIAL_DEPTH) {
      return {
        summary: text.split('.')[0],
        blocks: [`<p>${text}</p>`],
        leaf: true
      }
    }

    const summaries = []
    const blocks = []
    for (let i = 0; i < special.count; i++) {
      const terms = [
        {
          type: 'Die',
          formula: special.formula
        },
        {
          type: 'Modifier',
          label: game.i18n.localize('DCC.AbilityLck'),
          formula: ensurePlus((ability.mod * 10).toString())
        }
      ]
      // Sub-rolls never re-prompt with the modifier dialog
      const subRoll = await game.dcc.DCCRoll.createRoll(terms, {}, {})
      const subDraw = await table.draw({ roll: subRoll })
      const sub = await this._extractMercurialEffect(subDraw, table, ability, depth + 1)
      summaries.push(sub.summary)
      if (sub.leaf) {
        // Label the effect with the sub-roll that produced it
        blocks.push(sub.blocks[0].replace('<p>', `<p><strong>(${subDraw.roll.total})</strong> `))
      } else {
        // A nested expansion's blocks already carry their own labels
        blocks.push(...sub.blocks)
      }
    }

    return {
      summary: summaries.join('; '),
      blocks,
      leaf: false
    }
  }
}

export default SpellItemMixin
