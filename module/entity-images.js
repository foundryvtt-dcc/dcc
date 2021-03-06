/* global CONFIG */

class EntityImages {
  /**
   * Select an appropriate image from a map
   * @param {Object}  map     The map of entity types (or default) to image paths
   * @param {String}  type    The entity type
   * @returns {String}        The image to use
   */
  static _selectImage (map, type) {
    // Grab the default image if available
    let img = map.default

    // Check for a more specialised image based on actor type
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
}

export default EntityImages
