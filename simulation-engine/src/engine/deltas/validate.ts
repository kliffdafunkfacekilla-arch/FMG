import type { Db, Delta, RejectedDelta, ValidateResult } from "./types.js";

const KNOWN_KINDS = new Set<string>([
  "burg.adjust",
  "burg.set",
  "cell.adjust",
  "cell.set",
  "cell.setFaction",
  "citizen.status",
  "citizen.move",
  "citizen.tagBurg",
  "agent.update",
  "agent.create",
  "agent.remove",
  "tags.add",
  "tags.remove",
  "event.log",
  "thread.open",
  "scheduled.add",
  "weatherFront.update",
  "weatherFront.create",
  "weatherFront.remove",
  "chaosZone.upsert",
  "chaosZone.adjust",
  "chaosZone.remove",
  "chaosFlow.update",
  "calendar.set",
  "entity.create",
  "entity.die",
  "citizen.killOne",
  "paragon.die",
  "burg.militaryAdjust",
  "infrastructure.adjust",
  "overlay.add",
  "standing.adjust",
  "diplomacy.endWars",
  "market.setGoods",
  "commodity.set",
  "grindCanyon.update",
  "grindCanyon.create",
  "outlawFaction.adjust",
  "fringeLair.mutate",
  "culture.adjustCells",
  "religion.adjustCells",
  "npcInstance.update",
  "fringeLair.addRations",
  "sectorLayer.update",
  "grove.adjust",
  "ancientWard.recharge",
  "ancientWard.discharge",
  "burg.createSatellite",
  "paragon.setCorruption",
  "faction.update",
  "factionUnit.update",
  "diplomacy.upsert",
]);

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function finiteOrReject(nums: Array<[string, number | undefined]>): string | null {
  for (const [k, v] of nums) {
    if (v !== undefined && !Number.isFinite(v)) {
      return `Non-finite number for ${k}`;
    }
  }
  return null;
}

/**
 * Validates existence of all referenced entity IDs (at most 1 SQL query per table), rejects malformed
 * or unknown deltas, and clamps absolute numeric fields to canonical simulation bounds.
 */
export async function validateDeltas(deltas: Delta[], db: Db): Promise<ValidateResult> {
  if (deltas.length === 0) return { ok: [], rejected: [] };

  const burgIds = new Set<number>();
  const cellIds = new Set<number>();
  const citizenIds = new Set<number>();
  const paragonIds = new Set<number>();
  const agentIds = new Set<number>();
  const factionIds = new Set<number>();
  const standingEntityRefs = new Set<string>();
  const marketIds = new Set<number>();
  const commodityNames = new Set<string>();
  const canyonIds = new Set<number>();
  const outlawIds = new Set<number>();
  const chaosFlowIds = new Set<number>();
  const cultureIds = new Set<number>();
  const religionIds = new Set<number>();
  const npcInstanceIds = new Set<string>();
  const groveIds = new Set<number>();
  const ancientWardIds = new Set<number>();
  const factionUnitIds = new Set<number>();

  const structuralErrors = new Map<number, string>();

  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    if (!d || typeof d !== "object" || !KNOWN_KINDS.has((d as any).kind)) {
      structuralErrors.set(i, `Unknown delta kind: ${(d as any)?.kind}`);
      continue;
    }

    switch (d.kind) {
      case "burg.adjust": {
        const err = finiteOrReject([
          ["burgId", d.burgId],
          ["food", d.food],
          ["wealth", d.wealth],
          ["unrest", d.unrest],
          ["health", d.health],
          ["crime", d.crime],
          ["rawMaterials", d.rawMaterials],
          ["refinedGoods", d.refinedGoods],
          ["popNull", d.popNull],
          ["popAttuned", d.popAttuned],
        ]);
        if (err) structuralErrors.set(i, err);
        else burgIds.add(d.burgId);
        break;
      }
      case "burg.set": {
        const f = d.fields || {};
        const err = finiteOrReject([
          ["burgId", d.burgId],
          ["food", f.food],
          ["wealth", f.wealth],
          ["unrest", f.unrest],
          ["health", f.health],
          ["crime_rate", f.crime_rate],
          ["raw_materials", f.raw_materials],
          ["refined_goods", f.refined_goods],
          ["pop_null", f.pop_null],
          ["pop_attuned", f.pop_attuned],
          ["urban_tier", f.urban_tier],
          ["occupation_ticks", f.occupation_ticks],
          ["resistance_strength", f.resistance_strength],
        ]);
        if (err) structuralErrors.set(i, err);
        else if (f.military_forces !== undefined && typeof f.military_forces !== "string") {
          structuralErrors.set(i, "Invalid military_forces in burg.set");
        } else {
          burgIds.add(d.burgId);
          if (typeof f.occupier_faction_id === "number" && f.occupier_faction_id > 0) {
            factionIds.add(f.occupier_faction_id);
          }
        }
        break;
      }
      case "cell.adjust": {
        const err = finiteOrReject([
          ["cellId", d.cellId],
          ["ecoHealth", d.ecoHealth],
          ["ecoMax", d.ecoMax],
          ["ecoPlants", d.ecoPlants],
          ["ecoPrey", d.ecoPrey],
          ["ecoPredators", d.ecoPredators],
          ["ecoApex", d.ecoApex],
          ["ecoBlight", d.ecoBlight],
          ["currentTemp", d.currentTemp],
        ]);
        if (err) structuralErrors.set(i, err);
        else cellIds.add(d.cellId);
        break;
      }
      case "cell.set": {
        const f = d.fields || {};
        const err = finiteOrReject([
          ["cellId", d.cellId],
          ["current_temp", f.current_temp],
          ["eco_plants", f.eco_plants],
          ["eco_prey", f.eco_prey],
          ["eco_predators", f.eco_predators],
          ["eco_apex", f.eco_apex],
          ["eco_blight", f.eco_blight],
          ["eco_health", f.eco_health],
          ["eco_max", f.eco_max],
          ["culture_id", f.culture_id],
          ["religion_id", f.religion_id],
        ]);
        if (err) structuralErrors.set(i, err);
        else cellIds.add(d.cellId);
        break;
      }
      case "cell.setFaction": {
        if (!Number.isFinite(d.cellId)) structuralErrors.set(i, "Non-finite cellId");
        else {
          cellIds.add(d.cellId);
          if (typeof d.factionId === "number" && d.factionId > 0) factionIds.add(d.factionId);
        }
        break;
      }
      case "diplomacy.endWars": {
        if (!Number.isFinite(d.factionId) || d.factionId <= 0) structuralErrors.set(i, "Invalid diplomacy.endWars factionId");
        else factionIds.add(d.factionId);
        break;
      }
      case "citizen.status": {
        if (!Number.isFinite(d.citizenId) || !d.status) structuralErrors.set(i, "Invalid citizen.status");
        else citizenIds.add(d.citizenId);
        break;
      }
      case "citizen.move": {
        const err = finiteOrReject([
          ["citizenId", d.citizenId],
          ["settlementId", d.settlementId],
          ["homeCellId", d.homeCellId],
        ]);
        if (err) structuralErrors.set(i, err);
        else {
          citizenIds.add(d.citizenId);
          burgIds.add(d.settlementId);
          cellIds.add(d.homeCellId);
        }
        break;
      }
      case "citizen.tagBurg": {
        const err = finiteOrReject([
          ["burgId", d.burgId],
          ["randomSeed", d.randomSeed],
          ["limit", d.limit],
        ]);
        if (err) structuralErrors.set(i, err);
        else if (!Array.isArray(d.tags) || d.tags.length === 0) structuralErrors.set(i, "Empty tags in citizen.tagBurg");
        else burgIds.add(d.burgId);
        break;
      }
      case "agent.update": {
        const f = d.fields || {};
        const err = finiteOrReject([
          ["agentId", d.agentId],
          ["location_cell_id", f.location_cell_id],
          ["target_grove_id", f.target_grove_id ?? undefined],
          ["corruption", f.corruption],
          ["drained_power", f.drained_power],
          ["age_ticks", f.age_ticks],
        ]);
        if (err) structuralErrors.set(i, err);
        else {
          agentIds.add(d.agentId);
          if (typeof f.location_cell_id === "number") cellIds.add(f.location_cell_id);
          if (typeof f.target_cell_id === "number") cellIds.add(f.target_cell_id);
        }
        break;
      }
      case "agent.create": {
        const err = finiteOrReject([
          ["locationCellId", d.locationCellId],
          ["targetCellId", d.targetCellId ?? undefined],
          ["targetGroveId", d.targetGroveId ?? undefined],
          ["homeBurgId", d.homeBurgId ?? undefined],
          ["factionId", d.factionId ?? undefined],
          ["corruption", d.corruption],
          ["drainedPower", d.drainedPower],
          ["ageTicks", d.ageTicks],
          ["createdTick", d.createdTick],
        ]);
        if (err || !d.name || !d.role || !d.state) {
          structuralErrors.set(i, err || "Invalid agent.create payload");
        } else {
          cellIds.add(d.locationCellId);
          if (typeof d.targetCellId === "number") cellIds.add(d.targetCellId);
          if (typeof d.homeBurgId === "number" && d.homeBurgId > 0) burgIds.add(d.homeBurgId);
          if (typeof d.factionId === "number" && d.factionId > 0) factionIds.add(d.factionId);
        }
        break;
      }
      case "agent.remove": {
        const err = finiteOrReject([["agentId", d.agentId], ["diedTick", d.diedTick]]);
        if (err) structuralErrors.set(i, err);
        else agentIds.add(d.agentId);
        break;
      }
      case "tags.add":
      case "tags.remove": {
        if (!Array.isArray(d.tags) || d.tags.length === 0) {
          structuralErrors.set(i, `Empty tags in ${d.kind}`);
        } else if (d.target.kind === "cell") {
          if (!Number.isFinite(d.target.cellId)) structuralErrors.set(i, "Non-finite cellId");
          else cellIds.add(d.target.cellId);
        } else if (d.kind === "tags.add" && d.target.kind === "citizen") {
          if (!Number.isFinite(d.target.citizenId)) structuralErrors.set(i, "Non-finite citizenId");
          else citizenIds.add(d.target.citizenId);
        } else {
          structuralErrors.set(i, `Unsupported ${d.kind} target`);
        }
        break;
      }
      case "event.log": {
        const err = finiteOrReject([
          ["tick", d.tick],
          ["burgId", d.burgId],
          ["cellId", d.cellId],
          ["factionId", d.factionId],
          ["outlawId", d.outlawId],
          ["zLayer", d.zLayer],
        ]);
        if (err || !d.type || !d.message) structuralErrors.set(i, err || "Missing type/message in event.log");
        else {
          if (d.burgId !== undefined && d.burgId > 0) burgIds.add(d.burgId);
          if (d.cellId !== undefined && d.cellId > 0) cellIds.add(d.cellId);
          if (d.factionId !== undefined && d.factionId > 0) factionIds.add(d.factionId);
        }
        break;
      }
      case "thread.open": {
        if (!d.spec || !d.spec.question || !Number.isFinite(d.spec.cell_id)) {
          structuralErrors.set(i, "Invalid thread.open spec");
        } else if (d.spec.cell_id > 0) {
          cellIds.add(d.spec.cell_id);
        }
        break;
      }
      case "scheduled.add": {
        if (!d.at || !Number.isFinite(d.at.tick) || !d.event?.kind) {
          structuralErrors.set(i, "Invalid scheduled.add");
        }
        break;
      }
      case "weatherFront.update": {
        const err = finiteOrReject([["frontId", d.frontId], ["x", d.x], ["y", d.y], ["lifetime", d.lifetime]]);
        if (err) structuralErrors.set(i, err);
        break;
      }
      case "weatherFront.create": {
        const err = finiteOrReject([
          ["x", d.x], ["y", d.y], ["dx", d.dx], ["dy", d.dy], ["radius", d.radius], ["lifetime", d.lifetime],
        ]);
        if (err || !d.type) structuralErrors.set(i, err || "Missing weatherFront type");
        break;
      }
      case "weatherFront.remove": {
        if (!Number.isFinite(d.frontId)) structuralErrors.set(i, "Non-finite frontId");
        break;
      }
      case "chaosZone.upsert": {
        const err = finiteOrReject([["cellId", d.cellId], ["intensity", d.intensity]]);
        if (err || !d.type) structuralErrors.set(i, err || "Invalid chaosZone.upsert");
        else cellIds.add(d.cellId);
        break;
      }
      case "chaosZone.adjust": {
        const err = finiteOrReject([["cellId", d.cellId], ["intensityDelta", d.intensityDelta]]);
        if (err) structuralErrors.set(i, err);
        else if (d.cellId !== undefined) cellIds.add(d.cellId);
        break;
      }
      case "calendar.set": {
        const err = finiteOrReject([
          ["id", d.id], ["tick", d.tick], ["year", d.year], ["month", d.month], ["dayOfMonth", d.dayOfMonth], ["dayOfYear", d.dayOfYear],
        ]);
        if (err) structuralErrors.set(i, err);
        break;
      }
      case "entity.create": {
        if (!d.ref || !d.name || !d.sourceTable || !d.sourceId) {
          structuralErrors.set(i, "Invalid entity.create");
        }
        break;
      }
      case "entity.die": {
        if (!d.ref || !Number.isFinite(d.diedTick)) {
          structuralErrors.set(i, "Invalid entity.die");
        }
        break;
      }
      case "citizen.killOne": {
        const err = finiteOrReject([["citizenId", d.citizenId], ["diedTick", d.diedTick]]);
        if (err || !d.cause) structuralErrors.set(i, err || "Missing cause in citizen.killOne");
        else citizenIds.add(d.citizenId);
        break;
      }
      case "paragon.die": {
        const err = finiteOrReject([["paragonId", d.paragonId], ["diedTick", d.diedTick]]);
        if (err) structuralErrors.set(i, err);
        else paragonIds.add(d.paragonId);
        break;
      }
      case "burg.militaryAdjust": {
        const err = finiteOrReject([["burgId", d.burgId], ["delta", d.delta]]);
        if (err || !d.unitType) structuralErrors.set(i, err || "Missing unitType in burg.militaryAdjust");
        else burgIds.add(d.burgId);
        break;
      }
      case "infrastructure.adjust": {
        const err = finiteOrReject([["burgId", d.burgId], ["levelDelta", d.levelDelta]]);
        if (err || !d.infraType) structuralErrors.set(i, err || "Missing infraType in infrastructure.adjust");
        else burgIds.add(d.burgId);
        break;
      }
      case "overlay.add": {
        const err = finiteOrReject([
          ["cellId", d.cellId],
          ["rx", d.rx],
          ["ry", d.ry],
          ["z", d.z],
          ["tick", d.tick],
          ["minute", d.minute],
        ]);
        if (err || !d.change || !d.source) {
          structuralErrors.set(i, err || "Missing change/source in overlay.add");
        } else if (d.cellId > 0) {
          cellIds.add(d.cellId);
        }
        break;
      }
      case "standing.adjust": {
        const err = finiteOrReject([
          ["delta", d.delta],
          ["tick", d.tick],
        ]);
        const subject = String(d.subjectRef || "").trim();
        const party = String(d.partyRef || "").trim();
        const reason = String(d.reason || "").trim();
        if (err || !subject || !party || !reason) {
          structuralErrors.set(i, err || "Invalid standing.adjust payload");
        } else if (subject.startsWith("faction:")) {
          const fid = Number(subject.slice("faction:".length));
          if (!Number.isInteger(fid) || fid <= 0) {
            structuralErrors.set(i, `Invalid faction standing ref "${subject}"`);
          } else {
            factionIds.add(fid);
          }
        } else {
          standingEntityRefs.add(subject);
        }
        break;
      }
      case "market.setGoods": {
        if (!Number.isFinite(d.marketId) || !d.goods || typeof d.goods !== "object" || Array.isArray(d.goods)) {
          structuralErrors.set(i, "Invalid market.setGoods payload");
        } else {
          let bad = false;
          for (const g of Object.values(d.goods)) {
            if (!g || !Number.isFinite(g.price) || !Number.isFinite(g.stock) || !Number.isFinite(g.refStock)) {
              bad = true;
              break;
            }
          }
          if (bad) structuralErrors.set(i, "Non-finite goods entry in market.setGoods");
          else marketIds.add(d.marketId);
        }
        break;
      }
      case "commodity.set": {
        const err = finiteOrReject([
          ["currentPrice", d.currentPrice],
          ["globalSupply", d.globalSupply],
          ["globalDemand", d.globalDemand],
          ["lastUpdatedTick", d.lastUpdatedTick],
        ]);
        if (err || !d.commodity || typeof d.commodity !== "string") {
          structuralErrors.set(i, err || "Missing commodity in commodity.set");
        } else {
          commodityNames.add(d.commodity);
        }
        break;
      }
      case "grindCanyon.update": {
        const err = finiteOrReject([
          ["canyonId", d.canyonId],
          ["richnessDelta", d.richnessDelta],
          ["stabilityTicksRemaining", d.stabilityTicksRemaining],
          ["closedTick", d.closedTick],
        ]);
        const validStatus = d.status === undefined || d.status === "OPEN" || d.status === "COLLAPSING" || d.status === "SEALED";
        if (err || !validStatus) structuralErrors.set(i, err || "Invalid status in grindCanyon.update");
        else canyonIds.add(d.canyonId);
        break;
      }
      case "grindCanyon.create": {
        const err = finiteOrReject([
          ["cellId", d.cellId],
          ["sectorX", d.sectorX],
          ["sectorY", d.sectorY],
          ["depthMeters", d.depthMeters],
          ["dragonstoneRichness", d.dragonstoneRichness],
          ["artifactsRemaining", d.artifactsRemaining],
          ["stabilityTicksRemaining", d.stabilityTicksRemaining],
          ["totalDurationTicks", d.totalDurationTicks],
          ["activeMiners", d.activeMiners],
          ["openedTick", d.openedTick],
        ]);
        const validStatus = d.status === "OPEN" || d.status === "COLLAPSING" || d.status === "SEALED";
        if (err || !validStatus || !d.name || !d.dragonName || !d.dragonDomain || !d.minerCrewName) {
          structuralErrors.set(i, err || "Invalid grindCanyon.create payload");
        } else {
          cellIds.add(d.cellId);
        }
        break;
      }
      case "outlawFaction.adjust": {
        const err = finiteOrReject([
          ["outlawId", d.outlawId],
          ["wealthDelta", d.wealthDelta],
          ["manpowerDelta", d.manpowerDelta],
          ["heatDelta", d.heatDelta],
        ]);
        if (err) structuralErrors.set(i, err);
        else outlawIds.add(d.outlawId);
        break;
      }
      case "fringeLair.mutate": {
        const err = finiteOrReject([
          ["factionId", d.factionId],
          ["cellId", d.cellId],
          ["burgId", d.burgId ?? undefined],
          ["manpower", d.manpower],
          ["heat", d.heat],
        ]);
        const validAction = d.action === "upsert" || d.action === "deleteByFactionCell";
        if (err || !validAction || (d.action === "upsert" && !d.lairType)) {
          structuralErrors.set(i, err || "Invalid fringeLair.mutate payload");
        } else {
          outlawIds.add(d.factionId);
          cellIds.add(d.cellId);
          if (typeof d.burgId === "number" && d.burgId > 0) burgIds.add(d.burgId);
        }
        break;
      }
      case "chaosZone.remove": {
        if (!Number.isFinite(d.cellId) || !d.type) {
          structuralErrors.set(i, "Invalid chaosZone.remove payload");
        } else {
          cellIds.add(d.cellId);
        }
        break;
      }
      case "chaosFlow.update": {
        const err = finiteOrReject([
          ["flowId", d.flowId],
          ["currentSurge", d.currentSurge],
          ["currentWidth", d.currentWidth],
        ]);
        if (err || !Array.isArray(d.waypoints) || !Array.isArray(d.narrowSpots)) {
          structuralErrors.set(i, err || "Invalid chaosFlow.update payload");
        } else {
          chaosFlowIds.add(d.flowId);
        }
        break;
      }
      case "culture.adjustCells": {
        const err = finiteOrReject([["cultureId", d.cultureId], ["delta", d.delta]]);
        if (err) structuralErrors.set(i, err);
        else cultureIds.add(d.cultureId);
        break;
      }
      case "religion.adjustCells": {
        const err = finiteOrReject([["religionId", d.religionId], ["delta", d.delta]]);
        if (err) structuralErrors.set(i, err);
        else religionIds.add(d.religionId);
        break;
      }
      case "npcInstance.update": {
        const err = finiteOrReject([
          ["disposition", d.disposition],
          ["tradePriceMult", d.tradePriceMult],
        ]);
        if (err || !d.npcId || typeof d.npcId !== "string") {
          structuralErrors.set(i, err || "Invalid npcInstance.update payload");
        } else {
          npcInstanceIds.add(d.npcId);
        }
        break;
      }
      case "fringeLair.addRations": {
        const err = finiteOrReject([["burgId", d.burgId], ["rations", d.rations]]);
        if (err || d.rations <= 0) {
          structuralErrors.set(i, err || "Invalid fringeLair.addRations payload");
        } else {
          burgIds.add(d.burgId);
        }
        break;
      }
      case "sectorLayer.update": {
        const err = finiteOrReject([
          ["cellId", d.cellId],
          ["rx", d.rx],
          ["ry", d.ry],
          ["zLayer", d.zLayer],
        ]);
        if (err || !Array.isArray(d.npcs) || !Array.isArray(d.props) || !d.features || typeof d.features !== "object") {
          structuralErrors.set(i, err || "Invalid sectorLayer.update payload");
        } else {
          cellIds.add(d.cellId);
        }
        break;
      }
      case "grove.adjust": {
        const err = finiteOrReject([["groveId", d.groveId], ["sealDelta", d.sealDelta]]);
        if (err) structuralErrors.set(i, err);
        else groveIds.add(d.groveId);
        break;
      }
      case "ancientWard.recharge": {
        const err = finiteOrReject([["tick", d.tick]]);
        if (err) structuralErrors.set(i, err);
        break;
      }
      case "ancientWard.discharge": {
        const err = finiteOrReject([["wardId", d.wardId], ["tick", d.tick]]);
        if (err) structuralErrors.set(i, err);
        else ancientWardIds.add(d.wardId);
        break;
      }
      case "burg.createSatellite": {
        const err = finiteOrReject([
          ["burgId", d.burgId],
          ["cellId", d.cellId],
          ["parentBurgId", d.parentBurgId],
          ["parentCellId", d.parentCellId],
          ["popNull", d.popNull],
          ["popAttuned", d.popAttuned],
          ["wealth", d.wealth],
          ["food", d.food],
        ]);
        const validTypes = new Set(["HAMLET", "FARMLAND", "LOGGING", "WATCHTOWER"]);
        if (
          err ||
          d.burgId <= 0 ||
          !d.name ||
          !d.name.trim() ||
          !d.roadName ||
          !d.roadName.trim() ||
          !validTypes.has(d.settlementType)
        ) {
          structuralErrors.set(i, err || "Invalid burg.createSatellite payload");
        } else {
          burgIds.add(d.parentBurgId);
          cellIds.add(d.cellId);
          cellIds.add(d.parentCellId);
        }
        break;
      }
      case "paragon.setCorruption": {
        const err = finiteOrReject([
          ["paragonId", d.paragonId],
          ["corruptionScore", d.corruptionScore],
        ]);
        if (err) structuralErrors.set(i, err);
        else paragonIds.add(d.paragonId);
        break;
      }
      case "faction.update": {
        const err = finiteOrReject([
          ["factionId", d.factionId],
          ["treasurySet", d.treasurySet],
          ["treasuryDelta", d.treasuryDelta],
        ]);
        if (err) structuralErrors.set(i, err);
        else factionIds.add(d.factionId);
        break;
      }
      case "factionUnit.update": {
        const err = finiteOrReject([
          ["unitId", d.unitId],
          ["count", d.count],
        ]);
        if (err || !d.status || !d.status.trim()) {
          structuralErrors.set(i, err || "Invalid factionUnit.update payload");
        } else {
          factionUnitIds.add(d.unitId);
        }
        break;
      }
      case "diplomacy.upsert": {
        const err = finiteOrReject([
          ["factionAId", d.factionAId],
          ["factionBId", d.factionBId],
          ["tension", d.tension],
        ]);
        if (err || !d.status || !d.status.trim() || d.factionAId === d.factionBId) {
          structuralErrors.set(i, err || "Invalid diplomacy.upsert payload");
        } else {
          factionIds.add(d.factionAId);
          factionIds.add(d.factionBId);
        }
        break;
      }
    }
  }

  const validBurgs = new Set<number>();
  if (burgIds.size > 0) {
    const res = await db.query(`SELECT burg_id FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`, [Array.from(burgIds)]);
    for (const r of res.rows) validBurgs.add(Number(r.burg_id));
  }

  const validCells = new Set<number>();
  if (cellIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_cells WHERE id = ANY($1::int[])`, [Array.from(cellIds)]);
    for (const r of res.rows) validCells.add(Number(r.id));
  }

  const validCitizens = new Set<number>();
  if (citizenIds.size > 0) {
    const res = await db.query(`SELECT citizen_id FROM population_demographics WHERE citizen_id = ANY($1::int[])`, [Array.from(citizenIds)]);
    for (const r of res.rows) validCitizens.add(Number(r.citizen_id));
  }

  const validParagons = new Set<number>();
  if (paragonIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_paragons WHERE id = ANY($1::int[])`, [Array.from(paragonIds)]);
    for (const r of res.rows) validParagons.add(Number(r.id));
  }

  const validAgents = new Set<number>();
  if (agentIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_agents WHERE id = ANY($1::int[])`, [Array.from(agentIds)]);
    for (const r of res.rows) validAgents.add(Number(r.id));
  }

  const validFactions = new Set<number>();
  if (factionIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_factions WHERE id = ANY($1::int[])`, [Array.from(factionIds)]);
    for (const r of res.rows) validFactions.add(Number(r.id));
  }

  const validMarkets = new Set<number>();
  if (marketIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_markets WHERE id = ANY($1::int[])`, [Array.from(marketIds)]);
    for (const r of res.rows) validMarkets.add(Number(r.id));
  }

  const validCommodities = new Set<string>();
  if (commodityNames.size > 0) {
    const res = await db.query(`SELECT commodity FROM sim_commodity_prices WHERE commodity = ANY($1::text[])`, [Array.from(commodityNames)]);
    for (const r of res.rows) validCommodities.add(String(r.commodity));
  }

  const validCanyons = new Set<number>();
  if (canyonIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_grind_canyons WHERE id = ANY($1::int[])`, [Array.from(canyonIds)]);
    for (const r of res.rows) validCanyons.add(Number(r.id));
  }

  const validOutlaws = new Set<number>();
  if (outlawIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_outlaw_factions WHERE id = ANY($1::int[])`, [Array.from(outlawIds)]);
    for (const r of res.rows) validOutlaws.add(Number(r.id));
  }

  const validChaosFlows = new Set<number>();
  if (chaosFlowIds.size > 0) {
    const res = await db.query(`SELECT flow_id FROM sim_chaos_flows WHERE flow_id = ANY($1::int[])`, [Array.from(chaosFlowIds)]);
    for (const r of res.rows) validChaosFlows.add(Number(r.flow_id));
  }

  const validCultures = new Set<number>();
  if (cultureIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_cultures WHERE id = ANY($1::int[])`, [Array.from(cultureIds)]);
    for (const r of res.rows) validCultures.add(Number(r.id));
  }

  const validReligions = new Set<number>();
  if (religionIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_religions WHERE id = ANY($1::int[])`, [Array.from(religionIds)]);
    for (const r of res.rows) validReligions.add(Number(r.id));
  }

  const validNpcInstances = new Set<string>();
  if (npcInstanceIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_npc_instances WHERE id = ANY($1::text[])`, [Array.from(npcInstanceIds)]);
    for (const r of res.rows) validNpcInstances.add(String(r.id));
  }

  const validGroves = new Set<number>();
  if (groveIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_sacred_groves WHERE id = ANY($1::int[])`, [Array.from(groveIds)]);
    for (const r of res.rows) validGroves.add(Number(r.id));
  }

  const validAncientWards = new Set<number>();
  if (ancientWardIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_ancient_path_wards WHERE id = ANY($1::int[])`, [Array.from(ancientWardIds)]);
    for (const r of res.rows) validAncientWards.add(Number(r.id));
  }

  const validFactionUnits = new Set<number>();
  if (factionUnitIds.size > 0) {
    const res = await db.query(`SELECT id FROM sim_faction_units WHERE id = ANY($1::int[])`, [Array.from(factionUnitIds)]);
    for (const r of res.rows) validFactionUnits.add(Number(r.id));
  }

  const validStandingEntities = new Set<string>();
  if (standingEntityRefs.size > 0) {
    const entCheck = await db.query(`SELECT to_regclass('entities') IS NOT NULL AS ready`);
    if (entCheck.rows[0]?.ready) {
      const res = await db.query(`SELECT ref FROM entities WHERE ref = ANY($1::text[])`, [Array.from(standingEntityRefs)]);
      for (const r of res.rows) validStandingEntities.add(String(r.ref));
    }
  }

  const ok: Delta[] = [];
  const rejected: RejectedDelta[] = [];

  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i]!;
    const structErr = structuralErrors.get(i);
    if (structErr) {
      rejected.push({ delta: d, reason: structErr });
      continue;
    }

    switch (d.kind) {
      case "burg.adjust":
        if (!validBurgs.has(d.burgId)) { rejected.push({ delta: d, reason: `Unknown burgId ${d.burgId}` }); break; }
        ok.push(d);
        break;

      case "burg.set": {
        if (!validBurgs.has(d.burgId)) { rejected.push({ delta: d, reason: `Unknown burgId ${d.burgId}` }); break; }
        const f = { ...d.fields };
        if (typeof f.occupier_faction_id === "number" && f.occupier_faction_id > 0 && !validFactions.has(f.occupier_faction_id)) {
          rejected.push({ delta: d, reason: `Unknown occupier_faction_id ${f.occupier_faction_id}` });
          break;
        }
        if (f.food !== undefined) f.food = Math.max(0, Math.round(f.food));
        if (f.wealth !== undefined) f.wealth = Math.max(0, Math.round(f.wealth));
        if (f.unrest !== undefined) f.unrest = clamp(Math.round(f.unrest), 0, 100);
        if (f.health !== undefined) f.health = clamp(Math.round(f.health), 0, 100);
        if (f.crime_rate !== undefined) f.crime_rate = clamp(f.crime_rate, 0, 100);
        if (f.raw_materials !== undefined) f.raw_materials = Math.max(0, Math.round(f.raw_materials));
        if (f.refined_goods !== undefined) f.refined_goods = Math.max(0, Math.round(f.refined_goods));
        if (f.pop_null !== undefined) f.pop_null = Math.max(0, Math.round(f.pop_null));
        if (f.pop_attuned !== undefined) f.pop_attuned = Math.max(0, Math.round(f.pop_attuned));
        if (f.urban_tier !== undefined) f.urban_tier = Math.max(0, Math.round(f.urban_tier));
        if (f.occupation_ticks !== undefined) f.occupation_ticks = Math.max(0, Math.round(f.occupation_ticks));
        if (f.resistance_strength !== undefined) f.resistance_strength = Math.max(0, Math.round(f.resistance_strength));
        ok.push({ kind: "burg.set", burgId: d.burgId, fields: f });
        break;
      }

      case "cell.adjust":
        if (!validCells.has(d.cellId)) { rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` }); break; }
        ok.push(d);
        break;

      case "cell.set": {
        if (!validCells.has(d.cellId)) { rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` }); break; }
        const f = { ...d.fields };
        if (f.eco_max !== undefined) f.eco_max = Math.max(10, f.eco_max);
        if (f.eco_health !== undefined) f.eco_health = clamp(f.eco_health, 0, f.eco_max ?? 200);
        if (f.eco_plants !== undefined) f.eco_plants = clamp(f.eco_plants, 0, 200);
        if (f.eco_prey !== undefined) f.eco_prey = clamp(f.eco_prey, 0, 100);
        if (f.eco_predators !== undefined) f.eco_predators = clamp(f.eco_predators, 0, 60);
        if (f.eco_apex !== undefined) f.eco_apex = clamp(f.eco_apex, 0, 100);
        if (f.eco_blight !== undefined) f.eco_blight = clamp(f.eco_blight, 0, 100);
        ok.push({ kind: "cell.set", cellId: d.cellId, fields: f });
        break;
      }

      case "cell.setFaction":
        if (!validCells.has(d.cellId)) { rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` }); break; }
        if (typeof d.factionId === "number" && d.factionId > 0 && !validFactions.has(d.factionId)) {
          rejected.push({ delta: d, reason: `Unknown factionId ${d.factionId}` });
          break;
        }
        ok.push(d);
        break;

      case "diplomacy.endWars":
        if (!validFactions.has(d.factionId)) { rejected.push({ delta: d, reason: `Unknown factionId ${d.factionId}` }); break; }
        ok.push(d);
        break;

      case "citizen.status":
        if (!validCitizens.has(d.citizenId)) { rejected.push({ delta: d, reason: `Unknown citizenId ${d.citizenId}` }); break; }
        ok.push(d);
        break;

      case "citizen.move":
        if (!validCitizens.has(d.citizenId)) { rejected.push({ delta: d, reason: `Unknown citizenId ${d.citizenId}` }); break; }
        if (!validBurgs.has(d.settlementId)) { rejected.push({ delta: d, reason: `Unknown settlementId ${d.settlementId}` }); break; }
        if (!validCells.has(d.homeCellId)) { rejected.push({ delta: d, reason: `Unknown homeCellId ${d.homeCellId}` }); break; }
        ok.push(d);
        break;

      case "citizen.tagBurg":
        if (!validBurgs.has(d.burgId)) { rejected.push({ delta: d, reason: `Unknown burgId ${d.burgId}` }); break; }
        ok.push(d);
        break;

      case "agent.update": {
        if (!validAgents.has(d.agentId)) { rejected.push({ delta: d, reason: `Unknown agentId ${d.agentId}` }); break; }
        const f = { ...d.fields };
        if (typeof f.location_cell_id === "number" && !validCells.has(f.location_cell_id)) {
          rejected.push({ delta: d, reason: `Unknown location_cell_id ${f.location_cell_id}` });
          break;
        }
        if (typeof f.target_cell_id === "number" && !validCells.has(f.target_cell_id)) {
          rejected.push({ delta: d, reason: `Unknown target_cell_id ${f.target_cell_id}` });
          break;
        }
        if (f.corruption !== undefined) f.corruption = clamp(Math.round(f.corruption), 0, 100);
        ok.push({ kind: "agent.update", agentId: d.agentId, fields: f });
        break;
      }

      case "agent.create":
        if (!validCells.has(d.locationCellId)) {
          rejected.push({ delta: d, reason: `Unknown agent locationCellId ${d.locationCellId}` });
          break;
        }
        if (typeof d.targetCellId === "number" && !validCells.has(d.targetCellId)) {
          rejected.push({ delta: d, reason: `Unknown agent targetCellId ${d.targetCellId}` });
          break;
        }
        if (typeof d.homeBurgId === "number" && d.homeBurgId > 0 && !validBurgs.has(d.homeBurgId)) {
          rejected.push({ delta: d, reason: `Unknown agent homeBurgId ${d.homeBurgId}` });
          break;
        }
        if (typeof d.factionId === "number" && d.factionId > 0 && !validFactions.has(d.factionId)) {
          rejected.push({ delta: d, reason: `Unknown agent factionId ${d.factionId}` });
          break;
        }
        ok.push({
          ...d,
          corruption: d.corruption !== undefined ? clamp(Math.round(d.corruption), 0, 100) : undefined,
        });
        break;

      case "agent.remove":
        if (!validAgents.has(d.agentId)) { rejected.push({ delta: d, reason: `Unknown agentId ${d.agentId}` }); break; }
        ok.push(d);
        break;

      case "tags.add":
        if (d.target.kind === "cell" && !validCells.has(d.target.cellId)) {
          rejected.push({ delta: d, reason: `Unknown cellId ${d.target.cellId}` });
          break;
        }
        if (d.target.kind === "citizen" && !validCitizens.has(d.target.citizenId)) {
          rejected.push({ delta: d, reason: `Unknown citizenId ${d.target.citizenId}` });
          break;
        }
        ok.push(d);
        break;

      case "tags.remove":
        if (d.target.kind === "cell" && !validCells.has(d.target.cellId)) {
          rejected.push({ delta: d, reason: `Unknown cellId ${d.target.cellId}` });
          break;
        }
        ok.push(d);
        break;

      case "event.log":
        if (d.burgId !== undefined && d.burgId > 0 && !validBurgs.has(d.burgId)) {
          rejected.push({ delta: d, reason: `Unknown burgId ${d.burgId}` });
          break;
        }
        if (d.cellId !== undefined && d.cellId > 0 && !validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` });
          break;
        }
        if (d.factionId !== undefined && d.factionId > 0 && !validFactions.has(d.factionId)) {
          rejected.push({ delta: d, reason: `Unknown factionId ${d.factionId}` });
          break;
        }
        ok.push(d);
        break;

      case "thread.open":
        if (d.spec.cell_id > 0 && !validCells.has(d.spec.cell_id)) {
          rejected.push({ delta: d, reason: `Unknown thread cell_id ${d.spec.cell_id}` });
          break;
        }
        ok.push(d);
        break;

      case "chaosZone.upsert":
        if (!validCells.has(d.cellId)) { rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` }); break; }
        ok.push({ ...d, intensity: clamp(d.intensity, 0, 100) });
        break;

      case "chaosZone.adjust":
        if (d.cellId !== undefined && !validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` });
          break;
        }
        ok.push(d);
        break;

      case "chaosZone.remove":
        if (!validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown cellId ${d.cellId}` });
          break;
        }
        ok.push(d);
        break;

      case "chaosFlow.update":
        if (!validChaosFlows.has(d.flowId)) {
          rejected.push({ delta: d, reason: `Unknown chaosFlow flowId ${d.flowId}` });
          break;
        }
        ok.push(d);
        break;

      case "citizen.killOne":
        if (!validCitizens.has(d.citizenId)) {
          rejected.push({ delta: d, reason: `Unknown citizenId ${d.citizenId}` });
          break;
        }
        ok.push(d);
        break;

      case "paragon.die":
        if (!validParagons.has(d.paragonId)) {
          rejected.push({ delta: d, reason: `Unknown paragonId ${d.paragonId}` });
          break;
        }
        ok.push(d);
        break;

      case "burg.militaryAdjust":
        if (!validBurgs.has(d.burgId)) {
          rejected.push({ delta: d, reason: `Unknown burgId ${d.burgId}` });
          break;
        }
        ok.push(d);
        break;

      case "infrastructure.adjust":
        if (!validBurgs.has(d.burgId)) {
          rejected.push({ delta: d, reason: `Unknown burgId ${d.burgId}` });
          break;
        }
        ok.push(d);
        break;

      case "overlay.add":
        if (d.cellId > 0 && !validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown overlay cellId ${d.cellId}` });
          break;
        }
        ok.push(d);
        break;

      case "standing.adjust": {
        const subject = String(d.subjectRef || "").trim();
        if (subject.startsWith("faction:")) {
          const fid = Number(subject.slice("faction:".length));
          if (!validFactions.has(fid)) {
            rejected.push({ delta: d, reason: `Unknown standing faction ${subject}` });
            break;
          }
        } else if (!validStandingEntities.has(subject)) {
          rejected.push({ delta: d, reason: `Unknown standing entity ${subject}` });
          break;
        }
        ok.push(d);
        break;
      }

      case "market.setGoods":
        if (!validMarkets.has(d.marketId)) {
          rejected.push({ delta: d, reason: `Unknown marketId ${d.marketId}` });
          break;
        }
        ok.push(d);
        break;

      case "commodity.set":
        if (!validCommodities.has(d.commodity)) {
          rejected.push({ delta: d, reason: `Unknown commodity ${d.commodity}` });
          break;
        }
        ok.push({
          ...d,
          currentPrice: Math.max(0, d.currentPrice),
          globalSupply: clamp(Math.round(d.globalSupply), 0, 2147483647),
          globalDemand: clamp(Math.round(d.globalDemand), 0, 2147483647),
          lastUpdatedTick: Math.round(d.lastUpdatedTick),
        });
        break;

      case "grindCanyon.update":
        if (!validCanyons.has(d.canyonId)) {
          rejected.push({ delta: d, reason: `Unknown canyonId ${d.canyonId}` });
          break;
        }
        ok.push(d);
        break;

      case "grindCanyon.create":
        if (!validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown grindCanyon cellId ${d.cellId}` });
          break;
        }
        ok.push(d);
        break;

      case "outlawFaction.adjust":
        if (!validOutlaws.has(d.outlawId)) {
          rejected.push({ delta: d, reason: `Unknown outlawId ${d.outlawId}` });
          break;
        }
        ok.push(d);
        break;

      case "fringeLair.mutate":
        if (!validOutlaws.has(d.factionId)) {
          rejected.push({ delta: d, reason: `Unknown fringeLair factionId ${d.factionId}` });
          break;
        }
        if (!validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown fringeLair cellId ${d.cellId}` });
          break;
        }
        if (typeof d.burgId === "number" && d.burgId > 0 && !validBurgs.has(d.burgId)) {
          rejected.push({ delta: d, reason: `Unknown fringeLair burgId ${d.burgId}` });
          break;
        }
        ok.push(d);
        break;

      case "culture.adjustCells":
        if (!validCultures.has(d.cultureId)) {
          rejected.push({ delta: d, reason: `Unknown cultureId ${d.cultureId}` });
          break;
        }
        ok.push(d);
        break;

      case "religion.adjustCells":
        if (!validReligions.has(d.religionId)) {
          rejected.push({ delta: d, reason: `Unknown religionId ${d.religionId}` });
          break;
        }
        ok.push(d);
        break;

      case "npcInstance.update":
        if (!validNpcInstances.has(d.npcId)) {
          rejected.push({ delta: d, reason: `Unknown npcInstance id ${d.npcId}` });
          break;
        }
        ok.push(d);
        break;

      case "fringeLair.addRations":
        if (!validBurgs.has(d.burgId)) {
          rejected.push({ delta: d, reason: `Unknown fringeLair.addRations burgId ${d.burgId}` });
          break;
        }
        ok.push(d);
        break;

      case "sectorLayer.update":
        if (!validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown sectorLayer cellId ${d.cellId}` });
          break;
        }
        ok.push(d);
        break;

      case "grove.adjust":
        if (!validGroves.has(d.groveId)) {
          rejected.push({ delta: d, reason: `Unknown groveId ${d.groveId}` });
          break;
        }
        ok.push(d);
        break;

      case "ancientWard.recharge":
        ok.push({ kind: "ancientWard.recharge", tick: Math.round(d.tick) });
        break;

      case "ancientWard.discharge":
        if (!validAncientWards.has(d.wardId)) {
          rejected.push({ delta: d, reason: `Unknown ancientWard id ${d.wardId}` });
          break;
        }
        ok.push({ kind: "ancientWard.discharge", wardId: d.wardId, tick: Math.round(d.tick) });
        break;

      case "burg.createSatellite":
        if (!validBurgs.has(d.parentBurgId)) {
          rejected.push({ delta: d, reason: `Unknown parentBurgId ${d.parentBurgId}` });
          break;
        }
        if (!validCells.has(d.cellId)) {
          rejected.push({ delta: d, reason: `Unknown satellite cellId ${d.cellId}` });
          break;
        }
        if (!validCells.has(d.parentCellId)) {
          rejected.push({ delta: d, reason: `Unknown satellite parentCellId ${d.parentCellId}` });
          break;
        }
        ok.push({
          ...d,
          burgId: Math.round(d.burgId),
          popNull: Math.max(0, Math.round(d.popNull)),
          popAttuned: Math.max(0, Math.round(d.popAttuned)),
          wealth: Math.max(0, Math.round(d.wealth)),
          food: Math.max(0, Math.round(d.food)),
        });
        break;

      case "paragon.setCorruption":
        if (!validParagons.has(d.paragonId)) {
          rejected.push({ delta: d, reason: `Unknown paragonId ${d.paragonId}` });
          break;
        }
        ok.push({
          kind: "paragon.setCorruption",
          paragonId: d.paragonId,
          corruptionScore: clamp(Math.round(d.corruptionScore), 0, 100),
        });
        break;

      case "faction.update":
        if (!validFactions.has(d.factionId)) {
          rejected.push({ delta: d, reason: `Unknown factionId ${d.factionId}` });
          break;
        }
        ok.push({
          ...d,
          treasurySet: d.treasurySet !== undefined ? Math.max(0, Math.round(d.treasurySet)) : undefined,
          treasuryDelta: d.treasuryDelta !== undefined ? Math.round(d.treasuryDelta) : undefined,
        });
        break;

      case "factionUnit.update":
        if (!validFactionUnits.has(d.unitId)) {
          rejected.push({ delta: d, reason: `Unknown factionUnit id ${d.unitId}` });
          break;
        }
        ok.push({
          kind: "factionUnit.update",
          unitId: d.unitId,
          count: Math.max(0, Math.round(d.count)),
          status: d.status,
        });
        break;

      case "diplomacy.upsert":
        if (!validFactions.has(d.factionAId)) {
          rejected.push({ delta: d, reason: `Unknown diplomacy factionAId ${d.factionAId}` });
          break;
        }
        if (!validFactions.has(d.factionBId)) {
          rejected.push({ delta: d, reason: `Unknown diplomacy factionBId ${d.factionBId}` });
          break;
        }
        ok.push({
          kind: "diplomacy.upsert",
          factionAId: d.factionAId,
          factionBId: d.factionBId,
          status: d.status,
          tension: clamp(Math.round(d.tension), 0, 100),
        });
        break;

      default:
        ok.push(d);
        break;
    }
  }

  return { ok, rejected };
}
