- Added a link from the Welcome Chat Card to the User Guide's table of contents

![Spell](images/spell.gif) ![Weapon](images/weapon.gif)

- Added a Roll Modifier dialog to allow adjustments to rolls
  - Accessed by Ctrl+Clicking any appropriate rollable (this behaviour can be inverted in the Settings to enable it by default)
  - Displays semantically appropriate widgets for each roll and all terms of 'freeform' formulae
  - For rolls where Action Dice are used the actor's action dice and an untrained option are displayed in addition to the dice chain modifier buttons
  - Modifiers/bonuses have simple +/- buttons and a reset button
  - Rolls where the Check Penalty is relevant have a special widget for this and the check penalty is automatically applied (for wizard spells) or optionally applied (cleric spells, skills and ability checks)
  - Luck Dice and Disapproval Rolls have their own dice widget that changes the number instead of the size of the dice
  - All terms can be overridden by entering formulae as text for cases the widgets don't anticipate
- Added support for variable substitution for all fields and handling for this in the Roll Modifier
- Sheet fields that are filled out by automation processes are now consistently greyed out and have a title attribute (hover text) to indicate why
- Speed Penalty can be automatically calculated and written to the Speed field on the sheet, based on armor and a Base Speed in the Actor Config dialog
- Rolling the Luck Die subtracts the appropriate amount of luck from the player's stats
- Max Attributes are show by default (this can still be disabled in the Actor Config dialog)
- Implemented multiple modes for Deed Rolls selectable from the Actor Config dialog - based on contributions by @radoslawg and @TylerKostuch 
  - Flat for characters without a Deed Roll - the default
  - Manual - the previous behaviour with a manual roll
  - Roll Per Attack - The Deed Roll button is not shown, but the Deed Die is automatically rolled with every attack
- Tidied up the formatting of the Deed Roll button
- The rollAttackBonus function now awaits on updating the Actor's Document, so macros that use this function can avoid race conditions
- Fixed rolling HD automatically in the NPC importer
- Fixed the Mighty Deeds How-To link on the Warrior sheet
- Automatically enable the extra dice in Dice So Nice's configuration when Dice So Nice is enabled in a new world
- Various refactoring and tidying of Roll related code