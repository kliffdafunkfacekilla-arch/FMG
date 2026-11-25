import {
  evaluateNPCMind,
  type ActionUtilityChoice,
  type BurgEnvironmentalContext,
  type NPCBelief,
  type NPCInstinct,
  type NPCMindState,
  type NPCMood,
  type NPCNeeds,
  type NPCSocialLink,
  type NPCTemper,
} from "../../ai/npcMindPure.js";
import type { Delta } from "../../deltas/types.js";

export interface LivingNpcRoutineSnapshot {
  id: string;
  cellId: number;
  role: string;
  instinct: NPCInstinct;
  temper: NPCTemper;
  needs: NPCNeeds;
  mood: NPCMood;
  beliefs: NPCBelief[];
  socialLinks: NPCSocialLink[];
  scheduleState: ActionUtilityChoice;
  burgFood: number;
  burgWealth: number;
  burgUnrest: number;
  burgCrime: number;
}

export interface ActiveTradeRouteSnapshot {
  sourceBurgId: number;
  destBurgId: number;
  volume: number;
  riskLevel: number;
  srcFood: number;
  dstFood: number;
}

export interface DeceasedNpcSnapshot {
  id: string;
  cellId: number;
  burgId: number | null;
  role: string;
  recent: boolean;
}

export interface NpcRoutinesSnapshot {
  tick: number;
  loreDate: string;
  livingNpcs: LivingNpcRoutineSnapshot[];
  recentEvents: Array<{ burgId: number; type: string; message: string; tier?: string | undefined }>;
  activeRoutes: ActiveTradeRouteSnapshot[];
  deceasedNpcs: DeceasedNpcSnapshot[];
}

/**
 * Pure NPC Routines & Logistics step: updates daily NPC cognition, resolves caravan route
 * ambushes/deliveries, and deducts economic penalties once per newly slain producer NPC.
 */
export function stepNpcRoutines(
  snap: NpcRoutinesSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  if (snap.livingNpcs.length > 0) {
    const eventsByBurg = new Map<number, Array<{ type: string; message: string; tier?: string }>>();
    for (const ev of snap.recentEvents) {
      let list = eventsByBurg.get(ev.burgId);
      if (!list) {
        list = [];
        eventsByBurg.set(ev.burgId, list);
      }
      list.push({ type: ev.type, message: ev.message, ...(ev.tier !== undefined ? { tier: ev.tier } : {}) });
    }

    for (const npc of snap.livingNpcs) {
      const env: BurgEnvironmentalContext = {
        burgId: npc.cellId,
        foodStock: npc.burgFood,
        wealth: npc.burgWealth,
        unrest: npc.burgUnrest,
        crimeRate: npc.burgCrime,
        recentEvents: eventsByBurg.get(npc.cellId) || [],
        isDaytime: true,
        diurnalPhase: "MIDDAY",
      };

      const mindState: NPCMindState = {
        npcId: npc.id,
        role: npc.role || "Citizen",
        instinct: npc.instinct || "WARY",
        temper: npc.temper || "STOIC",
        needs: npc.needs,
        mood: npc.mood,
        beliefs: npc.beliefs,
        socialLinks: npc.socialLinks,
        lastAction: npc.scheduleState || "ROUTINE_WORK",
      };

      const evalResult = evaluateNPCMind(mindState, env, 24);
      deltas.push({
        kind: "npcInstance.update",
        npcId: npc.id,
        needs: evalResult.nextNeeds as unknown as Record<string, number>,
        mood: evalResult.nextMood as unknown as Record<string, number>,
        beliefs: evalResult.nextBeliefs,
        disposition: evalResult.dispositionToPlayer,
        tradePriceMult: evalResult.tradePriceMultiplier,
      });
    }
  }

  for (const route of snap.activeRoutes) {
    if (route.srcFood > 400 && route.dstFood < 200) {
      const transferFood = Math.min(60, Math.floor(route.volume * 0.4));
      const ambushRoll = random() * 100;
      const isAmbushed = ambushRoll < route.riskLevel * 15;

      if (isAmbushed) {
        deltas.push({
          kind: "burg.adjust",
          burgId: route.sourceBurgId,
          food: -transferFood,
        });
        deltas.push({
          kind: "fringeLair.addRations",
          burgId: route.destBurgId,
          rations: transferFood,
        });
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "CARAVAN_AMBUSH",
          message: `Trade convoy from Burg ${route.sourceBurgId} toward Burg ${route.destBurgId} was plundered by highway outlaws! Food failed to arrive.`,
          tier: "MINOR",
          burgId: route.destBurgId,
          loreDate: snap.loreDate,
        });
      } else {
        deltas.push({
          kind: "burg.adjust",
          burgId: route.sourceBurgId,
          food: -transferFood,
        });
        deltas.push({
          kind: "burg.adjust",
          burgId: route.destBurgId,
          food: transferFood,
          unrest: -2,
        });
      }
    }
  }

  for (const dead of snap.deceasedNpcs) {
    if (dead.recent && dead.burgId !== null) {
      if (dead.role.includes("Smith") || dead.role.includes("Artisan")) {
        deltas.push({ kind: "burg.adjust", burgId: dead.burgId, refinedGoods: -15 });
      } else if (dead.role.includes("Provisioner") || dead.role.includes("Trapper") || dead.role.includes("Farmer")) {
        deltas.push({ kind: "burg.adjust", burgId: dead.burgId, food: -10 });
      }
    }
    deltas.push({
      kind: "npcInstance.update",
      npcId: dead.id,
      processedForEconomy: true,
    });
  }

  return deltas;
}
