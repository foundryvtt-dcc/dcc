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

        return data;
    }

    /** @override */
    prepareData() {
        super.prepareData();
        console.log("PREPARE DATA");

        const actorData = this.data;
        const data = actorData.data;
        const flags = actorData.flags;
        console.log("ACTOR DATA");
        console.log(data);
        console.log(actorData.type);

        // Ability modifiers and saves
        for (let [id, abl] of Object.entries(data.abilities)) {
            abl.mod = CONFIG.DCC.abilities.modifiers[abl.value] || 0;
            abl.label = CONFIG.DCC.abilities[id];
        }

        if (actorData.type === "level0") {
            data.saves["ref"].value = data.abilities["agl"].mod;
            data.saves["frt"].value = data.abilities["sta"].mod;
            data.saves["wil"].value = data.abilities["per"].mod;
        }
    }

    /**
     * Roll an Ability Test
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

    /**
     * Roll a Weapon Attack
     * @param {string} weapon    The weaponid
     * @param {Object} options      Options which configure how ability tests are rolled
     * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
     */
    rollWeaponAttack(weaponId, options = {}) {
        const weapon = this.data.data.items.weapons[weaponId];
        let roll = new Roll("1d20+@hitBonus", {hitBonus: weapon.tohit});

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize(weapon.name) + " Attack Hits AC"
        });

        roll = new Roll("@damage", {damage: weapon.damage});

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize(weapon.name) + " Attack Damage"
        });
    }
}
