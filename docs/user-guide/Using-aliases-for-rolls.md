You can use variables in any roll on your sheet or chat to reference attributes of the actor or selected token. To use a variable, type @variable in the text box for the relevant roll.

For example, to setup a melee attack roll, you can enter '+@ab+@str+1'. This adds attack bonus, plus your strength, plus 1 to the roll.

You can reference any attribute of an actor with its full path (e.g. data.ablities.int.mod), but the system provides some aliases for quick access to common attributes:

        @str: Strength Modifier (data.abilities.str.mod)
        @agi: Agility Modifier (data.abilities.agl.mod)
        @agl: Agility Modifier - alternate alias (data.abilities.agl.mod)
        @sta: Stamina Modifier (data.abilities.sta.mod)
        @per: Personality Modifier (data.abilities.per.mod)
        @int: Intelligence Modifier (data.abilities.int.mod)
        @lck: Luck Modidifer (data.abilities.lck.mod)
        @ref: Reflex Save (data.abilities.ref.value)
        @frt: Fortitude Save (data.saves.frt.value)
        @wil: Will Save (data.saves.wil.value)
        @ac: Armor Class (data.attributes.ac.value)
        @check: Armor Check Penalty (data.attributes.ac.checkPenalty)
        @speed: Speed (data.attributes.speed.value)
        @hp: Current Hit Points (data.attributes.hp.value)
        @maxhp: Maximum Hit Points (data.attributes.hp.max)
        @level: Current Level (data.details.level.value)
        @cl: Current Level - alternate alias (data.details.level.value)

For Player type actors only:

        @xp: Current XP (data.details.xp.value)
        @ab: Attack Bonus or last Deed Die roll (data.details.attackBonus if Attack Bonus Mode is 'Flat' otherwise data.details.lastRolledAttackBonus)