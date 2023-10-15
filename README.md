# Dungeon Crawl Classics Support for Foundry VTT

Goodman Games' Dungeon Crawl Classics RPG system for the [Foundry Virtual Tabletop](https://foundryvtt.com).

[User Guide](https://github.com/foundryvtt-dcc/dcc/wiki/DCC-System-User-Guide), thanks to Christian Ovsenik (@algnc).

Join us on the [virtual-tabletop channel](https://discord.gg/2PR9YH9) on the Goodman Games discord for help and discussion.

*Note that this system does not contain content from copyrighted DCC products, only rollable character sheets.*

You can purchase a module containing copyrighted Goodman Games content ready for out-of-the-box use in Foundry VTT from the [Goodman Games Web Store](https://goodman-games.com/store/product/foundryvtt-dcc-compendium-license-key/) .

###### Maintainers
* Steve Barnett (@mooped)
* Christian Ovsenik (@algnc)
* Tim L. White (@cyface, tim@cyface.com)

###### Contributors
* Connor Stone (@ckwk)
* Alexander Dotor-Mohring (@adotor)
* Jonathan Dorety (@jdorety)
* Radoslaw Grzanka (@radoslawg)
* Tyler Kostuch (@TylerKostuch)
* @sasquach45932 

Contains some icon art from game-icons.net.

###### Contributing
* Thanks for considering helping out!
* All PRs must pass the automated unit tests in this project to be considered for merging.
* All PRs must implement Internationalization support in en.json to be considered for merging.
* We have lots of changes in progress, so your PR may not be able to be merged if it conflicts with unreleased work.
* Chat with us on the Discord channel if you have questions!

###### Extension Hooks
The system will call the following hooks for extension purposes:
* **dcc.ready** () - called with no arguments when the DCC system has finished initialising
* **dcc.postActorImport** ( options = { actor } ) - called with an object containing the actor data after an actor has been imported
* **dcc.activateItem** ( messageData, options) - called when an item is activated, to allow the event to be handled or the chat message to be adjusted

The sytem responds to the following hooks for extension purposes:
* **dcc.registerDisapprovalPack** ( packName, fromSystemSetting) - add a custom pack of disapproval tables
* **dcc.registerCriticalHitsPack** ( packName, fromSystemSetting) - add a custom pack of critical hit tables
* **dcc.setFumbleTable** ( tablePath, fromSystemSetting) - set the fumble table
* **dcc.setMercurialMagicTable** ( tablePath, fromSystemSetting) - set the Mercurial Magic results table
* **dcc.setDivineAidTable** ( tablePath, fromSystemSetting) - set the Divine Aid results table
* **dcc.setLayOnHandsTable** ( tablePath, fromSystemSetting) - set the Lay on Hands results table
* **dcc.setTurnUnholyTable** ( tablePath, fromSystemSetting) - set the Turn Unholy results table

_Based on material ©2012 Goodman Games, used with permission._
