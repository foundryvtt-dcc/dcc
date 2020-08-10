/* global Item */

/**
 * Extend the base Item entity for DCC RPG
 * @extends {Item}
 */
class DCCItem extends Item {
  prepareData () {
    super.prepareData()

    /*
    const itemData = this.data
    const actorData = this.actor ? this.actor.data : {}
    const data = itemData.data
    */
  }
}

export default DCCItem
