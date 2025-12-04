/**
 * Data model for Party actors
 * Party actors only use the common template
 */
import { BaseActorData } from './base-actor.mjs'

export class PartyData extends BaseActorData {
  static defineSchema () {
    return {
      ...super.defineSchema()
      // Party has no additional fields beyond common
    }
  }
}
