/* global foundry */
/**
 * A formula-capable coin-value schema for a physical item's worth
 * (pp/ep/gp/sp/cp). Unlike {@link CurrencyField} — which an actor's wallet uses
 * and must stay integer for arithmetic + ecosystem currency-walking (Item Piles,
 * §2.12) — an item's value may be authored as a rollable DCC treasure formula
 * (e.g. a hoard worth `3d100` gp). Each denomination is therefore a
 * `StringField` so a die formula persists; `DCCItem.needsValueRoll()` flags it as
 * unresolved and `DCCItem.rollValue()` resolves it in place (writing the rolled
 * total back, which the StringField stores as its string form). The downstream
 * readers (the coin-merge in `actor-sheet/items.mjs`, the conversion math in
 * `item/currency-mixin.mjs`) already `parseInt(...)` these, so a resolved value
 * behaves identically to the old integer field.
 */
const { SchemaField, StringField } = foundry.data.fields

export class TreasureValueField extends SchemaField {
  /**
   * @param {object} additionalFields - Additional fields to include
   */
  constructor (additionalFields = {}) {
    super({
      pp: new StringField({ initial: '0' }),
      ep: new StringField({ initial: '0' }),
      gp: new StringField({ initial: '0' }),
      sp: new StringField({ initial: '0' }),
      cp: new StringField({ initial: '0' }),
      ...additionalFields
    })
  }
}
