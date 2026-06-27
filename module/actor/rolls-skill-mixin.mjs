/* global game, CONFIG, Roll, ChatMessage, ui, foundry */

import { ensurePlus } from '../utilities.js'
import { rollCheck as libRollCheck } from '../vendor/dcc-core-lib/index.js'
import { actorToCharacter } from '../adapter/character-accessors.mjs'
import { renderSkillCheck } from '../adapter/chat-renderer.mjs'
import { promptRollModifierDialog } from '../adapter/roll-dialog.mjs'
import { normalizeLibDie } from '../adapter/attack-input.mjs'
import { logDispatch, withRollErrorBoundary } from '../adapter/debug.mjs'
import { applyForceCritToFoundryRoll } from './force-crit.mjs'
import { planActionDie, spendPlannedActionDie, formatActionDiceChatLine } from '../action-dice-tracker.mjs'

/**
 * Skill-check dispatch mixin for {@link DCCActor}.
 *
 * Phase 7 actor.js shrinkage (continued): the skill-check dispatch layer
 * — the public `rollSkillCheck` wrapper plus its private resolvers/
 * adapters/builders (`_resolveSkill`, `_rollSkillCheckViaAdapter`,
 * `_skillTableViaAdapter`, `_buildSkillDefinition`,
 * `_buildSkillCheckModifiers`, `_stripDieCount`,
 * `_emitSkillDescriptionViaAdapter`, `_buildSkillCheckRollTerms`) — was
 * lifted out of `module/actor.js` into this mixin. `DCCActor` composes it
 * into its `extends` chain so every method stays an instance method with
 * byte-identical behavior and `this` semantics (`this.applyDisapproval`
 * resolves to actor.js; `this.getActionDice` / `this.getRollData` to the
 * roll-data mixin; every roll mixin is always co-composed on DCCActor).
 *
 * `_stripDieCount` lives here but is also called by the check mixin's
 * initiative path via `this._stripDieCount` — safe because both mixins
 * are always present on DCCActor's prototype chain.
 *
 * Public surface unchanged: downstream modules depend on the public
 * shape of `rollSkillCheck`. Self-contained: depends only on the skill
 * adapter/lib imports above, the shared `applyForceCritToFoundryRoll`
 * helper, and the Foundry globals.
 *
 * @param {typeof import('foundry').Actor} Base - the class to extend.
 * @returns {typeof Base} a subclass carrying the skill-check dispatchers.
 */
export const RollsSkillMixin = (Base) => class extends Base {
  /**
   * Roll a Skill Check.
   *
   * Single-path through the adapter (legacy fully decommissioned). The
   * dispatcher routes on the resolved skill: description-only items (no
   * die) emit a chat card via `_emitSkillDescriptionViaAdapter`;
   * skill-table / cleric-disapproval skills route through
   * `_skillTableViaAdapter`; everything else (including the modifier
   * dialog) flows through `_rollSkillCheckViaAdapter` via the two-pass
   * formula/evaluate pattern. The former `_rollSkillCheckLegacy` body
   * was deleted at Phase 7 session 25.
   *
   * Signature and emitted chat-message flags are preserved —
   * downstream modules depend on this public surface.
   *
   * @param {String} skillId  The skill ID (e.g. "sneakSilently")
   * @param {Object} options  Roll options
   */
  async rollSkillCheck (skillId, options = {}) {
    return withRollErrorBoundary('rollSkillCheck', game.i18n.localize('DCC.Skill'), () => {
      const resolved = this._resolveSkill(skillId)

      // Unknown skill — no built-in slot, no skill item with this name.
      // Without this guard the `!hasDie` description route would crash
      // on the missing `resolved.skill`. Mirror the `rollSpellCheck`
      // "no owned item" notification shape so the user sees a clear
      // warning rather than a console TypeError.
      if (!resolved.skill) {
        return ui.notifications.warn(
          game.i18n.format('DCC.SkillCheckUnknownSkillWarning', { skill: skillId })
        )
      }

      // Title for the roll modifier dialog — legacy mutates options,
      // keep the behavior so the dialog path still sees it.
      options.title = game.i18n.localize(resolved.skill.label) ||
        (game.i18n.localize('DCC.AbilityCheck') + resolved.abilityLabel)

      const hasSkillTable = !!CONFIG.DCC?.skillTables?.[skillId]
      const useDisapprovalRange = !!resolved.skill?.useDisapprovalRange

      // Custom spell-like skills (a skill item with a wizard/cleric casting
      // mode) get the same failure automation as spells (issue #375)
      const spellLikeCastingMode = !!resolved.skill.castingMode && resolved.skill.castingMode !== 'generic'

      // A spell-like skill in wizard casting mode is lost on a failed check
      // like a wizard spell; once lost it cannot be cast again until recovered,
      // mirroring rollSpellCheck's lost gate
      if (resolved.skillItem?.system.lost && resolved.skill.castingMode === 'wizard' && game.settings.get('dcc', 'automateWizardSpellLoss')) {
        return ui.notifications.warn(game.i18n.format('DCC.SpellLostWarning', {
          actor: this.name,
          spell: resolved.skillItem.name
        }))
      }

      // Description-only skill items (no die, no value, no roll) route
      // through the adapter's `_emitSkillDescriptionViaAdapter`, which
      // posts a description chat card rather than a roll (legacy-decom
      // step 4). Phase 3 session 26 (Q7) folded the previous
      // `!!options.showModifierDialog` clause into the adapter routes:
      // `_rollSkillCheckViaAdapter` calls `promptRollModifierDialog`
      // adapter-side, and `_skillTableViaAdapter` already threads
      // `options` through `DCCRoll.createRoll` which honours
      // `showModifierDialog` on its own.
      if (!resolved.hasDie) {
        return this._emitSkillDescriptionViaAdapter(skillId, resolved)
      }

      // Skill-table, cleric disapproval-range, and spell-like castingMode
      // skills all resolve through the one adapter path. `_skillTableViaAdapter`
      // applies the result-table / disapproval-range handling and, for skills
      // with an explicit casting mode, the matching wizard spell loss or
      // cleric disapproval automation (#375) — so spell-like skills are no
      // longer a separate processSpellCheck detour.
      if (hasSkillTable || useDisapprovalRange || spellLikeCastingMode) {
        return this._skillTableViaAdapter(skillId, options, resolved)
      }

      return this._rollSkillCheckViaAdapter(skillId, options, resolved)
    })
  }

  /**
   * Normalize a skill reference (built-in slot or skill item) to the
   * shared bundle both dispatch paths consume. Extracted from the
   * legacy dispatcher so the adapter can reuse the same resolution.
   * @private
   */
  _resolveSkill (skillId) {
    let skill = this.system.skills ? this.system.skills[skillId] : null
    let skillItem = null
    if (!skill) {
      skillItem = this.itemTypes.skill.find(i => i.name === skillId)
      if (skillItem) {
        skill = {
          label: skillItem.name
        }
        if (skillItem.system.config.useAbility) {
          skill.ability = skillItem.system.ability || null
        }
        if (skillItem.system.config.useDie) {
          skill.die = skillItem.system.die || null
        }
        if (skillItem.system.config.useValue) {
          skill.value = skillItem.system.value ?? undefined
        }
        if (skillItem.system.config.useLevel) {
          skill.level = `+${this.system.details.level.value ?? 0}`
        }
        if (skillItem.system.config.castingMode) {
          // Spell-like skills carry a casting mode that drives failure
          // automation through processSpellCheck (issue #375)
          skill.castingMode = skillItem.system.config.castingMode
        }
      }
    }

    if (skill?.config?.useLevel) {
      skill.level = `+${this.system.details.level.value ?? 0}`
    }

    let die = (skill?.die && skill.die.trim()) ? skill.die : null
    let hasDie = !!die

    if (skill?.useDisapprovalRange && this.system.class.spellCheckOverrideDie) {
      die = this.system.class.spellCheckOverrideDie
      hasDie = true
    }

    // Fall back to the actor's action die when no per-skill die is
    // configured. Built-in skill slots always inherit it. Skill items
    // inherit it too — but only when they actually roll something
    // (they contribute a value, ability, or level modifier). A pure
    // description-only skill item (useDie / useValue / useAbility /
    // useLevel all off) must stay on the description path and gets no
    // die. Fixes NPC skill items saved with `useDie: false` that carry
    // a flat `value` modifier (e.g. an imported NPC's "Divine Aid +4"):
    // before, the missing-die branch only matched built-in slots, so
    // those items rolled with no action die / dropped to description.
    const skillItemIsRollable = !!skillItem && (
      skill.value !== undefined ||
      !!(skill.ability && skill.ability.trim()) ||
      skill.level !== undefined
    )
    if (!hasDie && skill && (!skillItem || skillItemIsRollable)) {
      die = this.getActionDice()[0].formula || '1d20'
      hasDie = true
    }

    const abilityId = skill?.ability && skill.ability.trim() ? skill.ability : null
    const abilityLabel = abilityId
      ? ` (${game.i18n.localize(CONFIG.DCC.abilities[abilityId])})`
      : ''
    const abilityMod = abilityId
      ? parseInt(this.system.abilities[abilityId]?.mod || '0')
      : 0

    return {
      skill,
      skillItem,
      abilityId,
      abilityLabel,
      abilityMod,
      die,
      hasDie
    }
  }

  /**
   * Adapter path for skill checks. Two-pass sync flow mirroring
   * `_rollSavingThrowViaAdapter`: pass 1 asks the lib for the formula,
   * Foundry evaluates it (so Roll.total includes every modifier),
   * pass 2 classifies against the same natural for crit/fumble.
   *
   * Roll-modifier-dialog branch (Phase 3 session 26 / Q7): when the
   * caller passes `options.showModifierDialog`, the
   * `RollModifierDialog` is surfaced adapter-side via
   * `promptRollModifierDialog`. The dialog's term list comes from the
   * shared `_buildSkillCheckRollTerms` helper; on submit we override
   * `definition.roll.die` with the user-selected die and replace the
   * per-source modifier list with a single flat user total (the
   * dialog's term flattening already loses per-source attribution,
   * so the lib breakdown collapses to one `dialog-modifier` line).
   * @private
   */
  async _rollSkillCheckViaAdapter (skillId, options, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId })
    const { skill, skillItem, abilityId, abilityLabel } = resolved

    const character = actorToCharacter(this)
    const definition = this._buildSkillDefinition(skillId, resolved)
    let modifiers = this._buildSkillCheckModifiers(skillId, resolved)

    // Multiple action dice (Phase 3) — when enabled and this actor is in
    // combat, plan the next eligible action-die slot for this check and
    // spend it after the roll resolves. `planActionDie` returns null on the
    // off-path (setting off / not in combat / no budget), leaving today's
    // behavior. Only an *extra* die (slot index > 0) overrides the check's
    // die, so the first action of the round stays byte-identical to today.
    const actionDicePlan = planActionDie(this, 'check')
    if (actionDicePlan?.choice && actionDicePlan.choice.index > 0) {
      definition.roll.die = actionDicePlan.choice.slot.die
    }

    if (options.showModifierDialog) {
      const dialogTerms = this._buildSkillCheckRollTerms(skillId, resolved)
      const prompt = await promptRollModifierDialog(dialogTerms, {
        rollData: this.getRollData(),
        title: options.title,
        rollLabel: game.i18n.localize('DCC.RollModifierRoll')
      })
      if (prompt === null) return
      if (prompt.actionDie) {
        const libDie = this._stripDieCount(prompt.actionDie)
        if (libDie) definition.roll.die = libDie
      }
      // Replace per-source modifiers with a single flat total (the
      // dialog's submit step reduces every non-die term to a numeric
      // sum). Suppress the lib's auto-ability add since the dialog
      // total already includes ability mod (legacy compound term was
      // `skill.value + abilityMod`).
      if (definition.roll.ability) delete definition.roll.ability
      modifiers = []
      const flatTotal = prompt.modifierTotal
      if (flatTotal !== 0) {
        modifiers.push({
          kind: 'add',
          value: flatTotal,
          origin: {
            category: 'other',
            id: 'dialog-modifier',
            label: options.title || game.i18n.localize('DCC.RollModifierTitle')
          }
        })
      }
      // Capture the dialog choice in the dispatch log so the e2e
      // assertion can verify the prompt actually fired.
      logDispatch('rollSkillCheck', 'adapter', {
        skillId,
        dialog: true,
        actionDie: prompt.actionDie,
        modifierTotal: flatTotal
      })
    }

    // Pass 1: lib builds the formula (no evaluation).
    const plan = libRollCheck(definition, character, {
      mode: 'formula',
      modifiers
    })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    // Pass 2: lib classifies against the rolled natural.
    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => natural,
      modifiers
    })

    const skillLabel = game.i18n.localize(skill.label)

    // Spend the planned die (the tracker pip flips on the flag update) and
    // build the "Action N of M" chat line. Null plan ⇒ off-path, no line.
    // Reached only after a non-cancelled dialog, so a cancel spends nothing.
    const actionDiceChatLine = formatActionDiceChatLine(await spendPlannedActionDie(actionDicePlan))

    await renderSkillCheck({
      actor: this,
      skillId,
      skillLabel,
      abilityId,
      abilityLabel,
      skillItem,
      result,
      foundryRoll,
      actionDiceChatLine
    })

    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': foundryRoll.total })
    }

    return foundryRoll
  }

  /**
   * Skill-table + disapproval-range adapter branch
   * (Phase 3 session 25 / D4(skill-table)).
   *
   * Replaces the former legacy skill-check →
   * `processSpellCheck({rollTable: skillTable})` flow for skills that
   * carry a result table (Turn Unholy, divine aid) or a cleric
   * disapproval range. The roll itself still flows through
   * `DCCRoll.createRoll` so per-class skill terms (skill die, value,
   * level, deed roll, check penalty) render identically; the lookup +
   * chat emit + drainDisapproval mirror the `processSpellCheck`
   * cleric/skill-table branch (`module/dcc.js:665-693, 781-792`).
   *
   * Mechanics preserved from the former legacy path:
   *   - Term-builder (`_buildSkillCheckRollTerms`) covers die / value /
   *     level / useDeed / check penalty so a Turn Unholy roll
   *     displays the same modifier breakdown.
   *   - `useDisapprovalRange` annotates the die's `lowerThreshold` so
   *     the chat shows the cleric's disapproval band.
   *   - `forceCrit` (shift-click GM testing) is honored via the same
   *     Foundry-Roll mutation helper as the spell-check routes.
   *   - Natural 1 / Natural 20 detection drives the table lookup row:
   *     fumble → row 1; PC crit → roll.total + level (with the +level
   *     compound term appended to the roll for chat display).
   *   - Chat emit uses `SpellResult.addChatMessage` for the table path
   *     and the four `DCC.SpellCheck*NoTable` strings for the
   *     disapproval-range-only-no-table fallback (rare; mirror
   *     legacy).
   *   - `skill.drainDisapproval` increments the actor's disapproval
   *     range by N when `automateClericDisapproval` is on (Turn
   *     Unholy's documented cost).
   *   - `skillItem.system.config.showLastResult` updates `lastResult`
   *     on the skill item so the sheet displays the latest total.
   *   - Spell-like skills (an explicit `skill.castingMode`) additionally
   *     apply wizard spell loss or cleric disapproval automation on a
   *     failed check (#375), the single path for all spell-like skills.
   * @private
   */
  async _skillTableViaAdapter (skillId, options, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId, mode: 'skillTable' })
    const { skill, skillItem, abilityLabel } = resolved

    const terms = this._buildSkillCheckRollTerms(skillId, resolved)

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (skill.useDisapprovalRange && roll.dice.length > 0) {
      roll.dice[0].options.dcc = {
        lowerThreshold: this.system.class.disapproval
      }
    }

    if (!roll._evaluated) {
      await roll.evaluate()
    }

    const skillTable = await game.dcc.getSkillTable(skillId)

    // forceCrit (shift-click GM testing) — same Foundry-Roll mutation
    // helper as the spell-check adapter routes. Mirrors legacy
    // `processSpellCheck:605-611`.
    const naturalRoll = applyForceCritToFoundryRoll(
      roll,
      roll.dice[0]?.total ?? roll.total,
      options
    )

    const fumble = naturalRoll === 1
    const crit = naturalRoll === 20 && this.type === 'Player'
    const actorLevel = parseInt(this.system.details?.level?.value || 0, 10) || 0

    const flavor = `${game.i18n.localize(skill.label)}${abilityLabel}`

    if (skillTable) {
      let result
      if (fumble) {
        result = skillTable.getResultsForRoll(1)
      } else if (crit) {
        const critRoll = roll.total + actorLevel
        result = skillTable.getResultsForRoll(critRoll)
        roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }))
        roll.terms.push(new foundry.dice.terms.NumericTerm({ number: actorLevel }))
        roll._formula += ` + ${actorLevel}`
        roll._total += actorLevel
      } else {
        result = skillTable.getResultsForRoll(roll.total)
      }

      // Built-in cleric Lay on Hands carries an optional Spell
      // Manifestation on the actor skill (no spell item) — surface it in
      // the chat card when present (#426).
      const skillManifestation = this.system.skills?.[skillId]?.manifestation
      await game.dcc.SpellResult.addChatMessage(roll, skillTable, result, {
        crit, fumble, item: skillItem, manifestation: skillManifestation
      })
    } else {
      // `useDisapprovalRange` without a table: emit the same
      // pass/fail/crit/fumble HTML indicator as the legacy no-table
      // processSpellCheck branch. `level` for the threshold defaults
      // to 1 (skill items typically don't carry a spell level).
      const noTableLevel = skillItem?.system?.level || 1
      const noTableSuccess = roll.total >= 10 + noTableLevel * 2
      let spellResultHtml
      if (fumble) {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFumbleNoTable')}</p>`
      } else if (crit) {
        spellResultHtml = `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckCritNoTable')}</p>`
      } else if (noTableSuccess) {
        spellResultHtml = `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckSuccessNoTable')}</p>`
      } else {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFailureNoTable')}</p>`
      }

      const flags = {
        'dcc.RollType': 'SpellCheck',
        'dcc.isSpellCheck': true,
        'dcc.isSkillCheck': true,
        'dcc.ItemId': skillItem?.id,
        'dcc.SkillId': skillId,
        'dcc.spellResult': spellResultHtml
      }
      if (game.dcc?.FleetingLuck?.updateFlags) {
        game.dcc.FleetingLuck.updateFlags(flags, roll)
      }

      const rollHTML = await roll.render()
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor,
        flags,
        system: { spellId: skillItem?.id, skillId },
        content: `${rollHTML}${spellResultHtml}`
      })
    }

    // Spell-like skill failure automation (#375): a skill configured with an
    // explicit casting mode applies the same wizard spell loss / cleric
    // disapproval as a spell check. Spell-like skills carry no level field, so
    // the success threshold uses level 1 (10 + 1 * 2), matching
    // processSpellCheck. Built-in cleric abilities have no castingMode and are
    // unaffected (they keep the disapproval-range / drainDisapproval handling).
    if (skill.castingMode === 'wizard') {
      const spellLikeLevel = skillItem?.system?.level ?? 1
      if (game.settings.get('dcc', 'automateWizardSpellLoss') && roll.total < (10 + spellLikeLevel * 2)) {
        await this.loseSpell(skillItem)
      }
    } else if (skill.castingMode === 'cleric') {
      if (game.settings.get('dcc', 'automateClericDisapproval')) {
        const spellLikeLevel = skillItem?.system?.level ?? 1
        let success = roll.total >= (10 + spellLikeLevel * 2)
        // A natural roll inside the disapproval range triggers disapproval and
        // is an automatic failure
        if (naturalRoll <= this.system.class.disapproval) {
          await this.rollDisapproval(naturalRoll)
          success = false
        }
        if (!success) {
          await this.applyDisapproval()
        }
      }
    }

    // Skill-driven disapproval drain (Turn Unholy etc.) — preserves
    // the former legacy skill-check post-step.
    if (skill.drainDisapproval && game.settings.get('dcc', 'automateClericDisapproval')) {
      await this.applyDisapproval(skill.drainDisapproval)
    }

    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': roll.total })
    }

    return roll
  }

  /**
   * Build a lib `SkillDefinition` for a resolved skill. Ability
   * modifier and level are added by the lib from the character
   * (see `roll.ability` / `roll.levelModifier`). Other Foundry-side
   * modifiers (skill value, deed, check penalty) are emitted as
   * situational modifiers in `_buildSkillCheckModifiers`.
   * @private
   */
  _buildSkillDefinition (skillId, { skill, die, abilityId }) {
    // Foundry stores `1d14`; lib's DieType is just `d14`.
    const libDie = this._stripDieCount(die) || 'd20'

    const definition = {
      id: `skill:${skillId}`,
      name: game.i18n.localize(skill.label),
      type: 'check',
      roll: {
        die: libDie,
        levelModifier: 'none'
      }
    }

    if (abilityId) {
      definition.roll.ability = abilityId
    }

    return definition
  }

  /**
   * Emit the situational modifiers the lib needs to produce the same
   * total the legacy term list would have: skill value, level (when
   * useLevel is true), Mighty Deed's last attack bonus, and the
   * armor check penalty for skills that honor it.
   * @private
   */
  _buildSkillCheckModifiers (skillId, { skill, abilityMod }) {
    const modifiers = []
    const skillLabel = game.i18n.localize(skill.label)

    if (skill.value !== undefined) {
      const valueNum = parseInt(String(skill.value), 10) || 0
      // Legacy folded ability mod into the same Compound term as skill
      // value. The lib adds ability mod on its own from roll.ability,
      // so we emit just skill.value here — total arithmetic matches.
      if (valueNum !== 0 || abilityMod === 0) {
        modifiers.push({
          kind: 'add',
          value: valueNum,
          origin: {
            category: 'other',
            id: 'skill-value',
            label: skillLabel
          }
        })
      }
    }

    // Active-Effect skill modifier. AEs target the derived-only `otherMod`
    // field (never the editable `value` base — see #714), so it surfaces as
    // its own attributed term in the roll breakdown rather than overlaying
    // the base.
    const otherMod = parseInt(String(skill.otherMod ?? 0), 10) || 0
    if (otherMod !== 0) {
      modifiers.push({
        kind: 'add',
        value: otherMod,
        origin: {
          category: 'other',
          id: 'skill-other-mod',
          label: skillLabel
        }
      })
    }

    if (skill.level !== undefined && skill.level !== 0) {
      const levelNum = parseInt(String(skill.level), 10) || 0
      if (levelNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: levelNum,
          origin: {
            category: 'level',
            id: 'level',
            label: game.i18n.localize('DCC.Level')
          }
        })
      }
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      const deedNum = parseInt(String(this.system.details.lastRolledAttackBonus), 10)
      if (Number.isFinite(deedNum) && deedNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: deedNum,
          origin: {
            category: 'class-feature',
            id: 'mighty-deed',
            label: game.i18n.localize('DCC.DeedRoll')
          }
        })
      }
    }

    const checkPenaltyCouldApply =
      ['sneakSilently', 'climbSheerSurfaces'].includes(skillId) ||
      !!skill.config?.applyCheckPenalty
    if (checkPenaltyCouldApply) {
      const penaltyNum = parseInt(String(this.system.attributes.ac.checkPenalty || '0'), 10)
      if (Number.isFinite(penaltyNum) && penaltyNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: penaltyNum,
          origin: {
            category: 'penalty',
            id: 'armor-check-penalty',
            label: game.i18n.localize('DCC.CheckPenalty')
          }
        })
      }
    }

    return modifiers
  }

  /**
   * Turn a Foundry die formula like `'1d14'` into the bare die type
   * `'d14'` the lib's SkillDefinition wants. Returns null when the
   * input can't be parsed (callers either `|| 'd20'` it or use the
   * null to leave the existing die untouched).
   *
   * Delegates to the canonical adapter `normalizeLibDie` (Phase 7
   * session 12 consolidation) with `fallback: null` — every call site
   * passes a single die string, so the unanchored matcher behaves
   * identically to the former anchored regex here.
   * @private
   */
  _stripDieCount (formula) {
    return normalizeLibDie(formula, null)
  }

  /**
   * Adapter path for description-only skill items — a skill item with
   * `useDie` / `useValue` / `useAbility` / `useLevel` all off (the
   * `!resolved.hasDie` gate; built-in slots and rollable items always
   * inherit the action die, so this is reached only for skill items
   * with nothing to roll). These emit a description chat card, not a
   * roll: there is no formula to hand the lib, so this is a pure
   * Foundry-side chat emit rather than a lib round-trip.
   *
   * Reproduces the former legacy early-return chat contract exactly —
   * same content (`.skill-description` div), flavor (`<label><ability>`),
   * flags (`SkillCheck` / `ItemId` / `SkillId` / `isSkillCheck`), and
   * `system` payload. Emits nothing when the item carries no
   * description. The `mode: 'description'` dispatch field distinguishes
   * it from the rolling adapter routes.
   *
   * Landed at Phase 7 session 24 (legacy-decom step 4) as the route that
   * retired the last reachable gate on the old `_rollSkillCheckLegacy`
   * body (since deleted at session 25).
   * @private
   */
  _emitSkillDescriptionViaAdapter (skillId, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId, mode: 'description' })
    const { skill, skillItem, abilityLabel } = resolved

    if (skillItem && skillItem.system.description.value) {
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="skill-description">${skillItem.system.description.value}</div>`,
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`,
        flags: {
          'dcc.RollType': 'SkillCheck',
          'dcc.ItemId': skillId,
          'dcc.SkillId': skillId,
          'dcc.isSkillCheck': true
        },
        system: { skillId, skillDescription: skillItem.system.description.value }
      })
    }
  }

  /**
   * Build the `DCCRoll.createRoll` term-descriptor array for a resolved
   * skill (the "legacy" term-descriptor *format* the Foundry roll dialog
   * + `DCCRoll.createRoll` consume — not a legacy code path). Shared by
   * `_skillTableViaAdapter` (table + disapproval-range lookups) and
   * `_rollSkillCheckViaAdapter`'s `showModifierDialog` branch (open
   * question #7), both of which still drive Foundry's
   * `RollModifierDialog` / `DCCRoll.createRoll` and so need the
   * descriptor shape. Renamed from `_buildSkillCheckLegacyTerms` at
   * Phase 7 session 25 when the last legacy caller
   * (`_rollSkillCheckLegacy`) was deleted.
   * @private
   */
  _buildSkillCheckRollTerms (skillId, resolved) {
    const { skill, abilityLabel, abilityMod, die, hasDie } = resolved
    const terms = []

    if (hasDie) {
      terms.push({
        type: 'Die',
        label: skill.die ? null : game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      })
    }

    if (skill.value !== undefined) {
      // Fold the ability mod and the Active-Effect skill modifier
      // (`otherMod`, see #714) into the same Compound term so the dialog
      // total matches the non-dialog modifier list.
      const otherMod = parseInt(String(skill.otherMod ?? 0), 10) || 0
      const parts = [skill.value.toString()]
      if (abilityMod !== 0) parts.push(`${abilityMod}`)
      if (otherMod !== 0) parts.push(`${otherMod}`)
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize(skill.label) + abilityLabel,
        formula: parts.join(' + ')
      })
    }

    if (skill.level && skill.level !== 0) {
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.Level'),
        formula: `${skill.level}`
      })
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.DeedRoll'),
        formula: parseInt(this.system.details.lastRolledAttackBonus)
      })
    }

    const checkPenaltyCouldApply =
      ['sneakSilently', 'climbSheerSurfaces'].includes(skillId) ||
      !!skill.config?.applyCheckPenalty
    const checkPenalty = ensurePlus(this.system.attributes.ac.checkPenalty || '0')
    if (checkPenaltyCouldApply && checkPenalty !== '+0') {
      terms.push({
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: checkPenaltyCouldApply
      })
    }

    return terms
  }
}
