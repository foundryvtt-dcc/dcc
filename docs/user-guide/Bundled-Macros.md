# Bundled Macros

The DCC system includes several macros in the **DCC Macros** compendium to help configure tokens. You can find them by browsing the Macro Compendiums.

## Set Up NPC Token

Select an NPC token on the canvas, then run this macro. It configures the token with standard NPC display settings:

- **Bar 1** displays HP
- **Bar 2** displays AC
- **Token image** syncs to the actor portrait
- **Name and bars** are visible to the GM on hover (players cannot see them)

If no token is selected, a warning notification is shown.

## Update All NPCs

A batch version of **Set Up NPC Token**. Running this macro updates:

1. **All NPC actors** in the world — sets their prototype token configuration so any future tokens placed on the canvas inherit the standard display settings.
2. **All tokens already placed** across every scene — applies the same settings to existing tokens.

This is useful after importing a large number of NPCs, or when upgrading from an older version of the system.

## Set Up Player Token

Select a player character token on the canvas, then run this macro. It works like **Set Up NPC Token** but with settings appropriate for player characters:

- **Bar 1** displays HP
- **Bar 2** displays AC
- **Name** is visible to everyone on hover
- **Bars** are always visible
- **Vision** is enabled
- **Actor link** is enabled (token shares data with the actor, so changes persist between scenes)

## Update All Players

A batch version of **Set Up Player Token**. Updates all Player-type actors and their tokens across every scene.

## NPC vs Player Token Differences

| Setting | NPC Macros | Player Macros |
|---------|-----------|---------------|
| Name visibility | GM on hover | Everyone on hover |
| Bar visibility | GM on hover | Always visible |
| Vision | Not set | Enabled |
| Actor link | Not set | Enabled |

## Dragging Rollable Items to the Macro Bar

Any rollable item (weapons, spells, skills, etc.) can be dragged directly to the macro bar for quick access:

![Dragging a rollable item to the macro bar](images/macros.gif)
