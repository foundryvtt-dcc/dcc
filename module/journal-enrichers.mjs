/* global game, canvas, ui, CONFIG, ChatMessage, document, fromUuid */

/**
 * Clickable roll links in journals, item descriptions, and chat (issue #794).
 *
 * Registers a custom text enricher (v13+ `CONFIG.TextEditor.enrichers` API
 * with `id` + `onRender`) that turns
 *
 *   [[/check agl 10]]        → "DC 10 Agility Check" roll link
 *   [[/check lck]]           → roll-under Luck check link
 *   [[/save ref 15]]         → "DC 15 Reflex Save" roll link
 *   [[/skill sneakSilently]] → "Sneak Silently Check" roll link
 *   [[/save frt 15]]{resist the poison} → custom-label link
 *
 * into anchors anywhere `enrichHTML` runs. Clicking a link rolls the check
 * for the actors of all controlled tokens, falling back to the user's
 * assigned character, through the existing public roll methods
 * (`rollAbilityCheck` / `rollSavingThrow` / `rollSkillCheck` — the stable
 * surface downstream modules depend on). For GMs each link grows a
 * chat-bubble icon that posts the same link to chat as a roll request, so
 * players can click it and roll with *their* character — chat message
 * content is enriched per-client at render time, so the posted card wires
 * itself with no extra chat listeners.
 *
 * The enricher callback and `onRender` need a DOM; everything else
 * (config parsing, key normalization, label/markup building) is exported
 * as pure functions so the unit tests can cover them without jsdom.
 */

/**
 * Enricher id — becomes the `enricher` attribute on the wrapping
 * `<enriched-content>` element core creates, and is how the element's
 * `connectedCallback` finds our `onRender`.
 * @type {string}
 */
export const DCC_ENRICHER_ID = 'dcc-roll'

/**
 * Pattern for DCC roll links. The config group is everything up to the
 * closing brackets; an optional trailing `{...}` supplies a custom label.
 * The lookahead requires whitespace (or the closing brackets) right after
 * the command word so near-miss commands like `[[/skills ...]]` stay raw
 * text instead of half-matching. Core's inline-roll enricher runs first
 * but leaves unknown `/commands` untouched (its `ChatLog.parse` gate), so
 * the raw text reaches us intact — including inside chat message content.
 * @type {RegExp}
 */
export const ENRICHER_PATTERN = /\[\[\/(?<type>check|save|skill)(?=[\s\]])(?<config>[^\]]*)]](?:{(?<label>[^}]+)})?/g

/**
 * Full-name aliases accepted in addition to the canonical ability keys.
 * @type {Object<string, string>}
 */
const ABILITY_ALIASES = {
  strength: 'str',
  agility: 'agl',
  stamina: 'sta',
  personality: 'per',
  intelligence: 'int',
  luck: 'lck'
}

/**
 * Full-name aliases accepted in addition to the canonical save keys.
 * @type {Object<string, string>}
 */
const SAVE_ALIASES = {
  reflex: 'ref',
  fort: 'frt',
  fortitude: 'frt',
  will: 'wil'
}

/**
 * Parse an enricher config string into bare values and key=value options.
 *
 * Tokens are whitespace-separated; double quotes group a value containing
 * spaces (skill items are referenced by name, e.g. `"Nature Lore"`).
 * `key=value` pairs land as properties; a bare number becomes `dc`; the
 * first other bare token becomes `key`.
 * e.g. ' agl 10' → { key: 'agl', dc: '10' };
 *      ' ability=agl dc=10' → { ability: 'agl', dc: '10' };
 *      ' "Nature Lore" 12' → { key: 'Nature Lore', dc: '12' }.
 *
 * @param {string} config  The raw config group (may be empty)
 * @returns {Object<string, string>} parsed fields
 */
export function parseEnricherConfig (config) {
  const parsed = {}
  const unquote = (value) => value.replace(/"([^"]*)"/g, '$1')
  for (const token of String(config ?? '').match(/(?:[^\s"]+|"[^"]*")+/g) ?? []) {
    const eq = token.indexOf('=')
    if (eq > 0) {
      parsed[token.slice(0, eq)] = unquote(token.slice(eq + 1))
    } else if (/^\d+$/.test(token)) {
      parsed.dc = token
    } else if (!parsed.key) {
      parsed.key = unquote(token)
    }
  }
  return parsed
}

/**
 * Normalize an ability reference ('agl', 'Agility', …) to a canonical
 * ability key, or null if unrecognized.
 * @param {string} key
 * @returns {string|null}
 */
export function normalizeAbilityKey (key) {
  const lower = String(key ?? '').toLowerCase()
  const canonical = ABILITY_ALIASES[lower] ?? lower
  return (CONFIG.DCC?.abilities ?? {})[canonical] ? canonical : null
}

/**
 * Normalize a save reference ('ref', 'Reflex', 'fort', …) to a canonical
 * save key, or null if unrecognized.
 * @param {string} key
 * @returns {string|null}
 */
export function normalizeSaveKey (key) {
  const lower = String(key ?? '').toLowerCase()
  const canonical = SAVE_ALIASES[lower] ?? lower
  return (CONFIG.DCC?.saves ?? {})[canonical] ? canonical : null
}

/**
 * Escape a string for safe interpolation into HTML text or attribute
 * values (double-quoted).
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Fallback display name for a skill id when no custom label is given:
 * camelCase / kebab-case / snake_case → spaced Title Case
 * (e.g. 'sneakSilently' → 'Sneak Silently'). Built-in skill labels live on
 * actor data (class mixins), so there is no actor-independent i18n key to
 * resolve at enrich time; the roll itself still uses the actor's own label.
 * @param {string} skillId
 * @returns {string}
 */
export function skillDisplayName (skillId) {
  return String(skillId ?? '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
}

/**
 * Resolve a matched enricher into the data the markup builder needs.
 *
 * @param {Object} params
 * @param {string} params.type    'check' | 'save' | 'skill'
 * @param {string} params.config  The raw config group
 * @param {string} [params.label] Optional custom label
 * @returns {Object|null} `{ type, key, dc, rollUnder, actorUuid,
 *   displayLabel }`, or null when the reference is invalid (the raw text
 *   is left in place so the author can see the mistake).
 */
export function buildEnricherData ({ type, config, label }) {
  const parsed = parseEnricherConfig(config)
  const rawKey = parsed.key ?? parsed.ability ?? parsed.save ?? parsed.skill
  if (!rawKey) return null
  const dc = parsed.dc !== undefined && /^\d+$/.test(parsed.dc) ? parseInt(parsed.dc) : null
  // An `actor=<uuid>` option targets a specific actor (roll requests,
  // issue #855) instead of the clicking user's controlled tokens.
  const actorUuid = parsed.actor ?? null

  let key
  let baseLabel
  let rollUnder = false
  if (type === 'check') {
    key = normalizeAbilityKey(rawKey)
    if (!key) return null
    // Luck checks are roll-under by default; `rollUnder=false` opts out,
    // `rollUnder=true` forces it for another ability.
    rollUnder = parsed.rollUnder !== undefined ? parsed.rollUnder === 'true' : key === 'lck'
    baseLabel = `${game.i18n.localize(CONFIG.DCC.abilities[key])} ${game.i18n.localize('DCC.Check')}`
  } else if (type === 'save') {
    key = normalizeSaveKey(rawKey)
    if (!key) return null
    baseLabel = `${game.i18n.localize(CONFIG.DCC.saves[key])} ${game.i18n.localize('DCC.Save')}`
  } else if (type === 'skill') {
    key = rawKey
    baseLabel = `${skillDisplayName(rawKey)} ${game.i18n.localize('DCC.Check')}`
  } else {
    return null
  }

  const displayLabel = label ||
    (dc !== null ? `${game.i18n.format('DCC.SaveDC', { dc })} ${baseLabel}` : baseLabel)

  return { type, key, dc, rollUnder, actorUuid, displayLabel }
}

/**
 * Build the enricher markup as an HTML string (pure — unit-testable
 * without a DOM).
 *
 * @param {Object} data  Result of {@link buildEnricherData}
 * @param {Object} [options]
 * @param {boolean} [options.isGM]   Append the GM-only roll-request icon
 * @param {string} [options.source]  The raw matched text, stored on the
 *   request icon so it can be re-posted to chat verbatim
 * @returns {string} HTML for the link group
 */
export function buildEnricherHtml (data, { isGM = false, source = '' } = {}) {
  const { type, key, dc, rollUnder, actorUuid, displayLabel } = data
  const attributes = [
    `data-roll-type="${escapeHtml(type)}"`,
    `data-key="${escapeHtml(key)}"`
  ]
  if (dc !== null) attributes.push(`data-dc="${dc}"`)
  if (rollUnder) attributes.push('data-roll-under="true"')
  if (actorUuid) attributes.push(`data-actor-uuid="${escapeHtml(actorUuid)}"`)
  const dataAttributes = attributes.join(' ')

  let html = '<span class="dcc-enricher-group">' +
    `<a class="dcc-enricher" data-action="dccRoll" ${dataAttributes}>` +
    `<i class="fa-solid fa-dice-d20" inert></i>${escapeHtml(displayLabel)}</a>`
  if (isGM) {
    const tooltip = escapeHtml(game.i18n.localize('DCC.EnricherRequestRoll'))
    html += `<a class="dcc-enricher dcc-enricher-request" data-action="dccRequest" ${dataAttributes} ` +
      `data-source="${escapeHtml(source)}" data-tooltip="${tooltip}" aria-label="${tooltip}">` +
      '<i class="fa-solid fa-comment" inert></i></a>'
  }
  return html + '</span>'
}

/**
 * The enricher callback: matched text → link-group element (or null to
 * leave the raw text alone).
 * @param {RegExpMatchArray} match
 * @returns {HTMLElement|null}
 */
export function enrichRollLink (match) {
  const data = buildEnricherData({
    type: match.groups.type,
    config: match.groups.config,
    label: match.groups.label
  })
  if (!data) return null
  const template = document.createElement('template')
  template.innerHTML = buildEnricherHtml(data, {
    isGM: !!game.user?.isGM,
    source: match[0]
  })
  return template.content.firstElementChild
}

/**
 * Actors a clicked roll link applies to: the actors of all controlled
 * tokens (deduplicated), falling back to the user's assigned character.
 * @returns {Actor[]}
 */
export function resolveEnricherActors () {
  const actors = new Set()
  for (const token of canvas?.tokens?.controlled ?? []) {
    if (token.actor) actors.add(token.actor)
  }
  if (!actors.size && game.user.character) actors.add(game.user.character)
  return [...actors]
}

/**
 * Resolve an actor-targeted link (`data-actor-uuid`) to the one actor it
 * applies to, or null (with a user-facing warning) when the actor is gone
 * or the clicking user may not roll for it. GMs own everything, so a GM
 * can always trigger the roll they requested.
 * @param {string} actorUuid
 * @returns {Promise<Actor|null>}
 */
export async function resolveTargetedEnricherActor (actorUuid) {
  const resolved = await fromUuid(actorUuid).catch(() => null)
  // A token uuid resolves to the TokenDocument — unwrap to its actor.
  const actor = resolved?.actor ?? resolved
  if (!actor?.rollAbilityCheck) {
    ui.notifications.warn(game.i18n.localize('DCC.EnricherActorMissingWarning'))
    return null
  }
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.format('DCC.EnricherNotOwnerWarning', { actor: actor.name }))
    return null
  }
  return actor
}

/**
 * Dispatch a clicked roll link through the matching public roll method.
 * The DC is passed through in options — saves render the success/failure
 * suffix from it today; checks and skills carry it for downstream use.
 * An actor-targeted link (`data-actor-uuid`, roll requests #855) rolls
 * for exactly that actor, gated on ownership; otherwise the link rolls
 * for the clicking user's controlled tokens / assigned character.
 * @param {HTMLElement} anchor  The clicked anchor carrying the data attributes
 */
export async function handleEnricherRollClick (anchor) {
  const { rollType, key, dc, rollUnder, actorUuid } = anchor.dataset
  let actors
  if (actorUuid) {
    const actor = await resolveTargetedEnricherActor(actorUuid)
    if (!actor) return
    actors = [actor]
  } else {
    actors = resolveEnricherActors()
  }
  if (!actors.length) {
    return ui.notifications.warn(game.i18n.localize('DCC.EnricherNoActorWarning'))
  }
  const options = {}
  if (dc !== undefined) {
    options.dc = parseInt(dc)
    options.showDc = true
  }
  for (const actor of actors) {
    if (rollType === 'check') {
      await actor.rollAbilityCheck(key, { ...options, rollUnder: rollUnder === 'true' })
    } else if (rollType === 'save') {
      await actor.rollSavingThrow(key, { ...options })
    } else if (rollType === 'skill') {
      // `rollSkillCheck` already warns when the actor lacks the skill
      await actor.rollSkillCheck(key, { ...options })
    }
  }
}

/**
 * Post a roll request card to chat (GM chat-bubble icon). The card body
 * contains the raw enricher text — chat content is enriched per-client at
 * render, so every player sees a live roll link wired by `onRender` and
 * clicking it rolls with *their* controlled token / assigned character.
 * @param {HTMLElement} anchor  The clicked request anchor
 * @returns {Promise<ChatMessage>}
 */
export async function handleEnricherRequestClick (anchor) {
  const source = anchor.dataset.source
  if (!source) return
  const content = '<div class="dcc-roll-request">' +
    `<p>${escapeHtml(game.i18n.format('DCC.EnricherRequestText', { user: game.user.name }))}</p>` +
    `<p class="dcc-roll-request-link">${escapeHtml(source)}</p>` +
    '</div>'
  return ChatMessage.create({
    content,
    speaker: { alias: game.user.name },
    flags: { dcc: { rollRequest: true } }
  })
}

/**
 * `onRender` callback — fires from `<enriched-content>`'s
 * `connectedCallback` every time an enriched link lands in the DOM
 * (journal pages, sheets, chat), so listeners survive re-renders.
 * @param {HTMLElement} element  The wrapping enriched-content element
 */
export function onRenderRollLink (element) {
  // `connectedCallback` fires again if the element is detached and
  // reattached (popouts, DOM-moving modules) — guard so a node never
  // accumulates duplicate listeners (which would double-roll).
  if (element.dataset.dccWired) return
  element.dataset.dccWired = 'true'
  // Core wraps each match in its own element, but a multi-link request
  // card (#914) is cheap to make robust — wire every anchor we find.
  for (const rollAnchor of element.querySelectorAll('[data-action="dccRoll"]')) {
    rollAnchor.addEventListener('click', (event) => {
      event.preventDefault()
      handleEnricherRollClick(event.currentTarget)
        .catch(err => console.error('DCC | Enricher roll click failed', err))
    })
  }
  for (const requestAnchor of element.querySelectorAll('[data-action="dccRequest"]')) {
    requestAnchor.addEventListener('click', (event) => {
      event.preventDefault()
      handleEnricherRequestClick(event.currentTarget)
        .catch(err => console.error('DCC | Enricher roll request failed', err))
    })
  }
}

/**
 * Register the DCC roll-link enricher. Called from the init hook.
 */
export function registerJournalEnrichers () {
  CONFIG.TextEditor.enrichers.push({
    id: DCC_ENRICHER_ID,
    pattern: ENRICHER_PATTERN,
    enricher: enrichRollLink,
    onRender: onRenderRollLink
  })
}
