    export interface CombatOptions {
        attackerName?: string;
        defenderName?: string;
        tick?: number;
        attackerTraits?: string[];
        defenderTraits?: string[];
    }

    export function resolveCombat(attackerForces: any, defenderForces: any, options: CombatOptions = {}) {
        const UnitTypes = ["infantry", "ranged", "mounted", "airship", "mage"];
        const aName = (options.attackerName || "").toLowerCase();
        const bName = (options.defenderName || "").toLowerCase();
        const tick = options.tick || 1;

        // Asymmetric Doctrine 1: Meridian / Dusthusk Desert Sand Evasion & Supply Siphon
        // 30% chance to slip past open field battle lines and plunder supplies instead
        if ((aName.includes('meridian') || aName.includes('dusthusk')) && Math.random() < 0.30) {
            return {
                attackerTotal: 50,
                defenderTotal: 50,
                difference: 0,
                winner: "ATTACKER" as const,
                attackerForces,
                defenderForces,
                evadedClash: true,
                siphonWealth: 100,
                siphonFood: 100,
                doctrineApplied: "Dusthusk Sand Evasion (Siphoned supplies instead of open field battle)"
            };
        } else if ((bName.includes('meridian') || bName.includes('dusthusk')) && Math.random() < 0.30) {
            return {
                attackerTotal: 50,
                defenderTotal: 50,
                difference: 0,
                winner: "DEFENDER" as const,
                attackerForces,
                defenderForces,
                evadedClash: true,
                siphonWealth: 100,
                siphonFood: 100,
                doctrineApplied: "Dusthusk Sand Evasion (Siphoned supplies instead of open field battle)"
            };
        }

        function getModifier(isAttacker: boolean, myType: string, enemyType: string): number {
            let mod = 0;
            if (isAttacker) {
                if (myType === "infantry" && (enemyType === "ranged" || enemyType === "mage")) mod -= 25;
                if (myType === "ranged" && (enemyType === "mounted" || enemyType === "airship")) mod -= 25;
                if (myType === "mounted" && (enemyType === "ranged" || enemyType === "mage")) mod -= 25;
                if (myType === "airship" && (enemyType === "infantry" || enemyType === "mage")) mod -= 25;
                if (myType === "mage") mod += 30;
            } else {
                if (myType === "infantry" && (enemyType === "mounted" || enemyType === "airship")) mod -= 25;
                if (myType === "ranged" && (enemyType === "infantry" || enemyType === "mage")) mod -= 25;
                if (myType === "mounted" && (enemyType === "infantry" || enemyType === "airship")) mod -= 25;
                if (myType === "airship" && (enemyType === "ranged" || enemyType === "mounted")) mod -= 25;
                if (myType === "mage") {
                    if (enemyType === "infantry" || enemyType === "mounted") mod -= 20;
                    else mod += 30;
                }
            }
            return mod;
        }

        function getRandomTarget(army: any): string {
            const types = Object.keys(army).filter(k => (army[k] || 0) > 0);
            if (types.length === 0) return "infantry";
            return types[Math.floor(Math.random() * types.length)] || "infantry";
        }

        let attackerTotal = 0;
        let defenderTotal = 0;

        for (const [unitType, count] of Object.entries(attackerForces)) {
            const numUnits = Math.floor(count as number);
            for (let i = 0; i < numUnits; i++) {
                const enemy = getRandomTarget(defenderForces);
                const roll = Math.floor(Math.random() * 100) + 1;
                attackerTotal += Math.max(0, roll + getModifier(true, unitType, enemy));
            }
        }

        for (const [unitType, count] of Object.entries(defenderForces)) {
            const numUnits = Math.floor(count as number);
            for (let i = 0; i < numUnits; i++) {
                const enemy = getRandomTarget(attackerForces);
                const roll = Math.floor(Math.random() * 100) + 1;
                defenderTotal += Math.max(0, roll + getModifier(false, unitType, enemy));
            }
        }

        // --- ASYMMETRIC FACTION WAR DOCTRINES ---
        // Avian: Airborne vanguard strikes
        if (aName.includes('avian')) attackerTotal += (Number(attackerForces.airship) || 0) * 15;
        if (bName.includes('avian')) defenderTotal += (Number(defenderForces.airship) || 0) * 15;

        // Ursine: Heavy shock cavalry fortitude
        if (aName.includes('ursine')) attackerTotal += (Number(attackerForces.mounted) || 0) * 8;
        if (bName.includes('ursine')) defenderTotal += (Number(defenderForces.mounted) || 0) * 8;

        // Iron Caldera: Forged-steel heavy armor
        if (aName.includes('iron caldera')) attackerTotal += (Number(attackerForces.infantry) || 0) * 5;
        if (bName.includes('iron caldera')) defenderTotal += (Number(defenderForces.infantry) || 0) * 5;

        // Guerrilla: Air denial & supply ambushes
        if (aName.includes('guerrilla')) defenderTotal = Math.max(0, defenderTotal - (Number(defenderForces.airship) || 0) * 10);
        if (bName.includes('guerrilla')) attackerTotal = Math.max(0, attackerTotal - (Number(attackerForces.airship) || 0) * 10);

        // Eastern Hounds: Tracking and outflanking (cut opposing combat power by 20%)
        if (aName.includes('eastern')) defenderTotal *= 0.80;
        if (bName.includes('eastern')) attackerTotal *= 0.80;

        // Heartland: Massive peasant levies
        if (aName.includes('heartland')) attackerTotal += (Number(attackerForces.infantry) || 0) * 2;
        if (bName.includes('heartland')) defenderTotal += (Number(defenderForces.infantry) || 0) * 2;

        // Canopy / Flower: Plant camouflage & neurotoxins
        if (aName.includes('canopy') || aName.includes('flower')) attackerTotal *= 1.20;
        if (bName.includes('canopy') || bName.includes('flower')) defenderTotal *= 1.20;

        const difference = Math.abs(attackerTotal - defenderTotal);
        const aWon = attackerTotal > defenderTotal;
        const losingArmy = aWon ? defenderForces : attackerForces;

        let totalUnitsInLosingArmy = 0;
        for (const val of Object.values(losingArmy)) {
            totalUnitsInLosingArmy += (val as number) || 0;
        }

        // Base casualty calculation
        let winCasRate = 0.05;
        let loseCasRate = 0.20;

        // Asymmetric casualty shielding:
        // Hive: Chitinous casualty shielding
        if (aName.includes('hive')) { if (aWon) winCasRate *= 0.5; else loseCasRate *= 0.5; }
        if (bName.includes('hive')) { if (!aWon) winCasRate *= 0.5; else loseCasRate *= 0.5; }

        // Heartland: Casualties halved
        if (aName.includes('heartland')) { if (aWon) winCasRate *= 0.5; else loseCasRate *= 0.5; }
        if (bName.includes('heartland')) { if (!aWon) winCasRate *= 0.5; else loseCasRate *= 0.5; }

        // Prism: Solar daylight shielding (0 casualties during daytime ticks)
        if (tick % 8 < 4) {
            if (aName.includes('prism')) { if (aWon) winCasRate = 0; else loseCasRate = 0; }
            if (bName.includes('prism')) { if (!aWon) winCasRate = 0; else loseCasRate = 0; }
        }

        if (totalUnitsInLosingArmy > 0) {
            const unitsLost = Math.min(totalUnitsInLosingArmy, Math.max(1, (difference / 100) * loseCasRate * totalUnitsInLosingArmy));

            for (const unitType of Object.keys(losingArmy)) {
                const current = (losingArmy[unitType] as number) || 0;
                if (current > 0) {
                    const proportion = current / totalUnitsInLosingArmy;
                    const typeLoss = unitsLost * proportion;
                    losingArmy[unitType] = Math.max(0, current - typeLoss);
                }
            }
        }

        // Check Reliance Scorched Earth & Sump-Kin Subterranean Terror
        const winnerName = aWon ? aName : bName;
        const loserName = aWon ? bName : aName;
        const isScorchedEarth = loserName.includes('reliance');
        const isSumpKinTerror = winnerName.includes('sump') || winnerName.includes('sump-kin');

        return {
            attackerTotal,
            defenderTotal,
            difference,
            winner: aWon ? "ATTACKER" as const : "DEFENDER" as const,
            attackerForces,
        defenderForces,
            scorchedEarth: isScorchedEarth,
            sumpKinTerror: isSumpKinTerror
        };
    }
