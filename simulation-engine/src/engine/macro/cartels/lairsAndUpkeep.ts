import {
  pickShuffled,
  type CartelRunContext,
  type CartelsSnapshot,
  type WorkingCartel,
} from "./types.js";

/**
 * Pure lair founding check (every 10th tick, cap < 8 active lairs per syndicate).
 */
export function planLairEstablishment(
  cartel: WorkingCartel,
  preferredLairType: string,
  isSecret: boolean,
  ctx: CartelRunContext
): void {
  const { snap, random, deltas } = ctx;
  if (snap.tick % 10 !== 0) return;

  const currentLairs = ctx.lairCountByFaction.get(cartel.id) || 0;
  if (currentLairs >= 8) return;

  if (cartel.wealth >= 2000 && cartel.manpower >= 24 && random() < 0.35) {
    const lairBurg = snap.targetBurgs.find((b) => (b.wealth || 0) >= 150 && (b.unrest || 0) >= 10);
    if (!lairBurg) return;

    const key = `${cartel.id}:${lairBurg.burgId}`;
    if (!ctx.lairKeys.has(key)) {
      cartel.wealth = Math.max(0, cartel.wealth - 1200);
      cartel.manpower = Math.max(0, cartel.manpower - 24);
      ctx.lairCountByFaction.set(cartel.id, currentLairs + 1);
      ctx.lairKeys.add(key);

      deltas.push({
        kind: "fringeLair.mutate",
        action: "upsert",
        factionId: cartel.id,
        cellId: lairBurg.cellId,
        burgId: lairBurg.burgId,
        lairType: preferredLairType,
        manpower: 24,
        heat: 15,
      });

      ctx.newLairsNeedingResidents.push({
        factionId: cartel.id,
        cellId: lairBurg.cellId,
        burgId: lairBurg.burgId,
        lairType: preferredLairType,
        cartelName: cartel.name,
        cartelType: cartel.type,
      });

      const visibilityText = isSecret ? "a covert, camouflaged" : "an unhidden, prominent";
      deltas.push({
        kind: "event.log",
        tick: snap.tick,
        type: "LAIR_ESTABLISHED",
        message: `${cartel.name} established ${visibilityText} ${preferredLairType.replace(/_/g, " ")} base in ${lairBurg.name} to expand their provincial operations!`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: lairBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }
}

/**
 * Pure lair heat accumulation, corrupt Security Commander bribery checks, and watch militia busts.
 */
export function stepLairOperationsAndMilitiaBusts(
  snap: CartelsSnapshot,
  ctx: CartelRunContext
): void {
  const { deltas } = ctx;

  for (const lair of snap.lairs) {
    if (!lair.burgId) continue;

    let military: Record<string, number> = {};
    try {
      military =
        typeof lair.militaryForces === "string"
          ? JSON.parse(lair.militaryForces)
          : ((lair.militaryForces as Record<string, number>) || {});
    } catch {
      // Ignore malformed JSON
    }
    let milPower = ((military.infantry || military.footmen || 0) + (military.mounted || 0) * 2) * 12;

    const cmd = snap.commandersByBurg[lair.burgId];
    let isCorrupt = false;
    let isTactician = false;
    if (cmd) {
      const traits = JSON.stringify(cmd.traits || "");
      const score = Number(cmd.corruptionScore) || 0;
      if (traits.includes("Corrupt") || score > 40) isCorrupt = true;
      if (traits.includes("Tactician")) isTactician = true;
    }

    if (isTactician) milPower *= 2;

    const currentHeat = (lair.heat || 0) + 3;

    if (currentHeat >= 45 && milPower > 0) {
      if (isCorrupt) {
        deltas.push({
          kind: "fringeLair.update",
          lairId: lair.id,
          heat: Math.max(0, lair.heat - 15),
        });
        if (snap.tick % 7 === 0) {
          deltas.push({
            kind: "event.log",
            tick: snap.tick,
            type: "COMMANDER_BRIBED",
            message: `💰 CORRUPT COLLUSION: City Watch Commander in ${lair.burgName} quietly called off a planned raid on ${lair.cartelName}'s lair after accepting an underworld tribute.`,
            tier: "MINOR",
            burgId: lair.burgId,
            loreDate: snap.loreDate,
          });
        }
        continue;
      }

      if (milPower > lair.manpower) {
        deltas.push({ kind: "fringeLair.delete", lairId: lair.id });
        deltas.push({ kind: "burg.adjust", burgId: lair.burgId, crime: -10 });
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "LAIR_BUSTED",
          message: `⚔️ CARTEL LAIR BUSTED: City watch forces in ${lair.burgName} stormed and dismantled ${lair.cartelName}'s ${lair.lairType.replace(/_/g, " ")}!`,
          tier: "MAJOR",
          burgId: lair.burgId,
          loreDate: snap.loreDate,
        });
        const curCount = ctx.lairCountByFaction.get(lair.factionId) || 0;
        if (curCount > 0) ctx.lairCountByFaction.set(lair.factionId, curCount - 1);
      } else {
        deltas.push({ kind: "fringeLair.update", lairId: lair.id, heat: 10 });
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "MILITIA_DEFEATED",
          message: `⚠️ WATCH REPELLED: Underground syndicates violently repelled a city watch raid on ${lair.cartelName}'s ${lair.lairType.replace(/_/g, " ")} in ${lair.burgName}.`,
          tier: "MAJOR",
          burgId: lair.burgId,
          loreDate: snap.loreDate,
        });
      }
    } else {
      deltas.push({ kind: "fringeLair.update", lairId: lair.id, heat: currentHeat });
    }
  }
}

/**
 * Pure every-10-ticks syndicate attrition, payroll desertion, heat cooling, and sovereign crackdown.
 */
export function stepSyndicateUpkeepAndCrackdown(
  snap: CartelsSnapshot,
  ctx: CartelRunContext
): void {
  if (snap.tick % 10 !== 0) return;

  for (const c of snap.cartels) {
    const cartel = ctx.workingById.get(c.id)!;
    const mp = cartel.manpower;
    const wealth = cartel.wealth;

    if (mp > 1500) {
      const neededUpkeep = Math.floor(mp * 0.5);
      if (wealth >= neededUpkeep) {
        const turnover = Math.max(5, Math.floor(mp * 0.02));
        cartel.wealth = Math.max(0, cartel.wealth - neededUpkeep);
        cartel.manpower = Math.max(500, cartel.manpower - turnover);
      } else {
        const deserters = Math.max(15, Math.floor(mp * 0.08));
        cartel.wealth = Math.max(0, cartel.wealth - 50);
        cartel.manpower = Math.max(300, cartel.manpower - deserters);
      }
    } else if (mp > 800) {
      const naturalAttrition = Math.max(2, Math.floor(mp * 0.01));
      cartel.manpower = Math.max(300, cartel.manpower - naturalAttrition);
    }

    const currentCartelHeat = cartel.heat;
    if (currentCartelHeat > 15) {
      const greasePay = wealth >= 50 ? 25 : 0;
      const cooledHeat = Math.max(2, Math.floor(currentCartelHeat * 0.06));
      cartel.heat = Math.max(0, cartel.heat - cooledHeat);
      cartel.wealth = Math.max(0, cartel.wealth - greasePay);
    }

    if (mp >= 2000 && snap.tick % 20 === 0 && snap.crackdownCrowns.length > 0) {
      const salt = Math.floor(ctx.random() * 2147483647);
      const crown = pickShuffled(snap.crackdownCrowns, (f) => String(f.id), salt, 1)[0];
      if (crown) {
        const dispersed = Math.floor(mp * 0.25);
        const seizedWealth = Math.min(wealth, Math.floor(wealth * 0.20));

        cartel.manpower = Math.max(500, cartel.manpower - dispersed);
        cartel.wealth = Math.max(0, cartel.wealth - seizedWealth);
        cartel.heat = Math.min(100, cartel.heat + 25);

        ctx.deltas.push({
          kind: "faction.update",
          factionId: crown.id,
          treasuryDelta: seizedWealth,
        });

        ctx.deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "SOVEREIGN_MERCENARY_CRACKDOWN",
          message: `👑 ROYAL EXPEDITION: Alarmed by rogue mercenary expansion, the royal army of ${crown.name} marched against ${cartel.name}, routing ${dispersed} rogue mercenaries and seizing ${seizedWealth} gold in contraband war-chests!`,
          tier: "CRITICAL",
          factionId: crown.id,
          loreDate: snap.loreDate,
        });
      }
    }
  }
}
