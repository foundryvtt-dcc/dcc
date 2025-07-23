Release v0.32.0

## Release Notes:
* Mark as compatible with v9 and add release notes for v0.32.0. (Steve Barnett)
* Update item creation/deletion to the v9 compatible APIs. Closes #323. (Steve Barnett)
* Remove the sheet config override - just use Foundry's one. (Steve Barnett)
* Explicitly pass a locstring for custom sheets (following 5e's lead). Re-sort the localised strings. (Steve Barnett)
* Fix tabs on v9. Closes #276. (Steve Barnett)
* Fallback to v8 Sheet Config override. Use v8 compatible SHEETS.Entity/DocumentSheetHint string for now. (Steve Barnett)
* Restore the custom sheet selection dialog. (Steve Barnett)
* Fix spurious single quote on Check Penalty field. Fix id of Base Speed field. (Steve Barnett)
* Update character sheet links to user guide to point at the wiki. Closes #315. (Steve Barnett)
* Support Deed Rolls on NPCs (via Config dialog). Tidy up Attack Bonus logic. Fix default Attack Bonus Mode. Closes #227. Closes #321. (Steve Barnett)
* Fix CSS formatting. (Steve Barnett)
* Lowercase data-dtype for funds fields. (Steve Barnett)
* Make each actor and item config sheet a unique instance. (Steve Barnett)
* Implement a set of fixed 'funds' fields on the character. Merge resolved As Coins items into the actor's funds. Closes #305. (Steve Barnett)
* Move zero level equipment tab over to the common template, with some logic to strip out the weapons and armor. (Steve Barnett)
* Add a compendium for common macros. Currently:
- Lightsource: None, Candle, Torch - apply lightsource settings to an actor
- Update All Players/NPCs - apply default vision and bar settings to all actors of the relevant type
- Setup Player/NPC Token - apply default vision and bar settings to the selected actor Closes #314. (Steve Barnett)
* Fix crit adjustment when critRange comes through as a string (e.g. for warriors). Closes #317. (Steve Barnett)
