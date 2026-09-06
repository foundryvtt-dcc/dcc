/* global game, canvas, ui, CONFIG, ChatMessage, foundry */

/**
 * GM roll requests (issues #855, #914).
 *
 * The DCC sidebar tab offers GMs a "Request Roll" tool that opens
 * {@link RollRequestDialog}: tick one, several, or all player characters
 * (defaulting to the controlled PC tokens' actors), pick a check —
 * abilities first, then saving throws, then the selected characters'
 * class skills (`system.skills`) and custom skill items — and
 * optionally set a DC.
 * Submitting posts a single chat card built on the roll-link enricher
 * infrastructure (#794/#852): the card body carries one raw
 * `[[/check ...]]` / `[[/save ...]]` / `[[/skill ...]]` per requested
 * character with an
 * `actor=<uuid>` option, chat content is re-enriched per client at
 * render, and clicking a link rolls for exactly that character
 * (ownership-gated in `handleEnricherRollClick`). With a DC set, the
 * resulting check card shows the DC and Success/Failure via
 * `dcResultSuffix`.
 *
 * Skills are unioned across the selected characters, so a skill only some
 * of them have can still be requested — the card only lists the ones who
 * actually have it, and the GM is told who was skipped.
 *
 * Because chat is enriched per client, each viewer only keeps the links
 * they can use: `muteUnownedRequestLink` turns another player's row into
 * plain text, so a player with one PC has exactly one thing to click and
 * a player owning several requested PCs gets a link for each. GMs own
 * every actor, so their copy of the card stays fully clickable.
 *
 * The actor/check/source helpers are pure(ish) and exported for the unit
 * tests; the dialog itself is covered by the Playwright spec
 * `browser-tests/e2e/roll-request.spec.js`.
 */

import { skillDisplayName, escapeHtml } from './journal-enrichers.mjs'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * The player characters a roll can be requested from: world actors of
 * type Player that some non-GM user owns, sorted by name.
 *
 * Ownership is the filter because a roll request is a question put to a
 * *player* — nobody but the GM could ever answer a link targeting a PC
 * with no player owner, so retired characters and GM-authored Player
 * actors would otherwise pad the list and quietly ride along with the
 * All Players toggle.
 *
 * @returns {Actor[]}
 */
export function getRequestableActors () {
  return (game.actors ?? [])
    .filter(actor => actor.type === 'Player' && actor.hasPlayerOwner)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The actors the dialog preselects: every controlled PC token's actor,
 * deduplicated and in selection order. Empty when none is controlled.
 * @returns {Actor[]}
 */
export function getDefaultRequestActors () {
  const actors = new Set()
  for (const token of canvas?.tokens?.controlled ?? []) {
    if (token.actor?.type === 'Player') actors.add(token.actor)
  }
  return [...actors]
}

/**
 * Whether an actor can roll a skill: it either occupies a built-in skill
 * slot (`system.skills`) or exists as a skill item on the skills tab.
 * @param {Actor} actor  The actor to test
 * @param {string} key   Skill slot id or skill item name
 * @returns {boolean}
 */
export function actorHasSkill (actor, key) {
  if (actor?.system?.skills?.[key]) return true
  return (actor?.itemTypes?.skill ?? []).some(item => item.name === key)
}

/**
 * Assemble the check options for the selected actors: the six abilities
 * first, then the three saving throws, then the union of their skills —
 * built-in class skill slots (`system.skills`, e.g. thief skills)
 * followed by custom skill items from the skills tab. Values are
 * namespaced (`check:agl` / `save:ref` / `skill:sneakSilently` /
 * `skill:Nature Lore`) so the submit handler can dispatch on type.
 *
 * Abilities and saves are the same for everyone, so only the skills
 * depend on who is selected.
 *
 * @param {Actor[]|Actor|null} actors  The selected actors (a lone actor
 *   or null/empty is accepted; no actors yields abilities and saves only)
 * @returns {{abilities: Array<{value: string, label: string}>,
 *            saves: Array<{value: string, label: string}>,
 *            skills: Array<{value: string, label: string}>}}
 */
export function buildCheckOptions (actors) {
  const selected = (Array.isArray(actors) ? actors : [actors]).filter(actor => actor)
  const checkSuffix = ` ${game.i18n.localize('DCC.Check')}`
  const abilities = Object.entries(CONFIG.DCC?.abilities ?? {}).map(([key, label]) => ({
    value: `check:${key}`,
    label: `${game.i18n.localize(label)}${checkSuffix}`
  }))

  const saveSuffix = ` ${game.i18n.localize('DCC.Save')}`
  const saves = Object.entries(CONFIG.DCC?.saves ?? {}).map(([key, label]) => ({
    value: `save:${key}`,
    label: `${game.i18n.localize(label)}${saveSuffix}`
  }))

  // Built-in slots for every selected actor first, then their items, so
  // the ordering stays "class skills before custom skills" for the group
  // the same way it did for a single character.
  const skills = []
  const seen = new Set()
  for (const actor of selected) {
    for (const [id, skill] of Object.entries(actor?.system?.skills ?? {})) {
      if (seen.has(id)) continue
      seen.add(id)
      skills.push({ value: `skill:${id}`, label: localizeSkillLabel(id, skill) })
    }
  }
  for (const actor of selected) {
    for (const item of actor?.itemTypes?.skill ?? []) {
      // `rollSkillCheck` resolves built-in slots before items, so an item
      // whose name collides with a slot id would roll the slot — skip it.
      if (seen.has(item.name)) continue
      seen.add(item.name)
      skills.push({ value: `skill:${item.name}`, label: item.name })
    }
  }

  return { abilities, saves, skills }
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
 * @param {string} params.type       'check' | 'save' | 'skill'
 * @param {string} params.key        Ability key, save key, skill slot id,
 *   or skill item name
 * @param {number|null} [params.dc]  Optional DC
 * @param {string} [params.actorUuid]  Target actor uuid
 * @param {boolean|null} [params.rollUnder]  Explicit roll-under override
 *   (false forces a roll-high Luck check); null leaves the enricher default
 * @param {string} [params.label]    Optional custom display label
 * @returns {string} e.g. '[[/skill "Nature Lore" 12 actor=Actor.abc]]{DC 12 Nature Lore Check}'
 */
export function buildRollRequestSource ({ type, key, dc = null, actorUuid = '', rollUnder = null, label = '' }) {
  const cleanKey = String(key).replace(/["[\]{}=]/g, '')
  const parts = [`/${type}`, /\s/.test(cleanKey) ? `"${cleanKey}"` : cleanKey]
  if (Number.isFinite(dc)) parts.push(String(dc))
  if (rollUnder !== null) parts.push(`rollUnder=${rollUnder}`)
  if (actorUuid) parts.push(`actor=${actorUuid}`)
  let source = `[[${parts.join(' ')}]]`
  if (label) source += `{${String(label).replace(/[{}[\]]/g, '')}}`
  return source
}

/**
 * The enricher source for one actor's copy of a requested check, with the
 * per-actor DC and label adjustments applied.
 * @param {Actor} actor    The actor being asked to roll
 * @param {string} type    'check' | 'save' | 'skill'
 * @param {string} key     Ability key, skill slot id, or skill item name
 * @param {number|null} dc The requested DC (may be dropped for this actor)
 * @returns {string}
 */
function buildActorRequestSource (actor, type, key, dc) {
  let dcValue = dc

  // Table-backed skills (Divine Aid, Turn Unholy, Lay on Hands, and
  // disapproval-range skills) resolve on their result table, not against
  // a DC — drop the DC rather than promise a verdict the result card
  // cannot show.
  const slot = type === 'skill' ? actor.system?.skills?.[key] : null
  if (type === 'skill' && (CONFIG.DCC?.skillTables?.[key] || slot?.useDisapprovalRange)) {
    dcValue = null
  }

  // A DC turns a Luck check into a roll-high check — roll-under has no
  // DC to beat, so the roll-under default would ignore it.
  const rollUnder = (type === 'check' && key === 'lck' && dcValue !== null) ? false : null

  // Built-in skill ids and item names have no actor-independent label
  // the enricher could resolve, so pass the label we showed the GM.
  // Abilities and saves it can label on its own.
  let label = ''
  if (type === 'skill') {
    const skillName = slot
      ? localizeSkillLabel(key, slot)
      : (actor.itemTypes?.skill?.find(item => item.name === key)?.name ?? skillDisplayName(key))
    const baseLabel = `${skillName} ${game.i18n.localize('DCC.Check')}`
    label = dcValue !== null
      ? `${game.i18n.format('DCC.SaveDC', { dc: dcValue })} ${baseLabel}`
      : baseLabel
  }

  return buildRollRequestSource({ type, key, dc: dcValue, actorUuid: actor.uuid, rollUnder, label })
}

/**
 * The chat card body for a roll request: a single link for one character,
 * a name/link list for several.
 * @param {Array<{actor: Actor, source: string}>} entries
 * @returns {string} HTML (raw enricher text escaped for storage; chat
 *   enrichment decodes text nodes before matching)
 */
export function buildRollRequestContent (entries) {
  if (entries.length === 1) {
    const { actor, source } = entries[0]
    return '<div class="dcc-roll-request">' +
      `<p>${escapeHtml(game.i18n.format('DCC.RequestRollText', { actor: actor.name }))}</p>` +
      `<p class="dcc-roll-request-link">${escapeHtml(source)}</p>` +
      '</div>'
  }
  const rows = entries.map(({ actor, source }) =>
    '<li class="dcc-roll-request-row">' +
    `<span class="dcc-roll-request-name">${escapeHtml(actor.name)}</span>` +
    `<span class="dcc-roll-request-link">${escapeHtml(source)}</span>` +
    '</li>').join('')
  return '<div class="dcc-roll-request">' +
    `<p>${escapeHtml(game.i18n.localize('DCC.RequestRollTextMultiple'))}</p>` +
    `<ul class="dcc-roll-request-list">${rows}</ul>` +
    '</div>'
}

/**
 * Post a roll request card to chat for one or more actors and a check.
 * The card body carries the raw enricher text — chat content is enriched
 * per client at render (see #852), so every player sees live roll links
 * and only each requested actor's owner may trigger their own.
 *
 * Actors that lack a requested skill are dropped from the card (with a
 * GM-side warning) rather than given a link that would only warn them.
 *
 * @param {Object} params
 * @param {Actor} [params.actor]     A single actor being asked to roll
 * @param {Actor[]} [params.actors]  Several actors being asked to roll
 * @param {string} params.checkValue Namespaced check ('check:agl' /
 *   'save:ref' / 'skill:...')
 * @param {number|string|null} [params.dc]  Optional DC
 * @returns {Promise<ChatMessage|null>} null when no actor could be asked
 */
export async function postRollRequest ({ actor = null, actors = null, checkValue, dc = null }) {
  const separator = String(checkValue).indexOf(':')
  const type = String(checkValue).slice(0, separator)
  const key = String(checkValue).slice(separator + 1)
  if (separator < 1 || !key || !['check', 'save', 'skill'].includes(type)) {
    throw new Error(`DCC | postRollRequest: invalid checkValue "${checkValue}"`)
  }
  const targets = (actors ?? (actor ? [actor] : [])).filter(target => target)
  // The enricher config only accepts digits, so a negative DC would be
  // dropped from the link while still showing up in the label — promising
  // a verdict the roll cannot produce. Treat it as no DC at all.
  const parsedDc = parseInt(dc)
  const dcValue = Number.isFinite(parsedDc) && parsedDc >= 0 ? parsedDc : null

  const entries = []
  const skipped = []
  for (const target of targets) {
    if (type === 'skill' && !actorHasSkill(target, key)) {
      skipped.push(target.name)
      continue
    }
    entries.push({ actor: target, source: buildActorRequestSource(target, type, key, dcValue) })
  }

  if (skipped.length) {
    ui.notifications.warn(game.i18n.format('DCC.RequestRollSkillMissingWarning', { actors: skipped.join(', ') }))
  }
  if (!entries.length) return null

  return ChatMessage.create({
    content: buildRollRequestContent(entries),
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
      template: 'systems/dcc/templates/dialog-roll-request.html',
      // A large party scrolls the character list — let ApplicationV2
      // restore the offset when a selection change re-renders the part.
      scrollable: ['.roll-request-actor-list']
    }
  }

  /** Selected actor ids, or null until the defaults are resolved. */
  #actorIds = null

  /** Selected check, persisted across selection-change re-renders. */
  #check = ''

  /** Entered DC, persisted across selection-change re-renders. */
  #dc = ''

  /** The skill option values the last render offered, to detect changes. */
  #skillSignature = ''

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const actors = getRequestableActors()
    if (this.#actorIds === null) {
      // Controlled PC tokens preselect their actors. With none
      // controlled the dialog opens with nothing ticked (and submit
      // disabled) rather than guessing a character: the single-select
      // version had to default to *someone*, but silently requesting a
      // roll from an arbitrary PC is worse than one extra click.
      this.#actorIds = new Set(getDefaultRequestActors().map(actor => actor.id))
    }
    // Drop ids for characters deleted while the dialog was open
    const ids = new Set(actors.filter(actor => this.#actorIds.has(actor.id)).map(actor => actor.id))
    this.#actorIds = ids

    context.actors = actors.map(actor => ({
      id: actor.id,
      name: actor.name,
      selected: ids.has(actor.id)
    }))
    context.hasActors = actors.length > 0
    context.allSelected = actors.length > 0 && ids.size === actors.length
    context.canSubmit = ids.size > 0
    context.checks = buildCheckOptions(actors.filter(actor => ids.has(actor.id)))
    // Keep the previous check selected across re-renders when the new
    // selection still offers it (ability checks always survive). A skill
    // the new selection dropped falls back to the first option, so clear
    // the stale value rather than resurrect it on a later re-render.
    let stillOffered = false
    const allOptions = [...context.checks.abilities, ...context.checks.saves, ...context.checks.skills]
    for (const option of allOptions) {
      option.selected = option.value === this.#check
      stillOffered ||= option.selected
    }
    if (!stillOffered) this.#check = ''
    context.dc = this.#dc
    this.#skillSignature = context.checks.skills.map(option => option.value).join('|')
    return context
  }

  /** @inheritDoc */
  _onRender (context, options) {
    super._onRender(context, options)
    const allToggle = this.element.querySelector('input[name="allActors"]')
    const boxes = [...this.element.querySelectorAll('input[name="actorIds"]')]

    allToggle?.addEventListener('change', (event) => {
      for (const box of boxes) box.checked = event.target.checked
      this.#onSelectionChange(boxes)
    })
    for (const box of boxes) {
      box.addEventListener('change', () => {
        if (allToggle) allToggle.checked = boxes.length > 0 && boxes.every(other => other.checked)
        this.#onSelectionChange(boxes)
      })
    }
  }

  /**
   * Adopt the ticked characters. Changing who is asked swaps in that
   * group's skill union, but re-rendering on every tick would fight the
   * checkbox the GM just clicked — so only re-render when the skill list
   * actually changed.
   * @param {HTMLInputElement[]} boxes  The character checkboxes
   */
  #onSelectionChange (boxes) {
    this.#actorIds = new Set(boxes.filter(box => box.checked).map(box => box.value))
    // Nothing ticked is a dead submit — block it here rather than let the
    // form close on a warning and throw away the check and DC.
    const submit = this.element.querySelector('button[type="submit"]')
    if (submit) submit.disabled = !this.#actorIds.size
    const selected = getRequestableActors().filter(actor => this.#actorIds.has(actor.id))
    const signature = buildCheckOptions(selected).skills.map(option => option.value).join('|')
    if (signature === this.#skillSignature) return
    this.#stashFields()
    this.render().catch(err => console.error('DCC | Roll request re-render failed', err))
  }

  /** Preserve the check and DC fields across a re-render. */
  #stashFields () {
    this.#check = this.element.querySelector('select[name="check"]')?.value ?? ''
    this.#dc = this.element.querySelector('input[name="dc"]')?.value ?? ''
  }

  /**
   * Post the request card for the chosen characters / check / DC.
   * @this {RollRequestDialog}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit (event, form, formData) {
    const { check, dc } = formData.object
    // Read the ticked boxes straight off the form: FormDataExtended
    // collapses repeated checkbox names to a single value.
    const actorIds = [...form.querySelectorAll('input[name="actorIds"]:checked')].map(input => input.value)
    if (!actorIds.length || !check) {
      return ui.notifications.warn(game.i18n.localize('DCC.RequestRollNoSelectionWarning'))
    }
    const actors = actorIds.map(id => game.actors.get(id)).filter(actor => actor)
    if (!actors.length) {
      // e.g. the selected characters were deleted while the dialog was open
      return ui.notifications.warn(game.i18n.localize('DCC.EnricherActorMissingWarning'))
    }
    await postRollRequest({ actors, checkValue: check, dc })
  }

  /** Open the dialog (sidebar tool entry point). */
  static async show () {
    // The sidebar tool is GM-only, but this is also the public macro
    // entry point (`game.dcc.RollRequestDialog.show()`) — and the card it
    // posts is worded as coming from the Judge.
    if (!game.user?.isGM) {
      return ui.notifications.warn(game.i18n.localize('DCC.RequestRollGMOnlyWarning'))
    }
    if (!getRequestableActors().length) {
      return ui.notifications.warn(game.i18n.localize('DCC.RequestRollNoActorsWarning'))
    }
    // A second click must raise the open dialog, not spawn a twin sharing
    // its DOM id (and its slot in `foundry.applications.instances`). Only
    // a *rendered* instance counts — one already closing (submit closes
    // the form) still holds the registry slot, and raising that would
    // leave the GM with a dialog that vanishes a moment later. Let that
    // close finish before constructing: the new app would take over the
    // registry slot, and the closing app's own cleanup would then evict
    // the new one from it.
    const open = foundry.applications.instances.get('dcc-roll-request-dialog')
    if (open?.rendered) return open.bringToFront()
    if (open) await open.close()
    return new RollRequestDialog().render({ force: true })
  }
}

export default RollRequestDialog
