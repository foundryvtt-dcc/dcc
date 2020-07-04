/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */


export class DCCActor extends Actor {

    /** @override */
    getRollData() {
        const data = super.getRollData();
        return data;
    }

    /** @override */
    prepareData() {
        super.prepareData();

        const actorData = this.data;
        const data = actorData.data;
        const flags = actorData.flags;

        // Ability modifiers
        for (let [id, abl] of Object.entries(data.abilities)) {
            abl.mod = CONFIG.DCC.abilities.modifiers[abl.value] || 0;
            abl.label = CONFIG.DCC.abilities[id];
        }
    }

    /**
     * Roll an Ability Check
     * @param {String} abilityId    The ability ID (e.g. "str")
     * @param {Object} options      Options which configure how ability checks are rolled
     * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
     */
    rollAbilityCheck(abilityId, options = {}) {
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
     * Roll Initiative
     * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
     */
    rollInitiative() {
        const init = this.data.data.attributes.init.value;
        let roll = new Roll("1d20+@init", {init: init});

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize("DCC.Initiative")
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
