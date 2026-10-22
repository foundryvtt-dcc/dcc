/* global Object */

/*
 * Manage lists of compendium packs
 */
class TablePackManager {
  constructor (options = {}) {
    this._packs = {}
    this._updateHook = options.updateHook
  }

  addPack (newPack, fromSystemConfig = false) {
    // There can only ever be one pack from the system config; clearing the
    // setting (an empty value) drops it
    if (fromSystemConfig) {
      for (const key in this._packs) {
        const pack = this._packs[key]
        if (pack.fromSystemConfig) {
          delete this._packs[key]
        }
      }
    }

    if (!newPack) {
      if (fromSystemConfig && this._updateHook) {
        this._updateHook(this)
      }
      return
    }

    // Add the new pack if not already present
    if (!this._packs[newPack]) {
      this._packs[newPack] = {
        key: newPack,
        fromSystemConfig
      }
    }

    // Update any listeners
    if (this._updateHook) {
      this._updateHook(this)
    }
  }

  removePack (packToRemove) {
    // Delete the pack
    delete this._packs[packToRemove]

    // Update any listeners
    if (this._updateHook) {
      this._updateHook(this)
    }
  }

  get packs () {
    return Object.keys(this._packs)
  }
}

export default TablePackManager
