/**
 * Pure reference mapping and matching helpers between micro map NPC IDs and unified entity refs.
 * Zero DB imports so map generators remain completely pure (Rule 8).
 */

export type EntityKind = "person" | "group" | "creature" | "structure" | "object" | "place";
export type EntityLod = "macro" | "meso" | "micro";

export interface ParsedEntityRef {
  prefix: string;
  rawId: string;
  numericId?: number | undefined;
}

const TYPED_PREFIX_RE = /^(citizen|paragon|agent|player|faction|burg|squad|convoy|wildlife|creature|npcinst|object|place):(.+)$/;

export function parseEntityRef(ref: string): ParsedEntityRef {
  const clean = String(ref || "").trim();
  const m = TYPED_PREFIX_RE.exec(clean);
  if (!m) return { prefix: "unknown", rawId: clean };
  const prefix = m[1]!;
  const rawId = m[2]!;
  const num = /^\d+$/.test(rawId) ? Number(rawId) : undefined;
  return { prefix, rawId, numericId: num };
}

export function mapNpcIdToEntityRef(
  npcId: string,
  loc?: { cellId?: number | undefined; rx?: number | undefined; ry?: number | undefined }
): string {
  const id = String(npcId || "").trim();
  if (!id) return "npcinst:unknown";
  if (TYPED_PREFIX_RE.test(id)) return id;

  const paragon = /^npc_paragon_(\d+)$/.exec(id);
  if (paragon) return `paragon:${paragon[1]}`;

  const citizen = /^npc_(?:citizen|ward|demographic)_(\d+)$/.exec(id);
  if (citizen) return `citizen:${citizen[1]}`;

  const squad = /^npc_mil_squad_(\d+)_(.+)_(\d+)$/.exec(id);
  if (squad) return `squad:${squad[1]}:${squad[2]}:${squad[3]}`;

  const wildAgent = /^npc_wild_(\d+)$/.exec(id);
  if (wildAgent) return `agent:${wildAgent[1]}`;

  const beast = /^npc_(?:burg_sewer_beast|cave_beast|wild_beast)_(.+)$/.exec(id);
  if (beast) {
    return `creature:${loc?.cellId ?? 0}:${loc?.rx ?? 50}:${loc?.ry ?? 50}:${id}`;
  }

  return `npcinst:${id}`;
}

export function inferEntityKindAndSource(
  ref: string,
  npc?: { tags?: string[] | undefined }
): { kind: EntityKind; sourceTable: string; sourceId: string } {
  const parsed = parseEntityRef(ref);
  switch (parsed.prefix) {
    case "paragon":
      return { kind: "person", sourceTable: "sim_paragons", sourceId: parsed.rawId };
    case "citizen":
      return { kind: "person", sourceTable: "population_demographics", sourceId: parsed.rawId };
    case "agent":
      return { kind: "person", sourceTable: "sim_agents", sourceId: parsed.rawId };
    case "player":
      return { kind: "person", sourceTable: "sim_player_character", sourceId: parsed.rawId };
    case "faction":
      return { kind: "group", sourceTable: "sim_factions", sourceId: parsed.rawId };
    case "burg":
      return { kind: "place", sourceTable: "sim_burg_economy", sourceId: parsed.rawId };
    case "squad": {
      const burgId = parsed.rawId.split(":")[0] || "0";
      return { kind: "group", sourceTable: "sim_burg_economy", sourceId: burgId };
    }
    case "convoy":
      return { kind: "group", sourceTable: "sim_trade_shipments", sourceId: parsed.rawId };
    case "wildlife": {
      const cellPart = parsed.rawId.split(":").pop() || parsed.rawId;
      return { kind: "group", sourceTable: "sim_cells", sourceId: cellPart };
    }
    case "creature":
      return { kind: "creature", sourceTable: "sim_sector_layers", sourceId: ref };
    case "object":
      return { kind: "object", sourceTable: "sim_sector_layers", sourceId: ref };
    case "place":
      return { kind: "place", sourceTable: "sim_cells", sourceId: parsed.rawId };
    default: {
      const tags = Array.isArray(npc?.tags) ? npc.tags.map((t) => String(t).toLowerCase()) : [];
      const isCreature = tags.includes("beast") || tags.includes("creature");
      return { kind: isCreature ? "creature" : "person", sourceTable: "sim_npc_instances", sourceId: parsed.rawId };
    }
  }
}

export function npcMatchesRef(npc: any, actorIds: Iterable<string>): boolean {
  const expanded = new Set<string>();
  for (const raw of actorIds) {
    const s = String(raw);
    expanded.add(s);
    if (s.startsWith("npc_")) expanded.add(mapNpcIdToEntityRef(s));
  }
  const id = String(npc?.id ?? "");
  const entityRef = String(npc?.entity_ref ?? "");
  if (entityRef && expanded.has(entityRef)) return true;
  if (id && expanded.has(id)) return true;
  if (id && expanded.has(mapNpcIdToEntityRef(id))) return true;
  return false;
}

export function stampEntityRefsOnNpcs<T extends { id: string; entity_ref?: string | undefined }>(
  npcs: T[],
  loc?: { cellId?: number | undefined; rx?: number | undefined; ry?: number | undefined }
): T[] {
  for (const npc of npcs) {
    if (!npc.entity_ref && npc.id) {
      npc.entity_ref = mapNpcIdToEntityRef(npc.id, loc);
    }
  }
  return npcs;
}
