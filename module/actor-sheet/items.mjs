/**
 * Inventory preparation for the DCC actor sheet.
 *
 * Phase 7 (Appendix-A actor-sheet.js shrinkage): `#prepareItems` was lifted out
 * of `module/actor-sheet.js` into this module as a free function. A sheet's
 * `#private` methods cannot be relocated to a mixin (private names are lexically
 * class-scoped), so the shrinkage shape here mirrors `actor-sheet/effects.mjs`:
 * a free function taking the actor, which `_prepareContext` now calls directly.
 *
 * Unlike the effects builders, this one is **not** pure — it mutates the actor:
 * it deletes zero-quantity items when `removeEmptyItems` is enabled, folds
 * resolved coin-treasure items into `system.currency`, and repairs missing /
 * mystery-man item icons. It is therefore "actor-logic → free function" rather
 * than "pure-logic → free function". The four Foundry globals it reaches
 * (`TextEditor`, the item-icon table, `game.i18n`, `game.settings`) are injected
 * via the {@link prepareItems} `deps` parameter — defaulting to the live globals,
 * matching the dependency-injection idiom in `extension-api.mjs` — so the
 * bucketing, coin-merge, and weight math are directly unit-testable. The method
 * was `#private` and had no prior unit coverage; as a free function it does now.
 */

import EntityImages from '../entity-images.js'

/**
 * Categorize an actor's items for sheet display and compute carried weights.
 *
 * Side effects on `actor` (preserved from the original `#prepareItems`):
 * - deletes physical items with quantity ≤ 0 when `system.config.removeEmptyItems`
 *   is on;
 * - merges resolved coin-treasure items into `system.currency` and deletes them;
 * - repairs items whose `img` is missing or the default mystery-man icon.
 *
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {object} [deps.TextEditor] - `foundry.applications.ux.TextEditor`.
 * @param {(type: string) => string} [deps.imageForItem] - item-type → icon path.
 * @param {object} [deps.i18n] - `game.i18n` (only `.localize` is used).
 * @param {object} [deps.settings] - `game.settings` (only `.get` is used).
 * @returns {Promise<object>} the inventory context merged into the sheet context.
 */
export async function prepareItems (actor, {
  TextEditor = globalThis.foundry?.applications?.ux?.TextEditor,
  imageForItem = (type) => EntityImages.imageForItem(type),
  i18n = globalThis.game?.i18n,
  settings = globalThis.game?.settings
} = {}) {
  // Initialize categories
  const ammunition = []
  const armor = []
  const coins = []
  const containers = []
  const equipment = []
  const mounts = []
  const spells = {}
  const skills = []
  const treasure = []
  const weapons = {
    melee: [],
    ranged: []
  }

  // Convert items collection to array immediately to ensure proper initialization
  let inventory = [...actor.items]

  if (actor.system.config.sortInventory) {
    // Lexical sort
    inventory = inventory.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Build a set of contained item IDs to filter them from normal categories
  // Only treat as contained if the referenced container actually exists on this actor
  const containedItemIds = new Set()
  for (const i of inventory) {
    if (i.system.container && actor.items.get(i.system.container)) {
      containedItemIds.add(i._id)
    }
  }

  // Iterate through items, allocating to categories
  const removeEmptyItems = actor.system.config.removeEmptyItems
  for (const i of inventory) {
    // Remove physical items with zero quantity
    if (removeEmptyItems && i.system.quantity !== undefined && i.system.quantity <= 0) {
      await actor.deleteEmbeddedDocuments('Item', [i._id])
      continue
    }

    // Fix the icon for items Foundry created with no icon or the mystery-man icon
    if (!i.img || i.img === 'icons/svg/mystery-man.svg') {
      i.img = imageForItem(i.type)
    }

    // Skip contained items — they will be nested under their container
    if (containedItemIds.has(i._id)) continue

    if (i.type === 'container') {
      // Build a plain object for template rendering since DCCItem has read-only getters
      const item = actor.items.get(i._id)
      const containerData = {
        _id: i._id,
        name: i.name,
        img: i.img,
        type: i.type,
        system: i.system,
        containerContents: item.contents,
        contentsWeight: item.contentsWeight,
        contentsItemCount: item.contentsItemCount,
        totalWeight: item.totalWeight,
        availableWeightCapacity: item.availableWeightCapacity,
        availableItemCapacity: item.availableItemCapacity
      }
      const maxWeight = i.system.capacity?.weight || 0
      const maxItems = i.system.capacity?.items || 0
      const summaryParts = []
      if (maxWeight > 0) {
        summaryParts.push(`${Number(containerData.contentsWeight.toFixed(2))}/${maxWeight} ${i18n.localize('DCC.WeightUnit')}`)
      }
      if (maxItems > 0) {
        summaryParts.push(`${containerData.contentsItemCount}/${maxItems} ${i18n.localize('DCC.ContainerItemsUnit')}`)
      }
      containerData.capacitySummary = summaryParts.join(', ')
      containers.push(containerData)
    } else if (i.type === 'weapon') {
      if (i.system.melee) {
        weapons.melee.push(i)
      } else {
        weapons.ranged.push(i)
      }
    } else if (i.type === 'ammunition') {
      ammunition.push(i)
    } else if (i.type === 'armor') {
      armor.push(i)
    } else if (i.type === 'equipment') {
      equipment.push(i)
    } else if (i.type === 'mount') {
      mounts.push(i)
    } else if (i.type === 'spell') {
      if (!i.system.level) {
        i.system.level = 0
      }
      // Enrich HTML for spell description for tooltips
      if (i.system.description?.value) {
        i.descriptionHTML = await TextEditor.enrichHTML(i.system.description.value, {
          relativeTo: i,
          secrets: actor.isOwner
        })
      }
      if (spells[i.system.level]) {
        spells[i.system.level].push(i)
      } else {
        spells[i.system.level] = [i]
      }
    } else if (i.type === 'skill') {
      // Resolve the die shown in the Skills "Die" column. A skill
      // with its own die (useDie) shows that die. With useDie off, a
      // rollable skill (value / ability / level) inherits the actor's
      // action die — matching what `rollSkillCheck` actually rolls —
      // so NPC skills no longer display "--" while still rolling the
      // action die. A pure description-only skill shows nothing.
      const skillConfig = i.system.config || {}
      if (skillConfig.useDie && i.system.die) {
        i.displayDie = i.system.die
      } else if (!skillConfig.useDie && (skillConfig.useValue || skillConfig.useAbility || skillConfig.useLevel)) {
        i.displayDie = actor.getActionDice()[0]?.formula || '1d20'
      } else {
        i.displayDie = null
      }
      skills.push(i)
    } else if (i.type === 'treasure') {
      let treatAsCoins = false

      if (i.system.isCoins) {
        // Safe to treat as coins if the item's value is resolved
        const item = actor.items.get(i._id)
        if (!item.needsValueRoll()) {
          treatAsCoins = true
        }
      }

      if (treatAsCoins) {
        coins.push(i)
      } else {
        treasure.push(i)
      }
    }
  }

  // Combine any extra coins into a single item
  if (coins.length) {
    const funds = {
      pp: parseInt(actor.system.currency.pp),
      ep: parseInt(actor.system.currency.ep),
      gp: parseInt(actor.system.currency.gp),
      sp: parseInt(actor.system.currency.sp),
      cp: parseInt(actor.system.currency.cp)
    }
    let needsUpdate = false
    for (const c of coins) {
      funds.pp += parseInt(c.system.value.pp)
      funds.ep += parseInt(c.system.value.ep)
      funds.gp += parseInt(c.system.value.gp)
      funds.sp += parseInt(c.system.value.sp)
      funds.cp += parseInt(c.system.value.cp)
      await actor.deleteEmbeddedDocuments('Item', [c._id])
      needsUpdate = true
    }
    if (needsUpdate) {
      await actor.update({
        'system.currency': funds
      }, { diff: true })
    }
  }

  // Helper function to calculate total weight for an array of items
  const calculateWeight = (items) => {
    let total = 0
    for (const item of items) {
      const weight = parseFloat(item.system.weight) || 0
      const quantity = parseInt(item.system.quantity) || 1
      total += weight * quantity
    }
    return Number.isFinite(total) ? total : 0
  }

  // Helper function to calculate treasure weight with configurable coin weight
  // When isCoins is true, weight = total coins / coinsPerPound (default 10)
  const coinsPerPound = settings.get('dcc', 'coinWeight') || 0
  const calculateTreasureWeight = (items) => {
    let total = 0
    for (const item of items) {
      if (item.system.isCoins && coinsPerPound > 0) {
        // Configurable coin weight (default: 10 coins = 1 pound)
        const value = item.system.value || {}
        const totalCoins = (value.pp || 0) + (value.ep || 0) + (value.gp || 0) + (value.sp || 0) + (value.cp || 0)
        total += totalCoins / coinsPerPound
      } else if (!item.system.isCoins) {
        // Non-coin treasure uses standard weight * quantity
        const weight = parseFloat(item.system.weight) || 0
        const quantity = parseInt(item.system.quantity) || 1
        total += weight * quantity
      }
      // If isCoins is true but coinsPerPound is 0, coins have no weight
    }
    return Number.isFinite(total) ? total : 0
  }

  // Calculate container weight (each container's totalWeight includes contents with reduction)
  const containersWeight = containers.reduce((sum, c) => sum + (c.totalWeight || 0), 0)

  // Calculate weights for each section
  const meleeWeight = calculateWeight(weapons.melee)
  const rangedWeight = calculateWeight(weapons.ranged)
  const armorWeight = calculateWeight(armor)
  const equipmentWeight = calculateWeight(equipment)
  const ammunitionWeight = calculateWeight(ammunition)
  const mountsWeight = calculateWeight(mounts)

  // Calculate treasure weight including actor's currency (configurable coins per pound)
  const actorCurrency = actor.system.currency || {}
  const actorCoinCount = (actorCurrency.pp || 0) + (actorCurrency.ep || 0) + (actorCurrency.gp || 0) + (actorCurrency.sp || 0) + (actorCurrency.cp || 0)
  const actorCoinWeight = coinsPerPound > 0 ? actorCoinCount / coinsPerPound : 0
  const treasureWeight = calculateTreasureWeight(treasure) + actorCoinWeight

  // Return the inventory object
  return {
    'equipment.ammunition': ammunition,
    'equipment.armor': armor,
    'equipment.containers': containers,
    'equipment.equipment': equipment,
    'equipment.mounts': mounts,
    'equipment.treasure': treasure,
    'equipment.weapons': weapons,
    'equipment.weights': {
      melee: meleeWeight,
      ranged: rangedWeight,
      armor: armorWeight,
      containers: containersWeight,
      equipment: equipmentWeight,
      ammunition: ammunitionWeight,
      mounts: mountsWeight,
      treasure: treasureWeight,
      total: meleeWeight + rangedWeight + armorWeight + containersWeight + equipmentWeight + ammunitionWeight + mountsWeight + treasureWeight
    },
    skills,
    spells
  }
}
