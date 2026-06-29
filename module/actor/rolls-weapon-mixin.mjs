/* global CONFIG, game, Hooks, Roll, ChatMessage, ui, foundry */

import { ensurePlus, getCritTableResult, getCritTableLink, getFumbleTableResult, getNPCFumbleTableResult, getFumbleTableNameFromCritTableName, addDamageFlavorToRolls } from '../utilities.js'
import {
  makeAttackRoll as libMakeAttackRoll,
  rollDamage as libRollDamage,
  rollCritical as libRollCritical,
  rollFumble as libRollFumble,
  getMonsterFumbleDie
} from '../vendor/dcc-core-lib/index.js'
import { qolHandlingCombat } from '../integrations.mjs'
import { highestPcTargetLuckMod } from '../combat-targeting.mjs'
import { autoApplyAttackDamage, attackHitsTarget } from '../auto-apply-damage.mjs'
import { maybeFriendlyFire } from '../friendly-fire.mjs'
import { buildAttackInput, hookTermsToBonuses, normalizeLibDie } from '../adapter/attack-input.mjs'
import { buildDamageInput, buildPassthroughDamageResult, parseDamageFormula, parseMultiTypeFormula, parseWeaponMagicBonus, peelTrailingFlavor } from '../adapter/damage-input.mjs'
import { buildCriticalInput, buildFumbleInput } from '../adapter/crit-fumble-input.mjs'
import { logDispatch, warnIfDivergent, withRollErrorBoundary } from '../adapter/debug.mjs'
import { buildDamageBreakdown } from './damage-breakdown.mjs'
import { planActionDie, slotRollFormula, spendPlannedActionDie, formatActionDiceChatLine, noEligibleActionDieWarning } from '../action-dice-tracker.mjs'

const { TextEditor } = foundry.applications.ux

/**
 * Weapon-attack dispatch mixin for {@link DCCActor}.
 *
 * Phase 7 actor.js shrinkage (continued): the weapon attack/damage/crit/
 * fumble dispatch layer — the public `rollWeaponAttack` + `rollCritical`
 * wrappers plus their private dispatchers (`_rollWeaponAttackDispatch`,
 * `rollToHit`, `_rollDamage`, `_buildLibDamageResult`,
 * `_structureDamageInput`, `_rollCritical`, `_rollFumble`) — was lifted
 * out of `module/actor.js` into this mixin. `DCCActor` composes it into
 * its `extends` chain so every method stays an instance method with
 * byte-identical behavior and `this` semantics (`this.getActionDice` /
 * `this.getRollData` / `this.classId` resolve up the prototype chain to
 * the mixin or class that defines them).
 *
 * Public surface unchanged: `actor.rollWeaponAttack()` and
 * `actor.rollCritical()` are the documented entry points; the rest are
 * internal. Self-contained: depends only on the attack/damage adapter
 * imports above and the Foundry globals.
 *
 * @param {typeof import('foundry').Actor} Base - the class to extend.
 * @returns {typeof Base} a subclass carrying the weapon-attack dispatchers.
 */
export const RollsWeaponMixin = (Base) => class extends Base {
  /**
   * Roll a weapon's attack, damage, and handle any crits
   * @param {string} weaponId    The weapon name or slot id (e.g. "m1", "r1")
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollWeaponAttack (weaponId, options = {}) {
    return withRollErrorBoundary('rollWeaponAttack', game.i18n.localize('DCC.Attack'), () => {
      return this._rollWeaponAttackDispatch(weaponId, options)
    })
  }

  /**
   * Internal weapon-attack dispatch body. Extracted from
   * `rollWeaponAttack` so the public method is a thin
   * `withRollErrorBoundary` wrapper while the (long) attack / damage /
   * crit / fumble orchestration stays at one indent level.
   * @private
   */
  async _rollWeaponAttackDispatch (weaponId, options = {}) {
    const automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')
    const messageMode = game.settings.get('core', 'messageMode')

    // First try and find the item by id
    const weapon = this.items.find(i => i.id === weaponId)

    // If weapon is not found, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', { id: weaponId }))
    }

    // Warn if weapon is not equipped
    if (!weapon.system?.equipped && game.settings.get('dcc', 'checkWeaponEquipment') && this.isPC) return ui.notifications.warn(game.i18n.localize('DCC.WeaponWarningUnequipped'))

    // Accumulate all rolls for sending to the chat message
    const rolls = []

    // Multiple action dice (Phase 3) — when enabled and this actor is in
    // combat, default the action die to the next unspent eligible slot and
    // spend it after the roll. `planActionDie` returns null on the off-path
    // (setting off / not in combat / no budget), leaving today's behavior.
    // A stale `_actionDieFormula` from a reused options object is cleared
    // first; only an extra die (slot index > 0) overrides the weapon's die,
    // so the first action of the round stays byte-identical to today.
    delete options._actionDieFormula
    const actionDicePlan = planActionDie(this, 'attack')
    if (actionDicePlan?.choice && actionDicePlan.choice.index > 0) {
      options._actionDieFormula = slotRollFormula(actionDicePlan.choice.slot)
    }
    // Soft spells-only filter (Phase 4 / D1a): if the only action dice left are
    // restricted to other uses (a wizard's spells-only die can't make a weapon
    // attack), warn — but never block. The roll proceeds on the default die and
    // the chat line reads "no eligible action die".
    const noEligibleWarning = noEligibleActionDieWarning(actionDicePlan, 'attack')
    if (noEligibleWarning) ui.notifications.warn(noEligibleWarning)

    // Attack roll
    options.targets = game.user.targets // Add targets set to options
    const attackRollResult = await this.rollToHit(weapon, options)
    if (!attackRollResult) return // <-- if the attack roll is cancelled, return

    // Spend the planned die (the tracker pip flips on the flag update) and
    // build the "Action N of M" chat line. Null plan ⇒ off-path, no line.
    const actionDiceChatLine = formatActionDiceChatLine(await spendPlannedActionDie(actionDicePlan))

    if (attackRollResult.naturalCrit) {
      options.naturalCrit = true
    }
    foundry.utils.mergeObject(attackRollResult.roll.options, { 'dcc.isAttackRoll': true })
    const attackRollHTML = await attackRollResult.roll.render()
    rolls.push(attackRollResult.roll)

    // Damage roll - use modified formula from roll modifier dialog if available
    let damageRollFormula = attackRollResult.weaponDamageFormula || weapon.system.damage
    if (attackRollResult.deedDieRollResult) {
      const rawDeedFormula = attackRollResult.deedDieFormula // e.g. "d4"
      const deedBonusStringComponent = ensurePlus(rawDeedFormula) // e.g. "+d4", this is what's in the damage formula from warrior bonus
      const deedNumericResult = attackRollResult.deedDieRollResult.toString() // e.g. "4"
      // Determine sign from how deed was added to formula, then append numeric result
      const replacementDeedValueString = (deedBonusStringComponent.startsWith('-') ? '-' : '+') + deedNumericResult // e.g. "+4"
      damageRollFormula = damageRollFormula.replace(deedBonusStringComponent, replacementDeedValueString)

      if (damageRollFormula.includes('@ab')) {
        // This does not handle very high level characters that might have a deed die and a deed die modifier
        // But since @ab really should only be for NPCs, we don't have a way of splitting out such a mod from a strength mod
        // So when building NPCs, ensure that @ab really only accounts for the deed die, not a deed die mod, you can add that to the damage formula
        damageRollFormula = damageRollFormula.replaceAll('@ab', attackRollResult.deedDieRollResult)
      }
    }
    if (options.backstab && weapon.system?.backstabDamage) {
      if (!weapon.system?.damageWeapon || weapon.system.damageWeapon.trim() === '') {
        // No weapon damage component to replace, use backstab damage directly
        damageRollFormula = weapon.system.backstabDamage
      } else {
        // Replace the weapon damage component with backstab damage
        damageRollFormula = damageRollFormula.replace(weapon.system.damageWeapon, weapon.system.backstabDamage)
      }
    }

    // Add damage bonus adjustment for NPCs (from Active Effects)
    // For PCs, this is already incorporated via computeMeleeAndMissileAttackAndDamage()
    let npcDamageAdjustment = 0
    if (this.isNPC && damageRollFormula) {
      const isMeleeWeapon = weapon.system?.melee !== false
      npcDamageAdjustment = isMeleeWeapon
        ? parseInt(this.system.details.attackDamageBonus?.melee?.adjustment) || 0
        : parseInt(this.system.details.attackDamageBonus?.missile?.adjustment) || 0
      if (npcDamageAdjustment !== 0) {
        damageRollFormula = `${damageRollFormula}${npcDamageAdjustment >= 0 ? '+' : ''}${npcDamageAdjustment}`
      }
    }

    let damageRoll, damageInlineRoll, damagePrompt, libDamageResult
    let libCritResult, libFumbleResult
    if (automateDamageFumblesCrits && damageRollFormula) {
      const damageDispatch = await this._rollDamage(weapon, damageRollFormula, { ...options, npcDamageAdjustment })
      damageRoll = damageDispatch.damageRoll
      damageInlineRoll = damageDispatch.damageInlineRoll
      damagePrompt = damageDispatch.damagePrompt
      libDamageResult = damageDispatch.libDamageResult
      rolls.push(damageRoll)
    } else if (damageRollFormula) {
      damageInlineRoll = await TextEditor.enrichHTML(`[[/r ${damageRollFormula} # Damage]]`)
      damagePrompt = game.i18n.localize('DCC.RollDamage')
    }

    // Deed roll
    const deedDieRoll = attackRollResult.deedDieRoll
    const deedDieFormula = attackRollResult.deedDieFormula
    const deedDieRollResult = attackRollResult.deedDieRollResult
    const deedRollSuccess = attackRollResult.deedDieRollResult > 2

    // On a successful deed, offer a prompt to look up the deed die result on a Mighty Deed table (issue #319).
    // Gated on the `mightyDeedsEnabled` world setting (off by default) so the prompt never appears unless a GM opts in.
    let deedTables = []
    if (deedRollSuccess && game.settings.get('dcc', 'mightyDeedsEnabled')) {
      deedTables = Object.values(CONFIG.DCC.mightyDeedsTables || {})
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    // Crit roll
    let critRollFormula = ''
    let critInlineRoll = ''
    let critPrompt = game.i18n.localize('DCC.RollCritical')
    let critRoll
    const critTableName = weapon.system?.critTable || this.system.attributes.critical?.table || ''
    let critResult = '' // Separate storage for navigable result
    let critTableLookupHint = '' // Set when no crit table is available (look-it-up prompt)
    let critRollTotal = null
    const luckMod = ensurePlus(this.system.abilities.lck.mod)
    // Monster crit vs a PC: a defending PC's Luck always alters the monster's
    // crit (RAW). Only when this actor is an NPC, the rule's automation is on,
    // and dcc-qol isn't driving combat. 0 (no PC target) is a no-op.
    const defenderLuckMod = (this.isNPC && !qolHandlingCombat() && game.settings.get('dcc', 'playerLuckVsMonsterCrits'))
      ? (highestPcTargetLuckMod(options.targets) ?? 0)
      : 0
    if (attackRollResult.crit) {
      const critDispatch = await this._rollCritical(weapon, {
        automate: automateDamageFumblesCrits,
        luckMod,
        defenderLuckMod,
        critTableName
      })
      critRollFormula = critDispatch.critRollFormula
      critInlineRoll = critDispatch.critInlineRoll
      critPrompt = critDispatch.critPrompt
      critRoll = critDispatch.critRoll
      critResult = critDispatch.critResult
      critTableLookupHint = critDispatch.critTableLookupHint
      critRollTotal = critDispatch.critRollTotal
      libCritResult = critDispatch.libCritResult
      if (critRoll) rolls.push(critRoll)
    }

    // Fumble roll
    let fumbleRollFormula = ''
    let fumbleInlineRoll = ''
    let fumblePrompt = ''
    let useNPCFumbles = true // even if core compendium isn't installed, still show correct fumble table in flavor text
    try {
      useNPCFumbles = game.settings.get('dcc-core-book', 'registerNPCFumbleTables') || true
    } catch {
      // Module not installed, use default (true)
    }
    let fumbleTableName = (this.isPC || !useNPCFumbles) ? 'Table 4-2: Fumbles' : getFumbleTableNameFromCritTableName(critTableName)
    const originalFumbleTableName = fumbleTableName // Preserve for navigation

    let fumbleRoll
    let fumbleResult = '' // Separate storage for navigable result
    let fumbleRollTotal = null
    let isNPCFumble = false
    const inverseLuckMod = ensurePlus((parseInt(this.system.abilities.lck.mod) * -1).toString())
    // Optional Monster Fumbles rule (DCC Yearbook #8): a monster fumbling
    // against PC(s) steps its fumble die by the highest targeted PC's Luck.
    // null (rule off / no PC target / dcc-qol active) leaves the flat NPC die.
    const monsterFumbleLuckMod = (this.isNPC && !qolHandlingCombat() && game.settings.get('dcc', 'monsterFumbles'))
      ? highestPcTargetLuckMod(options.targets)
      : null
    if (attackRollResult.fumble) {
      const fumbleDispatch = await this._rollFumble(weapon, {
        automate: automateDamageFumblesCrits,
        luckMod,
        inverseLuckMod,
        useNPCFumbles,
        monsterFumbleLuckMod,
        fumbleTableName,
        originalFumbleTableName
      })
      fumbleRollFormula = fumbleDispatch.fumbleRollFormula
      fumbleInlineRoll = fumbleDispatch.fumbleInlineRoll
      fumblePrompt = fumbleDispatch.fumblePrompt
      fumbleRoll = fumbleDispatch.fumbleRoll
      fumbleResult = fumbleDispatch.fumbleResult
      fumbleRollTotal = fumbleDispatch.fumbleRollTotal
      fumbleTableName = fumbleDispatch.fumbleTableName
      isNPCFumble = fumbleDispatch.isNPCFumble
      libFumbleResult = fumbleDispatch.libFumbleResult
      if (fumbleRoll) rolls.push(fumbleRoll)
    }

    const flags = {
      'dcc.isToHit': true,
      // Record the automation decision made here, at creation time, so viewers
      // render the card from what actually happened rather than re-deriving it
      // from their own setting (issue #783). The enhanced attack card reads this
      // to choose Roll buttons vs. resolved results consistently for everyone.
      'dcc.automated': automateDamageFumblesCrits,
      'dcc.isBackstab': options.backstab,
      'dcc.isFumble': attackRollResult.fumble,
      'dcc.isCrit': attackRollResult.crit,
      'dcc.isNaturalCrit': attackRollResult.naturalCrit,
      'dcc.isMelee': weapon.system?.melee
    }
    // Hit/miss vs the selected target, computed here while the targets are in
    // hand (they're stripped from system data before create). Read back by the
    // enhanced attack card's hit/miss banner.
    const primaryTarget = options.targets?.first?.()
    const primaryTargetActor = primaryTarget?.actor
    if (primaryTargetActor) {
      flags['dcc.hasTarget'] = true
      flags['dcc.hitsTarget'] = attackHitsTarget(attackRollResult, primaryTargetActor)
      flags['dcc.targetName'] = primaryTarget?.name ?? primaryTargetActor.name ?? ''
    }
    if (attackRollResult.libResult) {
      flags['dcc.libResult'] = attackRollResult.libResult
    }
    if (libDamageResult) {
      flags['dcc.libDamageResult'] = libDamageResult
    }
    if (libCritResult) {
      flags['dcc.libCritResult'] = libCritResult
    }
    if (libFumbleResult) {
      flags['dcc.libFumbleResult'] = libFumbleResult
    }
    game.dcc.FleetingLuck.updateFlags(flags, attackRollResult.roll)

    // Speaker object for the chat cards
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Check for halfling two-weapon fighting special note
    let twoWeaponNote = ''
    if (attackRollResult.fumble &&
      (weapon.system?.twoWeaponPrimary || weapon.system?.twoWeaponSecondary) &&
      this.classId === 'halfling') {
      twoWeaponNote = game.i18n.localize('DCC.HalflingTwoWeaponFumbleNote')
    }

    const messageData = {
      user: game.user.id,
      speaker,
      flavor: game.i18n.format(options.backstab ? 'DCC.BackstabRoll' : 'DCC.AttackRoll', { weapon: weapon.name }),
      flags,
      rolls,
      system: {
        actorId: this.id,
        attackRollHTML,
        damageInlineRoll,
        damagePrompt,
        damageRoll,
        damageRollFormula,
        critInlineRoll,
        critPrompt,
        critRoll,
        critRollFormula,
        critResult,
        critTableLookupHint,
        critRollTotal,
        ...(attackRollResult.crit ? { critTableName } : {}),
        critDieOverride: weapon.system?.config?.critDieOverride,
        critTableOverride: weapon.system?.config?.critTableOverride,
        deedDieFormula,
        deedDieRoll,
        deedDieRollResult,
        deedRollSuccess,
        deedTables,
        fumbleInlineRoll,
        fumblePrompt,
        fumbleRoll,
        fumbleRollFormula,
        fumbleResult,
        fumbleRollTotal,
        fumbleTableName,
        originalFumbleTableName,
        isNPCFumble,
        hitsAc: attackRollResult.hitsAc,
        targets: game.user.targets,
        weaponId,
        weaponName: weapon.name,
        twoWeaponNote,
        actionDiceChatLine
      }
    }

    // noinspection JSValidateJSDoc
    /**
     * A hook event that fires after an attack has been rolled but before chat message is sent
     * @function dcc.rollWeaponAttack
     * @memberof hookEvents
     * @param {object} messageData                     Data to send to the chat card
     * @param {object} data
     */
    await Hooks.callAll('dcc.rollWeaponAttack', rolls, messageData)

    // Remove non-serializable objects before creating the ChatMessage
    // In Foundry v14, system data goes through TypeDataModel validation which can't handle
    // Roll objects or Sets with circular references. This is safe for v13 as well.
    delete messageData.system.targets
    delete messageData.system.damageRoll
    delete messageData.system.critRoll
    delete messageData.system.fumbleRoll
    delete messageData.system.deedDieRoll

    messageData.content = await foundry.applications.handlebars.renderTemplate('systems/dcc/templates/chat-card-attack-result.html', { message: messageData })

    // Output the results
    ChatMessage.applyMode(messageData, messageMode)
    ChatMessage.create(messageData)

    // Auto-apply damage to a hit target (setting-gated; routes through the GM
    // socket). Fire-and-forget — it swallows its own errors.
    autoApplyAttackDamage(options, attackRollResult, damageRoll)

    // Friendly fire: a missed missile shot into melee may stray into an ally
    // (setting-gated). Fire-and-forget — it swallows its own errors.
    maybeFriendlyFire(this, options, attackRollResult, weapon)
  }

  /**
   * Roll a weapon attack through the lib's `makeAttackRoll`. Foundry's
   * `DCCRoll.createRoll` owns the chat render + the `dcc.modifyAttackRollTerms`
   * hook contract verbatim; after the Roll evaluates, the natural d20
   * (and deed die when present) feed the lib via a sequenced roller so
   * the lib owns the classification + `appliedModifiers` list that
   * downstream chat flags surface as `dcc.libResult`.
   *
   * D1 (Phase 3 session 15) retired the `_rollToHitLegacy` branch —
   * the Phase 3 gate (`_canRouteAttackViaAdapter`) had already reached
   * exhaustiveness at A7 (session 14), and the legacy body became dead
   * code. This is the single path now.
   *
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollToHit (weapon, options = {}) {
    logDispatch('rollWeaponAttack', 'adapter', { weapon: weapon?.name || 'unknown' })

    const toHit = (weapon.system?.toHit ?? '').replaceAll('@ab', this.system.details.attackBonus)
    // Hoisted: `getActionDice` runs a regex/split + a side-effecting implicit
    // `config.actionDice` migration write, so compute the preset list once and
    // reuse it for all three consumers — `die` (the [0] formula), the
    // action-die term `presets`, and `buildAttackInput` (passed the [0]
    // formula below) — rather than calling it three times.
    //
    // `forAction: 'attack'` applies the soft spells-only filter (Phase 4): a
    // wizard's spells-only die is dropped from the preset list so the dialog
    // never offers it for an attack. Slot 0 is always unrestricted, so the
    // `[0].formula` default die is unaffected; off-path (master off / no derived
    // list) the filter is a no-op and the presets are byte-identical.
    const actionDicePresets = this.getActionDice({ includeUntrained: true, forAction: 'attack' })
    const actorActionDice = actionDicePresets[0].formula
    // `_actionDieFormula` is the multiple-action-dice next-unspent override
    // (Phase 3), set by `_rollWeaponAttackDispatch` only for an extra die; it
    // is absent on the off-path so `die` resolves exactly as today.
    let die = weapon.system?.actionDie || actorActionDice
    if (options._actionDieFormula) die = options._actionDieFormula
    let critRange = parseInt(weapon.system?.critRange || this.system.details.critRange || 20)

    if (!Roll.validate(toHit)) {
      return { rolled: false, formula: toHit }
    }

    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: actionDicePresets
      },
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.DeedDie'),
        modifierLabel: game.i18n.localize('DCC.ToHit'),
        formula: toHit
      }
    ]

    // Session 9: thief backstab — push the Table 1-9 bonus term
    // identically to the legacy path, then surface the bonus to the
    // lib via `attackInput.bonuses` below so `libResult.total` matches
    // the Foundry Roll total.
    const backstabBonus = options.backstab
      ? (parseInt(this.system?.class?.backstab || '0') || 0)
      : 0
    if (options.backstab) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.Backstab'),
        presets: [],
        formula: backstabBonus
      })
    }

    if (this.isNPC) {
      const isMelee = weapon.system?.melee !== false
      const attackAdjustment = isMelee
        ? parseInt(this.system.details.attackHitBonus?.melee?.adjustment) || 0
        : parseInt(this.system.details.attackHitBonus?.missile?.adjustment) || 0
      if (attackAdjustment !== 0) {
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize(isMelee ? 'DCC.MeleeAttackAdjustment' : 'DCC.MissileAttackAdjustment'),
          formula: attackAdjustment
        })
      }
    }

    const termsLengthBefore = terms.length
    const proceed = Hooks.call('dcc.modifyAttackRollTerms', terms, this, weapon, options)
    if (!proceed) return
    const hookAddedTerms = terms.slice(termsLengthBefore)

    const rollOptions = Object.assign({ title: game.i18n.localize('DCC.ToHit') }, options)

    // Session 13 (A6): when the modifier dialog is shown, pass the
    // damage terms through so the user can modify both attack and
    // damage in one dialog. Legacy parity — same shape, same fields.
    // `modifiedDamageFormula` lands on `attackRoll.options` after the
    // dialog resolves; the `modifiedDamageFormula` read below picks it
    // up identically to legacy.
    if (options.showModifierDialog && weapon.system?.damage) {
      rollOptions.damageTerms = [
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.DamageDie'),
          modifierLabel: game.i18n.localize('DCC.DamageModifier'),
          formula: weapon.system.damage
        }
      ]
    }

    const attackRoll = await game.dcc.DCCRoll.createRoll(terms, Object.assign({ critical: critRange }, this.getRollData()), rollOptions)
    await attackRoll.evaluate()

    const strictCrits = game.settings.get('dcc', 'strictCriticalHits')
    if (strictCrits) {
      const originalDieMatch = die.match(/(\d+)d(\d+)/)
      const adjustedDieMatch = attackRoll.formula.match(/(\d+)d(\d+)/)
      if (originalDieMatch && adjustedDieMatch) {
        const originalDieSize = parseInt(originalDieMatch[2])
        const adjustedDieSize = parseInt(adjustedDieMatch[2])
        if (originalDieSize !== adjustedDieSize) {
          critRange = game.dcc.DiceChain.calculateProportionalCritRange(critRange, originalDieSize, adjustedDieSize)
        }
      }
    } else {
      critRange += parseInt(game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula))
    }

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = { upperThreshold: critRange }

    const attackInput = buildAttackInput(this, weapon, actorActionDice)
    // Keep the lib on the same die Foundry rolled when the multiple-action-dice
    // override picked an extra die (buildAttackInput otherwise prefers the
    // weapon's first-die `actionDie`), so crit/fumble classification and the
    // lib total match the evaluated Roll.
    if (options._actionDieFormula) {
      attackInput.actionDie = normalizeLibDie(options._actionDieFormula)
    }
    attackInput.threatRange = critRange
    // Reflect in-place mutations of the action-die term (e.g. dcc-qol's
    // long-range `DiceChain.bumpDie` rewriting `terms[0].formula` from
    // 1d20 to 1d16). Without this the lib's `actionDie` stays on the
    // pre-hook die while the Foundry Roll evaluates on the bumped one.
    const dieAfterHook = terms[0]?.formula
    if (dieAfterHook && dieAfterHook !== die) {
      attackInput.actionDie = normalizeLibDie(dieAfterHook)
    }
    const bonuses = []
    if (options.backstab) {
      attackInput.isBackstab = true
      if (backstabBonus !== 0) {
        bonuses.push({
          id: 'class:backstab',
          label: game.i18n.localize('DCC.Backstab'),
          source: { type: 'class', id: 'thief' },
          category: 'inherent',
          effect: { type: 'modifier', value: backstabBonus }
        })
      }
    }
    const hookBonuses = hookTermsToBonuses(hookAddedTerms)
    if (hookBonuses.length > 0) bonuses.push(...hookBonuses)
    if (bonuses.length > 0) attackInput.bonuses = bonuses

    // Session 10 (A3): warrior / dwarf deed die. Foundry's Roll already
    // evaluated both the action die (`dice[0]`) and the deed die
    // (`dice[1]`); build a roller closure that hands those naturals to
    // the lib in order — `evaluateRoll` consumes the first call (action
    // die), `rollDeedDie` consumes the second.
    let deedDieRoll
    let deedDieFormula = ''
    let deedDieRollResult = ''
    let deedSucceed = false
    const naturals = [d20RollResult]
    if (attackInput.deedDie) {
      // Gate said deedDie applies; the Foundry Roll's Compound term
      // must have produced a second dice entry. If it didn't (parser
      // regression, hook removed the deed term, lib formula change),
      // failing loud beats silently failing every deed forever.
      if (attackRoll.dice.length <= 1) {
        throw new Error(`[DCC adapter] deed-die expected on attackRoll.dice[1] but only ${attackRoll.dice.length} dice term(s) present (weapon=${weapon?.name})`)
      }
      const deedTotal = attackRoll.dice[1].total
      naturals.push(deedTotal)
      attackRoll.dice[1].options.dcc = { lowerThreshold: 2, upperThreshold: 3 }
      deedDieRollResult = deedTotal
      deedDieFormula = attackRoll.dice[1].formula
      if (!String(this.system.details.attackBonus).startsWith('+1')) {
        deedDieFormula = deedDieFormula.replace(/^1/, '')
      }
      deedDieRoll = Roll.fromTerms([attackRoll.dice[1]])
      deedDieRoll._total = deedTotal
      deedDieRoll._evaluated = true
      deedSucceed = deedTotal > 2
    }
    let rollerIdx = 0
    // Throw on over-consumption rather than silently feeding 0 — a future
    // lib that adds a third internal roll would otherwise silently get a
    // nat-1 (deterministic fumble) and `warnIfDivergent` might miss it
    // if the totals coincidentally agree.
    const sequencedRoller = () => {
      if (rollerIdx >= naturals.length) {
        throw new Error(`[DCC adapter] sequencedRoller exhausted: lib requested ${rollerIdx + 1} rolls, ${naturals.length} natural(s) available (weapon=${weapon?.name})`)
      }
      return naturals[rollerIdx++]
    }
    const libResult = libMakeAttackRoll(attackInput, sequencedRoller)

    // `hookTermsToBonuses` silently drops dice-bearing hook terms
    // (documented in `attack-input.mjs`), so divergence here is
    // expected when a hook injects a bonus die (e.g. dcc-qol's
    // stressful-range `-1d2`). Warn so the case is visible rather
    // than hidden in chat flags — and so a genuine lib-version
    // regression shows up immediately.
    warnIfDivergent('rollToHit', attackRoll.total, libResult.total, { weapon: weapon?.name })

    const fumble = libResult.isFumble
    const naturalCrit = libResult.isCriticalThreat
    const crit = !fumble && naturalCrit

    const modifiedDamageFormula = attackRoll.options?.modifiedDamageFormula

    return {
      d20RollResult,
      deedDieFormula,
      deedDieRollResult,
      deedDieRoll,
      deedSucceed,
      crit,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      fumble,
      hitsAc: attackRoll.total,
      naturalCrit,
      roll: attackRoll,
      rolled: true,
      weaponDamageFormula: modifiedDamageFormula || weapon.system?.damage || weapon.damage,
      libResult: {
        die: attackInput.actionDie,
        natural: d20RollResult,
        total: libResult.total,
        totalBonus: libResult.totalBonus,
        isHit: libResult.isHit,
        isCriticalThreat: libResult.isCriticalThreat,
        critSource: libResult.critSource,
        isFumble: libResult.isFumble,
        modifiers: libResult.appliedModifiers,
        bonuses: attackInput.bonuses || [],
        deedDie: attackInput.deedDie,
        deedNatural: libResult.deedRoll?.natural,
        deedSuccess: libResult.deedSuccess,
        isTwoWeaponPrimary: !!weapon.system?.twoWeaponPrimary,
        isTwoWeaponSecondary: !!weapon.system?.twoWeaponSecondary
      }
    }
  }

  /**
   * Damage-roll route. Single path after Phase 3 session 19 (D2 damage
   * retirement): the gate is exhaustive thanks to multi-type /
   * dice-bearing / cursed support plus passthrough fallback for
   * unparseable formulas.
   *
   * Rendering branches on whether the formula has per-term flavors
   * (`1d6[fire]+1d6[cold]`):
   *   - Per-term flavor → native `new Roll` so Foundry preserves the
   *     per-term labels in the chat breakdown (matches legacy's
   *     `hasPerTermFlavors` branch).
   *   - Otherwise → `DCCRoll.createRoll` with a Compound term, peeling
   *     any single trailing `[flavor]` off the formula.
   *
   * After evaluation, `_buildLibDamageResult` structures the input for
   * the lib (multi-type split, dice-bearing magic-bonus strip, cursed
   * flat negative, or simple flat) or falls back to a lossless
   * passthrough. Foundry remains authoritative for the displayed total
   * + chat anchor — `libDamageResult` only populates `dcc.libDamageResult`
   * on chat flags. Both the lib and Foundry apply the DCC min-1 damage
   * floor, so `libDamageResult.total` already matches the displayed
   * total (the lib leaves `baseDamage` / `modifierDamage` raw, so they
   * won't sum to a floored `total`).
   *
   * @param {Object} weapon
   * @param {string} damageRollFormula
   * @param {Object} options
   * @private
   */
  async _rollDamage (weapon, damageRollFormula, options = {}) {
    logDispatch('rollDamage', 'adapter', { weapon: weapon?.name || 'unknown' })

    const hasPerTermFlavors = /\d+d\d+\[/.test(damageRollFormula)

    let damageRoll
    if (hasPerTermFlavors) {
      damageRoll = new Roll(damageRollFormula, this.getRollData())
      await damageRoll.evaluate()
    } else {
      const { formula: peeledFormula, flavor } = peelTrailingFlavor(damageRollFormula)
      damageRoll = game.dcc.DCCRoll.createRoll([
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.Damage'),
          flavor,
          formula: peeledFormula
        }
      ])
      await damageRoll.evaluate()
    }
    foundry.utils.mergeObject(damageRoll.options, { 'dcc.isDamageRoll': true })
    if (damageRoll.total < 1) {
      damageRoll._total = 1
    }

    const libDamageResult = this._buildLibDamageResult(weapon, damageRollFormula, damageRoll, options)

    let damageInlineRoll = damageRoll.toAnchor({
      classes: ['damage-applyable', 'inline-dsn-hidden'],
      dataset: { damage: damageRoll.total }
    }).outerHTML

    const damageBreakdown = buildDamageBreakdown(damageRoll)
    if (damageBreakdown) {
      damageInlineRoll += ` <span class="damage-breakdown">(${damageBreakdown})</span>`
    }

    return {
      damageRoll,
      damageInlineRoll,
      damagePrompt: game.i18n.localize('DCC.Damage'),
      libDamageResult
    }
  }

  /**
   * Build a lib-native `libDamageResult` from a Foundry-evaluated
   * damage Roll. Routes the raw formula + weapon through the
   * appropriate structurer (multi-type, dice-bearing magic, simple
   * flat) and feeds a sequenced-natural roller into the lib's
   * `rollDamage`. Falls back to a passthrough shape when no
   * structurer can digest the inputs.
   *
   * @private
   */
  _buildLibDamageResult (weapon, damageRollFormula, damageRoll, options) {
    const structured = this._structureDamageInput(weapon, damageRollFormula, options)
    if (!structured) return buildPassthroughDamageResult(damageRoll)

    // Sequence the naturals from Foundry's evaluated dice so the lib's
    // evaluateRoll calls (one per extraDamageDice term, plus the base)
    // line up with what Foundry rolled. For single-die formulas,
    // `naturals` has one entry and the closure returns it once.
    const naturals = damageRoll.dice.map(d => d?.total ?? 0)
    let idx = 0
    const sequencedRoller = () => naturals[idx++] ?? 0

    const libResult = libRollDamage(structured, sequencedRoller)

    // Both sides apply the DCC min-1 damage floor: Foundry clamps
    // `damageRoll.total` at 1 above, and the lib clamps its own `total`
    // (`combat/damage.js`: `Math.max(1, baseDamage + modifierDamage)`).
    // So `libResult.total` already matches the displayed total — the
    // `Math.max(1, …)` here is belt-and-suspenders against a future lib
    // that drops its floor. Note the lib leaves `baseDamage` /
    // `modifierDamage` raw, so on a floored hit they won't sum to the
    // clamped `total`; that is the lib's deliberate shape.
    warnIfDivergent('rollDamage', damageRoll.total, Math.max(1, libResult.total), { weapon: weapon?.name })

    return {
      damageDie: libResult.roll.formula,
      natural: naturals[0] ?? null,
      baseDamage: libResult.baseDamage,
      modifierDamage: libResult.modifierDamage,
      total: libResult.total,
      breakdown: libResult.breakdown
    }
  }

  /**
   * Choose a parsing strategy for a Foundry damage formula + weapon and
   * return a lib `DamageInput`, or `null` when no strategy applies and
   * the caller should fall back to the passthrough shape.
   *
   * Strategies tried in order:
   *   1. Multi-type per-term flavor formula (`1d6[fire]+1d6[cold]`) →
   *      `parseMultiTypeFormula` splits into base + extras. The base
   *      term's flavor is dropped (lib breakdown hardcodes
   *      `source: 'weapon'`); Foundry's chat render preserves it.
   *   2. Simple formula + dice-bearing magic bonus (`damageWeaponBonus:
   *      '+1d4'`) → strip the suffix item.js appended, parse the base
   *      via `parseDamageFormula`, feed the dice as `extraDamageDice[]`.
   *   3. Simple formula + flat magic bonus (positive = magic, negative
   *      = cursed) → `parseDamageFormula` + `buildDamageInput` with
   *      `magicBonus`.
   *   4. Simple formula, non-magical → same as 3 with `magicBonus: 0`.
   *
   * @private
   */
  _structureDamageInput (weapon, damageRollFormula, options) {
    if (/\d+d\d+\[/.test(damageRollFormula)) {
      const parsed = parseMultiTypeFormula(damageRollFormula)
      if (!parsed) return null
      const input = {
        damageDie: parsed.base.die,
        diceCount: parsed.base.diceCount,
        strengthModifier: parsed.modifier || 0
      }
      if (parsed.extras.length > 0) {
        input.extraDamageDice = parsed.extras.map(e => {
          const entry = { count: e.count, die: e.die }
          if (e.flavor !== undefined) {
            entry.flavor = e.flavor
            entry.source = e.flavor
          }
          return entry
        })
      }
      return input
    }

    const { formula: peeledFormula } = peelTrailingFlavor(damageRollFormula)

    const magic = parseWeaponMagicBonus(weapon)
    let baseFormula = peeledFormula
    let extraFromMagic = null
    let flatMagicBonus = 0

    if (magic === null) return null
    if (magic.kind === 'dice') {
      // item.js concatenates the raw damageWeaponBonus onto the derived
      // damage formula verbatim for dice-bearing bonuses. Strip that
      // exact suffix so the remaining formula parses via parseDamageFormula.
      const raw = weapon.system.damageWeaponBonus.trim()
      const suffix = /^[+-]/.test(raw) ? raw : `+${raw}`
      if (peeledFormula.endsWith(suffix)) {
        baseFormula = peeledFormula.slice(0, peeledFormula.length - suffix.length)
      } else if (peeledFormula.endsWith(raw)) {
        baseFormula = peeledFormula.slice(0, peeledFormula.length - raw.length)
      }
      const entry = { count: magic.count, die: magic.die, source: 'magic' }
      if (magic.flavor !== undefined) {
        entry.flavor = magic.flavor
        entry.source = magic.flavor
      }
      extraFromMagic = entry
    } else if (magic.kind === 'flat') {
      flatMagicBonus = magic.value
    }

    const parsed = parseDamageFormula(baseFormula)
    if (!parsed) return null

    const input = buildDamageInput(parsed, {
      npcDamageAdjustment: options.npcDamageAdjustment,
      magicBonus: flatMagicBonus
    })
    if (extraFromMagic) {
      input.extraDamageDice = [extraFromMagic]
    }
    return input
  }

  /**
   * Crit-finisher route. Builds the Foundry Roll (when `automate` is on),
   * feeds the natural die into the lib's `rollCritical`, and returns the
   * chat-ready shape for `rollWeaponAttack` to stitch into the message.
   *
   * With `automate` off, no Roll is evaluated — the caller renders an
   * inline `[[/r ...]]` template the user clicks to roll manually. No
   * `libCritResult` is produced in that mode (nothing rolled to feed the
   * lib). Otherwise the lib owns classification + total that surface as
   * `dcc.libCritResult` on the chat flags.
   *
   * D2 (Phase 3 session 16) retired the `_rollCriticalLegacy` branch
   * when the crit gate went exhaustive — the `!automate` path was the
   * only remaining non-adapter case and it had no lib work to do, so it
   * folded into this body directly.
   *
   * @param {Object} weapon
   * @param {{automate: boolean, luckMod: string, critTableName: string}} ctx
   * @private
   */
  async _rollCritical (weapon, ctx) {
    logDispatch('rollCritical', 'adapter', { weapon: weapon?.name || 'unknown' })

    const { automate, luckMod, defenderLuckMod = 0, critTableName } = ctx
    const critDie = weapon.system?.critDie || this.system.attributes.critical?.die || '1d10'
    // A defending PC's Luck is subtracted from the monster's crit roll (RAW):
    // +Luck lowers the result, -Luck raises it.
    const defenderLuckTerm = defenderLuckMod ? ensurePlus((-defenderLuckMod).toString(), false) : ''
    const critRollFormula = `${critDie}${luckMod}${defenderLuckTerm}`
    const criticalText = game.i18n.localize('DCC.Critical')
    const critTableText = game.i18n.localize('DCC.CritTable')
    const critTableDisplayText = `${critTableText} ${critTableName}`
    const critTableLink = await getCritTableLink(critTableName, critTableDisplayText)

    if (!automate) {
      const critInlineRoll = await TextEditor.enrichHTML(`[[/r ${critRollFormula} # ${criticalText} (${critTableDisplayText})]] <span style="white-space:nowrap">(${critTableLink})</span>`)
      return {
        critRollFormula,
        critInlineRoll,
        critPrompt: game.i18n.localize('DCC.RollCritical'),
        critRoll: undefined,
        critResult: '',
        critTableLookupHint: '',
        critRollTotal: null
      }
    }

    const critPrompt = criticalText
    const critRoll = game.dcc.DCCRoll.createRoll([
      {
        type: 'Compound',
        dieLabel: criticalText,
        formula: critRollFormula
      }
    ])
    await critRoll.evaluate()
    foundry.utils.mergeObject(critRoll.options, { 'dcc.isCritRoll': true })
    const critRollTotal = critRoll.total

    const naturalCrit = critRoll.dice[0]?.total ?? critRoll.total
    const critInput = buildCriticalInput({
      critDie,
      luckModifier: parseInt(this.system.abilities.lck.mod) || 0,
      defenderLuckModifier: defenderLuckMod,
      critTableName
    })
    const libResult = libRollCritical(critInput, () => naturalCrit)

    warnIfDivergent('rollCritical', critRoll.total, libResult.total, { weapon: weapon?.name })

    let critResult = ''
    let critTableLookupHint = ''
    const critResultObj = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
    if (critResultObj) {
      critResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(critResultObj.description))
    } else {
      // No crit table available (e.g. the core book module is disabled).
      // Don't fail silently and don't complain about the missing module —
      // the rolled total is shown in the crit anchor above; just point the
      // user at the table to look up by hand in their physical rulebook.
      critTableLookupHint = game.i18n.format('DCC.CritTableLookupHint', { table: critTableDisplayText })
    }
    const critResultPrompt = game.i18n.localize('DCC.CritResult')
    const critRollAnchor = critRoll.toAnchor({ classes: ['inline-dsn-hidden'], dataset: { damage: critRoll.total } }).outerHTML
    const critInlineRoll = await TextEditor.enrichHTML(`${critResultPrompt} ${critRollAnchor} <span style="white-space:nowrap">(${critTableLink})</span>`)

    return {
      critRollFormula,
      critInlineRoll,
      critPrompt,
      critRoll,
      critResult,
      critTableLookupHint,
      critRollTotal,
      libCritResult: {
        critDie: libResult.roll.formula,
        natural: naturalCrit,
        total: libResult.total,
        critTable: libResult.critTable,
        modifiers: libResult.roll.modifiers
      }
    }
  }

  /**
   * Fumble-finisher route. Builds the Foundry Roll (when `automate` is
   * on), feeds the natural die into the lib's `rollFumble`, and returns
   * the chat-ready shape for `rollWeaponAttack` to stitch into the
   * message.
   *
   * With `automate` off, no Roll is evaluated — the caller renders an
   * inline `[[/r ...]]` template the user clicks to roll manually. No
   * `libFumbleResult` is produced in that mode. Otherwise the lib owns
   * the result that surfaces as `dcc.libFumbleResult` on the chat flags.
   *
   * D2 (Phase 3 session 16) retired the `_rollFumbleLegacy` branch when
   * the fumble gate went exhaustive — same rationale as the crit route
   * above.
   *
   * @param {Object} weapon
   * @param {Object} ctx
   * @private
   */
  async _rollFumble (weapon, ctx) {
    logDispatch('rollFumble', 'adapter', { weapon: weapon?.name || 'unknown' })

    const { automate, inverseLuckMod, useNPCFumbles, monsterFumbleLuckMod = null, originalFumbleTableName } = ctx
    let fumbleTableName = ctx.fumbleTableName
    // NPC fumble die: flat 1d10, or — under the optional Monster Fumbles rule
    // (Yearbook #8) — stepped along the dice chain by the targeted PC's Luck.
    const npcFumbleDie = monsterFumbleLuckMod !== null ? getMonsterFumbleDie(monsterFumbleLuckMod) : '1d10'
    let fumbleRollFormula = `${this.system.attributes.fumble.die}${inverseLuckMod}`
    if (this.isNPC && useNPCFumbles) {
      fumbleRollFormula = npcFumbleDie
    }

    if (!automate) {
      const fumbleInlineRoll = await TextEditor.enrichHTML(`[[/r ${fumbleRollFormula} # Fumble (${fumbleTableName})]] (${fumbleTableName})`)
      return {
        fumbleRollFormula,
        fumbleInlineRoll,
        fumblePrompt: game.i18n.localize('DCC.RollFumble'),
        fumbleRoll: undefined,
        fumbleResult: '',
        fumbleRollTotal: null,
        fumbleTableName,
        isNPCFumble: false
      }
    }

    const fumblePrompt = game.i18n.localize('DCC.Fumble')
    const fumbleRoll = game.dcc.DCCRoll.createRoll([
      {
        type: 'Compound',
        dieLabel: fumblePrompt,
        formula: fumbleRollFormula
      }
    ])
    await fumbleRoll.evaluate()
    foundry.utils.mergeObject(fumbleRoll.options, { 'dcc.isFumbleRoll': true })
    const fumbleRollTotal = fumbleRoll.total

    const naturalFumble = fumbleRoll.dice[0]?.total ?? fumbleRoll.total
    const fumbleDie = this.isNPC && useNPCFumbles ? npcFumbleDie : this.system.attributes.fumble.die
    const fumbleInput = buildFumbleInput({
      fumbleDie,
      luckModifier: parseInt(this.system.abilities.lck.mod) || 0
    })
    const libResult = libRollFumble(fumbleInput, () => naturalFumble)

    warnIfDivergent('rollFumble', fumbleRoll.total, libResult.total, { weapon: weapon?.name })

    let isNPCFumble = false
    let fumbleResultObj
    if (this.isPC || !useNPCFumbles) {
      fumbleResultObj = await getFumbleTableResult(fumbleRoll)
    } else {
      isNPCFumble = true
      fumbleResultObj = await getNPCFumbleTableResult(fumbleRoll, originalFumbleTableName)
    }
    let fumbleResult = ''
    if (fumbleResultObj) {
      fumbleTableName = `${fumbleResultObj?.parent?.link}:<br>`.replace('Fumble Table ', '').replace('Crit/', '')
      fumbleResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(fumbleResultObj.description))
    }
    const onPrep = game.i18n.localize('DCC.on')
    const fumbleRollAnchor = fumbleRoll.toAnchor({ classes: ['inline-dsn-hidden'], dataset: { damage: fumbleRoll.total } }).outerHTML
    const fumbleInlineRoll = await TextEditor.enrichHTML(`${fumbleRollAnchor} ${onPrep} ${fumbleTableName}`)

    return {
      fumbleRollFormula,
      fumbleInlineRoll,
      fumblePrompt,
      fumbleRoll,
      fumbleResult,
      fumbleRollTotal,
      fumbleTableName,
      isNPCFumble,
      libFumbleResult: {
        fumbleDie: libResult.fumbleDie,
        natural: naturalFumble,
        total: libResult.total,
        modifiers: libResult.roll.modifiers
      }
    }
  }

  /**
   * Roll a Critical Hit
   * Called from sheet and macros
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollCritical (options = {}) {
    // Construct the terms
    const terms = [
      {
        type: 'Die',
        formula: options.critDieOverride || this.system.attributes.critical?.die || '1d10'
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: ensurePlus(this.system.abilities.lck.mod)
      }
    ]

    const critRoll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
    await critRoll.evaluate()
    const critRollFormula = critRoll.formula
    const critPrompt = game.i18n.localize('DCC.Critical')

    const critTableName = this.system.attributes.critical?.table
    const critResultObj = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
    let critResult = ''
    if (critResultObj) {
      critResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(critResultObj.description))
    }

    foundry.utils.mergeObject(critRoll.options, { 'dcc.isCritRoll': true })

    // Speaker object for the chat cards
    const speaker = ChatMessage.getSpeaker({ actor: this })

    const messageData = {
      user: game.user.id,
      speaker,
      flavor: game.i18n.format('DCC.CritDie'),
      flags: {
        'dcc.isCrit': true,
        'dcc.isNaturalCrit': true
      },
      rolls: [critRoll],
      system: {
        actorId: this.id,
        critPrompt,
        critResult,
        critRollFormula,
        critRollTotal: critRoll.total,
        critTableName,
        critInlineRoll: critResult
      }
    }

    // Note: critRoll is already in rolls array, no need to include in system data
    // Roll objects in system data can cause issues with Foundry v14's TypeDataModel
    ChatMessage.create(messageData)
  }
}
