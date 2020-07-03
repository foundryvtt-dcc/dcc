/**
 * Extend the basic ActorSheet
 * @extends {ActorSheet}
 */

import {DCC} from './config.js';

export class DCCActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["dcc", "sheet", "actor"],
            template: "systems/dcc/templates/actor-sheet-level0.html",
            width: 600,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
            dragDrop: [{dragSelector: ".weapon-list .weapon", dropSelector: null}]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        // Basic data
        let isOwner = this.entity.owner;
        const data = {
            owner: isOwner,
            limited: this.entity.limited,
            options: this.options,
            editable: this.isEditable,
            cssClass: isOwner ? "editable" : "locked",
            isCharacter: this.entity.data.type === "character",
            isNPC: this.entity.data.type === "npc",
            isZero: this.entity.data.type === "level0",
            config: CONFIG.DCC,
        };

        data.actor = duplicate(this.actor.data);
        data.data = data.actor.data;
        data.labels = this.actor.labels || {};
        data.filters = this._filters;

        data.data.utility = {};
        data.data.utility.meleeWeapons = [0, 1, 2];
        data.data.utility.rangedWeapons = [3, 4];
        console.log(data.data);

        if (data.isNPC) {
            this.options.template = "systems/dcc/templates/actor-sheet-npc.html"
        }

        return data;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Owner Only Listeners
        if (this.actor.owner) {
            // Ability Checks
            html.find('.ability-name').click(this._onRollAbilityTest.bind(this));

            // Initiative
            html.find('.init').click(this._onRollInitiative.bind(this));

            // Saving Throws
            html.find('.save-value').click(this._onRollSavingThrow.bind(this));

            // Weapons
            let handler = ev => this._onDragStart(ev);
            html.find('.weapon-button').click(this._onRollWeaponAttack.bind(this));
            html.find('li.weapon').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", handler, false);
            });
        }
        // Otherwise remove rollable classes
        else {
            html.find(".rollable").each((i, el) => el.classList.remove("rollable"));
        }

    }

    /* -------------------------------------------- */

    /**
     * Listen for click events on an attribute control to modify the composition of attributes in the sheet
     * @param {MouseEvent} event    The originating left click event
     * @private
     */
    async _onClickAttributeControl(event) {
        event.preventDefault();
        const a = event.currentTarget;
        const action = a.dataset.action;
        const attrs = this.object.data.data.attributes;
        const form = this.form;
    }

    /** @override */
    _onDragStart(event) {
        const li = event.currentTarget;
        const weapon = this.actor.data.data.items.weapons[li.dataset.weaponId];
        weapon.id = li.dataset.weaponId;
        const dragData = {
            type: "Item",
            actorId: this.actor.id,
            data: weapon
        };
        if (this.actor.isToken) dragData.tokenId = this.actor.token.id;
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    /* -------------------------------------------- */

    /**
     * Handle rolling an Ability check
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollAbilityTest(event) {
        event.preventDefault();
        let ability = event.currentTarget.parentElement.dataset.ability;
        this.actor.rollAbilityCheck(ability, {event: event});
    }

    /**
     * Handle rolling Initiative
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollInitiative(event) {
        event.preventDefault();
        this.actor.rollInitiative({event: event});
    }

    /**
     * Handle rolling a saving throw
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollSavingThrow(event) {
        event.preventDefault();
        let save = event.currentTarget.parentElement.dataset.save;
        this.actor.rollSavingThrow(save, {event: event});
    }

    /**
     * Handle rolling a weapon attack
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollWeaponAttack(event) {
        event.preventDefault();
        let weaponId = event.currentTarget.parentElement.dataset.weaponId;
        this.actor.rollWeaponAttack(weaponId, {event: event});
    }

    /* -------------------------------------------- */

    /** @override */
    setPosition(options = {}) {
        const position = super.setPosition(options);
        const sheetBody = this.element.find(".sheet-body");
        const bodyHeight = position.height - 192;
        sheetBody.css("height", bodyHeight);
        return position;
    }

    /* -------------------------------------------- */

    /** @override */
    _updateObject(event, formData) {
        // Update the Actor
        return this.object.update(formData);
    }

}
