import { Burg } from "../civilization/burg-generator";
import { BurgMarket } from "../civilization/markets-generator";

export interface FringeGroup {
    id: number;
    type: "Rebels" | "Bandits" | "Cultists";
    originBurgId: number;
    size: number;
}

export function generateFringeGroups(
    burgs: Burg[],
    markets: BurgMarket[],
    magicLevels: Float32Array
): FringeGroup[] {
    const groups: FringeGroup[] = [];
    let nextId = 1;

    for (const burg of burgs) {
        const market = markets.find((m) => m.burgId === burg.id);
        if (!market) continue;

        // Crop is good ID 3
        const cropSupply = market.supply[3] || 0;
        
        // Economic Trigger: Low food supply
        if (cropSupply < 1.0) {
            groups.push({
                id: nextId++,
                type: "Rebels",
                originBurgId: burg.id,
                size: Math.floor(burg.population * 0.05), // 5% of pop becomes rebels
            });
        } else if (cropSupply < 2.0) {
            groups.push({
                id: nextId++,
                type: "Bandits",
                originBurgId: burg.id,
                size: Math.floor(burg.population * 0.02), // 2% of pop becomes bandits
            });
        }

        // Magical Trigger: High magic level in the area
        const cellMagicLevel = magicLevels[burg.cell] || 0;
        if (cellMagicLevel > 80.0) {
            groups.push({
                id: nextId++,
                type: "Cultists",
                originBurgId: burg.id,
                size: Math.floor(burg.population * 0.03), // 3% of pop becomes cultists
            });
        }
    }

    return groups;
}
