import type { Delta } from "../../deltas/types.js";
import { deriveParagonMotives } from "../../rpg/paragonMotives.js";

export interface ParagonBurgSnap {
  burgId: number;
  name: string;
  cellId: number;
  popNull: number;
  popAttuned?: number;
  food: number;
  health: number;
  unrest: number;
  wealth: number;
  crimeRate: number;
  port: boolean;
}

export interface ParagonRowSnap {
  id: number;
  burgId: number | null;
  outlawId: number | null;
  domain: string | null;
  title: string;
  name: string;
  traits: unknown;
  corruptionScore: number;
}

export interface ParagonsSnapshot {
  tick: number;
  loreDate: string;
  burgs: ParagonBurgSnap[];
  paragons: ParagonRowSnap[];
  cellTagsByCell: Record<number, string[]>;
}

function getParagonTraitNames(traitsRaw: unknown): string[] {
  const list: string[] = [];
  if (!traitsRaw) return list;
  try {
    const parsed = typeof traitsRaw === "string" ? JSON.parse(traitsRaw) : traitsRaw;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") list.push(item.toUpperCase());
        else if (item && typeof item === "object" && (item as any).name) {
          list.push(String((item as any).name).toUpperCase());
        }
      }
    }
  } catch {
    // Ignore malformed trait JSON
  }
  return list;
}

/**
 * Pure Phase 2.3 #13 paragon step: evaluates personality-biased municipal and security decrees
 * across burgs on their staggered bi-weekly council days and emits deltas for all state changes.
 */
export function stepParagons(
  snap: ParagonsSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  const paragonsByBurg = new Map<number, ParagonRowSnap[]>();
  for (const p of snap.paragons) {
    if (p.burgId === null || p.burgId === undefined) continue;
    let arr = paragonsByBurg.get(p.burgId);
    if (!arr) {
      arr = [];
      paragonsByBurg.set(p.burgId, arr);
    }
    arr.push(p);
  }

  const paragonScoreUpdates = new Map<number, number>();
  const pendingEvents: Array<{ burgId: number; type: string; tier: "MINOR" | "MAJOR"; msg: string }> = [];

  const tagCitizens = (
    burgId: number,
    tags: string[],
    temper: string | null,
    motivation: string | null,
    professionFilter: string | null,
    limit: number
  ) => {
    deltas.push({
      kind: "citizen.tagBurg",
      burgId,
      tags,
      temper,
      motivation,
      professionFilter,
      limit,
      randomSeed: random(),
    });
  };

  const addEnvTags = (cellId: number, tags: string[]) => {
    if (cellId > 0) {
      deltas.push({ kind: "tags.add", target: { kind: "cell", cellId, zLayer: 0 }, tags });
    }
  };

  const removeEnvTags = (cellId: number, tags: string[]) => {
    if (cellId > 0) {
      deltas.push({ kind: "tags.remove", target: { kind: "cell", cellId, zLayer: 0 }, tags });
    }
  };

  for (const burg of snap.burgs) {
    const pop = Math.floor(((burg.popNull || 0) + (burg.popAttuned || 0)) / 2);
    if (pop <= 0) continue;

    const cellId = Number(burg.cellId || 0);
    const sectorTags = snap.cellTagsByCell[cellId] || [];

    const foodNeedRatio = (burg.food || 0) / Math.max(1, pop * 2);
    const isFamine = foodNeedRatio < 0.6 || sectorTags.some((t) => t.includes("Famine") || t.includes("Shortage"));
    const isFoodShortage = foodNeedRatio < 1.0;
    const isPlagueOrSqualor =
      (burg.health || 100) < 70 || sectorTags.some((t) => t.includes("Plague") || t.includes("Fever") || t.includes("Squalor"));
    const isHighUnrest = (burg.unrest || 0) > 25 || sectorTags.some((t) => t.includes("Unrest") || t.includes("Riot"));
    const isCriticalUnrest = (burg.unrest || 0) > 50;
    const isBankrupt = (burg.wealth || 0) < 60;
    const isWealthySurplus = (burg.wealth || 0) > 800;
    const isHighCrime =
      (burg.crimeRate || 0) > 30 || sectorTags.some((t) => t.includes("Underworld") || t.includes("Cartel") || t.includes("Extortion"));
    const isTradeBlockaded = sectorTags.some((t) => t.includes("Blockade") || t.includes("Embargo"));
    const isCartelInfiltrated = sectorTags.some(
      (t) => t.includes("Cartel") || t.includes("InsideMan") || t.includes("Smuggler")
    );
    const isChaosCrisis = sectorTags.some((t) => t.includes("Chaos") || t.includes("Storm") || t.includes("Rift"));

    let foodDelta = 0;
    let wealthDelta = 0;
    let crimeDelta = 0;
    let unrestDelta = 0;
    let healthDelta = 0;
    const rawMaterialsDelta = 0;
    let refinedGoodsDelta = 0;

    const myParagons = paragonsByBurg.get(burg.burgId) || [];

    for (const p of myParagons) {
      if ((snap.tick + p.id * 5) % 14 !== 0) continue;

      const domain =
        p.domain ||
        (p.title?.includes("Commander") ||
        p.title?.includes("Marshal") ||
        p.title?.includes("Captain") ||
        p.title?.includes("Warden")
          ? "Security"
          : "Civil");

      const traits = getParagonTraitNames(p.traits);
      const corruption = Number(p.corruptionScore || 0);
      const motive = deriveParagonMotives({
        id: p.id,
        title: p.title,
        traits: p.traits,
        corruption_score: p.corruptionScore,
        outlaw_id: p.outlawId,
      });

      const isGreedy = traits.some(
        (t) => t.includes("GREEDY") || t.includes("USURIOUS") || t.includes("CORRUPT") || t.includes("AVARICE")
      );
      const isParanoid = traits.some(
        (t) => t.includes("PARANOID") || t.includes("WARY") || t.includes("FEARFUL") || t.includes("SUSPICIOUS")
      );
      const isCompassionate = traits.some(
        (t) =>
          t.includes("COMPASSIONATE") ||
          t.includes("BENEVOLENT") ||
          t.includes("AGRARIAN") ||
          t.includes("GENEROUS") ||
          t.includes("PATERNAL")
      );
      const isFanatical = traits.some(
        (t) => t.includes("FANATICAL") || t.includes("DEVOUT") || t.includes("ZEALOUS") || t.includes("SUPERSTITIOUS")
      );
      const isHedonist = traits.some(
        (t) => t.includes("HEDONIST") || t.includes("CONVIVIAL") || t.includes("INDOLENT") || t.includes("DECADENT")
      );
      const isScholarly = traits.some(
        (t) => t.includes("SCHOLARLY") || t.includes("LOGICIAN") || t.includes("BUREAUCRATIC") || t.includes("CALCULATED")
      );
      const isStoic = traits.some(
        (t) => t.includes("STOIC") || t.includes("PRAGMATIC") || t.includes("RESOLUTE") || t.includes("INDUSTRIOUS")
      );
      const isVengeful = traits.some(
        (t) => t.includes("VENGEFUL") || t.includes("BITTER") || t.includes("HARSH") || t.includes("TYRANNICAL")
      );

      let workingScore = corruption;
      if (isGreedy || isVengeful) {
        workingScore = Math.min(100, corruption + 2);
        paragonScoreUpdates.set(p.id, workingScore);
      } else if (isCompassionate && corruption > 0) {
        workingScore = Math.max(0, corruption - 1);
        paragonScoreUpdates.set(p.id, workingScore);
      }

      if (workingScore >= 65 && !sectorTags.some((t) => t.includes("CompassEmbargo"))) {
        addEnvTags(cellId, ["#CompassEmbargo", "#TradeBlockaded"]);
        pendingEvents.push({
          burgId: burg.burgId,
          type: "COMPASS_TRADE_EMBARGO",
          tier: "MAJOR",
          msg: `⚖️ GILDED COMPASS TRADE EMBARGO: Outraged by municipal embezzlement, extortionate kickbacks, and unpaid mercantile notes under ${p.title} ${p.name}, the Gilded Compass has declared a punitive trade embargo on ${burg.name}! Commercial shipping and grain imports are frozen until debts are settled.`,
        });
      }

      // 1. Civil Paragons
      if (domain === "Civil") {
        interface CivicActionOption {
          id: string;
          utility: number;
          biasReason: string;
          jittered?: number;
        }
        const options: CivicActionOption[] = [];

        if (isFoodShortage || isFamine) {
          let u = isFamine ? 80 : 50;
          if (isCompassionate || motive.wantTag === "#Want_PublicRelief") u += 40;
          if (isStoic) u += 20;
          if (isGreedy || motive.wantTag === "#Want_HoardWealth") u -= 50;
          if (isParanoid) u -= 20;
          options.push({
            id: "MAYOR_EXPAND_GRANARY",
            utility: Math.max(5, u),
            biasReason:
              motive.wantTag === "#Want_PublicRelief"
                ? motive.want.toLowerCase()
                : isCompassionate
                  ? "deep empathy for starving laborers"
                  : "civic food reserves",
          });
        }

        if (
          (isFoodShortage || isFamine) &&
          (isGreedy || corruption > 30 || motive.wantTag === "#Want_HoardWealth") &&
          motive.lineTag !== "#Line_NeverTaxTheStarving"
        ) {
          let u = 40;
          if (isGreedy) u += 50;
          if (motive.wantTag === "#Want_HoardWealth") u += 25;
          if (corruption > 50) u += 30;
          if (isVengeful) u += 20;
          options.push({
            id: "MAYOR_HOARD_GRAIN_SPECULATION",
            utility: u,
            biasReason: "avaricious desire to exploit food scarcity for profit",
          });
        }

        if (isPlagueOrSqualor) {
          let u = 65;
          if (isCompassionate) u += 35;
          if (isScholarly) u += 30;
          if (isStoic) u += 20;
          if (isGreedy) u -= 30;
          if (isParanoid) u -= 20;
          options.push({
            id: "MAYOR_PUBLIC_SANITATION",
            utility: Math.max(5, u),
            biasReason: isScholarly ? "modern miasma theory and clean aqueducts" : "compassion for the sick",
          });
        }

        if (isPlagueOrSqualor && (isParanoid || isVengeful || isFanatical)) {
          let u = 45;
          if (isParanoid) u += 40;
          if (isVengeful) u += 25;
          options.push({
            id: "MAYOR_QUARANTINE_DISTRICT",
            utility: u,
            biasReason: "paranoia of contamination spreading to the noble quarter",
          });
        }

        if (isHighUnrest) {
          let u = 45;
          if (isHedonist) u += 55;
          if (isCompassionate) u += 20;
          if (isStoic) u -= 35;
          if (isGreedy) u -= 25;
          options.push({
            id: "MAYOR_CIVIC_FESTIVAL",
            utility: Math.max(5, u),
            biasReason: isHedonist
              ? "hedonistic belief that wine and songs cure all civil strife"
              : "soothing public anger",
          });
        }

        if (isHighUnrest && (isCompassionate || isStoic)) {
          let u = 50;
          if (isCompassionate) u += 40;
          if (isGreedy) u -= 60;
          options.push({
            id: "MAYOR_TAX_HOLIDAY",
            utility: Math.max(5, u),
            biasReason: "granting tax relief to ease the crushing burden on citizens",
          });
        }

        if (
          (isBankrupt || isGreedy || corruption > 40 || motive.wantTag === "#Want_HoardWealth") &&
          !(motive.lineTag === "#Line_NeverTaxTheStarving" && (isFamine || isFoodShortage))
        ) {
          let u = isBankrupt ? 50 : 25;
          if (isGreedy || motive.wantTag === "#Want_HoardWealth") u += 55;
          if (isVengeful) u += 25;
          if (isCompassionate || motive.wantTag === "#Want_PublicRelief") u -= 50;
          options.push({
            id: "MAYOR_TAX_LEVY_AUDIT",
            utility: Math.max(5, u),
            biasReason: isGreedy ? "insatiable greed to squeeze coin from local merchants" : "empty treasury coffers",
          });
        }

        if ((snap.tick + p.id) % 22 === 0 && (isParanoid || sectorTags.some((t) => t.includes("Bandit") || t.includes("War")))) {
          let u = 40;
          if (isParanoid) u += 50;
          if (isStoic) u += 20;
          options.push({
            id: "MAYOR_CITADEL_RAMPARTS",
            utility: u,
            biasReason: "paranoia over vulnerable gates and lurking wilderness hostiles",
          });
        }

        if (isChaosCrisis || sectorTags.some((t) => t.includes("Cult") || t.includes("Dragon") || t.includes("Chaos"))) {
          let u = 35;
          if (isFanatical) u += 60;
          if (isScholarly) u -= 30;
          options.push({
            id: "MAYOR_TEMPLE_SACRIFICE_PURGE",
            utility: u,
            biasReason: "fanatical zeal to appease celestial patrons and ward against cosmic doom",
          });
        }

        if (isCartelInfiltrated && (isGreedy || corruption > 35) && motive.lineTag !== "#Line_NeverForgeCharters") {
          let u = 35;
          if (isGreedy || motive.wantTag === "#Want_HoardWealth") u += 45;
          if (corruption > 50) u += 30;
          options.push({
            id: "MAYOR_TOLERATE_SHADOW_WAREHOUSE",
            utility: u,
            biasReason: "under-the-table kickbacks from cartel factors in exchange for warehouse permits",
          });
        }

        if (isTradeBlockaded) {
          let u = 60;
          if (isStoic || isScholarly) u += 30;
          if (isParanoid) u -= 20;
          options.push({
            id: "MAYOR_CHARTER_BLOCKADE_RUNNERS",
            utility: u,
            biasReason: "pragmatic determination to slip food through maritime blockades",
          });
        }

        if (burg.port && isWealthySurplus && !isHighUnrest && !isCriticalUnrest) {
          let u = 45;
          if (isStoic) u += 25;
          if (isScholarly) u += 15;
          options.push({
            id: "MAYOR_HARBOR_EXPANSION",
            utility: u,
            biasReason: "expanding deepwater berths to welcome foreign trade galleons",
          });
        }

        if (isWealthySurplus && !isFamine && !isPlagueOrSqualor) {
          let u = 40;
          if (isScholarly) u += 30;
          if (isStoic) u += 25;
          options.push({
            id: "MAYOR_ARTISAN_GUILDHALL",
            utility: u,
            biasReason: "chartering guild workshops to boost refined craftsmanship",
          });
        }

        if ((isScholarly && (burg.crimeRate || 0) > 5) || isHighUnrest) {
          let u = 35;
          if (isScholarly) u += 50;
          options.push({
            id: "MAYOR_ACADEMY_SCRIBES",
            utility: u,
            biasReason: "philosophical devotion to orderly cadastral archives and legal scholarship",
          });
        }

        if (isFoodShortage || isFamine) {
          let u = 45;
          if (isCompassionate) u += 30;
          if (isStoic) u += 25;
          options.push({
            id: "MAYOR_TERRACED_FARMLAND",
            utility: u,
            biasReason: "industrious expansion of hillside agricultural terraces",
          });
        }

        if (isBankrupt && (isGreedy || corruption > 35)) {
          let u = 40;
          if (isGreedy) u += 40;
          options.push({
            id: "MAYOR_MUNICIPAL_MINT",
            utility: u,
            biasReason: "standardizing civic currency while levying lucrative seigniorage profits",
          });
        }

        if (options.length === 0) continue;

        for (const o of options) o.jittered = o.utility + random() * 8;
        options.sort((a, b) => (b.jittered ?? 0) - (a.jittered ?? 0));
        const chosen = options[0]!;

        switch (chosen.id) {
          case "MAYOR_EXPAND_GRANARY": {
            const grainGain = Math.floor(pop * 0.15) + 350;
            foodDelta += grainGain;
            wealthDelta -= 35;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🌾 CIVIC GRANARY EXPANSION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} opened municipal emergency grain silos in ${burg.name}, distributing +${grainGain} food reserves to avert famine.`,
            });
            tagCitizens(burg.burgId, ["#GrainSubsidyRecipient", "#GranaryCarpenter"], "RELIEVED", `Receiving municipal grain rations under ${p.title} ${p.name}.`, "%laborer%", 3);
            addEnvTags(cellId, ["#MunicipalGrainRelief"]);
            break;
          }
          case "MAYOR_HOARD_GRAIN_SPECULATION": {
            wealthDelta += 85;
            unrestDelta += 12;
            paragonScoreUpdates.set(p.id, Math.min(100, corruption + 4));
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MAJOR",
              msg: `⚠️ CORRUPT GRAIN HOARDING: Driven by ${chosen.biasReason}, ${p.title} ${p.name} locked down the municipal granaries in ${burg.name} during food shortages, reselling grain at extortionate prices to enrich the civic treasury (+85 Gold, +12 Unrest)!`,
            });
            tagCitizens(burg.burgId, ["#GougedCommoner", "#StarvingBitter"], "DESPERATE", `Struggling to afford bread due to Mayor ${p.name}'s speculative grain prices.`, null, 3);
            addEnvTags(cellId, ["#HoardedGrainCrisis"]);
            break;
          }
          case "MAYOR_PUBLIC_SANITATION": {
            healthDelta += 10;
            wealthDelta -= 45;
            unrestDelta -= 3;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🚰 PUBLIC SANITATION EDICT: Guided by ${chosen.biasReason}, ${p.title} ${p.name} funded stone aqueduct conduits and street-cleansing lime washes in ${burg.name}, eradicating filth and boosting public health (+10 Health).`,
            });
            tagCitizens(burg.burgId, ["#SanitationWorker", "#CleanWaterBearer"], "INDUSTRIOUS", `Laying stone water pipes under ${p.title} ${p.name}'s sanitation edict.`, "%laborer%", 3);
            addEnvTags(cellId, ["#SanitationDrivesActive"]);
            break;
          }
          case "MAYOR_QUARANTINE_DISTRICT": {
            healthDelta += 4;
            unrestDelta += 14;
            crimeDelta += 6;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MAJOR",
              msg: `🧱 SICK QUARTER QUARANTINE: Driven by ${chosen.biasReason}, ${p.title} ${p.name} ordered heavy timber barricades erected around the lower river slums of ${burg.name}, sealing infected families behind armed sentries!`,
            });
            tagCitizens(burg.burgId, ["#QuarantinedCitizen", "#BarricadedSlumDweller"], "REBELLIOUS", `Trapped behind quarantine barricades erected by ${p.title} ${p.name}.`, null, 3);
            addEnvTags(cellId, ["#DistrictQuarantineLockdown"]);
            break;
          }
          case "MAYOR_CIVIC_FESTIVAL": {
            unrestDelta -= 16;
            wealthDelta -= 60;
            foodDelta -= 80;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🎪 CIVIC REVELRY FESTIVAL: Guided by ${chosen.biasReason}, ${p.title} ${p.name} funded a grand street carnival in ${burg.name}, tapping municipal wine vats and roasting whole oxen to soothe civil unrest (-16 Unrest).`,
            });
            tagCitizens(burg.burgId, ["#FestivalReveler", "#JovialCitizen"], "JOVIAL", `Dancing and feasting at the municipal festival hosted by ${p.title} ${p.name}.`, null, 4);
            addEnvTags(cellId, ["#FestivalRevelry"]);
            break;
          }
          case "MAYOR_TAX_HOLIDAY": {
            unrestDelta -= 14;
            wealthDelta -= 30;
            refinedGoodsDelta += 40;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `📜 DEBT JUBILEE & TAX HOLIDAY: Guided by ${chosen.biasReason}, ${p.title} ${p.name} declared a duty-free market holiday in ${burg.name}, canceling market tolls and easing popular unrest (-14 Unrest).`,
            });
            tagCitizens(burg.burgId, ["#TaxHolidayBeneficiary", "#ProsperousTrader"], "PROSPEROUS", `Selling goods duty-free under ${p.title} ${p.name}'s holiday decree.`, "%trader%", 3);
            break;
          }
          case "MAYOR_TAX_LEVY_AUDIT": {
            wealthDelta += 90;
            unrestDelta += 12;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `💰 HARSH TAX REASSESSMENT: Driven by ${chosen.biasReason}, ${p.title} ${p.name} dispatched municipal bailiffs across ${burg.name} to seize unpaid arrears, extracting +90 Gold while stoking citizen resentment (+12 Unrest).`,
            });
            tagCitizens(burg.burgId, ["#OverburdenedTaxpayer", "#ResentfulMerchant"], "BITTER", `Enduring harsh tax audits by ${p.title} ${p.name}'s bailiffs.`, "%merchant%", 3);
            addEnvTags(cellId, ["#TaxAuditBurden"]);
            break;
          }
          case "MAYOR_CITADEL_RAMPARTS": {
            unrestDelta -= 4;
            wealthDelta -= 70;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🛡️ PERIMETER RAMPART FORTIFICATION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} reinforced the perimeter stone ramparts and gate bastions of ${burg.name}, bolstering civic defense.`,
            });
            tagCitizens(burg.burgId, ["#RampartSentry", "#MasonFortifier"], "WARY", `Manning the newly reinforced battlements of ${burg.name}.`, "%watch%", 3);
            addEnvTags(cellId, ["#FortifiedRamparts"]);
            break;
          }
          case "MAYOR_TEMPLE_SACRIFICE_PURGE": {
            wealthDelta -= 50;
            unrestDelta -= 8;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🕯️ CELESTIAL PURIFICATION RITE: Guided by ${chosen.biasReason}, ${p.title} ${p.name} sponsored solemn temple purification vigils in ${burg.name}, burning cleansing incense to ward against chaos corruption.`,
            });
            tagCitizens(burg.burgId, ["#PenitentPilgrim", "#TempleAcolyte"], "DEVOUT", `Chanting prayers in the sacred temple sanctuary of ${burg.name}.`, null, 3);
            break;
          }
          case "MAYOR_TOLERATE_SHADOW_WAREHOUSE": {
            wealthDelta += 110;
            crimeDelta += 12;
            const nextScore = Math.min(100, corruption + 8);
            paragonScoreUpdates.set(p.id, nextScore);
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MAJOR",
              msg: `🗝️ CLANDESTINE COLLUSION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} granted private warehouse storage permits in ${burg.name}, pocketing kickbacks while allowing underworld syndicates to flourish (+110 Wealth, +12 Crime)!`,
            });
            tagCitizens(burg.burgId, ["#CartelCollaborator", "#BribedDockClerk"], "COMPLICIT", `Facilitating uninspected warehouse transfers under Mayor ${p.name}'s blind eye.`, "%trader%", 3);
            addEnvTags(cellId, ["#CartelInfiltration"]);

            if (nextScore >= 65 && !sectorTags.some((t) => t.includes("CompassEmbargo"))) {
              addEnvTags(cellId, ["#CompassEmbargo", "#TradeBlockaded"]);
              pendingEvents.push({
                burgId: burg.burgId,
                type: "COMPASS_TRADE_EMBARGO",
                tier: "MAJOR",
                msg: `⚖️ GILDED COMPASS TRADE EMBARGO: Outraged by municipal embezzlement, extortionate kickbacks, and unpaid mercantile notes by Mayor ${p.name}, the Gilded Compass has declared a punitive trade embargo on ${burg.name}! Commercial shipping and grain imports are frozen until debts are settled.`,
              });
            }
            break;
          }
          case "MAYOR_CHARTER_BLOCKADE_RUNNERS": {
            foodDelta += 240;
            wealthDelta -= 55;
            unrestDelta -= 6;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MAJOR",
              msg: `⚡ BLOCKADE RUNNER CHARTER: Driven by ${chosen.biasReason}, ${p.title} ${p.name} hired independent cloud-skiffs and swift coastal luggers to slip grain into ${burg.name}, breaking the stranglehold of trade blockades (+240 Food)!`,
            });
            tagCitizens(burg.burgId, ["#BlockadeRunnerContact"], "CONFIDENT", `Distributing flour brought through maritime blockades under ${p.title} ${p.name}.`, "%baker%", 3);
            break;
          }
          case "MAYOR_HARBOR_EXPANSION": {
            wealthDelta += 75;
            refinedGoodsDelta += 50;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `⚓ HARBOR BASIN EXPANSION: Guided by ${chosen.biasReason}, ${p.title} ${p.name} dredged the anchorage and erected timber crane wharves in ${burg.name}, accelerating maritime commerce.`,
            });
            tagCitizens(burg.burgId, ["#DockBuilder", "#QuayRigger"], "INDUSTRIOUS", `Framing timber docks and driving pilings in the harbor of ${burg.name}.`, "%carpenter%", 3);
            break;
          }
          case "MAYOR_ARTISAN_GUILDHALL": {
            wealthDelta += 45;
            refinedGoodsDelta += 70;
            healthDelta += 2;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🔨 ARTISAN GUILD CHARTER: Guided by ${chosen.biasReason}, ${p.title} ${p.name} chartered a grand municipal guildhall in ${burg.name}, providing bellows and workbenches for blacksmiths and weavers.`,
            });
            tagCitizens(burg.burgId, ["#MasterArtisan", "#GuildSmith"], "PROSPEROUS", `Forging masterwork wares under ${p.title} ${p.name}'s guild charter.`, "%smith%", 3);
            break;
          }
          case "MAYOR_ACADEMY_SCRIBES": {
            crimeDelta -= 12;
            wealthDelta -= 30;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `📚 LEGAL SCRIBE ARCHIVE: Guided by ${chosen.biasReason}, ${p.title} ${p.name} founded a municipal scribe academy and deed registry in ${burg.name}, codifying property rights and trade contracts.`,
            });
            tagCitizens(burg.burgId, ["#CadastralScribe", "#LegalScholar"], "SCHOLARLY", `Registering guild deeds in the municipal scribe hall of ${burg.name}.`, "%scribe%", 2);
            break;
          }
          case "MAYOR_MUNICIPAL_MINT": {
            wealthDelta += 85;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🪙 MUNICIPAL COIN MINTING: Guided by ${chosen.biasReason}, ${p.title} ${p.name} struck new stamped silver coinage in ${burg.name}, standardizing market transactions and collecting bullion seigniorage.`,
            });
            tagCitizens(burg.burgId, ["#MintAssayer", "#CoinStamper"], "SCHOLARLY", `Assaying silver ingots at the municipal mint of ${burg.name}.`, "%smith%", 2);
            break;
          }
          default: {
            foodDelta += 400;
            wealthDelta -= 35;
            pendingEvents.push({
              burgId: burg.burgId,
              type: "MAYOR_TERRACED_FARMLAND",
              tier: "MINOR",
              msg: `🌱 TERRACED FARMLAND CLEARING: Guided by ${chosen.biasReason}, ${p.title} ${p.name} cleared foothill slopes for terraced barley fields and irrigation ditches around ${burg.name}.`,
            });
            tagCitizens(burg.burgId, ["#TerraceFarmer"], "INDUSTRIOUS", `Cultivating terraced barley fields under ${p.title} ${p.name}.`, "%farmer%", 3);
            break;
          }
        }
      }

      // 2. Security Paragons
      else if (domain === "Security") {
        interface SecurityActionOption {
          id: string;
          utility: number;
          biasReason: string;
          jittered?: number;
        }
        const options: SecurityActionOption[] = [];

        const isCurfewActive = sectorTags.includes("#NightfallCurfewActive");
        if (isHighUnrest && !isCurfewActive) {
          let u = isCriticalUnrest ? 80 : 50;
          if (isParanoid || motive.wantTag === "#Want_IronOrder") u += 35;
          if (isVengeful) u += 30;
          if (isCompassionate) u -= 40;
          options.push({
            id: "COMMANDER_IRON_CURFEW",
            utility: Math.max(5, u),
            biasReason:
              motive.wantTag === "#Want_IronOrder"
                ? motive.want.toLowerCase()
                : isParanoid
                  ? "paranoia of nocturnal rebellion and street barricades"
                  : "suppressing civil riots",
          });
        }

        if (isCurfewActive && !isHighUnrest) {
          options.push({
            id: "COMMANDER_LIFT_CURFEW",
            utility: 70,
            biasReason: "restored civil peace and open commerce",
          });
        }

        if (isHighCrime || isCartelInfiltrated) {
          let u = 60;
          if (isStoic || traits.some((t) => t.includes("DUTIFUL") || t.includes("RESOLUTE"))) u += 35;
          if (corruption > 40) u -= 60;
          options.push({
            id: "COMMANDER_CONTRABAND_RAID",
            utility: Math.max(5, u),
            biasReason: "dutiful commitment to smashing unlicensed underworld syndicates",
          });
        }

        if ((isHighCrime || isCartelInfiltrated) && (corruption > 40 || isGreedy)) {
          let u = 40;
          if (isGreedy) u += 40;
          if (corruption > 60) u += 30;
          options.push({
            id: "COMMANDER_TAKE_UNDERWORLD_BRIBE",
            utility: u,
            biasReason: "greed for syndicate hush money in exchange for routing patrols away from the harbor",
          });
        }

        if (!isCriticalUnrest && (isHighUnrest || isCartelInfiltrated || isTradeBlockaded || (burg.crimeRate || 0) > 15)) {
          let u = 45;
          if (isStoic) u += 25;
          if (motive.wantTag === "#Want_IronOrder") u += 18;
          options.push({
            id: "COMMANDER_GARRISON_DRILL",
            utility: u,
            biasReason: "iron discipline and wall archer readiness",
          });
        }

        if (
          (sectorTags.some((t) => t.includes("Bandit") || t.includes("Wilderness")) || (burg.crimeRate || 0) > 20) &&
          !(motive.lineTag === "#Line_NeverAbandonWalls" && (isHighUnrest || isCriticalUnrest))
        ) {
          let u = 40;
          if (isVengeful) u += 25;
          options.push({
            id: "COMMANDER_BANDIT_SWEEP",
            utility: u,
            biasReason: "aggressive determination to scour highway bandits from trade corridors",
          });
        }

        if (isHighUnrest && (isVengeful || isParanoid)) {
          let u = 55;
          if (isVengeful) u += 30;
          options.push({
            id: "COMMANDER_ARREST_AGITATORS",
            utility: u,
            biasReason: "intolerant fury toward street dissent and strike organizers",
          });
        }

        if (options.length === 0) continue;

        for (const o of options) o.jittered = o.utility + random() * 8;
        options.sort((a, b) => (b.jittered ?? 0) - (a.jittered ?? 0));
        const chosen = options[0]!;

        switch (chosen.id) {
          case "COMMANDER_IRON_CURFEW": {
            unrestDelta -= 8;
            crimeDelta -= 12;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MAJOR",
              msg: `⚔️ MANDATORY IRON CURFEW: Driven by ${chosen.biasReason}, ${p.title} ${p.name} locked all gates and deployed heavy halberd patrols across ${burg.name}, enforcing dusk-to-dawn curfews!`,
            });
            tagCitizens(burg.burgId, ["#CurfewEnforcer"], "WARY", `Enforcing ${p.title} ${p.name}'s strict nighttime lockdown.`, "%watch%", 3);
            tagCitizens(burg.burgId, ["#CurfewDefier"], "REBELLIOUS", `Evading armed curfew patrols in the shadowed alleys of ${burg.name}.`, "%laborer%", 3);
            addEnvTags(cellId, ["#NightfallCurfewActive"]);
            break;
          }
          case "COMMANDER_LIFT_CURFEW": {
            unrestDelta -= 5;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🕊️ IRON CURFEW LIFTED: With civil order restored, ${p.title} ${p.name} opened the gates and stood down dusk-to-dawn curfew patrols across ${burg.name}.`,
            });
            removeEnvTags(cellId, ["#NightfallCurfewActive"]);
            break;
          }
          case "COMMANDER_CONTRABAND_RAID": {
            crimeDelta -= 15;
            wealthDelta += 35;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🗡️ DOCKSIDE CONTRABAND RAID: Guided by ${chosen.biasReason}, ${p.title} ${p.name} led a tactical raid on an unlicensed wharf warehouse in ${burg.name}, impounding smuggled contraband (-15 Crime).`,
            });
            tagCitizens(burg.burgId, ["#RaidedSmuggler"], "FEARFUL", `Lying low after ${p.title} ${p.name}'s watchmen raided a nearby safehouse.`, "%trader%", 3);
            break;
          }
          case "COMMANDER_TAKE_UNDERWORLD_BRIBE": {
            wealthDelta += 65;
            crimeDelta += 14;
            paragonScoreUpdates.set(p.id, Math.min(100, corruption + 6));
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MAJOR",
              msg: `💰 WATCH BRIBERY COLLUSION: Driven by ${chosen.biasReason}, ${p.title} ${p.name} accepted pouches of hush gold in ${burg.name}, redirecting watch patrols away from smuggling alleys (+65 Wealth, +14 Crime)!`,
            });
            tagCitizens(burg.burgId, ["#BribedSentry"], "COMPLICIT", `Turning a blind eye to nightly smuggling crates under Commander ${p.name}'s orders.`, "%watch%", 3);
            addEnvTags(cellId, ["#CorruptedWatchGarrison"]);
            break;
          }
          case "COMMANDER_BANDIT_SWEEP": {
            crimeDelta -= 10;
            wealthDelta += 20;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `🐎 HIGHWAY OUTRIDER SWEEP: Driven by ${chosen.biasReason}, ${p.title} ${p.name} led mounted outriders along the trade roads of ${burg.name}, driving off highway robbers and restoring order.`,
            });
            tagCitizens(burg.burgId, ["#ClearedRoadMerchant"], "CONFIDENT", `Transporting goods along highways secured by ${p.title} ${p.name}.`, "%trader%", 3);
            break;
          }
          case "COMMANDER_ARREST_AGITATORS": {
            unrestDelta -= 10;
            crimeDelta -= 8;
            pendingEvents.push({
              burgId: burg.burgId,
              type: chosen.id,
              tier: "MINOR",
              msg: `⛓️ LABOR AGITATOR CRACKDOWN: Driven by ${chosen.biasReason}, ${p.title} ${p.name} arrested five strike organizers in ${burg.name}, breaking up illegal assembly in the market square.`,
            });
            tagCitizens(burg.burgId, ["#JailedDissidentFamily"], "BITTER", `Harboring deep resentment after ${p.title} ${p.name} imprisoned local labor spokesmen.`, "%laborer%", 3);
            break;
          }
          default: {
            unrestDelta -= 3;
            crimeDelta -= 6;
            if ((snap.tick + p.id) % 20 === 0) {
              pendingEvents.push({
                burgId: burg.burgId,
                type: "COMMANDER_GARRISON_DRILL",
                tier: "MINOR",
                msg: `🛡️ GARRISON MARTIAL DRILL: Guided by ${chosen.biasReason}, ${p.title} ${p.name} conducted shield wall and pike drills on the ramparts of ${burg.name}, honing combat discipline.`,
              });
              tagCitizens(burg.burgId, ["#GarrisonDrilled"], "DEVOUT", `Drilling with shields and spears under ${p.title} ${p.name}.`, "%watch%", 3);
            }
            break;
          }
        }
      }
    }

    if (
      foodDelta !== 0 ||
      wealthDelta !== 0 ||
      crimeDelta !== 0 ||
      unrestDelta !== 0 ||
      healthDelta !== 0 ||
      rawMaterialsDelta !== 0 ||
      refinedGoodsDelta !== 0
    ) {
      deltas.push({
        kind: "burg.adjust",
        burgId: burg.burgId,
        food: foodDelta || undefined,
        wealth: wealthDelta || undefined,
        crime: crimeDelta || undefined,
        unrest: unrestDelta || undefined,
        health: healthDelta || undefined,
        rawMaterials: rawMaterialsDelta || undefined,
        refinedGoods: refinedGoodsDelta || undefined,
      });
    }
  }

  for (const pid of Array.from(paragonScoreUpdates.keys()).sort((a, b) => a - b)) {
    deltas.push({
      kind: "paragon.setCorruption",
      paragonId: pid,
      corruptionScore: paragonScoreUpdates.get(pid)!,
    });
  }

  for (const ev of pendingEvents) {
    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: ev.type,
      message: ev.msg,
      tier: ev.tier,
      burgId: ev.burgId,
      loreDate: snap.loreDate,
    });
  }

  return deltas;
}
