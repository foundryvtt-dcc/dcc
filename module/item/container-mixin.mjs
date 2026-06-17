/**
 * Container-support mixin for {@link DCCItem}.
 *
 * Phase 7 (Appendix-A item.js shrinkage): the self-contained container-support
 * block — the weight/capacity/depth getters plus the containment-validation
 * helpers — was lifted out of `module/item.js` into this mixin. `DCCItem` now
 * declares `extends ContainerItemMixin(Item)`, so every member below remains an
 * instance getter/method on `DCCItem` with byte-identical behavior and `this`
 * semantics — consumers (`actor-sheet.js`, `item-sheet.js`,
 * `item-piles-support.js`) read these straight off a live item and need no
 * change.
 *
 * The block is fully self-contained: it reads only `this` / `this.system` /
 * `this.parent` / `this.id` / `this.type` and the `MAX_CONTAINER_DEPTH`
 * constant (moved here with it). No spell/roll/lib/adapter entanglement, no
 * dispatch logging, no i18n at this layer — `canContainItem` returns i18n
 * *keys* for the caller to localize.
 *
 * @param {typeof Item} Base - the Foundry document class to extend (always
 *   `Item` in production; a stub in unit tests).
 * @returns {typeof Item} a subclass of `Base` carrying the container surface.
 */

const MAX_CONTAINER_DEPTH = 3

export const ContainerItemMixin = (Base) => class extends Base {
  /* -------------------------------------------- */
  /*  Container Support                            */
  /* -------------------------------------------- */

  /**
   * Is this item a container type?
   * @returns {boolean}
   */
  get isContainer () {
    return this.type === 'container'
  }

  /**
   * Is this item contained inside another item?
   * @returns {boolean}
   */
  get isContained () {
    return !!this.system.container
  }

  /**
   * Get the items contained in this container
   * @returns {DCCItem[]}
   */
  get contents () {
    if (!this.isContainer || !this.parent) return []
    return this.parent.items.filter(i => i.system.container === this.id)
  }

  /**
   * Get the total weight of contents, applying weight reduction
   * @returns {number}
   */
  get contentsWeight () {
    if (!this.isContainer) return 0
    let total = 0
    for (const item of this.contents) {
      const weight = parseFloat(item.system.weight) || 0
      const quantity = parseInt(item.system.quantity) || 1
      total += weight * quantity
    }
    const reduction = this.system.weightReduction || 0
    return total * (1 - reduction / 100)
  }

  /**
   * Get total weight: container's own weight + reduced contents weight
   * @returns {number}
   */
  get totalWeight () {
    const ownWeight = (parseFloat(this.system.weight) || 0) * (parseInt(this.system.quantity) || 1)
    return ownWeight + this.contentsWeight
  }

  /**
   * Get remaining weight capacity
   * @returns {number|null} null if unlimited
   */
  get availableWeightCapacity () {
    if (!this.isContainer) return null
    const maxWeight = this.system.capacity?.weight || 0
    if (maxWeight <= 0) return null
    return Math.max(0, maxWeight - this.contentsWeight)
  }

  /**
   * Get remaining item count capacity
   * @returns {number|null} null if unlimited
   */
  get availableItemCapacity () {
    if (!this.isContainer) return null
    const maxItems = this.system.capacity?.items || 0
    if (maxItems <= 0) return null
    return Math.max(0, maxItems - this.contentsItemCount)
  }

  /**
   * Get the total item count of contents, factoring in quantity
   * @returns {number}
   */
  get contentsItemCount () {
    if (!this.isContainer) return 0
    return this.contents.reduce((total, item) => {
      return total + (parseInt(item.system.quantity) || 1)
    }, 0)
  }

  /**
   * Calculate the nesting depth of this item in container hierarchy
   * @returns {number} 0 if not contained, 1+ for nesting level
   */
  get containerDepth () {
    if (!this.isContained || !this.parent) return 0
    let depth = 0
    let current = this
    while (current.system.container && depth <= MAX_CONTAINER_DEPTH) {
      depth++
      current = this.parent.items.get(current.system.container)
      if (!current) break
    }
    return depth
  }

  /**
   * Check if adding an item to this container would create a circular reference
   * @param {string} itemId - ID of the item to check
   * @returns {boolean} true if circular
   */
  wouldCreateCircularContainment (itemId) {
    if (this.id === itemId) return true
    if (!this.isContained || !this.parent) return false
    let current = this
    let steps = 0
    while (current.system.container && steps <= MAX_CONTAINER_DEPTH) {
      if (current.system.container === itemId) return true
      current = this.parent.items.get(current.system.container)
      if (!current) break
      steps++
    }
    return false
  }

  /**
   * Check if an item can be added to this container
   * @param {DCCItem} item - The item to check
   * @returns {{allowed: boolean, reason: string|null}}
   */
  canContainItem (item) {
    if (!this.isContainer) {
      return { allowed: false, reason: 'DCC.ContainerNotAContainer' }
    }
    if (item.system.container === undefined) {
      return { allowed: false, reason: 'DCC.ContainerItemNotPhysical' }
    }
    if (item.id === this.id) {
      return { allowed: false, reason: 'DCC.ContainerCannotContainSelf' }
    }
    if (this.wouldCreateCircularContainment(item.id)) {
      return { allowed: false, reason: 'DCC.ContainerCircularReference' }
    }
    // Check nesting depth
    if (item.isContainer) {
      const itemDepth = item.isContained ? item.containerDepth : 0
      const thisDepth = this.containerDepth
      if (thisDepth + itemDepth + 1 >= MAX_CONTAINER_DEPTH) {
        return { allowed: false, reason: 'DCC.ContainerMaxDepth' }
      }
    }
    // Check item capacity
    if (this.availableItemCapacity !== null) {
      const itemQuantity = parseInt(item.system.quantity) || 1
      if (itemQuantity > this.availableItemCapacity) {
        return { allowed: false, reason: 'DCC.ContainerFull' }
      }
    }
    // Check weight capacity
    if (this.availableWeightCapacity !== null) {
      const itemWeight = (parseFloat(item.system.weight) || 0) * (parseInt(item.system.quantity) || 1)
      if (itemWeight > this.availableWeightCapacity) {
        return { allowed: false, reason: 'DCC.ContainerTooHeavy' }
      }
    }
    return { allowed: true, reason: null }
  }
}

export { MAX_CONTAINER_DEPTH }
export default ContainerItemMixin
