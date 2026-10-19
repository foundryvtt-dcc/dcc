# Dungeon Crawl Classics Support for Foundry VTT

Goodman Games' Dungeon Crawl Classics RPG system for the [Foundry Virtual Tabletop](https://foundryvtt.com).

Please check out the [User Guide](https://foundryvtt-dungeon-crawl-classics-user-guide.readthedocs.io/en/latest/). Thanks to Christian Ovsenik (@algnc) for putthing that together.

Join us on the [dcc channel on the FoundryVTT Discord](https://discord.gg/foundryvtt) for help and discussion.

## What the free system includes

This system is the **rules engine**: character sheets and the dice for attacks, critical hits and fumbles, Mighty Deeds, two-weapon fighting, saving throws, spell checks, spellburn, patron taint, cleric disapproval and spell duels.

It contains **no content from copyrighted DCC products**. The rules tables, class level data, spells, equipment and monsters are in the paid **DCC Core Book** module, available from the [Goodman Games Web Store](https://goodman-games.com/store/product/foundryvtt-dcc-compendium-license-key/).

Without the core book module, the rolls still work, but you look results up in your rulebook or enter the content yourself:

* **Critical hits and fumbles** roll the right die. For crits, the chat card tells you which table to look the result up on; for fumbles, look the roll up on the fumble table.
* **Spell checks** show success or failure, but not the spell's result text.
* **Leveling up** only changes the level number. The hit point roll, attack bonus, saves and other class values for the new level come from level data, which you have to [enter yourself](docs/user-guide/Adding-Level-Up-Data.md).
* **Spells, equipment and monsters** have to be created by hand.

See [System vs. Module](docs/user-guide/System-Vs-Module.md) for more.

Work Process (for developers): [JSON/LevelDB pack workflow](docs/dev/LEVELDB_WORKFLOW.md)

###### Maintainers
* Tim L. White (@cyface, tim@cyface.com)

###### Maintainers Emeritus
* Christian Ovsenik (@algnc)
* Steve Barnett (@mooped)

###### Contributors
* Connor Stone (@ckwk)
* Alexander Dotor-Mohring (@adotor) (Original German translation and other contributions)
* Jonathan Dorety (@jdorety)
* Radoslaw Grzanka (@radoslawg)
* Tyler Kostuch (@TylerKostuch)
* Frédéric (@theksi) (Original French translation)
* @sasquach45932
* Tony Zito (@tonyrobots)
* Marco Bertolini (@bertolinimarco) and Emanuele Granatello (Italian translation)
* ZzNoah (Chinese Translation)
* Alexander Minges (@Athemis)

Contains some icon art from [game-icons.net](https://game-icons.net), used under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) — see [per-artist credits](styles/images/game-icons-net/credits.txt).

###### Documentation
* [Release Process](docs/dev/RELEASE_PROCESS.md) - Guidelines for creating releases and managing versions
* [V14 Reference](docs/dev/V14.md) - FoundryVTT V14 data models, Active Effects V2, and API changes
* [V13 / ApplicationV2 Reference](docs/dev/V13.md) - ApplicationV2 patterns used by all sheets and dialogs

###### Contributing
* Thanks for considering helping out! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.
* All PRs must pass the automated unit tests in this project to be considered for merging.
* All PRs must implement Internationalization support in en.json to be considered for merging.
* We have lots of changes in progress, so your PR may not be able to be merged if it conflicts with unreleased work.
* Chat with us on the Discord channel if you have questions!

_Based on material ©2012 Goodman Games, used with permission._
