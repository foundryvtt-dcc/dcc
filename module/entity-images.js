/* global CONFIG */

class EntityImages {
  /**
   * Select an appropriate image from a map
   * @param {Object}  map       The map of entity types (or default) to image paths
   * @param type                The actor type
   * @param {String}  fallback  Fallback key
   * @returns {String}          The image to use
   */
  static _selectImage (map, type = 'default', fallback = '') {
    let img = fallback
    if (map[type]) {
      img = map[type]
    }
    return img
  }

  /**
   * Select an appropriate image for an actor
   * @param {String}  type    The actor type
   * @returns {String}        The image to use
   */
  static imageForActor (type) {
    return this._selectImage(CONFIG.DCC.defaultActorImages, type)
  }

  /**
   * Select an appropriate image for an item
   * @param {String}  type    The item type
   * @returns {String}        The image to use
   */
  static imageForItem (type) {
    return this._selectImage(CONFIG.DCC.defaultItemImages, type)
  }

  /**
   * Select an appropriate image for a macro
   * @param {String} macro      The macro category or dice size
   * @param {String} fallback   Fallback category
   * @returns {String}          The image to use
   */
  static imageForMacro (macro, fallback = '') {
    return this._selectImage(CONFIG.DCC.macroImages, macro, fallback)
  }
}

export default EntityImages
