/* global game, canvas, ui, CONST, Dialog */

/**
 * Test Macro for DCC Active Effects
 * This macro demonstrates how to programmatically create and apply active effects
 */

// Get the selected actor or default to the first controlled token
const actor = game.user.character || canvas.tokens.controlled[0]?.actor

if (!actor) {
  ui.notifications.warn('Please select a token or assign a character')
} else {
// Example 1: Create a temporary "-2 to next attack" effect
  async function applyAttackPenalty () {
    const effectData = {
      label: 'Attack Penalty',
      icon: 'icons/svg/downgrade.svg',
      changes: [
        {
          key: 'system.details.attackHitBonus.melee.adjustment',
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: -2
        },
        {
          key: 'system.details.attackHitBonus.missile.adjustment',
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: -2
        }
      ],
      duration: {
        rounds: 1,
        turns: 1
      },
      flags: {
        dcc: {
          effectType: 'temporaryPenalty'
        }
      }
    }

    await actor.createEmbeddedDocuments('ActiveEffect', [effectData])
    ui.notifications.info(`Applied -2 attack penalty to ${actor.name}`)
  }

  // Example 2: Create a strength bonus effect (as if from a magic item)
  async function applyStrengthBonus () {
    const effectData = {
      label: 'Strength Enhancement',
      icon: 'icons/magic/life/heart-glowing-red.webp',
      changes: [
        {
          key: 'system.abilities.str.value',
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: 1
        }
      ],
      duration: {},
      flags: {
        dcc: {
          effectType: 'magicItem'
        }
      }
    }

    await actor.createEmbeddedDocuments('ActiveEffect', [effectData])
    ui.notifications.info(`Applied +1 Strength bonus to ${actor.name}`)
  }

  // Example 3: Apply an AC bonus
  async function applyACBonus () {
    const effectData = {
      label: 'Shield of Faith',
      icon: 'icons/magic/defensive/shield-barrier-blue.webp',
      changes: [
        {
          key: 'system.attributes.ac.otherMod',
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: 2
        }
      ],
      duration: {
        rounds: 10
      },
      flags: {
        dcc: {
          effectType: 'spell'
        }
      }
    }

    await actor.createEmbeddedDocuments('ActiveEffect', [effectData])
    ui.notifications.info(`Applied +2 AC bonus to ${actor.name}`)
  }

  // Create a dialog to choose which effect to apply
  new Dialog({
    title: 'Test Active Effects',
    content: `
    <p>Select an effect to apply to ${actor.name}:</p>
    <ul>
      <li><strong>Attack Penalty:</strong> -2 to melee and missile attacks (1 round)</li>
      <li><strong>Strength Bonus:</strong> +1 to Strength (permanent until removed)</li>
      <li><strong>AC Bonus:</strong> +2 to AC (10 rounds)</li>
    </ul>
  `,
    buttons: {
      attack: {
        label: 'Apply Attack Penalty',
        callback: applyAttackPenalty
      },
      strength: {
        label: 'Apply Strength Bonus',
        callback: applyStrengthBonus
      },
      ac: {
        label: 'Apply AC Bonus',
        callback: applyACBonus
      },
      cancel: {
        label: 'Cancel'
      }
    },
    default: 'cancel'
  }).render(true)
} // Close the else block
