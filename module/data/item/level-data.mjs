/* global foundry */
/**
 * Data model for level items
 * Level items store class progression data
 */
const { StringField } = foundry.data.fields

export class LevelData extends foundry.abstract.TypeDataModel {
  static defineSchema () {
    return {
      class: new StringField({ initial: '' }),
      level: new StringField({ initial: '' }),
      levelData: new StringField({ initial: '' }),
      levelDataLawful: new StringField({ initial: '' }),
      levelDataNeutral: new StringField({ initial: '' }),
      levelDataChaotic: new StringField({ initial: '' })
    }
  }
}
