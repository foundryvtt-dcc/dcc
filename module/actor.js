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

    /* -------------------------------------------- */

    /**
     * Roll an Ability Test
     * Prompt the user for input any Situational Bonus
     * @param {String} abilityId    The ability ID (e.g. "str")
     * @param {Object} options      Options which configure how ability tests are rolled
     * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
     */
    rollAbilityTest(abilityId, options = {}) {
        const label = CONFIG.DCC.abilities[abilityId];
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

    /**
     * Roll a Saving Throw
     * Prompt the user for input any Situational Bonus
     * @param {String} saveId    The save ID (e.g. "str")
     * @param {Object} options      Options which configure how ability tests are rolled
     * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
     */
    rollSavingThrow(saveId, options = {}) {
        const label = CONFIG.DCC.saves[saveId];
        const save = this.data.data.saves[saveId];
        save.label = CONFIG.DCC.saves[saveId];
        switch (saveId) {
            case 'ref':
                save.value = CONFIG.DCC.abilities.modifiers[this.data.data.abilities["agl"].value] || 0;
                break;
            case 'frt':
                save.value = CONFIG.DCC.abilities.modifiers[this.data.data.abilities["sta"].value] || 0;
                break;
            case 'wil':
                save.value = CONFIG.DCC.abilities.modifiers[this.data.data.abilities["per"].value] || 0;
                break;
        }

        let roll = new Roll("1d20+@saveMod", {saveMod: save.value});

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize(save.label) + " Save"
        });
    }
}
