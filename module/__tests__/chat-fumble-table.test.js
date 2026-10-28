import { describe, expect, it } from 'vitest'
import '../__mocks__/foundry.js'
import { fumbleTableForMessage } from '../chat.js'

describe('fumbleTableForMessage', () => {
  it('reads the PC, NPC and weapon override tables from a click-to-roll flavor (#1110)', () => {
    expect(fumbleTableForMessage({ flavor: 'Fumble (Table 4-2: Fumbles)' })).toEqual({ tableName: 'Table 4-2: Fumbles', isNPC: false })
    expect(fumbleTableForMessage({ flavor: 'Fumble (Fumble Table M)' })).toEqual({ tableName: 'Fumble Table M', isNPC: true })
    expect(fumbleTableForMessage({ flavor: 'Fumble (Firearm Fumbles)' })).toEqual({ tableName: 'Firearm Fumbles', isNPC: false })
    expect(fumbleTableForMessage({ flavor: 'Fumble' })).toEqual({ tableName: 'Table 4-2: Fumbles', isNPC: false })
    expect(fumbleTableForMessage({ flavor: 'Fumble (Fumbles (Firearms))' })).toEqual({ tableName: 'Fumbles (Firearms)', isNPC: false })
    expect(fumbleTableForMessage({ flavor: 'Fumble (Table 4-2: Fumbles - Firearms)' })).toEqual({ tableName: 'Table 4-2: Fumbles - Firearms', isNPC: false })
  })
})
