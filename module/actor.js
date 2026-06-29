/* global Actor, ChatMessage, CONFIG, CONST, game, ui, foundry */
// noinspection JSUnresolvedReference

import { logAbilityChange } from './ability-score-log.js'
import DCCActorLevelChange from './actor-level-change.js'
import { ActiveEffectsMixin } from './actor/active-effects-mixin.mjs'
import { DerivedStatsMixin } from './actor/derived-stats-mixin.mjs'
import { RollDataMixin } from './actor/roll-data-mixin.mjs'
import { RollsSpellMixin } from './actor/rolls-spell-mixin.mjs'
import { RollsWeaponMixin } from './actor/rolls-weapon-mixin.mjs'
import { RollsCheckMixin } from './actor/rolls-check-mixin.mjs'
import { RollsSkillMixin } from './actor/rolls-skill-mixin.mjs'
import { parseActionDice } from './vendor/dcc-core-lib/index.js'
import { multipleActionDiceEnabled } from './action-dice-tracker.mjs'

// noinspection JSUnusedGlobalSymbols
/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */
class DCCActor extends RollsSkillMixin(RollsCheckMixin(RollsWeaponMixin(RollsSpellMixin(RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor))))))) {
  /**
   * Canonical lowercase class identifier for this actor, or `null` if
   * `system.details.sheetClass` is empty. Use this for class dispatch
   * (e.g. `actor.classId === 'halfling'`) instead of comparing the
   * raw `sheetClass` field, which stores the capitalized sheet label
   * and may shift form when the lib's `Character.classId` projection
   * lands in a later phase.
   * @returns {string | null}
   */
  get classId () {
    const sheetClass = this.system?.details?.sheetClass
    return typeof sheetClass === 'string' && sheetClass.length > 0
      ? sheetClass.toLowerCase()
      : null
  }

  /** @override */
  prepareBaseData () {
    super.prepareBaseData()

    this.isNPC = (this.type === 'NPC')
    this.isPC = (this.type === 'Player')

    // Ensure HP values are numbers
    if (this.system.attributes?.hp) {
      if (this.system.attributes.hp.max !== undefined) {
        this.system.attributes.hp.max = Number(this.system.attributes.hp.max) || 0
      }
      if (this.system.attributes.hp.value !== undefined) {
        this.system.attributes.hp.value = Number(this.system.attributes.hp.value) || 0
      }
    }

    // Ability modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()
    const data = this.system

    // Set NPC computations to manual
    if (this.isNPC) {
      this.system.config.computeAC = false
      this.system.config.computeSpeed = false
      this.system.config.computeCheckPenalty = false
      this.system.config.computeMeleeAndMissileAttackAndDamage = false
    }

    // Cap level if required
    if (config.maxLevel) {
      data.details.level.value = Math.max(0, Math.min(data.details.level.value, parseInt(config.maxLevel)))
    }

    // Determine the correct fumble die and check penalty to use based on armor
    let fumbleDieRank = 0
    let fumbleDie = '1d4'
    let checkPenalty = 0
    if (this.itemTypes?.armor) {
      for (const armorItem of this.itemTypes.armor) {
        if (armorItem.system.equipped) {
          try {
            checkPenalty += parseInt(armorItem.system.checkPenalty || 0)
            const expression = armorItem.system.fumbleDie
            const rank = game.dcc.DiceChain.rankDiceExpression(expression)
            if (rank > fumbleDieRank) {
              fumbleDieRank = rank
              fumbleDie = expression
            }
          } catch (err) {
            // Ignore bad fumble die expressions
          }
        }
      }
    }
    data.attributes.fumble = foundry.utils.mergeObject(
      data.attributes.fumble || {},
      { die: fumbleDie }
    )
    if (data.config.computeCheckPenalty) {
      data.attributes.ac.checkPenalty = checkPenalty
    }

    // Compute derived values in prepareBaseData so items can access them during their preparation.
    // These will be called again in prepareDerivedData to update with any active effect
    // modifications to ability modifiers.
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    // Compute spell check for PCs so spell items can inherit it
    if (this.isPC) {
      this.computeSpellCheck()
    }

    // Compute initiative for PCs so weapon items can access it
    if (this.isPC && config.computeInitiative) {
      this.computeInitiative(config)
    }
  }

  /**
   * Compute the displayed Speed from its component parts.
   *
   * Kept as a pure static so the arithmetic is unit-testable without a full
   * actor prepare cycle (see __tests__/speed-compute.test.js).
   *
   * value = base + manual modifier + armor penalty + active-effect delta,
   * where the active-effect delta is the difference between the post-effect
   * in-memory value and the persisted (`_source`) value. Deriving the delta
   * from `_source` — rather than from baseSpeed — is what lets Config edits to
   * Base Speed reach the sheet (#739); the previous implementation used
   * `currentValue - baseSpeed`, which cancelled baseSpeed entirely.
   *
   * @param {object} parts
   * @param {number|string} parts.base          Configured base speed
   * @param {number|string} parts.otherMod      Manual flat modifier
   * @param {number|string} parts.armorPenalty  Summed armor speed penalty
   * @param {number|string} parts.currentValue  In-memory (post-effect) value
   * @param {number|string} parts.sourceValue   Persisted (pre-effect) value
   * @returns {number} The computed speed value
   */
  static computeSpeedValue ({ base, otherMod, armorPenalty, currentValue, sourceValue } = {}) {
    const baseSpeed = parseInt(base) || 0
    const mod = parseInt(otherMod) || 0
    const penalty = parseInt(armorPenalty) || 0
    const current = parseInt(currentValue)
    const source = parseInt(sourceValue)
    const aeModifier = (isNaN(current) || isNaN(source)) ? 0 : current - source
    return baseSpeed + mod + penalty + aeModifier
  }

  /** @override */
  prepareDerivedData () {
    super.prepareDerivedData()
    if (!this.overrides) this.overrides = {}

    // Recalculate ability modifiers after Active Effects have been applied
    // This ensures effects that modify ability values (e.g. +2 to str.value) are reflected in the modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()

    // Compute melee/missile attack and damage bonuses (after effects have modified ability modifiers)
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    // Compute spell check and saving throws for PCs (after effects have modified ability modifiers)
    if (this.isPC) {
      this.computeSpellCheck()
      if (config.computeSavingThrows) {
        this.computeSavingThrows()
      }
    }

    if (this.classId === 'elf') {
      this.system.skills.detectSecretDoors.value = '+4'
    }

    // For NPCs, add otherBonus to displayed save values (tracked as overrides for #714)
    if (this.isNPC) {
      const saves = this.system.saves
      for (const saveId of ['ref', 'frt', 'wil']) {
        const otherBonus = parseInt(saves[saveId].otherBonus || 0)
        if (otherBonus !== 0) {
          const baseValue = parseInt(saves[saveId].value || 0)
          saves[saveId].value = baseValue + otherBonus
          this.overrides[`system.saves.${saveId}.value`] = saves[saveId].value
        }
      }
    }

    // For NPCs, add init.otherMod to init.value (after effects are applied)
    if (this.isNPC) {
      const initOtherMod = parseInt(this.system.attributes.init.otherMod || 0)
      if (initOtherMod !== 0) {
        const baseInit = parseInt(this.system.attributes.init.value || 0)
        this.system.attributes.init.value = baseInit + initOtherMod
        this.overrides['system.attributes.init.value'] = this.system.attributes.init.value
      }
    }

    // For NPCs with computeAC disabled, add ac.otherMod to ac.value (after effects are applied)
    if (this.isNPC && !config.computeAC) {
      const acOtherMod = parseInt(this.system.attributes.ac.otherMod || 0)
      if (acOtherMod !== 0) {
        const baseAC = parseInt(this.system.attributes.ac.value || 10)
        this.system.attributes.ac.value = baseAC + acOtherMod
        this.overrides['system.attributes.ac.value'] = this.system.attributes.ac.value
      }
    }

    // Seed base speed from the persisted speed for older actors that stored no
    // base field at all (runtime safety net; the one-time migration corrects
    // actors whose base defaulted to '30'). Read from _source so a
    // schema-defaulted base does not mask a genuinely-unset value.
    if (this._source?.system?.attributes?.speed?.base === undefined ||
        this._source?.system?.attributes?.speed?.base === '') {
      this.system.attributes.speed.base = this.system.attributes.speed.value
    }

    // Compute AC if required
    if (config.computeAC || config.computeSpeed) {
      const baseACAbility = this.system.abilities[config.baseACAbility] || { mod: 0 }
      const abilityMod = baseACAbility.mod
      const acOtherMod = parseInt(this.system.attributes.ac.otherMod) || 0
      const abilityLabel = baseACAbility.label
      let armorBonus = 0
      let speedPenalty = 0
      for (const armorItem of this.itemTypes.armor) {
        if (armorItem.system.equipped) {
          armorBonus += parseInt(armorItem.system.acBonus || '0')
          speedPenalty += parseInt(armorItem.system.speed || '0')
        }
      }
      if (config.computeAC) {
        this.system.attributes.ac.baseAbility = abilityMod
        this.system.attributes.ac.baseAbilityLabel = abilityLabel
        this.system.attributes.ac.armorBonus = armorBonus
        this.system.attributes.ac.value = 10 + abilityMod + armorBonus + acOtherMod
      }
      if (config.computeSpeed) {
        this.system.attributes.ac.speedPenalty = speedPenalty
        this.system.attributes.speed.value = DCCActor.computeSpeedValue({
          base: this.system.attributes.speed.base,
          otherMod: this.system.attributes.speed.otherMod,
          armorPenalty: speedPenalty,
          currentValue: this.system.attributes.speed.value,
          sourceValue: this._source?.system?.attributes?.speed?.value
        })
      }
    }

    // Compute Initiative if required
    if (this.isPC && config.computeInitiative) {
      this.computeInitiative(config)
    }

    // Derive the structured action-dice list (multiple-action-dice feature).
    // Gated behind the master setting so that when off the system is
    // byte-for-byte on today's behavior — nothing reads `.list` and the
    // single-die path (attributes.actionDice.value) is untouched. The
    // authoring comma string in `config.actionDice` stays the source of
    // truth (it retains every die; attributes.actionDice.value keeps only
    // the first). See docs/dev/MULTIPLE_ACTION_DICE_DESIGN.md §5, §11.
    const actionDiceList = DCCActor.deriveActionDiceList({
      enabled: multipleActionDiceEnabled(),
      authoring: config.actionDice || this.system.attributes.actionDice.value || '',
      className: this.classId
    })
    if (actionDiceList) {
      this.system.attributes.actionDice.list = actionDiceList
    }

    // Re-prepare embedded items so they can see active effect modifications
    // Items initially prepare before applyActiveEffects runs, so they need
    // to re-read actor values that may have been modified by effects
    for (const item of this.items) {
      item.prepareData()
    }
  }

  /**
   * Derive the structured action-dice list for the multiple-action-dice
   * feature, or `null` when the feature is off. Pure so the off ⇒ no-list
   * guarantee and the wizard spells-only inference are directly unit-testable
   * without a full actor prepare cycle (mirrors {@link computeSpeedValue}).
   * @param {object} params
   * @param {boolean} params.enabled   The master setting state.
   * @param {string}  params.authoring The action-dice authoring string.
   * @param {string|null} params.className Canonical class id for use inference.
   * @returns {import('./vendor/dcc-core-lib/types/combat.js').ActionDieSlot[]|null}
   */
  static deriveActionDiceList ({ enabled, authoring, className } = {}) {
    if (!enabled) return null
    return parseActionDice(authoring || '', { className })
  }

  /**
   * Get per actor configuration
   *
   * @return {Object}       Configuration data
   */
  _getConfig () {
    let defaultConfig = {
      attackBonusMode: 'flat',
      actionDice: '1d20',
      maxLevel: '',
      computeAC: false,
      computeMeleeAndMissileAttackAndDamage: true,
      computeSpeed: false,
      baseACAbility: 'agl',
      sortInventory: true,
      removeEmptyItems: true,
      showSpells: false,
      showSkills: false,
      showBackstab: false
    }

    // Merge any existing data with defaults to implicitly migrate missing config fields
    defaultConfig = Object.assign(defaultConfig, this.system.config)
    this.system.config = defaultConfig

    return defaultConfig
  }

  /**
   * Level Change
   */
  levelChange () {
    new DCCActorLevelChange({ document: this }).render(true)
  }

  /**
   * Roll the Luck Die
   */
  async rollLuckDie (options = {}) {
    const die = this.system.class.luckDie
    options.title = game.i18n.localize('DCC.LuckDie')
    let luckSpend = 1

    // Collate terms for the roll
    const terms = [
      {
        type: 'LuckDie',
        formula: die,
        lck: this.system.abilities.lck.value,
        callback: (formula) => {
          // Record the amount of luck spent when the term is resolved
          luckSpend = game.dcc.DiceChain.countDice(formula)
        }
      }
    ]

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
    const flavor = game.i18n.format('DCC.LuckSpend', { luckSpend })

    // Spend the luck (logged in the ability score log when enabled)
    await logAbilityChange(this, {
      ability: 'lck',
      change: -luckSpend,
      type: 'luckSpend',
      source: options.title
    }, { announce: true })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags: {
        'dcc.RollType': 'LuckDie'
      }
    })
  }

  /**
   * Apply damage to this actor
   * @param {Number} damageAmount   Damage amount to apply
   * @param {Number} multiplier     Damage multiplier
   */
  async applyDamage (damageAmount, multiplier) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Calculate damage amount and current hit points
    const amount = damageAmount * multiplier
    const hp = this.system.attributes.hp.value

    let newHp = hp
    if (amount > 0) {
      // Taking damage - just subtract and allow damage to go below zero
      newHp = newHp - amount
    } else {
      // Healing - don't allow HP to be brought above MaxHP, but if it's already there assume it's intentional
      const maxHp = this.system.attributes.hp.max
      if (hp >= maxHp) {
        newHp = hp
      } else {
        newHp = Math.min(newHp - amount, maxHp)
      }
    }

    const deltaHp = newHp - hp

    // Announce damage or healing results
    if (Math.abs(deltaHp) > 0) {
      const locString = (deltaHp > 0) ? 'DCC.HealDamage' : 'DCC.TakeDamage'
      const messageData = {
        user: game.user.id,
        speaker,
        flags: {
          'dcc.isApplyDamage': true
        },
        content: game.i18n.format(locString, { damage: Math.abs(deltaHp) }),
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
        sound: CONFIG.sounds.notification
      }
      ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
      await CONFIG.ChatMessage.documentClass.create(messageData)
    }

    // Apply new HP
    return this.update({
      'system.attributes.hp.value': newHp
    })
  }

  /**
   * Lose a wizard spell through a casting failure
   */
  async loseSpell (item) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Mark the spell as lost - if the item is known
    if (item) {
      item.update({
        'system.lost': true
      })
    }

    // Announce that the spell (or a spell) was lost
    const locString = item ? game.i18n.format('DCC.SpellLostMessageFormat', { spell: item.name }) : game.i18n.localize('DCC.SpellLostMessage')
    const messageData = {
      user: game.user.id,
      speaker,
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: locString,
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Apply a point of disapproval
   */
  async applyDisapproval (amount = 1) {
    if (this.isNPC) {
      return
    }

    const speaker = ChatMessage.getSpeaker({ actor: this })
    // Calculate new disapproval
    const newRange = Math.min(this.system.class.disapproval + amount, 20)

    // Apply the new disapproval range
    this.update({
      'system.class.disapproval': newRange
    })

    // Announce that disapproval was increased
    const messageData = {
      user: game.user.id,
      speaker,
      flags: {
        'dcc.isDisapproval': true
      },
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: game.i18n.format('DCC.DisapprovalGained', { range: newRange }),
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Prompt and roll for disapproval
   * @param {Number} naturalRoll   Optional - the natural roll for the last spell check
   */
  async rollDisapproval (naturalRoll) {
    // Generate a formula, placeholder if the natural roll is not known
    const terms = [
      {
        type: 'DisapprovalDie',
        formula: `${naturalRoll || 1}d4`
      },
      {
        type: 'Modifier',
        label: 'Luck Modifier',
        formula: -this.system.abilities.lck.mod
      }
    ]
    const options = {}

    // Force the Roll Modifier dialog on if we don't know the formula
    if (naturalRoll === undefined) {
      options.showModifierDialog = true
    }

    // If we know the formula just roll it
    await this._onRollDisapproval(terms, options)
  }

  /**
   * Roll disapproval
   * @private
   * @param terms
   * @param options
   */
  async _onRollDisapproval (terms, options = {}) {
    try {
      const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

      if (!roll) { return }

      // Lookup the disapproval table if available
      let disapprovalTable = null
      for (const disapprovalPackName of CONFIG.DCC.disapprovalPacks.packs) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalPackName && disapprovalTableName) {
          const pack = game.packs.get(disapprovalPackName)
          if (pack) {
            const entry = pack.index.find((entity) => `${disapprovalPackName}.${entity.name}` === disapprovalTableName)
            if (entry) {
              disapprovalTable = await pack.getDocument(entry._id)
            }
          }
        }
      }

      // If not found in compendium packs, try the local world tables
      if (!disapprovalTable) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalTableName) {
          // Extract just the table name from the full path if needed
          // e.g., "dcc-core-book.dcc-core-disapproval.Disapproval" -> "Disapproval"
          const tableName = disapprovalTableName.includes('.')
            ? disapprovalTableName.split('.').pop()
            : disapprovalTableName

          // Search for a table in the world with a matching name
          disapprovalTable = game.tables.find((entity) => entity.name === tableName)
        }
      }

      // Draw from the table if found, otherwise display the roll
      if (disapprovalTable) {
        disapprovalTable.draw({ roll, displayChat: true })
      } else {
        // Fall back to displaying just the roll
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          flavor: game.i18n.localize('DCC.DisapprovalRoll'),
          flags: {
            'dcc.RollType': 'Disapproval'
          }
        })
      }
    } catch (err) {
      if (err) {
        ui.notifications.warn(game.i18n.format('DCC.DisapprovalFormulaWarning'))
      }
    }
  }

  /**
   * Override fromImport to fix legacy item IDs that are not 16 characters
   * Foundry v13 requires exactly 16-character alphanumeric IDs
   * @param {object} json - The JSON data to import
   * @returns {Promise<Document>} The created document
   */
  static async fromImport (json) {
    // Fix any item IDs that are not exactly 16 characters
    if (json.items && Array.isArray(json.items)) {
      for (const item of json.items) {
        if (item._id && (item._id.length !== 16 || !/^[a-zA-Z0-9]+$/.test(item._id))) {
          // Truncate or pad the ID to 16 characters while keeping it alphanumeric
          if (item._id.length > 16) {
            item._id = item._id.substring(0, 16)
          } else {
            // Pad with random alphanumeric characters
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            while (item._id.length < 16) {
              item._id += chars.charAt(Math.floor(Math.random() * chars.length))
            }
          }
        }
      }
    }
    return super.fromImport(json)
  }
}

export default DCCActor
