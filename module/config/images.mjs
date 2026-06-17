// DCC default / fallback image tables.
//
// Extracted from `module/config.js` (Phase 7 — Appendix-A config.js
// shrinkage arc). These three lookup tables map an actor type / item type /
// macro key onto a default art path. They are consumed only by
// `module/entity-images.js` (`EntityImages._selectImage`), via the `DCC.*`
// config object onto which `config.js` re-composes them — so the public
// `CONFIG.DCC` shape is unchanged. Pure data — no behavior lives here.

/**
 * Default actor artwork by actor type (plus a `default` fallback).
 * @type {Object}
 */
export const defaultActorImages = {
  default: 'systems/dcc/styles/images/actor.webp',
  Party: 'systems/dcc/styles/images/party.webp'
}

/**
 * Default item artwork by item type (plus a `default` fallback).
 * @type {Object}
 */
export const defaultItemImages = {
  default: 'systems/dcc/styles/images/item.webp',
  armor: 'systems/dcc/styles/images/armor.webp',
  container: 'systems/dcc/styles/images/game-icons-net/knapsack.svg',
  spell: 'systems/dcc/styles/images/spell.webp',
  treasure: 'systems/dcc/styles/images/coins.webp',
  weapon: 'systems/dcc/styles/images/weapon.webp',
  skill: 'systems/dcc/styles/images/skill.webp'
}

/**
 * Default hotbar-macro artwork by macro kind (ability / save / skill / die /
 * etc.), with `default` + `defaultDice` fallbacks.
 * @type {Object}
 */
export const macroImages = {
  default: 'systems/dcc/styles/images/game-icons-net/dice-target.svg',
  defaultDice: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg',

  ability: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg',
  abilityRollUnder: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-one.svg',
  str: 'systems/dcc/styles/images/game-icons-net/weight-lifting-up.svg',
  agl: 'systems/dcc/styles/images/game-icons-net/body-balance.svg',
  sta: 'systems/dcc/styles/images/game-icons-net/jumping-rope.svg',
  per: 'systems/dcc/styles/images/game-icons-net/charm.svg',
  int: 'systems/dcc/styles/images/game-icons-net/brain.svg',
  lck: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-one.svg',

  attackBonus: 'systems/dcc/styles/images/game-icons-net/d4.svg',
  backstab: 'systems/dcc/styles/images/game-icons-net/backstab.svg',
  hitDice: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-six.svg',
  initiative: 'systems/dcc/styles/images/game-icons-net/stairs-goal.svg',
  luckDie: 'systems/dcc/styles/images/game-icons-net/horseshoe.svg',

  applyDisapproval: 'systems/dcc/styles/images/game-icons-net/lightning-tear.svg',
  rollDisapproval: 'systems/dcc/styles/images/game-icons-net/lightning-branches.svg',

  savingThrow: 'systems/dcc/styles/images/game-icons-net/dodging.svg',
  ref: 'systems/dcc/styles/images/game-icons-net/dodging.svg',
  frt: 'systems/dcc/styles/images/game-icons-net/mighty-force.svg',
  wil: 'systems/dcc/styles/images/game-icons-net/psychic-waves.svg',

  skillCheck: 'systems/dcc/styles/images/game-icons-net/skills.svg',
  divineAid: 'systems/dcc/styles/images/game-icons-net/hand-of-god.svg',
  turnUnholy: 'systems/dcc/styles/images/game-icons-net/disintegrate.svg',
  layOnHands: 'systems/dcc/styles/images/game-icons-net/glowing-hands.svg',
  sneakSilently: 'systems/dcc/styles/images/game-icons-net/cloak-dagger.svg',
  pickPockets: 'systems/dcc/styles/images/game-icons-net/snatch.svg',
  pickLock: 'systems/dcc/styles/images/game-icons-net/lockpicks.svg',
  disableTrap: 'systems/dcc/styles/images/game-icons-net/box-trap.svg',
  disguiseSelf: 'systems/dcc/styles/images/game-icons-net/domino-mask.svg',
  handlePoison: 'systems/dcc/styles/images/game-icons-net/poison-bottle.svg',
  castSpellFromScroll: 'systems/dcc/styles/images/game-icons-net/scroll-unfurled.svg',
  hideInShadows: 'systems/dcc/styles/images/game-icons-net/hidden.svg',
  climbSheerSurfaces: 'systems/dcc/styles/images/game-icons-net/mountain-climbing.svg',
  findTrap: 'systems/dcc/styles/images/game-icons-net/wolf-trap.svg',
  forgeDocument: 'systems/dcc/styles/images/game-icons-net/scroll-quill.svg',
  readLanguages: 'systems/dcc/styles/images/game-icons-net/read.svg',
  sneakAndHide: 'systems/dcc/styles/images/game-icons-net/cloak-dagger.svg',
  shieldBash: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
  detectSecretDoors: 'systems/dcc/styles/images/game-icons-net/secret-door.svg',

  spellCheck: 'systems/dcc/styles/images/game-icons-net/bolt-spell-cast.svg',

  d3: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-three.svg',
  d4: 'systems/dcc/styles/images/game-icons-net/d4.svg',
  d5: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-five.svg',
  d6: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-six.svg',
  d8: 'systems/dcc/styles/images/game-icons-net/dice-eight-faces-eight.svg',
  d10: 'systems/dcc/styles/images/game-icons-net/d10.svg',
  d12: 'systems/dcc/styles/images/game-icons-net/d12.svg',
  d20: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg'
}
