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
        }
    }

    /**
     * Roll an Ability Check
     * @param {String} abilityId    The ability ID (e.g. "str")
     * @param {Object} options      Options which configure how ability checks are rolled
     */
    rollAbilityCheck(abilityId, options = {}) {
        const label = CONFIG.DCC.abilities[abilityId];
        const abl = this.data.data.abilities[abilityId];
        abl.mod = CONFIG.DCC.abilities.modifiers[abl.value] || 0;
        abl.label = CONFIG.DCC.abilities[abilityId];

        let roll = new Roll("1d20+@abilMod", {abilMod: abl.mod, critical: 20});
        if ((abilityId === 'lck') && (options.event.currentTarget.className !== "ability-modifiers")) {
            roll = new Roll("1d20");
        }

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize(abl.label) + " Check"
        });
    }

    /**
     * Roll Initiative
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
     * @param {String} saveId       The save ID (e.g. "str")
     */
    rollSavingThrow(saveId) {
        const label = CONFIG.DCC.saves[saveId];
        const save = this.data.data.saves[saveId];
        save.label = CONFIG.DCC.saves[saveId];
        let roll = new Roll("1d20+@saveMod", {saveMod: save.value});

        // Convert the roll to a chat message
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: game.i18n.localize(save.label) + " Save"
        });
    }

    /**
     * Roll a Weapon Attack
     * @param {string} weaponId     The weapon id (e.g. "m1", "r1")
     * @param {Object} options      Options which configure how ability tests are rolled
     */
    async rollWeaponAttack(weaponId, options = {}) {
        const weapon = this.data.data.items.weapons[weaponId];
        const speaker = {alias: this.name, _id: this._id};
        const toHit = myArray.filter(function (str) { return str.indexOf("+-") === -1; });
        const formula = `1d20 + ${weapon.toHit}`

        /* Roll the Attack */
        let roll = new Roll(formula, {'critical': 20});
        roll.roll();
        const rollHTML = this._formatRoll(roll, formula);

        /** Handle Critical Hits **/
        let crit = "";
        if (Number(roll.dice[0].results[0]) === 20) {
            const critTableFilter = `Crit Table ${this.data.data.attributes.critical.table}`;
            const pack = game.packs.get('dcc.criticalhits');
            await pack.getIndex(); //Load the compendium index
            let entry = pack.index.find(entity => entity.name.startsWith(critTableFilter));
            const table = await pack.getEntity(entry._id);
            const roll = new Roll(`${this.data.data.attributes.critical.die} + ${this.data.data.abilities.lck.mod}`);
            const critResult = await table.draw({'roll': roll, 'displayChat': false});
            crit = ` <br><br><span style="color:red">Critical Hit!</span> ${critResult.results[0].text}</span>`;
        }

        /* Emote attack results */
        const messageData = {
            user: game.user._id,
            speaker: speaker,
            type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
            content: `Attacks with their ${game.i18n.localize(weapon.name)} and hits AC ${rollHTML} for [[${weapon.damage}]] points of damage!${crit}`,
            sound: CONFIG.sounds.dice
        };
        CONFIG.ChatMessage.entityClass.create(messageData);
    }

    /**
     * Format a roll for display in-line
     * @param {Object<Roll>} roll   The roll to format
     * @param {string} formula      Formula to show when hovering
     * @return {string}             Formatted HTML containing roll
     */
    _formatRoll(roll, formula) {
        const rollData = escape(JSON.stringify(roll));

        // Check for Crit/Fumble
        let critFailClass = "";
        if (Number(roll.dice[0].results[0]) === 20)  critFailClass = "critical ";
        else if (Number(roll.dice[0].results[0]) === 1) critFailClass = "fumble ";

        return `<a class="${critFailClass}inline-roll inline-result" data-roll="${rollData}" title="${formula}"><i class="fas fa-dice-d20"></i> ${roll.total}</a>`;
    }
}
