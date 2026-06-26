/**
 * Unit coverage for module/chat-message.js — the DCCChatMessage compatibility
 * shim. V14 removed the `getSpeakerActor()` instance method in favour of the
 * `speakerActor` getter; the shim restores the method by delegating to it so
 * modules/macros (e.g. dcc-qol) calling the V13 form don't throw (issue: QoL
 * `message.getSpeakerActor is not a function`).
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

let DCCChatMessage

beforeEach(async () => {
  // Minimal ChatMessage base exposing the V14 `speakerActor` getter.
  globalThis.ChatMessage = class ChatMessage {
    get speakerActor () { return this._speakerActor ?? null }
  }
  DCCChatMessage = (await import('../chat-message.js')).default
})

afterEach(() => { delete globalThis.ChatMessage })

describe('DCCChatMessage.getSpeakerActor', () => {
  test('is a callable instance method (the V13 form modules still use)', () => {
    const msg = new DCCChatMessage()
    expect(typeof msg.getSpeakerActor).toBe('function')
  })

  test('delegates to the V14 speakerActor getter', () => {
    const actor = { name: 'Speaker' }
    const msg = new DCCChatMessage()
    msg._speakerActor = actor
    expect(msg.getSpeakerActor()).toBe(actor)
  })

  test('returns null when there is no speaker actor', () => {
    expect(new DCCChatMessage().getSpeakerActor()).toBeNull()
  })
})
