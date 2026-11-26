import { planLairEstablishment } from "./lairsAndUpkeep.js";
import { pickShuffled, recruitSplit, type CartelRunContext, type WorkingCartel } from "./types.js";

/**
 * 1. The Gilded Compass: Armed privateers, merchant galleasses & trade blockades.
 */
export function stepGildedCompass(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  if (tick % 3 === 0) {
    const wealthyBurg = burgs.find((b) => b.wealth > 250);
    if (wealthyBurg) {
      ctx.emitTagBurg(
        wealthyBurg.burgId,
        ["#CompassContractor", "#MeridianNavigator"],
        "CALCULATED",
        "Under contract with the Gilded Compass armed merchant fleet as a skilled navigator and logistics factor.",
        "%artisan%",
        1
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "COMPASS_SKILLED_RECRUITMENT",
        message: `⚓ GILDED COMPASS COMMISSION: Fleet Commodore Cassian Midas (Hippo-Kin) commissioned a master shipwright and two veteran navigators in ${wealthyBurg.name} to overhaul high-tonnage merchant galleasses.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: wealthyBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  planLairEstablishment(cartel, "PUBLIC_TRADE_YARD", false, ctx);

  if (tick % 2 === 0) {
    const clientBurg = burgs.find((b) => b.wealth > 300);
    if (clientBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: clientBurg.burgId,
        refinedGoods: 60,
        wealth: 40,
      });
      cartel.wealth += 160;
      deltas.push({
        kind: "event.log",
        tick,
        type: "COMPASS_SHIPPING_CONTRACT",
        message: `🚢 COMMERCIAL FREIGHT: Hippo-captained merchant galleasses of the Gilded Compass fulfilled a scheduled commercial shipping contract into ${clientBurg.name}, delivering high-value cargo and collecting transport fees.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: clientBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 3 === 0) {
    const tradeBurg = burgs.find((b) => b.rawMaterials > 100);
    if (tradeBurg) {
      const actualDrop = Math.min(80, Math.max(0, tradeBurg.rawMaterials));
      deltas.push({
        kind: "burg.adjust",
        burgId: tradeBurg.burgId,
        rawMaterials: actualDrop > 0 ? -actualDrop : undefined,
        wealth: 50,
      });
      cartel.wealth += 130;
      deltas.push({
        kind: "event.log",
        tick,
        type: "COMPASS_MARKET_ARBITRAGE",
        message: `⚖️ COMMERCE ARBITRAGE: Gilded Compass factors bought surplus raw commodities at bulk discount in ${tradeBurg.name} to resell at monopoly rates across overseas trade hubs.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: tradeBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 0) {
    const coastalBurg = burgs.find((b) => b.wealth > 350);
    if (coastalBurg) {
      cartel.wealth += 180;
      deltas.push({
        kind: "event.log",
        tick,
        type: "COMPASS_NAVAL_INSPECTION",
        message: `⚓ NAVAL POLICING WAYLAY: An armed Gilded Compass war-sloop waylaid and boarded an unregistered foreign merchantman outside ${coastalBurg.name}. Heavy Hippo-Kin marines seized contraband cargo under armed inspection authority!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: coastalBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 5 === 0) {
    const targetBurg = burgs.find((b) => b.wealth > 400 && b.food > 100);
    if (targetBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: targetBurg.burgId,
        food: -120,
        unrest: 6,
      });
      cartel.wealth += 240;
      ctx.emitTagBurg(
        targetBurg.burgId,
        ["#CompassBlockaded", "#MarketShortage"],
        "BITTER",
        "Enduring severe commodity inflation and shortages caused by Gilded Compass naval trade blockades.",
        "%merchant%",
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "COMPASS_TRADE_BLOCKADE",
        message: `🚫 TRADE ROUTE BLOCKADE: Gilded Compass privateer squadrons imposed an iron blockade across maritime shipping lanes into ${targetBurg.name}, choking food provisions to artificially inflate market prices and force trade concessions!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: targetBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }
}

/**
 * 2. The Free Sky-Barons: Cloud-skiff smugglers, secret aeries & sky pirates.
 */
export function stepSkyBarons(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  if (tick % 3 === 0) {
    const recruitBurg = burgs.find((b) => b.unrest >= 5 || b.wealth > 150);
    if (recruitBurg) {
      cartel.manpower += 1;
      deltas.push({
        kind: "event.log",
        tick,
        type: "SKY_BARON_CORE_BRANDING",
        message: `🔥 CORE DRIVE BRANDING: Independent airship captain Dax Hawthorne of ${recruitBurg.name} was prospected by the Free Sky-Barons and brought to the capital dock near the Verge. Their airship core drive was branded with the brotherhood glyph before being assigned patrol territory!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: recruitBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  planLairEstablishment(cartel, "SECRET_AERIE_YARD", true, ctx);

  if (tick % 2 === 0) {
    const destBurg = burgs.find((b) => b.wealth > 200);
    if (destBurg) {
      cartel.wealth += 120;
      deltas.push({
        kind: "event.log",
        tick,
        type: "SKY_BARON_STEALTH_TRANSPORT",
        message: `🌫️ STEALTH AIRSHIP TRANSPORT: Slipped beneath cloud cover, a Free Sky-Baron cloud-skiff transported high-profile fugitives and unmanifested cargo into ${destBurg.name} without being detected by sovereign airship patrols.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: destBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 0) {
    const victimBurg = burgs.find((b) => b.wealth > 350);
    if (victimBurg) {
      const loot = 85;
      deltas.push({
        kind: "burg.adjust",
        burgId: victimBurg.burgId,
        wealth: -loot,
        unrest: 4,
      });
      cartel.wealth += loot;
      deltas.push({
        kind: "event.log",
        tick,
        type: "SKY_BARON_PIRATE_AMBUSH",
        message: `🏴‍☠️ AERIAL PIRATE AMBUSH: Catching a vulnerable merchant airship isolated in high winds near ${victimBurg.name}, Free Sky-Baron corsairs dropped from the sun, harpooned the rigging, and plundered ${loot} gold in cargo!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: victimBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }
}

/**
 * 3. The Legion / Devil's Choice: Elite mercenary force & monopoly bastions.
 */
export function stepLegion(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  if (tick % 5 === 0) {
    const currentMp = cartel.manpower;
    const recruitBurg = burgs.find((b) => (b.popNull || 0) + (b.popAttuned || 0) >= 100 && (b.unrest || 0) >= 30);
    if (recruitBurg && currentMp < 2500) {
      deltas.push({
        kind: "burg.adjust",
        burgId: recruitBurg.burgId,
        ...recruitSplit(recruitBurg, 12),
      });
      cartel.manpower = Math.min(2500, cartel.manpower + 12);

      ctx.emitTagBurg(
        recruitBurg.burgId,
        ["#LegionTrained", "#DisciplinedSoldier"],
        "STOIC",
        "Inducted and drilled into a hardened fighting machine under Legion centurions.",
        null,
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "LEGION_DRILL_TRAINING",
        message: `🛡️ LEGION DRILL & TRAINING: The Legion opened recruitment in ${recruitBurg.name}, taking in 12 recruits and subjecting them to grueling martial conditioning under centurions.`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: recruitBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  planLairEstablishment(cartel, "MERC_TRADE_BASTION", false, ctx);

  if (tick % 4 === 0) {
    const marketBurg = burgs.find((b) => b.wealth > 300);
    if (marketBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: marketBurg.burgId,
        wealth: -35,
      });
      cartel.wealth += 70;
      deltas.push({
        kind: "event.log",
        tick,
        type: "LEGION_MARKET_STRONGARM",
        message: `🔨 MARKET STRONG-ARM: Heavily armored Legion shock-troopers occupied the central trade plaza in ${marketBurg.name}, enforcing price floors for Legion grain shipments.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: marketBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 0 && snap.hireableFactions.length > 0) {
    const salt = Math.floor(ctx.random() * 2147483647);
    const clientFaction = pickShuffled(snap.hireableFactions, (f) => String(f.id), salt, 1)[0];
    if (clientFaction) {
      const currentMp = cartel.manpower;
      const deployed = Math.min(48, Math.max(12, Math.floor(currentMp * 0.05)));
      const casualties = Math.max(3, Math.floor(deployed * 0.25));

      deltas.push({
        kind: "faction.update",
        factionId: clientFaction.id,
        treasuryDelta: -350,
      });
      cartel.wealth += 350;
      cartel.manpower = Math.max(24, cartel.manpower - casualties);

      deltas.push({
        kind: "event.log",
        tick,
        type: "LEGION_MERCENARY_CONTRACT",
        message: `⚔️ MERCENARY CONTRACT: The Legion fulfilled an active military contract for ${clientFaction.name}, deploying ${deployed} shock-troopers to the frontlines (${casualties} fallen in battle).`,
        tier: "MAJOR",
        outlawId: cartel.id,
        loreDate: snap.loreDate,
      });
    }
  }
}
