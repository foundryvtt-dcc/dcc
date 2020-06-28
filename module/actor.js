/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */


export class DCCActor extends Actor {

    /** @override */
    getRollData() {
        const data = super.getRollData();
        const shorthand = game.settings.get("dcc", "macroShorthand");

        // Re-map all attributes onto the base roll data
        if (!!shorthand) {
            for (let [k, v] of Object.entries(data.attributes)) {
                if (!(k in data)) data[k] = v.value;
            }
            delete data.attributes;
        }

        // Map all items data using their slugified names
        data.items = this.data.items.reduce((obj, i) => {
            let key = i.name.slugify({strict: true});
            let itemData = duplicate(i.data);
            if (!!shorthand) {
                for (let [k, v] of Object.entries(itemData.attributes)) {
                    if (!(k in itemData)) itemData[k] = v.value;
                }
                delete itemData["attributes"];
            }
            obj[key] = itemData;
            return obj;
        }, {});
        return data;
    }

    /**
     * Roll a generic ability test or saving throw.
     * Prompt the user for input on which variety of roll they want to do.
     * @param {String}abilityId     The ability id (e.g. "str")
     * @param {Object} options      Options which configure how ability tests or saving throws are rolled
     */
    rollAbility(abilityId, options = {}) {
        const label = CONFIG.DCC.abilities[abilityId];
        this.rollAbilityTest(abilityId, options);
    }

    /* -------------------------------------------- */

    /**
     * Roll an Ability Test
     * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
     * @param {String} abilityId    The ability ID (e.g. "str")
     * @param {Object} options      Options which configure how ability tests are rolled
     * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
     */
    rollAbilityTest(abilityId, options = {}) {
        const label = CONFIG.DCC.abilities[abilityId];
        console.log(this.data);
        const abl = this.data.data.abilities[abilityId];
        abl.mod = CONFIG.DCC.abilities.modifiers[abl.value] || 0;
        abl.label = CONFIG.DCC.abilities[abilityId];

        let roll = new Roll("1d20+@abilMod", {abilMod: abl.mod});

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize(abl.label) + " Check"
        });
    }
}
