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
            template: "systems/dcc/templates/actor-sheet.html",
            width: 600,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
            dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
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
            isZero: this.entity.data.type === "zero",
            config: CONFIG.DCC,
        };

        // The Actor and its Items
        data.actor = duplicate(this.actor.data);
        console.log(data.actor.data);
        data.items = this.actor.items.map(i => {
            i.data.labels = i.labels;
            return i.data;
        });
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        data.data = data.actor.data;
        data.labels = this.actor.labels || {};
        data.filters = this._filters;

        // Ability modifiers and saves
        for (let [id, abl] of Object.entries(data.actor.data.abilities)) {
            abl.mod = data.config.abilities.modifiers[abl.value] || 0;
            abl.label = CONFIG.DCC.abilities[id];
        }

        data.actor.data.saves["ref"].value = data.actor.data.abilities["agl"].mod;
        data.actor.data.saves["ref"].label = CONFIG.DCC.saves["ref"];
        data.actor.data.saves["frt"].value = data.actor.data.abilities["sta"].mod;
        data.actor.data.saves["frt"].label = CONFIG.DCC.saves["frt"];
        data.actor.data.saves["wil"].value = data.actor.data.abilities["per"].mod;
        data.actor.data.saves["wil"].label = CONFIG.DCC.saves["wil"];

        // Update traits
        //this._prepareTraits(data.actor.data.traits);

        // Prepare owned items
        //this._prepareItems(data);

        // Return data to the sheet
        return data
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getOwnedItem(li.data("itemId"));
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            this.actor.deleteOwnedItem(li.data("itemId"));
            li.slideUp(200, () => this.render(false));
        });
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

    /* -------------------------------------------- */

    /** @override */
    _updateObject(event, formData) {
        // Update the Actor
        return this.object.update(formData);
    }
}
