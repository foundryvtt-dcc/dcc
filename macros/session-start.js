// Name: Reset Fleeting Luck
// Type: Script
// Scope: GM

async function resetFleetingLuck() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can run this macro.");
    return;
  }

  if (!game.settings.get('dcc', 'enableFleetingLuck')) {
    ui.notifications.warn("Fleeting Luck is not enabled in the system settings.");
    return;
  }

  const playerActors = game.actors.filter(a => a.type === 'Player');
  const updates = [];

  for (const actor of playerActors) {
    updates.push({
      _id: actor.id,
      'system.attributes.fleetingLuck.value': 1
    });
  }

  if (updates.length > 0) {
    await Actor.updateDocuments(updates);
    ChatMessage.create({
      content: `<h3>A New Day, A New Chance</h3><p>All heroes begin the session with 1 point of Fleeting Luck.</p>`,
      speaker: { alias: "The Fates" }
    });
    ui.notifications.info("Fleeting Luck has been reset for all player characters.");
  } else {
    ui.notifications.info("No player characters found to update.");
  }
}

resetFleetingLuck();
