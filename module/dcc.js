/**
 * DCC
 * Software License: GNU GPLv3
 */

// Import Modules
import {DCCActor} from "./actor.js";
import {DCCItemSheet} from "./item-sheet.js";
import {DCCActorSheet} from "./actor-sheet.js";
import {DCC} from './config.js';

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
    console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`);

    CONFIG.DCC = DCC;
    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "1d20",
        decimals: 2
    };

    // Define custom Entity classes
    CONFIG.Actor.entityClass = DCCActor;

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dcc", DCCActorSheet, {makeDefault: true});
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("dcc", DCCItemSheet, {makeDefault: true});

    // Register system settings
    game.settings.register("dcc", "macroShorthand", {
        name: "Shortened Macro Syntax",
        hint: "Enable a shortened macro syntax which allows referencing attributes directly, for example @str instead of @attributes.str.value. Disable this setting if you need the ability to reference the full attribute model, for example @attributes.str.label.",
        scope: "world",
        type: Boolean,
        default: true,
        config: true
    });
});
