"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCombat = resolveCombat;
function resolveCombat(attackerForces, defenderForces) {
    const UnitTypes = ["infantry", "ranged", "mounted", "airship", "mage"];
    function getModifier(isAttacker, myType, enemyType) {
        let mod = 0;
        if (isAttacker) {
            if (myType === "infantry" && (enemyType === "ranged" || enemyType === "mage"))
                mod -= 25;
            if (myType === "ranged" && (enemyType === "mounted" || enemyType === "airship"))
                mod -= 25;
            if (myType === "mounted" && (enemyType === "ranged" || enemyType === "mage"))
                mod -= 25;
            if (myType === "airship" && (enemyType === "infantry" || enemyType === "mage"))
                mod -= 25;
            if (myType === "mage")
                mod += 30;
        }
        else {
            if (myType === "infantry" && (enemyType === "mounted" || enemyType === "airship"))
                mod -= 25;
            if (myType === "ranged" && (enemyType === "infantry" || enemyType === "mage"))
                mod -= 25;
            if (myType === "mounted" && (enemyType === "infantry" || enemyType === "airship"))
                mod -= 25;
            if (myType === "airship" && (enemyType === "ranged" || enemyType === "mounted"))
                mod -= 25;
            if (myType === "mage") {
                if (enemyType === "infantry" || enemyType === "mounted")
                    mod -= 20;
                else
                    mod += 30;
            }
        }
        return mod;
    }
    function getRandomTarget(army) {
        const types = Object.keys(army).filter(k => (army[k] || 0) > 0);
        if (types.length === 0)
            return "infantry";
        return types[Math.floor(Math.random() * types.length)] || "infantry";
    }
    let attackerTotal = 0;
    let defenderTotal = 0;
    for (const [unitType, count] of Object.entries(attackerForces)) {
        const numUnits = Math.floor(count);
        for (let i = 0; i < numUnits; i++) {
            const enemy = getRandomTarget(defenderForces);
            const roll = Math.floor(Math.random() * 100) + 1;
            attackerTotal += Math.max(0, roll + getModifier(true, unitType, enemy));
        }
    }
    for (const [unitType, count] of Object.entries(defenderForces)) {
        const numUnits = Math.floor(count);
        for (let i = 0; i < numUnits; i++) {
            const enemy = getRandomTarget(attackerForces);
            const roll = Math.floor(Math.random() * 100) + 1;
            defenderTotal += Math.max(0, roll + getModifier(false, unitType, enemy));
        }
    }
    const difference = Math.abs(attackerTotal - defenderTotal);
    const losingArmy = attackerTotal > defenderTotal ? defenderForces : attackerForces;
    let totalUnitsInLosingArmy = 0;
    for (const val of Object.values(losingArmy)) {
        totalUnitsInLosingArmy += val || 0;
    }
    if (totalUnitsInLosingArmy > 0) {
        const unitsLost = difference / 100;
        for (const unitType of Object.keys(losingArmy)) {
            const current = losingArmy[unitType] || 0;
            if (current > 0) {
                const proportion = current / totalUnitsInLosingArmy;
                const typeLoss = unitsLost * proportion;
                losingArmy[unitType] = Math.max(0, current - typeLoss);
            }
        }
    }
    return {
        attackerTotal,
        defenderTotal,
        difference,
        winner: attackerTotal > defenderTotal ? "ATTACKER" : "DEFENDER",
        attackerForces,
        defenderForces
    };
}
//# sourceMappingURL=combatEngine.js.map