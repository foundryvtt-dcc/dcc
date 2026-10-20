/**
 * Data model for Party actors
 * Party actors use the common template and derive live member hit points
 */
import { BaseActorData } from './base-actor.mjs'

export class PartyData extends BaseActorData {
  /** Current world-member HP, derived on access and never persisted. */
  get aggregate () {
    const aggregate = { value: 0, max: 0 }
    const roster = this.parent?.getFlag('dcc', 'partyMembers')
    const members = Array.isArray(roster) ? roster : []
    const actors = globalThis.game?.actors
    const ids = new Set(members.map(member => member.id))
    for (const id of ids) {
      const hp = actors?.get(id)?.system?.attributes?.hp
      const value = Number(hp?.value)
      const max = Number(hp?.max)
      aggregate.value += Number.isFinite(value) ? value : 0
      aggregate.max += Number.isFinite(max) ? max : 0
    }
    return { hp: aggregate }
  }

  static defineSchema () {
    return {
      ...super.defineSchema()
      // Party has no additional fields beyond common
    }
  }
}
