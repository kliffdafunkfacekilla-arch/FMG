import { tagBurgCitizens, tagSectorEnvironment } from "./citizenPersonaHelper";
import { loadCellTagMap, removeCellTags } from "../cellTags.js";

/**
 * Helper to extract uppercase trait names from a paragon's traits column
 */
function getParagonTraitNames(p: any): string[] {
    const list: string[] = [];
    if (!p || !p.traits) return list;
    try {
        const parsed = typeof p.traits === 'string' ? JSON.parse(p.traits) : p.traits;
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (typeof item === 'string') list.push(item.toUpperCase());
                else if (item && item.name) list.push(String(item.name).toUpperCase());
            }
        }
    } catch (e) {}
    return list;
}

/**
 * Autonomous Local Paragon Agent:
 * Burg leaders (Mayors, Reeves, Burgomasters, Headmen, Security Commanders, Watch Captains)
 * assess the authentic deficits and crises of their burg, but their personality traits
 * and active narrative tags fundamentally bias their decision-making.
 *
 * An obvious decision (e.g. buying food during famine) is NOT always taken:
 * - A Greedy/Corrupt leader hoards grain for price gouging or audits taxes.
 * - A Paranoid leader fortifies ramparts or declares curfews to suppress riots.
 * - A Fanatical leader funds temple sacrifices and hunts heretics.
 * - A Hedonist leader throws distracting wine festivals.
 * - A Compassionate leader feeds the poor and cleanses the streets.
 * - Active tags (#PlagueOutbreak, #TradeBlockaded, #CartelInfiltration) further alter choices.
 */
export async function runLocalParagonAgent(client: any, tick: number, loreDate: string = "") {
    const burgRes = await client.query("SELECT * FROM sim_burg_economy");
    const paragonRes = await client.query("SELECT * FROM sim_paragons");
    
    // Fetch active environmental tags across sectors
    const sectorTagsMap = await loadCellTagMap(client);

    // Group paragons by burg
    const paragonsByBurg = new Map<number, any[]>();
    for (const p of paragonRes.rows) {
        if (!paragonsByBurg.has(p.burg_id)) paragonsByBurg.set(p.burg_id, []);
        paragonsByBurg.get(p.burg_id)!.push(p);
    }

    const burgUpdates: any[] = [];
    const events: any[] = [];
    const paragonScoreUpdates = new Map<number, number>();

    for (const burg of burgRes.rows) {
        const pop = burg.pop_null || 0;
        if (pop <= 0) continue;

        const cellId = Number(burg.cell_id || 0);
        const sectorTags = sectorTagsMap.get(cellId) || [];

        // 1. BURG ACTUAL REAL-WORLD CONDITION ASSESSMENT
        const foodNeedRatio = (burg.food || 0) / Math.max(1, pop * 2);
        const isFamine = foodNeedRatio < 0.6 || sectorTags.some(t => t.includes("Famine") || t.includes("Shortage"));
        const isFoodShortage = foodNeedRatio < 1.0;
        const isPlagueOrSqualor = (burg.health || 100) < 70 || sectorTags.some(t => t.includes("Plague") || t.includes("Fever") || t.includes("Squalor"));
        const isHighUnrest = (burg.unrest || 0) > 25 || sectorTags.some(t => t.includes("Unrest") || t.includes("Riot"));
        const isCriticalUnrest = (burg.unrest || 0) > 50;
        const isBankrupt = (burg.wealth || 0) < 60;
        const isWealthySurplus = (burg.wealth || 0) > 800;
        const isHighCrime = (burg.crime_rate || 0) > 30 || sectorTags.some(t => t.includes("Underworld") || t.includes("Cartel") || t.includes("Extortion"));
        const isTradeBlockaded = sectorTags.some(t => t.includes("Blockade") || t.includes("Embargo"));
        const isCartelInfiltrated = sectorTags.some(t => t.includes("Cartel") || t.includes("InsideMan") || t.includes("Smuggler"));
        const isDragonstoneBoom = sectorTags.some(t => t.includes("Dragonstone") || t.includes("Mining"));
        const isChaosCrisis = sectorTags.some(t => t.includes("Chaos") || t.includes("Storm") || t.includes("Rift"));

        // Action Results Trackers for this burg
        let foodDelta = 0;
        let wealthDelta = 0;
        let crimeDelta = 0;
        let unrestDelta = 0;
        let healthDelta = 0;
        let rawMaterialsDelta = 0;
        let refinedGoodsDelta = 0;

        const myParagons = paragonsByBurg.get(burg.burg_id) || [];

        for (const p of myParagons) {
            // Administrative Council Cycle: Leaders pass major municipal decrees periodically (bi-weekly council),
            // staggered by paragon ID to prevent daily decree spam across the realm.
            if ((tick + p.id * 5) % 14 !== 0) continue;

            const domain = p.domain || (
                p.title?.includes("Commander") || p.title?.includes("Marshal") || 
                p.title?.includes("Captain") || p.title?.includes("Warden") ? 'Security' : 'Civil'
            );

            const traits = getParagonTraitNames(p);
            const corruption = Number(p.corruption_score || 0);

            // Trait Booleans
            const isGreedy = traits.some(t => t.includes("GREEDY") || t.includes("USURIOUS") || t.includes("CORRUPT") || t.includes("AVARICE"));
            const isParanoid = traits.some(t => t.includes("PARANOID") || t.includes("WARY") || t.includes("FEARFUL") || t.includes("SUSPICIOUS"));
            const isCompassionate = traits.some(t => t.includes("COMPASSIONATE") || t.includes("BENEVOLENT") || t.includes("AGRARIAN") || t.includes("GENEROUS") || t.includes("PATERNAL"));
            const isFanatical = traits.some(t => t.includes("FANATICAL") || t.includes("DEVOUT") || t.includes("ZEALOUS") || t.includes("SUPERSTITIOUS"));
            const isHedonist = traits.some(t => t.includes("HEDONIST") || t.includes("CONVIVIAL") || t.includes("INDOLENT") || t.includes("DECADENT"));
            const isScholarly = traits.some(t => t.includes("SCHOLARLY") || t.includes("LOGICIAN") || t.includes("BUREAUCRATIC") || t.includes("CALCULATED"));
            const isStoic = traits.some(t => t.includes("STOIC") || t.includes("PRAGMATIC") || t.includes("RESOLUTE") || t.includes("INDUSTRIOUS"));
            const isVengeful = traits.some(t => t.includes("VENGEFUL") || t.includes("BITTER") || t.includes("HARSH") || t.includes("TYRANNICAL"));

            // Natural corruption drift: Greedy/tyrannical leaders slowly accumulate corruption over time
            if (isGreedy || isVengeful) {
                p.corruption_score = Math.min(100, corruption + 2);
                paragonScoreUpdates.set(p.id, p.corruption_score);
            } else if (isCompassionate && corruption > 0) {
                p.corruption_score = Math.max(0, corruption - 1);
                paragonScoreUpdates.set(p.id, p.corruption_score);
            }

            // High corruption naturally triggers Gilded Compass / Iron Bank trade embargoes
            if (p.corruption_score >= 65 && !sectorTags.some(t => t.includes("CompassEmbargo"))) {
                await tagSectorEnvironment(client, cellId, ['#CompassEmbargo', '#TradeBlockaded']);
                events.push({
                    burg_id: burg.burg_id,
                    type: "COMPASS_TRADE_EMBARGO",
                    tier: "MAJOR",
                    msg: `⚖️ GILDED COMPASS TRADE EMBARGO: Outraged by municipal embezzlement, extortionate kickbacks, and unpaid mercantile notes under ${p.title} ${p.name}, the Gilded Compass has declared a punitive trade embargo on ${burg.name}! Commercial shipping and grain imports are frozen until debts are settled.`
                });
            }

            // =========================================================================
            // 1. CIVIL PARAGONS (MAYORS, REEVES, BURGOMASTERS, HEADMEN)
            // =========================================================================
            if (domain === 'Civil') {
                interface CivicActionOption {
                    id: string;
                    utility: number;
                    biasReason: string;
                }
                const options: CivicActionOption[] = [];

                // Option: Expand Granaries & Subsidies (Natural food remedy)
                if (isFoodShortage || isFamine) {
                    let u = isFamine ? 80 : 50;
                    if (isCompassionate) u += 40;
                    if (isStoic) u += 20;
                    if (isGreedy) u -= 50; // Greedy mayors hate buying grain for peasants
                    if (isParanoid) u -= 20;
                    options.push({ id: "MAYOR_EXPAND_GRANARY", utility: Math.max(5, u), biasReason: isCompassionate ? "deep empathy for starving laborers" : "civic food reserves" });
                }

                // Option: Hoard Grain & Price Gouge (Selfish response to food crisis)
                if ((isFoodShortage || isFamine) && (isGreedy || corruption > 30)) {
                    let u = 40;
                    if (isGreedy) u += 50;
                    if (corruption > 50) u += 30;
                    if (isVengeful) u += 20;
                    options.push({ id: "MAYOR_HOARD_GRAIN_SPECULATION", utility: u, biasReason: "avaricious desire to exploit food scarcity for profit" });
                }

                // Option: Public Health & Sanitation Cisterns (Natural health remedy)
                if (isPlagueOrSqualor) {
                    let u = 65;
                    if (isCompassionate) u += 35;
                    if (isScholarly) u += 30;
                    if (isStoic) u += 20;
                    if (isGreedy) u -= 30;
                    if (isParanoid) u -= 20;
                    options.push({ id: "MAYOR_PUBLIC_SANITATION", utility: Math.max(5, u), biasReason: isScholarly ? "modern miasma theory and clean aqueducts" : "compassion for the sick" });
                }

                // Option: Quarantine District Lockdown (Fearful/harsh health response)
                if (isPlagueOrSqualor && (isParanoid || isVengeful || isFanatical)) {
                    let u = 45;
                    if (isParanoid) u += 40;
                    if (isVengeful) u += 25;
                    options.push({ id: "MAYOR_QUARANTINE_DISTRICT", utility: u, biasReason: "paranoia of contamination spreading to the noble quarter" });
                }

                // Option: Civic Festival & Spiced Wine Revelry (Hedonistic/distraction unrest remedy)
                if (isHighUnrest) {
                    let u = 45;
                    if (isHedonist) u += 55;
                    if (isCompassionate) u += 20;
                    if (isStoic) u -= 35;
                    if (isGreedy) u -= 25;
                    options.push({ id: "MAYOR_CIVIC_FESTIVAL", utility: Math.max(5, u), biasReason: isHedonist ? "hedonistic belief that wine and songs cure all civil strife" : "soothing public anger" });
                }

                // Option: Tax Holiday & Debt Jubilee (Benevolent unrest remedy)
                if (isHighUnrest && (isCompassionate || isStoic)) {
                    let u = 50;
                    if (isCompassionate) u += 40;
                    if (isGreedy) u -= 60;
                    options.push({ id: "MAYOR_TAX_HOLIDAY", utility: Math.max(5, u), biasReason: "granting tax relief to ease the crushing burden on citizens" });
                }

                // Option: Harsh Tax Audit & Shakedown (Greedy/extortive wealth measure)
                if (isBankrupt || isGreedy || corruption > 40) {
                    let u = isBankrupt ? 50 : 25;
                    if (isGreedy) u += 55;
                    if (isVengeful) u += 25;
                    if (isCompassionate) u -= 50;
                    options.push({ id: "MAYOR_TAX_LEVY_AUDIT", utility: Math.max(5, u), biasReason: isGreedy ? "insatiable greed to squeeze coin from local merchants" : "empty treasury coffers" });
                }

                // Option: Fortify Citadel Ramparts & Bastions (Periodic municipal defense project)
                if ((tick + p.id) % 22 === 0 && (isParanoid || sectorTags.some(t => t.includes("Bandit") || t.includes("War")))) {
                    let u = 40;
                    if (isParanoid) u += 50;
                    if (isStoic) u += 20;
                    options.push({ id: "MAYOR_CITADEL_RAMPARTS", utility: u, biasReason: "paranoia over vulnerable gates and lurking wilderness hostiles" });
                }

                // Option: Temple Sacrifice & Holy Tithes (Fanatical crisis response)
                if (isChaosCrisis || isFanatical || sectorTags.some(t => t.includes("Cult") || t.includes("Dragon"))) {
                    let u = 35;
                    if (isFanatical) u += 60;
                    if (isScholarly) u -= 30;
                    options.push({ id: "MAYOR_TEMPLE_SACRIFICE_PURGE", utility: u, biasReason: "fanatical zeal to appease celestial patrons and ward against cosmic doom" });
                }

                // Option: Tolerate Underworld Shadow Warehouse (Corrupt collusion)
                if (isCartelInfiltrated && (isGreedy || corruption > 35)) {
                    let u = 35;
                    if (isGreedy) u += 45;
                    if (corruption > 50) u += 30;
                    options.push({ id: "MAYOR_TOLERATE_SHADOW_WAREHOUSE", utility: u, biasReason: "under-the-table kickbacks from cartel factors in exchange for warehouse permits" });
                }

                // Option: Charter Blockade Runners (Smuggler shipping response to trade embargo)
                if (isTradeBlockaded) {
                    let u = 60;
                    if (isStoic || isScholarly) u += 30;
                    if (isParanoid) u -= 20;
                    options.push({ id: "MAYOR_CHARTER_BLOCKADE_RUNNERS", utility: u, biasReason: "pragmatic determination to slip food through maritime blockades" });
                }

                // Option: Harbor Expansion & Quays (Prosperity maritime expansion)
                if (burg.port && (isWealthySurplus || isStoic || isScholarly)) {
                    let u = 45;
                    if (isStoic) u += 25;
                    if (isWealthySurplus) u += 25;
                    options.push({ id: "MAYOR_HARBOR_EXPANSION", utility: u, biasReason: "expanding deepwater berths to welcome foreign trade galleons" });
                }

                // Option: Artisan Master Guildhall (Industrial development)
                if (!isFamine && !isPlagueOrSqualor && (isScholarly || isStoic || isWealthySurplus)) {
                    let u = 40;
                    if (isScholarly) u += 30;
                    if (isStoic) u += 25;
                    options.push({ id: "MAYOR_ARTISAN_GUILDHALL", utility: u, biasReason: "chartering guild workshops to boost refined craftsmanship" });
                }

                // Option: Scribe Academy & Legal Archive (Scholarly governance)
                if (isScholarly || (!isFamine && (tick + p.id) % 8 === 0)) {
                    let u = 35;
                    if (isScholarly) u += 50;
                    options.push({ id: "MAYOR_ACADEMY_SCRIBES", utility: u, biasReason: "philosophical devotion to orderly cadastral archives and legal scholarship" });
                }

                // Option: Foothill Terraced Farmland (Long-term agricultural foresight)
                if (isCompassionate || isStoic || isFoodShortage) {
                    let u = 45;
                    if (isCompassionate) u += 30;
                    if (isStoic) u += 25;
                    options.push({ id: "MAYOR_TERRACED_FARMLAND", utility: u, biasReason: "industrious expansion of hillside agricultural terraces" });
                }

                // Option: Municipal Mint & Currency Stamping (Greedy/Ambitious economic centralization)
                if (isWealthySurplus || isGreedy) {
                    let u = 40;
                    if (isGreedy) u += 40;
                    options.push({ id: "MAYOR_MUNICIPAL_MINT", utility: u, biasReason: "standardizing civic currency while levying lucrative seigniorage profits" });
                }

                // Sort options by utility with minor jitter for dynamic variance
                options.sort((a, b) => (b.utility + (Math.random() * 8)) - (a.utility + (Math.random() * 8)));
                const chosen = options[0] || { id: "MAYOR_TERRACED_FARMLAND", utility: 30, biasReason: "routine civic governance" };

                // Execute the chosen civic action
                switch (chosen.id) {
                    case "MAYOR_EXPAND_GRANARY": {
                        const grainGain = Math.floor(pop * 0.15) + 350;
                        foodDelta += grainGain;
                        wealthDelta -= 35;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🌾 CIVIC GRANARY EXPANSION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} opened municipal emergency grain silos in ${burg.name}, distributing +${grainGain} food reserves to avert famine.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#GrainSubsidyRecipient', '#GranaryCarpenter'], 'RELIEVED', `Receiving municipal grain rations under ${p.title} ${p.name}.`, '%laborer%', 3);
                        await tagSectorEnvironment(client, cellId, ['#MunicipalGrainRelief']);
                        break;
                    }
                    case "MAYOR_HOARD_GRAIN_SPECULATION": {
                        wealthDelta += 85;
                        unrestDelta += 12;
                        p.corruption_score = Math.min(100, corruption + 4);
                        paragonScoreUpdates.set(p.id, p.corruption_score);
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MAJOR",
                            msg: `⚠️ CORRUPT GRAIN HOARDING: Driven by ${chosen.biasReason}, ${p.title} ${p.name} locked down the municipal granaries in ${burg.name} during food shortages, reselling grain at extortionate prices to enrich the civic treasury (+85 Gold, +12 Unrest)!`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#GougedCommoner', '#StarvingBitter'], 'DESPERATE', `Struggling to afford bread due to Mayor ${p.name}'s speculative grain prices.`, null, 3);
                        await tagSectorEnvironment(client, cellId, ['#HoardedGrainCrisis']);
                        break;
                    }
                    case "MAYOR_PUBLIC_SANITATION": {
                        healthDelta += 10;
                        wealthDelta -= 45;
                        unrestDelta -= 3;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🚰 PUBLIC SANITATION EDICT: Guided by ${chosen.biasReason}, ${p.title} ${p.name} funded stone aqueduct conduits and street-cleansing lime washes in ${burg.name}, eradicating filth and boosting public health (+10 Health).`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#SanitationWorker', '#CleanWaterBearer'], 'INDUSTRIOUS', `Laying stone water pipes under ${p.title} ${p.name}'s sanitation edict.`, '%laborer%', 3);
                        await tagSectorEnvironment(client, cellId, ['#SanitationDrivesActive']);
                        break;
                    }
                    case "MAYOR_QUARANTINE_DISTRICT": {
                        healthDelta += 4;
                        unrestDelta += 14;
                        crimeDelta += 6;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MAJOR",
                            msg: `🧱 SICK QUARTER QUARANTINE: Driven by ${chosen.biasReason}, ${p.title} ${p.name} ordered heavy timber barricades erected around the lower river slums of ${burg.name}, sealing infected families behind armed sentries!`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#QuarantinedCitizen', '#BarricadedSlumDweller'], 'REBELLIOUS', `Trapped behind quarantine barricades erected by ${p.title} ${p.name}.`, null, 3);
                        await tagSectorEnvironment(client, cellId, ['#DistrictQuarantineLockdown']);
                        break;
                    }
                    case "MAYOR_CIVIC_FESTIVAL": {
                        unrestDelta -= 16;
                        wealthDelta -= 60;
                        foodDelta -= 80;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🎪 CIVIC REVELRY FESTIVAL: Guided by ${chosen.biasReason}, ${p.title} ${p.name} funded a grand street carnival in ${burg.name}, tapping municipal wine vats and roasting whole oxen to soothe civil unrest (-16 Unrest).`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#FestivalReveler', '#JovialCitizen'], 'JOVIAL', `Dancing and feasting at the municipal festival hosted by ${p.title} ${p.name}.`, null, 4);
                        await tagSectorEnvironment(client, cellId, ['#FestivalRevelry']);
                        break;
                    }
                    case "MAYOR_TAX_HOLIDAY": {
                        unrestDelta -= 14;
                        wealthDelta -= 30;
                        refinedGoodsDelta += 40;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `📜 DEBT JUBILEE & TAX HOLIDAY: Guided by ${chosen.biasReason}, ${p.title} ${p.name} declared a duty-free market holiday in ${burg.name}, canceling market tolls and easing popular unrest (-14 Unrest).`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#TaxHolidayBeneficiary', '#ProsperousTrader'], 'PROSPEROUS', `Selling goods duty-free under ${p.title} ${p.name}'s holiday decree.`, '%trader%', 3);
                        break;
                    }
                    case "MAYOR_TAX_LEVY_AUDIT": {
                        wealthDelta += 90;
                        unrestDelta += 12;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `💰 HARSH TAX REASSESSMENT: Driven by ${chosen.biasReason}, ${p.title} ${p.name} dispatched municipal bailiffs across ${burg.name} to seize unpaid arrears, extracting +90 Gold while stoking citizen resentment (+12 Unrest).`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#OverburdenedTaxpayer', '#ResentfulMerchant'], 'BITTER', `Enduring harsh tax audits by ${p.title} ${p.name}'s bailiffs.`, '%merchant%', 3);
                        await tagSectorEnvironment(client, cellId, ['#TaxAuditBurden']);
                        break;
                    }
                    case "MAYOR_CITADEL_RAMPARTS": {
                        unrestDelta -= 4;
                        wealthDelta -= 70;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🛡️ PERIMETER RAMPART FORTIFICATION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} reinforced the perimeter stone ramparts and gate bastions of ${burg.name}, bolstering civic defense.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#RampartSentry', '#MasonFortifier'], 'WARY', `Manning the newly reinforced battlements of ${burg.name}.`, '%watch%', 3);
                        await tagSectorEnvironment(client, cellId, ['#FortifiedRamparts']);
                        break;
                    }
                    case "MAYOR_TEMPLE_SACRIFICE_PURGE": {
                        wealthDelta -= 50;
                        unrestDelta -= 8;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🕯️ CELESTIAL PURIFICATION RITE: Guided by ${chosen.biasReason}, ${p.title} ${p.name} sponsored solemn temple purification vigils in ${burg.name}, burning cleansing incense to ward against chaos corruption.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#PenitentPilgrim', '#TempleAcolyte'], 'DEVOUT', `Chanting prayers in the sacred temple sanctuary of ${burg.name}.`, null, 3);
                        break;
                    }
                    case "MAYOR_TOLERATE_SHADOW_WAREHOUSE": {
                        wealthDelta += 110;
                        crimeDelta += 12;
                        p.corruption_score = Math.min(100, corruption + 8);
                        paragonScoreUpdates.set(p.id, p.corruption_score);
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MAJOR",
                            msg: `🗝️ CLANDESTINE COLLUSION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} granted private warehouse storage permits in ${burg.name}, pocketing kickbacks while allowing underworld syndicates to flourish (+110 Wealth, +12 Crime)!`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#CartelCollaborator', '#BribedDockClerk'], 'COMPLICIT', `Facilitating uninspected warehouse transfers under Mayor ${p.name}'s blind eye.`, '%trader%', 3);
                        await tagSectorEnvironment(client, cellId, ['#CartelInfiltration']);

                        // If corruption exceeds critical threshold, Gilded Compass / Iron Bank issues punitive trade embargo
                        if (p.corruption_score >= 65 && !sectorTags.some(t => t.includes("CompassEmbargo"))) {
                            await tagSectorEnvironment(client, cellId, ['#CompassEmbargo', '#TradeBlockaded']);
                            events.push({
                                burg_id: burg.burg_id,
                                type: "COMPASS_TRADE_EMBARGO",
                                tier: "MAJOR",
                                msg: `⚖️ GILDED COMPASS TRADE EMBARGO: Outraged by municipal embezzlement, extortionate kickbacks, and unpaid mercantile notes by Mayor ${p.name}, the Gilded Compass has declared a punitive trade embargo on ${burg.name}! Commercial shipping and grain imports are frozen until debts are settled.`
                            });
                        }
                        break;
                    }
                    case "MAYOR_CHARTER_BLOCKADE_RUNNERS": {
                        foodDelta += 240;
                        wealthDelta -= 55;
                        unrestDelta -= 6;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MAJOR",
                            msg: `⚡ BLOCKADE RUNNER CHARTER: Driven by ${chosen.biasReason}, ${p.title} ${p.name} hired independent cloud-skiffs and swift coastal luggers to slip grain into ${burg.name}, breaking the stranglehold of trade blockades (+240 Food)!`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#BlockadeRunnerContact'], 'CONFIDENT', `Distributing flour brought through maritime blockades under ${p.title} ${p.name}.`, '%baker%', 3);
                        break;
                    }
                    case "MAYOR_HARBOR_EXPANSION": {
                        wealthDelta += 75;
                        refinedGoodsDelta += 50;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `⚓ HARBOR BASIN EXPANSION: Guided by ${chosen.biasReason}, ${p.title} ${p.name} dredged the anchorage and erected timber crane wharves in ${burg.name}, accelerating maritime commerce.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#DockBuilder', '#QuayRigger'], 'INDUSTRIOUS', `Framing timber docks and driving pilings in the harbor of ${burg.name}.`, '%carpenter%', 3);
                        break;
                    }
                    case "MAYOR_ARTISAN_GUILDHALL": {
                        wealthDelta += 45;
                        refinedGoodsDelta += 70;
                        healthDelta += 2;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🔨 ARTISAN GUILD CHARTER: Guided by ${chosen.biasReason}, ${p.title} ${p.name} chartered a grand municipal guildhall in ${burg.name}, providing bellows and workbenches for blacksmiths and weavers.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#MasterArtisan', '#GuildSmith'], 'PROSPEROUS', `Forging masterwork wares under ${p.title} ${p.name}'s guild charter.`, '%smith%', 3);
                        break;
                    }
                    case "MAYOR_ACADEMY_SCRIBES": {
                        crimeDelta -= 12;
                        wealthDelta -= 30;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `📚 LEGAL SCRIBE ARCHIVE: Guided by ${chosen.biasReason}, ${p.title} ${p.name} founded a municipal scribe academy and deed registry in ${burg.name}, codifying property rights and trade contracts.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#CadastralScribe', '#LegalScholar'], 'SCHOLARLY', `Registering guild deeds in the municipal scribe hall of ${burg.name}.`, '%scribe%', 2);
                        break;
                    }
                    case "MAYOR_MUNICIPAL_MINT": {
                        wealthDelta += 85;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🪙 MUNICIPAL COIN MINTING: Guided by ${chosen.biasReason}, ${p.title} ${p.name} struck new stamped silver coinage in ${burg.name}, standardizing market transactions and collecting bullion seigniorage.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#MintAssayer', '#CoinStamper'], 'SCHOLARLY', `Assaying silver ingots at the municipal mint of ${burg.name}.`, '%smith%', 2);
                        break;
                    }
                    default: {
                        foodDelta += 400;
                        wealthDelta -= 35;
                        events.push({
                            burg_id: burg.burg_id,
                            type: "MAYOR_TERRACED_FARMLAND",
                            tier: "MINOR",
                            msg: `🌱 TERRACED FARMLAND CLEARING: Guided by ${chosen.biasReason}, ${p.title} ${p.name} cleared foothill slopes for terraced barley fields and irrigation ditches around ${burg.name}.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#TerraceFarmer'], 'INDUSTRIOUS', `Cultivating terraced barley fields under ${p.title} ${p.name}.`, '%farmer%', 3);
                        break;
                    }
                }
            }

            // =========================================================================
            // 2. SECURITY PARAGONS (COMMANDERS, MARSHALS, CAPTAINS, WARDENS)
            // =========================================================================
            else if (domain === 'Security') {
                interface SecurityActionOption {
                    id: string;
                    utility: number;
                    biasReason: string;
                }
                const options: SecurityActionOption[] = [];

                // Option: Iron Curfew & Gate Lock (Harsh response to civil unrest)
                // Cannot declare a new curfew if a nightfall curfew is already active!
                const isCurfewActive = sectorTags.includes("#NightfallCurfewActive");
                if (isHighUnrest && !isCurfewActive) {
                    let u = isCriticalUnrest ? 80 : 50;
                    if (isParanoid) u += 35;
                    if (isVengeful) u += 30;
                    if (isCompassionate) u -= 40;
                    options.push({ id: "COMMANDER_IRON_CURFEW", utility: Math.max(5, u), biasReason: isParanoid ? "paranoia of nocturnal rebellion and street barricades" : "suppressing civil riots" });
                }

                // Option: Lift Iron Curfew (When unrest subsides)
                if (isCurfewActive && !isHighUnrest) {
                    options.push({
                        id: "COMMANDER_LIFT_CURFEW",
                        utility: 70,
                        biasReason: "restored civil peace and open commerce"
                    });
                }

                // Option: Dockside Contraband Raid (Enforcing law against crime/syndicates)
                if (isHighCrime || isCartelInfiltrated) {
                    let u = 60;
                    if (isStoic || traits.some(t => t.includes("DUTIFUL") || t.includes("RESOLUTE"))) u += 35;
                    if (corruption > 40) u -= 60; // Corrupt commanders do NOT raid cartel partners!
                    options.push({ id: "COMMANDER_CONTRABAND_RAID", utility: Math.max(5, u), biasReason: "dutiful commitment to smashing unlicensed underworld syndicates" });
                }

                // Option: Underworld Bribe Acceptance (Corrupt commander colludes)
                if ((isHighCrime || isCartelInfiltrated) && (corruption > 40 || isGreedy)) {
                    let u = 40;
                    if (isGreedy) u += 40;
                    if (corruption > 60) u += 30;
                    options.push({ id: "COMMANDER_TAKE_UNDERWORLD_BRIBE", utility: u, biasReason: "greed for syndicate hush money in exchange for routing patrols away from the harbor" });
                }

                // Option: Garrison Drills & Shield Conditioning (Military readiness)
                if (!isCriticalUnrest && (isStoic || (tick + p.id) % 4 === 0)) {
                    let u = 45;
                    if (isStoic) u += 25;
                    options.push({ id: "COMMANDER_GARRISON_DRILL", utility: u, biasReason: "iron discipline and wall archer readiness" });
                }

                // Option: Wilderness Bandit Sweep (Road security)
                if (sectorTags.some(t => t.includes("Bandit") || t.includes("Wilderness")) || (tick + p.id) % 5 === 0) {
                    let u = 40;
                    if (isVengeful) u += 25;
                    options.push({ id: "COMMANDER_BANDIT_SWEEP", utility: u, biasReason: "aggressive determination to scour highway bandits from trade corridors" });
                }

                // Option: Arrest Labor Agitators (Harsh political crackdown)
                if (isHighUnrest && (isVengeful || isParanoid)) {
                    let u = 55;
                    if (isVengeful) u += 30;
                    options.push({ id: "COMMANDER_ARREST_AGITATORS", utility: u, biasReason: "intolerant fury toward street dissent and strike organizers" });
                }

                options.sort((a, b) => (b.utility + (Math.random() * 8)) - (a.utility + (Math.random() * 8)));
                const chosen = options[0] || { id: "COMMANDER_GARRISON_DRILL", utility: 35, biasReason: "routine garrison vigilance" };

                switch (chosen.id) {
                    case "COMMANDER_IRON_CURFEW": {
                        unrestDelta -= 8;
                        crimeDelta -= 12;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MAJOR",
                            msg: `⚔️ MANDATORY IRON CURFEW: Driven by ${chosen.biasReason}, ${p.title} ${p.name} locked all gates and deployed heavy halberd patrols across ${burg.name}, enforcing dusk-to-dawn curfews!`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#CurfewEnforcer'], 'WARY', `Enforcing ${p.title} ${p.name}'s strict nighttime lockdown.`, '%watch%', 3);
                        await tagBurgCitizens(client, burg.burg_id, ['#CurfewDefier'], 'REBELLIOUS', `Evading armed curfew patrols in the shadowed alleys of ${burg.name}.`, '%laborer%', 3);
                        await tagSectorEnvironment(client, cellId, ['#NightfallCurfewActive']);
                        break;
                    }
                    case "COMMANDER_LIFT_CURFEW": {
                        unrestDelta -= 5;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🕊️ IRON CURFEW LIFTED: With civil order restored, ${p.title} ${p.name} opened the gates and stood down dusk-to-dawn curfew patrols across ${burg.name}.`
                        });
                        await removeCellTags(client, cellId, ["#NightfallCurfewActive"]);
                        break;
                    }
                    case "COMMANDER_CONTRABAND_RAID": {
                        crimeDelta -= 15;
                        wealthDelta += 35;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🗡️ DOCKSIDE CONTRABAND RAID: Guided by ${chosen.biasReason}, ${p.title} ${p.name} led a tactical raid on an unlicensed wharf warehouse in ${burg.name}, impounding smuggled contraband (-15 Crime).`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#RaidedSmuggler'], 'FEARFUL', `Lying low after ${p.title} ${p.name}'s watchmen raided a nearby safehouse.`, '%trader%', 3);
                        break;
                    }
                    case "COMMANDER_TAKE_UNDERWORLD_BRIBE": {
                        wealthDelta += 65;
                        crimeDelta += 14;
                        p.corruption_score = Math.min(100, corruption + 6);
                        paragonScoreUpdates.set(p.id, p.corruption_score);
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MAJOR",
                            msg: `💰 WATCH BRIBERY COLLUSION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} accepted pouches of hush gold in ${burg.name}, redirecting watch patrols away from smuggling alleys (+65 Wealth, +14 Crime)!`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#BribedSentry'], 'COMPLICIT', `Turning a blind eye to nightly smuggling crates under Commander ${p.name}'s orders.`, '%watch%', 3);
                        await tagSectorEnvironment(client, cellId, ['#CorruptedWatchGarrison']);
                        break;
                    }
                    case "COMMANDER_BANDIT_SWEEP": {
                        crimeDelta -= 10;
                        wealthDelta += 20;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `🐎 HIGHWAY OUTRIDER SWEEP: Driven by ${chosen.biasReason}, ${p.title} ${p.name} led mounted outriders along the trade roads of ${burg.name}, driving off highway robbers and restoring order.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#ClearedRoadMerchant'], 'CONFIDENT', `Transporting goods along highways secured by ${p.title} ${p.name}.`, '%trader%', 3);
                        break;
                    }
                    case "COMMANDER_ARREST_AGITATORS": {
                        unrestDelta -= 10;
                        crimeDelta -= 8;
                        events.push({
                            burg_id: burg.burg_id,
                            type: chosen.id,
                            tier: "MINOR",
                            msg: `⛓️ LABOR AGITATOR CRACKDOWN: Driven by ${chosen.biasReason}, ${p.title} ${p.name} arrested five strike organizers in ${burg.name}, breaking up illegal assembly in the market square.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#JailedDissidentFamily'], 'BITTER', `Harboring deep resentment after ${p.title} ${p.name} imprisoned local labor spokesmen.`, '%laborer%', 3);
                        break;
                    }
                    default: {
                        unrestDelta -= 3;
                        crimeDelta -= 6;
                        // Only log routine rampart drills periodically to prevent event bloat
                        if ((tick + p.id) % 20 === 0) {
                            events.push({
                                burg_id: burg.burg_id,
                                type: "COMMANDER_GARRISON_DRILL",
                                tier: "MINOR",
                                msg: `🛡️ GARRISON MARTIAL DRILL: Guided by ${chosen.biasReason}, ${p.title} ${p.name} conducted shield wall and pike drills on the ramparts of ${burg.name}, honing combat discipline.`
                            });
                            await tagBurgCitizens(client, burg.burg_id, ['#GarrisonDrilled'], 'DEVOUT', `Drilling with shields and spears under ${p.title} ${p.name}.`, '%watch%', 3);
                        }
                        break;
                    }
                }
            }
        }

        // Apply Accumulators
        const newFood = Math.max(0, (burg.food || 0) + foodDelta);
        const newWealth = Math.max(0, (burg.wealth || 0) + wealthDelta);
        const newCrime = Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta));
        const newUnrest = Math.min(100, Math.max(0, (burg.unrest || 0) + unrestDelta));
        const newHealth = Math.min(100, Math.max(0, (burg.health || 100) + healthDelta));
        const newRaw = Math.max(0, (burg.raw_materials || 0) + rawMaterialsDelta);
        const newRefined = Math.max(0, (burg.refined_goods || 0) + refinedGoodsDelta);

        burgUpdates.push({
            id: burg.burg_id,
            food: newFood,
            wealth: newWealth,
            crime: newCrime,
            unrest: newUnrest,
            health: newHealth,
            raw: newRaw,
            refined: newRefined
        });
    }

    // Bulk Update burg economic states
    if (burgUpdates.length > 0) {
        await client.query(`
            UPDATE sim_burg_economy AS b SET
              food = v.food,
              wealth = v.wealth,
              crime_rate = v.crime,
              unrest = v.unrest,
              health = v.health,
              raw_materials = v.raw,
              refined_goods = v.refined
            FROM (
              SELECT unnest($1::int[]) as id,
                     unnest($2::int[]) as food,
                     unnest($3::int[]) as wealth,
                     unnest($4::int[]) as crime,
                     unnest($5::int[]) as unrest,
                     unnest($6::int[]) as health,
                     unnest($7::int[]) as raw,
                     unnest($8::int[]) as refined
            ) AS v
            WHERE b.burg_id = v.id
        `, [
            burgUpdates.map(u => u.id),
            burgUpdates.map(u => u.food),
            burgUpdates.map(u => u.wealth),
            burgUpdates.map(u => u.crime),
            burgUpdates.map(u => u.unrest),
            burgUpdates.map(u => u.health),
            burgUpdates.map(u => u.raw),
            burgUpdates.map(u => u.refined)
        ]);
    }

    // Bulk Update paragon corruption scores
    if (paragonScoreUpdates.size > 0) {
        const ids = Array.from(paragonScoreUpdates.keys());
        const scores = Array.from(paragonScoreUpdates.values());
        await client.query(`
            UPDATE sim_paragons AS p SET
              corruption_score = v.score
            FROM (
              SELECT unnest($1::int[]) as id,
                     unnest($2::int[]) as score
            ) AS v
            WHERE p.id = v.id
        `, [ids, scores]);
    }

    // Bulk Insert logged events
    if (events.length > 0) {
        await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
            SELECT unnest($1::int[]), unnest($2::text[]), unnest($3::text[]), unnest($4::text[]), unnest($5::int[]), unnest($6::text[])
        `, [
            events.map(() => tick),
            events.map(ev => ev.type),
            events.map(ev => ev.msg),
            events.map(ev => ev.tier || 'MINOR'),
            events.map(ev => ev.burg_id),
            events.map(() => loreDate)
        ]);
    }
}
