/* global ChatMessage */

/**
 * Extend the base ChatMessage document with a backward-compatibility shim for
 * the `getSpeakerActor()` instance method that Foundry removed in V14.
 *
 * V14 replaced the instance method with the `speakerActor` getter (the static
 * `ChatMessage.getSpeakerActor(speaker)` remains). Modules and macros that
 * still call the V13 instance form — notably dcc-qol's attack-card hook
 * (`enhanceAttackRollCard`) — otherwise throw `message.getSpeakerActor is not a
 * function`, which aborts chat-card rendering and spams the console. Restoring
 * the method here keeps those callers working without each one needing its own
 * V14 fix (DCC already tracks dcc-qol compatibility — see CLAUDE.md).
 *
 * @extends {ChatMessage}
 */
class DCCChatMessage extends ChatMessage {
  /**
   * The Actor that represents the speaker of this message, if any.
   * V13 instance-method shim delegating to the V14 `speakerActor` getter.
   * @returns {Actor|null}
   */
  getSpeakerActor () {
    return this.speakerActor
  }
}

export default DCCChatMessage
