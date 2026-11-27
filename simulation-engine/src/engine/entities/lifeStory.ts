/**
 * Reads a named person's life (sim_life_events + their ties) and boils it down for the people who meet them:
 * a few short lines a GM or NPC voice can use, and the full record for the player's inspect panel.
 */
import type { Db } from "../deltas/types.js";
import { mapNpcIdToEntityRef } from "./refs.js";

export interface LifeTie {
  citizenId: number;
  name: string;
  relation: string;
  alive: boolean;
}

export interface LifeStory {
  citizenId: number;
  name: string;
  profession: string;
  age: number;
  alive: boolean;
  causeOfDeath: string | null;
  burgId: number | null;
  townName: string | null;
  childhood: string | null;
  events: Array<{ tick: number; kind: string; text: string }>;
  ties: LifeTie[];
  /** Up to five short lines, most telling first: family, losses, hardships, the latest turn in their life. */
  summary: string[];
}

/** The citizen behind an NPC on a map, or null (paragons, beasts, squads have no life log). */
export function citizenIdOfNpc(npc: { id?: string; entity_ref?: string | undefined }): number | null {
  const ref = String(npc.entity_ref || mapNpcIdToEntityRef(String(npc.id || "")));
  const m = /^citizen:(\d+)$/.exec(ref);
  return m ? Number(m[1]) : null;
}

function summarize(s: Omit<LifeStory, "summary">): string[] {
  const out: string[] = [];
  const living = (r: string) => s.ties.filter((t) => t.relation === r && t.alive);
  const lost = (r: string) => s.ties.filter((t) => t.relation === r && !t.alive);
  const spouse = living("spouse")[0];
  const lostSpouse = lost("spouse")[0];
  if (spouse) out.push(`Married to ${spouse.name}.`);
  else if (lostSpouse) out.push(`Widowed: lost their spouse ${lostSpouse.name}.`);
  const kids = s.ties.filter((t) => t.relation === "child");
  if (kids.length) {
    const dead = kids.filter((k) => !k.alive).length;
    out.push(`Parent of ${kids.map((k) => k.name).join(", ")}${dead ? ` (${dead} buried)` : ""}.`);
  }
  const parents = s.ties.filter((t) => t.relation === "parent");
  if (parents.length) out.push(`Child of ${parents.map((p) => p.name + (p.alive ? "" : " (dead)")).join(" and ")}.`);
  const raids = s.events.filter((e) => e.kind === "survived_raid").length;
  if (raids) out.push(raids === 1 ? s.events.find((e) => e.kind === "survived_raid")!.text : `Survived ${raids} bandit raids on the caravan roads.`);
  const hunger = s.events.filter((e) => e.kind === "hunger").length;
  if (hunger) out.push(`Went hungry through ${hunger === 1 ? "a famine" : `${hunger} famines`}.`);
  const grief = s.events.filter((e) => e.kind === "grief" && !/spouse|parent|child/.test(e.text)).slice(-1)[0];
  if (grief) out.push(grief.text);
  const rivals = living("rival");
  if (rivals.length) out.push(`At odds with ${rivals.map((r) => r.name).join(", ")}.`);
  const friends = living("friend");
  if (friends.length) out.push(`Friends with ${friends.slice(0, 3).map((f) => f.name).join(", ")}.`);
  if (!s.alive && s.causeOfDeath) out.unshift(`Dead: ${s.causeOfDeath}`);
  return out.slice(0, 5);
}

/**
 * For NPCs about to be shown or played: drops townsfolk who have died since their map was drawn, and gives the
 * rest their `citizenId` and a short `lifeStory`. Non-citizen NPCs pass through untouched. Never throws.
 */
export async function attachLivesToNpcs<T extends { id: string; entity_ref?: string | undefined; citizenId?: number | undefined; lifeStory?: string[] | undefined }>(
  db: Db,
  npcs: T[] | undefined | null
): Promise<T[]> {
  const list = Array.isArray(npcs) ? npcs : [];
  try {
    const byNpc = new Map<string, number>();
    for (const n of list) {
      const cid = citizenIdOfNpc(n);
      if (cid) byNpc.set(n.id, cid);
    }
    if (byNpc.size === 0) return list;
    const stories = await getLifeStories(db, Array.from(byNpc.values()), 12);
    return list.filter((n) => {
      const cid = byNpc.get(n.id);
      const s = cid ? stories.get(cid) : undefined;
      if (!s) return true;
      if (!s.alive) return false;
      n.citizenId = cid;
      if (s.summary.length) n.lifeStory = s.summary;
      return true;
    });
  } catch (err) {
    console.warn("[lifeStory] Could not attach lives to NPCs:", err);
    return list;
  }
}

/** Life stories for many citizens in three queries. Citizens with no record are left out. */
export async function getLifeStories(db: Db, citizenIds: number[], eventLimit = 40): Promise<Map<number, LifeStory>> {
  const ids = Array.from(new Set(citizenIds.filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
  const out = new Map<number, LifeStory>();
  if (ids.length === 0) return out;

  const pRes = await db.query(
    `SELECT p.citizen_id, p.name, p.profession, COALESCE(p.age, 0)::int AS age, p.allegiance_status, p.cause_of_death,
            p.settlement_id, b.name AS town, p.childhood_background, p.social_links
     FROM population_demographics p LEFT JOIN sim_burg_economy b ON b.burg_id = p.settlement_id
     WHERE p.citizen_id = ANY($1::int[])`,
    [ids]
  );
  const eRes = await db.query(
    `SELECT citizen_id, tick, kind, text FROM (
       SELECT citizen_id, tick, kind, text, id,
              ROW_NUMBER() OVER (PARTITION BY citizen_id ORDER BY tick DESC, id DESC) AS rn
       FROM sim_life_events WHERE citizen_id = ANY($1::int[])
     ) x WHERE rn <= $2 ORDER BY citizen_id, tick, id`,
    [ids, eventLimit]
  );
  const events = new Map<number, Array<{ tick: number; kind: string; text: string }>>();
  for (const r of eRes.rows) {
    const id = Number(r.citizen_id);
    if (!events.has(id)) events.set(id, []);
    events.get(id)!.push({ tick: Number(r.tick), kind: String(r.kind), text: String(r.text) });
  }

  // Ties that carry an id (made by the lives step), and whether each of those people still lives.
  const tieIds = new Set<number>();
  for (const r of pRes.rows) for (const l of Array.isArray(r.social_links) ? r.social_links : []) if (Number(l?.citizenId) > 0) tieIds.add(Number(l.citizenId));
  const aliveOf = new Map<number, boolean>();
  if (tieIds.size > 0) {
    const tRes = await db.query(
      `SELECT citizen_id, allegiance_status FROM population_demographics WHERE citizen_id = ANY($1::int[])`,
      [Array.from(tieIds)]
    );
    for (const r of tRes.rows) aliveOf.set(Number(r.citizen_id), !["DECEASED", "DEPARTED"].includes(String(r.allegiance_status)));
  }

  for (const r of pRes.rows) {
    const id = Number(r.citizen_id);
    const ties: LifeTie[] = (Array.isArray(r.social_links) ? r.social_links : [])
      .filter((l: any) => Number(l?.citizenId) > 0)
      .map((l: any) => ({
        citizenId: Number(l.citizenId),
        name: String(l.name || "someone"),
        relation: String(l.relation || l.relationship || "friend"),
        alive: aliveOf.get(Number(l.citizenId)) ?? true,
      }));
    const base = {
      citizenId: id,
      name: String(r.name || ""),
      profession: String(r.profession || ""),
      age: Number(r.age),
      alive: !["DECEASED", "DEPARTED"].includes(String(r.allegiance_status)),
      causeOfDeath: r.cause_of_death ? String(r.cause_of_death) : null,
      burgId: r.settlement_id !== null ? Number(r.settlement_id) : null,
      townName: r.town ? String(r.town) : null,
      childhood: r.childhood_background ? String(r.childhood_background) : null,
      events: events.get(id) || [],
      ties,
    };
    out.set(id, { ...base, summary: summarize(base) });
  }
  return out;
}
