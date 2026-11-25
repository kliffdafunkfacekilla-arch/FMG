import { planLairEstablishment } from "./lairsAndUpkeep.js";
import type { CartelRunContext, WorkingCartel } from "./types.js";

/**
 * 4. The Silk-Sovereign Syndicate: Vice dens, Viper-Haze narcotics & street protection.
 */
export function stepSilkSovereign(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  planLairEstablishment(cartel, "VICE_DEN", false, ctx);

  if (tick % 3 === 0) {
    const targetBurg = burgs.find((b) => (b.unrest || 0) >= 30);
    if (targetBurg) {
      const nextHealth = Math.max(20, targetBurg.health - 4);
      const healthDelta = nextHealth - targetBurg.health;
      deltas.push({
        kind: "burg.adjust",
        burgId: targetBurg.burgId,
        unrest: -8,
        health: healthDelta || undefined,
        wealth: -30,
      });
      cartel.wealth += 75;

      ctx.emitTagBurg(
        targetBurg.burgId,
        ["#ViperHazeAddict", "#SilkProtectionTribute"],
        "PACIFIED",
        "Dependent on Viper-Haze narcotics supplied through the Silk-Sovereign Syndicate's parlor network.",
        "%laborer%",
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "SILK_NARCOTIC_DISTRIBUTION",
        message: `🍷 VICE NETWORK PROFIT: The Silk-Sovereign Syndicate expanded its velvet vice dens in ${targetBurg.name}, circulating Viper-Haze narcotics that numbed civil unrest while extracting illicit revenue.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: targetBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 0) {
    const wealthyBurg = burgs.find((b) => b.wealth > 200);
    if (wealthyBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: wealthyBurg.burgId,
        wealth: -45,
      });
      cartel.wealth += 90;
      deltas.push({
        kind: "event.log",
        tick,
        type: "SILK_GAMBLING_PROTECTION",
        message: `🎲 VICE PROTECTION RACKET: Silk-Sovereign enforcers levied weekly protection coin on merchant guilds and tavern owners in ${wealthyBurg.name}, insulating the parent Obsidian Cartel behind street muscle.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: wealthyBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }
}

/**
 * 6. The Obsidian Cartel: Business fronts, bribed gates, relics, arms smuggling & hits.
 */
export function stepObsidianCartel(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  if (tick % 3 === 0) {
    const wealthyBurg = burgs.find((b) => b.wealth > 300);
    if (wealthyBurg) {
      deltas.push({
        kind: "event.log",
        tick,
        type: "CARTEL_MAGISTRATE_AUDIENCE",
        message: `🍷 OLIGARCH BACKROOM DEAL: Front-factors of the Obsidian Cartel hosted a private banquet with magistrates in ${wealthyBurg.name}, commanding high municipal respect while securing customs exemptions.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: wealthyBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 3 === 0) {
    const gateBurg = burgs.find((b) => b.wealth > 200);
    if (gateBurg) {
      deltas.push({
        kind: "event.log",
        tick,
        type: "CARTEL_BRIBED_GATE",
        message: `🗝️ BRIBED CITY GATE: The Obsidian Cartel paid off night-watch sergeants at the fortified gate of ${gateBurg.name}, allowing concealed carts of narcotics and black-glass blades to enter uninspected.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: gateBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 3 === 0) {
    const buyerBurg = burgs.find((b) => b.wealth > 250);
    if (buyerBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: buyerBurg.burgId,
        wealth: -60,
        refinedGoods: 40,
      });
      cartel.wealth += 180;
      deltas.push({
        kind: "event.log",
        tick,
        type: "CARTEL_RELIC_FENCE",
        message: `🏺 TITAN RELIC FENCED: Operating through a licensed apothecary front in ${buyerBurg.name}, the Obsidian Cartel secretly fenced an unregistered pre-Cruor Titan relic to an oligarch collector for 180 gold.`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: buyerBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  const riotBurg = burgs.find((b) => b.unrest >= 15 || b.food < 100);
  if (riotBurg && tick % 2 === 0) {
    deltas.push({
      kind: "burg.adjust",
      burgId: riotBurg.burgId,
      unrest: 8,
      wealth: -30,
    });
    cartel.wealth += 200;
    deltas.push({
      kind: "event.log",
      tick,
      type: "CARTEL_ARM_RIOTERS",
      message: `🗡️ CARTEL ARMS RIOTERS: Exploiting food shortages and civil unrest in ${riotBurg.name}, the Obsidian Cartel sold black-market blades and blast-powder to rioting mobs for massive gold, stoking chaos for profit!`,
      tier: "MAJOR",
      outlawId: cartel.id,
      burgId: riotBurg.burgId,
      loreDate: snap.loreDate,
    });
  }

  if (tick % 4 === 0) {
    const candBurg = burgs.find((b) => (b.popNull || 0) >= 12);
    if (candBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: candBurg.burgId,
        popNull: -12,
      });
      cartel.manpower += 1;
      deltas.push({
        kind: "event.log",
        tick,
        type: "CARTEL_MEMBER_INDUCTION",
        message: `🗡️ CARTEL INDUCTION: After proving unwavering loyalty through extortion trials in ${candBurg.name}, recruit Silas Vance earned the syndicate's respect and was inducted as a made-member of the Obsidian Cartel.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: candBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (cartel.initialWealth >= 400 && tick % 3 === 0) {
    const hitBurg = burgs.find((b) => b.wealth > 300);
    if (hitBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: hitBurg.burgId,
        unrest: 8,
        health: -4,
      });
      ctx.emitTagBurg(
        hitBurg.burgId,
        ["#MurderInquiry", "#VigilantWatch"],
        "WARY",
        "Investigating a lethal contract killing executed by Obsidian Cartel assassins.",
        "%watch%",
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "CARTEL_CONTRACT_KILLING",
        message: `🗡️ OBSIDIAN CARTEL HIT: An assassin from the Obsidian Cartel struck down a defiant magistrate in ${hitBurg.name}! The city watch discovered an etched black-glass blade left at the murder scene.`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: hitBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  planLairEstablishment(cartel, "BUSINESS_FRONT", false, ctx);
}

/**
 * 7. The Otters (Canal Krewes): River stilt-dens, waterway intel & submerged retrieval.
 */
export function stepOtters(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  if (tick % 2 === 0) {
    const riverBurg = burgs.find((b) => b.wealth > 120);
    if (riverBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: riverBurg.burgId,
        wealth: -20,
      });
      cartel.wealth += 75;

      ctx.emitTagBurg(
        riverBurg.burgId,
        ["#OtterDenPatron", "#LooseLippedBargeman"],
        "CONVIVIAL",
        "Sipping fermented eel-wine in an Otter Canal Krewe dockside stilt-den, inadvertently sharing river trade secrets.",
        "%laborer%",
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "OTTER_TAVERN_INTEL",
        message: `🦦 CANAL KREWE INTEL: Over draughts of frosted marsh-ale and fermented eel-wine at a dockside stilt-den near ${riverBurg.name}, Otter Canal Krewe salooneers extracted vital sovereign trade schedules and patrol routes from loose-lipped barge crews.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: riverBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 1) {
    const escapeBurg = burgs.find((b) => b.unrest >= 8 || b.wealth > 200);
    if (escapeBurg) {
      cartel.wealth += 110;
      deltas.push({
        kind: "burg.adjust",
        burgId: escapeBurg.burgId,
        unrest: 2,
      });
      deltas.push({
        kind: "event.log",
        tick,
        type: "OTTER_UNDERWATER_EXTRACTION",
        message: `🏊 UNDERWATER EXTRACTION: Specialised Otter Canal Krewe flume-divers extracted a high-profile fugitive out of ${escapeBurg.name}! Equipped with reed respirators, they swam beneath municipal harbor cordons and submerged sewer grates, vanishing into the river currents!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: escapeBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 3) {
    const salvageBurg = burgs.find((b) => b.wealth > 150);
    if (salvageBurg) {
      cartel.wealth += 130;
      deltas.push({
        kind: "burg.adjust",
        burgId: salvageBurg.burgId,
        rawMaterials: 40,
      });
      deltas.push({
        kind: "event.log",
        tick,
        type: "OTTER_UNDERWATER_RETRIEVAL",
        message: `🌊 SUBMERGED RETRIEVAL MISSION: Otter Canal Krewe salvage teams dove into dangerous river flues and flooded ruins near ${salvageBurg.name}, retrieving sunken bullion chests and lost cargo crates from riverbed shipwrecks.`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: salvageBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  planLairEstablishment(cartel, "WATER_STILT_DEN", false, ctx);
}
