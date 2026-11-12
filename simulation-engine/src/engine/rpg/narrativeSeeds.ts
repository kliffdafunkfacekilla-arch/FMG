/**
 * Narrative seeds: tags NPCs on a freshly built tactical map with what the simulation already knows
 * about them, so the reaction rules (narrativeReactionEngine.ts) have something to react to.
 *
 * The rules fire on tags like #CorruptOfficial or #CultistInfiltrator, but no map generator ever added
 * them, so threads could only start after someone ran the story director. Every tag here comes from a
 * database fact about that NPC or their burg; nothing is invented (rule 7):
 *
 *   #CorruptOfficial     a paragon whose corruption_score >= 40
 *   #BountyTarget        an outlaw paragon, or a syndicate operative from a lair with heat >= 50
 *   #SyndicatePresence   an operative of a fringe lair in this burg
 *   #CultistInfiltrator  a citizen whose allegiance_status is CULTIST_INFILTRATOR
 *   #HedgeWizard         an operative of a Hedge Wizards lair in this burg
 *   #ExtortionVictim     a trader or innkeeper in a burg where a vice-and-protection syndicate has a lair
 *   #RebelInformant      one craftsperson in a burg with unrest >= 40 or a recent iron curfew
 *   #NightmareAfflicted  a chaos-sensitive citizen (spark tier SENSITIVE/CHANNELER) in a chaos-zone cell
 *
 * NPC ids carry their source record: npc_paragon_<id>, npc_(ward|demographic|citizen)_<citizen_id>,
 * npc_cartel_agent_<lair_id>, and lair resident_npc_ids.
 */

type Db = { query: (text: string, params?: any[]) => Promise<any> };

export interface NarrativeFacts {
  burgId: number | null;
  unrest: number;
  paragons: Map<number, { corruption: number; outlaw: boolean }>;
  cultistCitizens: Set<number>;
  lairs: Array<{ id: number; heat: number; type: string; name: string; residents: string[] }>;
  recentEventTypes: Set<string>;
  chaosIntensity: number;
}

export async function loadNarrativeFacts(db: Db, cellId: number): Promise<NarrativeFacts> {
  const burgRes = await db.query(`SELECT burg_id, unrest FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`, [cellId]);
  const burgId: number | null = burgRes.rows[0]?.burg_id ?? null;
  const facts: NarrativeFacts = {
    burgId,
    unrest: Number(burgRes.rows[0]?.unrest) || 0,
    paragons: new Map(),
    cultistCitizens: new Set(),
    lairs: [],
    recentEventTypes: new Set(),
    chaosIntensity: 0,
  };
  const [paragons, cultists, lairs, events, chaos] = await Promise.all([
    burgId != null
      ? db.query(`SELECT id, corruption_score, outlaw_id FROM sim_paragons WHERE burg_id = $1`, [burgId])
      : Promise.resolve({ rows: [] }),
    db.query(
      `SELECT citizen_id FROM population_demographics
       WHERE (home_cell_id = $1 OR settlement_id = $2) AND allegiance_status = 'CULTIST_INFILTRATOR'`,
      [cellId, burgId ?? -1]
    ),
    db.query(
      `SELECT l.id, l.heat, l.resident_npc_ids, o.type, o.name FROM sim_fringe_lairs l
       JOIN sim_outlaw_factions o ON o.id = l.faction_id WHERE l.burg_id = $1 OR l.cell_id = $2`,
      [burgId ?? -1, cellId]
    ),
    burgId != null
      ? db.query(
          `SELECT DISTINCT type FROM sim_events
           WHERE burg_id = $1 AND tick > (SELECT COALESCE(MAX(tick), 0) - 48 FROM sim_calendar)`,
          [burgId]
        )
      : Promise.resolve({ rows: [] }),
    db.query(`SELECT COALESCE(MAX(intensity), 0) AS i FROM sim_chaos_zones WHERE cell_id = $1`, [cellId]),
  ]);
  for (const p of paragons.rows) facts.paragons.set(Number(p.id), { corruption: Number(p.corruption_score) || 0, outlaw: p.outlaw_id != null });
  for (const c of cultists.rows) facts.cultistCitizens.add(Number(c.citizen_id));
  for (const l of lairs.rows) {
    facts.lairs.push({ id: Number(l.id), heat: Number(l.heat) || 0, type: String(l.type), name: String(l.name), residents: Array.isArray(l.resident_npc_ids) ? l.resident_npc_ids.map(String) : [] });
  }
  for (const e of events.rows) facts.recentEventTypes.add(String(e.type));
  facts.chaosIntensity = Number(chaos.rows[0]?.i) || 0;
  return facts;
}

const addTag = (npc: any, tag: string) => {
  npc.tags = Array.isArray(npc.tags) ? npc.tags : [];
  if (!npc.tags.includes(tag)) { npc.tags.push(tag); return true; }
  return false;
};
const text = (npc: any) => `${npc.role || ""} ${npc.name || ""} ${(npc.tags || []).join(" ")}`.toLowerCase();

/** Adds simulation-backed narrative tags to the NPCs in place. Returns how many tags were added. */
export function seedNarrativeTags(npcs: any[], facts: NarrativeFacts): number {
  let added = 0;
  const lairByOperative = new Map<string, NarrativeFacts["lairs"][0]>();
  for (const l of facts.lairs) {
    lairByOperative.set(`npc_cartel_agent_${l.id}`, l);
    for (const r of l.residents) lairByOperative.set(r, l);
  }

  for (const npc of npcs) {
    const id = String(npc.id || "");
    const paragon = id.match(/^npc_paragon_(\d+)$/);
    if (paragon) {
      const p = facts.paragons.get(Number(paragon[1]));
      if (p && p.corruption >= 40 && addTag(npc, "#CorruptOfficial")) added++;
      if (p?.outlaw && addTag(npc, "#BountyTarget")) added++;
    }
    const citizen = id.match(/^npc_(?:ward|demographic|citizen)_(\d+)$/);
    if (citizen && facts.cultistCitizens.has(Number(citizen[1])) && addTag(npc, "#CultistInfiltrator")) added++;

    const lair = lairByOperative.get(id);
    if (lair) {
      if (addTag(npc, "#SyndicatePresence")) added++;
      if (lair.heat >= 50 && addTag(npc, "#BountyTarget")) added++;
      if (lair.name === "The Hedge Wizards" && addTag(npc, "#HedgeWizard")) added++;
    }
  }

  // Burg-level facts land on fitting residents
  const hasProtectionRacket = facts.lairs.some(l => l.type === "VICE_AND_PROTECTION_ARM");
  if (hasProtectionRacket) {
    const traders = npcs.filter(n => /merchant|trader|shop|vendor|inn|tavern|peddler|chandler/.test(text(n)) && !lairByOperative.has(String(n.id)));
    for (const n of traders.slice(0, 2)) if (addTag(n, "#ExtortionVictim")) added++;
  }

  const unrestSignal = facts.unrest >= 40 || facts.recentEventTypes.has("COMMANDER_IRON_CURFEW");
  if (unrestSignal) {
    const crafts = npcs.filter(n => /smith|forge|mason|carpenter|cooper|tanner|weaver|wright|artisan/.test(text(n)));
    if (crafts.length) {
      const pick = crafts[(facts.burgId ?? 0) % crafts.length];
      if (pick && addTag(pick, "#RebelInformant")) added++;
    }
  }

  if (facts.chaosIntensity >= 0.6) {
    for (const n of npcs) {
      if (/spark:(sensitive|channeler)/.test(text(n)) && addTag(n, "#NightmareAfflicted")) added++;
    }
  }
  return added;
}

/** Loads the facts for a cell and seeds the given surface NPCs. */
export async function seedLayerNarrative(db: Db, cellId: number, npcs: any[]): Promise<number> {
  if (!Array.isArray(npcs) || npcs.length === 0) return 0;
  return seedNarrativeTags(npcs, await loadNarrativeFacts(db, cellId));
}
