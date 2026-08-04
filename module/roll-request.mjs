/* global game, canvas, ui, CONFIG, ChatMessage, foundry */

/**
 * GM roll requests (issue #855).
 *
 * The DCC sidebar tab offers GMs a "Request Roll" tool that opens
 * {@link RollRequestDialog}: pick a player character (defaulting to a
 * controlled PC token's actor), pick a check — abilities first, then the
 * character's class skills (`system.skills`) and custom skill items —
 * and optionally set a DC. Submitting posts a chat card built on the
 * roll-link enricher infrastructure (#794/#852): the card body carries
 * raw `[[/check ...]]` / `[[/skill ...]]` text with an `actor=<uuid>`
 * option, chat content is re-enriched per client at render, and clicking
 * the link rolls for exactly the requested actor (ownership-gated in
 * `handleEnricherRollClick`). With a DC set, the resulting check card
 * shows the DC and Success/Failure via `dcResultSuffix`.
 *
 * The actor/check/source helpers are pure(ish) and exported for the unit
 * tests; the dialog itself is covered by the Playwright spec
 * `browser-tests/e2e/roll-request.spec.js`.
 */

import { skillDisplayName, escapeHtml } from './journal-enrichers.mjs'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * The player characters a roll can be requested from: all world actors
 * of type Player, sorted by name.
 * @returns {Actor[]}
 */
export function getRequestableActors () {
  return (game.actors ?? [])
    .filter(actor => actor.type === 'Player')
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The actor the dialog preselects: the first controlled PC token's
 * actor, or null when none is controlled.
 * @returns {Actor|null}
 */
export function getDefaultRequestActor () {
  for (const token of canvas?.tokens?.controlled ?? []) {
    if (token.actor?.type === 'Player') return token.actor
  }
  return null
}

/**
 * Assemble the check options for one actor: the six abilities first,
 * then the actor's skills — built-in class skill slots
 * (`system.skills`, e.g. thief skills) followed by custom skill items
 * from the skills tab. Values are namespaced (`check:agl` /
 * `skill:sneakSilently` / `skill:Nature Lore`) so the submit handler can
 * dispatch on type.
 *
 * @param {Actor|null} actor  The selected actor (null yields abilities only)
 * @returns {{abilities: Array<{value: string, label: string}>,
 *            skills: Array<{value: string, label: string}>}}
 */
export function buildCheckOptions (actor) {
  const checkSuffix = ` ${game.i18n.localize('DCC.Check')}`
  const abilities = Object.entries(CONFIG.DCC?.abilities ?? {}).map(([key, label]) => ({
    value: `check:${key}`,
    label: `${game.i18n.localize(label)}${checkSuffix}`
  }))

  const skills = []
  const seen = new Set()
  for (const [id, skill] of Object.entries(actor?.system?.skills ?? {})) {
    seen.add(id)
    skills.push({ value: `skill:${id}`, label: localizeSkillLabel(id, skill) })
  }
  // `rollSkillCheck` resolves built-in slots before items, so an item
  // whose name collides with a slot id would roll the slot — skip it.
  for (const item of actor?.itemTypes?.skill ?? []) {
    if (seen.has(item.name)) continue
    seen.add(item.name)
    skills.push({ value: `skill:${item.name}`, label: item.name })
  }

  return { abilities, skills }
}

/**
 * Display label for a built-in skill slot: its localized `label` i18n
 * key, falling back to a prettified id when the key has no translation.
 * @param {string} id     The skill slot id (e.g. 'sneakSilently')
 * @param {Object} skill  The skill slot data
 * @returns {string}
 */
function localizeSkillLabel (id, skill) {
  if (skill?.label) {
    const localized = game.i18n.localize(skill.label)
    if (localized !== skill.label) return localized
  }
  return skillDisplayName(id)
}

/**
 * Build the raw enricher source text for a roll request. Multi-word
 * skill names are double-quoted for the enricher config tokenizer;
 * characters that would break the enricher pattern or tokenizer
 * (brackets, braces, quotes) are stripped.
 *
 * @param {Object} params
 * @param {string} params.type       'check' | 'skill'
 * @param {string} params.key        Ability key, skill slot id, or skill item name
 * @param {number|null} [params.dc]  Optional DC
 * @param {string} [params.actorUuid]  Target actor uuid
 * @param {string} [params.label]    Optional custom display label
 * @returns {string} e.g. '[[/skill "Nature Lore" 12 actor=Actor.abc]]{DC 12 Nature Lore Check}'
 */
export function buildRollRequestSource ({ type, key, dc = null, actorUuid = '', label = '' }) {
  const cleanKey = String(key).replace(/["[\]{}]/g, '')
  const parts = [`/${type}`, /\s/.test(cleanKey) ? `"${cleanKey}"` : cleanKey]
  if (Number.isFinite(dc)) parts.push(String(dc))
  if (actorUuid) parts.push(`actor=${actorUuid}`)
  let source = `[[${parts.join(' ')}]]`
  if (label) source += `{${String(label).replace(/[{}[\]]/g, '')}}`
  return source
}

/**
 * Post a roll request card to chat for one actor and check. The card
 * body carries the raw enricher text — chat content is enriched per
 * client at render (see #852), so every player sees a live roll link
 * and only the requested actor's owner may trigger it.
 *
 * @param {Object} params
 * @param {Actor} params.actor       The actor being asked to roll
 * @param {string} params.checkValue Namespaced check ('check:agl' / 'skill:...')
 * @param {number|string|null} [params.dc]  Optional DC
 * @returns {Promise<ChatMessage>}
 */
export async function postRollRequest ({ actor, checkValue, dc = null }) {
  const separator = String(checkValue).indexOf(':')
  const type = String(checkValue).slice(0, separator)
  const key = String(checkValue).slice(separator + 1)
  const parsedDc = parseInt(dc)
  const dcValue = Number.isFinite(parsedDc) ? parsedDc : null

  // Built-in skill ids and item names have no actor-independent label
  // the enricher could resolve, so pass the label we showed the GM.
  let label = ''
  if (type === 'skill') {
    const slot = actor.system?.skills?.[key]
    const skillName = slot
      ? localizeSkillLabel(key, slot)
      : (actor.itemTypes?.skill?.find(item => item.name === key)?.name ?? skillDisplayName(key))
    const baseLabel = `${skillName} ${game.i18n.localize('DCC.Check')}`
    label = dcValue !== null
      ? `${game.i18n.format('DCC.SaveDC', { dc: dcValue })} ${baseLabel}`
      : baseLabel
  }

  const source = buildRollRequestSource({ type, key, dc: dcValue, actorUuid: actor.uuid, label })
  const content = '<div class="dcc-roll-request">' +
    `<p>${escapeHtml(game.i18n.format('DCC.RequestRollText', { user: game.user.name, actor: actor.name }))}</p>` +
    `<p class="dcc-roll-request-link">${escapeHtml(source)}</p>` +
    '</div>'
  return ChatMessage.create({
    content,
    speaker: { alias: game.user.name },
    flags: { dcc: { rollRequest: true } }
  })
}

/**
 * The Request Roll dialog (DCC sidebar tab, GM-only tool).
 */
export class RollRequestDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'dcc-roll-request-dialog',
    classes: ['dcc', 'roll-request', 'themed'],
    tag: 'form',
    position: {
      width: 380,
      height: 'auto'
    },
    window: {
      title: 'DCC.RequestRollTitle'
    },
    form: {
      handler: RollRequestDialog.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-roll-request.html'
    }
  }

  /** Selected actor id, persisted across actor-change re-renders. */
  #actorId = null

  /** Entered DC, persisted across actor-change re-renders. */
  #dc = ''

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const actors = getRequestableActors()
    if (!this.#actorId) {
      this.#actorId = getDefaultRequestActor()?.id ?? null
    }
    const selected = actors.find(actor => actor.id === this.#actorId) ?? actors[0] ?? null
    this.#actorId = selected?.id ?? null
    context.actors = actors.map(actor => ({
      id: actor.id,
      name: actor.name,
      selected: actor === selected
    }))
    context.hasActors = actors.length > 0
    context.checks = buildCheckOptions(selected)
    context.dc = this.#dc
    return context
  }

  /** @inheritDoc */
  _onRender (context, options) {
    super._onRender(context, options)
    // Changing the character swaps in that character's skill list —
    // stash the DC so the re-render keeps it.
    this.element.querySelector('select[name="actorId"]')?.addEventListener('change', (event) => {
      this.#actorId = event.target.value
      this.#dc = this.element.querySelector('input[name="dc"]')?.value ?? ''
      this.render()
    })
  }

  /**
   * Post the request card for the chosen actor / check / DC.
   * @this {RollRequestDialog}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit (event, form, formData) {
    const { actorId, check, dc } = foundry.utils.expandObject(formData.object)
    const actor = game.actors.get(actorId)
    if (!actor || !check) {
      return ui.notifications.warn(game.i18n.localize('DCC.RequestRollNoActorsWarning'))
    }
    await postRollRequest({ actor, checkValue: check, dc })
  }

  /** Open the dialog (sidebar tool entry point). */
  static show () {
    if (!getRequestableActors().length) {
      return ui.notifications.warn(game.i18n.localize('DCC.RequestRollNoActorsWarning'))
    }
    return new RollRequestDialog().render({ force: true })
  }
}

export default RollRequestDialog
