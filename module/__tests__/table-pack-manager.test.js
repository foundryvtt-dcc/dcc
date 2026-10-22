import { describe, expect, test, vi } from 'vitest'
import TablePackManager from '../table-pack-manager.js'

describe('TablePackManager', () => {
  test('clearing the system setting drops its pack and keeps module packs', () => {
    const updateHook = vi.fn()
    const manager = new TablePackManager({ updateHook })
    manager.addPack('some-module.deeds')
    manager.addPack('dcc-core-book.dcc-core-deed-tables', true)

    manager.addPack('', true)

    expect(manager.packs).toEqual(['some-module.deeds'])
    expect(updateHook).toHaveBeenCalledTimes(3)
  })

  test('an empty module registration is ignored', () => {
    const updateHook = vi.fn()
    const manager = new TablePackManager({ updateHook })
    manager.addPack('')
    expect(manager.packs).toEqual([])
    expect(updateHook).not.toHaveBeenCalled()
  })
})
