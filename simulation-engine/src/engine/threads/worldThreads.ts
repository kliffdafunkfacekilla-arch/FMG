/**
 * World threads: stories that start from what the simulation did this tick, anywhere in the world.
 *
 * Map-based reactions (backgroundDirector + narrativeReactionEngine) only see cells someone has opened
 * as a tactical map. This opens threads straight from major events, with real actors (rule 7):
 *
 *   BURG_FAMINE                         the burg's civic paragon      Will the town get grain in time?
 *   COMMANDER_BRIBED / ..._BRIBE        the security paragon          Will anyone expose the bought commander?
 *   WITCH_HUNT_EXECUTION                the civic paragon             Will the purge claim more innocents?
 *   MAYOR_HOARD_GRAIN_SPECULATION       the civic paragon             Will the hoarding starve the poor?
 *   BANDIT_RAIDERS_EMERGE (unrest >= 50) the security paragon         Will the raiders be driven off?
 *   a dragon seal at or below 25%       a Warden at that prison       Can the seal be held?
 *
 * Limits keep the world from drowning in threads: at most MAX_NEW_PER_TICK new ones a tick, at most
 * MAX_OPEN open world threads, and never a second open thread of the same kind in the same cell.
 * Each thread declares what happens if it runs out (on_expire) and if a party resolves it.
 */
import { Pool, PoolClient } from "pg";
import { createThread, ThreadWorldDelta } from "./threadEngine.js";

const MAX_NEW_PER_TICK = 2;
const MAX_OPEN = 40;

type Db = Pool | PoolClient;
const isSecurity = (title: string) => /commander|marshal|warden|captain|sheriff|constable|watch/i.test(title || "");

interface Template {
  rule: string;
  actor: "civic" | "security";
  minUnrest?: number;
  clock: number;
  question: (burg: string, actor: { name: string; title: string }) => string;
  stakes: (burg: string) => string;
  onExpire: (burg: string, actor: { name: string }) => ThreadWorldDelta;
  onParty: (burg: string, actor: { name: string }) => ThreadWorldDelta;
}

const BY_EVENT: Record<string, Template> = {
  BURG_FAMINE: {
    rule: "WORLD_FAMINE", actor: "civic", clock: 6,
    question: (b) => `Will ${b} get grain before its people starve?`,
    stakes: (b) => `Without relief the last granaries in ${b} empty, the weakest die and the streets turn on the council.`,
    onExpire: (b) => ({ unrestDelta: 18, foodDelta: -200, crimeRateDelta: 6, narrativeSummary: `No relief reached ${b}. Hunger turned to riot and the dead were buried in the commons.` }),
    onParty: (b) => ({ unrestDelta: -12, foodDelta: 400, narrativeSummary: `Relief wagons reached ${b} in time; the bread lines thinned and the town breathed again.` }),
  },
  COMMANDER_BRIBED: {
    rule: "WORLD_BRIBED_COMMANDER", actor: "security", clock: 8,
    question: (b, a) => `Will anyone expose ${a.name}, the ${a.title || "commander"} of ${b} on a syndicate's payroll?`,
    stakes: (b) => `While the watch is bought, smugglers and extortionists run ${b} openly.`,
    onExpire: (b, a) => ({ crimeRateDelta: 12, unrestDelta: 6, narrativeSummary: `${a.name} kept the bribes and the silence; the syndicates now run ${b} in daylight.` }),
    onParty: (b, a) => ({ crimeRateDelta: -10, unrestDelta: -5, wealthDelta: 100, narrativeSummary: `${a.name}'s ledger of bribes reached the council; the watch of ${b} was purged.` }),
  },
  WITCH_HUNT_EXECUTION: {
    rule: "WORLD_WITCH_PURGE", actor: "civic", clock: 6,
    question: (b) => `Will the witch-hunters' purge in ${b} claim more innocents?`,
    stakes: (b) => `Every accusation in ${b} breeds another; neighbours inform on neighbours to save themselves.`,
    onExpire: (b) => ({ unrestDelta: 12, wealthDelta: -150, narrativeSummary: `The purge in ${b} burned on until there was no one left willing to speak against it.` }),
    onParty: (b) => ({ unrestDelta: -8, narrativeSummary: `The tribunal in ${b} was broken up and the accused set free; the pyres went cold.` }),
  },
  MAYOR_HOARD_GRAIN_SPECULATION: {
    rule: "WORLD_GRAIN_HOARD", actor: "civic", clock: 7,
    question: (b, a) => `Will ${a.name}'s grain hoarding starve the poor of ${b}?`,
    stakes: (b) => `Bread prices in ${b} climb by the day while the council's own warehouses stay locked.`,
    onExpire: (b, a) => ({ foodDelta: -150, unrestDelta: 10, wealthDelta: 200, narrativeSummary: `${a.name} sold the hoard at famine prices; ${b}'s poor paid in hunger.` }),
    onParty: (b, a) => ({ foodDelta: 250, unrestDelta: -8, narrativeSummary: `The warehouses of ${a.name} were thrown open and the grain sold at fair price in ${b}.` }),
  },
  BANDIT_RAIDERS_EMERGE: {
    rule: "WORLD_BANDIT_ROADS", actor: "security", minUnrest: 50, clock: 6,
    question: (b) => `Will the raiders preying on ${b}'s roads be driven off?`,
    stakes: (b) => `Caravans avoid ${b}; its markets thin and its people grow desperate enough to join the raiders.`,
    onExpire: (b) => ({ wealthDelta: -250, crimeRateDelta: 8, unrestDelta: 6, narrativeSummary: `The raiders took the roads around ${b}; trade withered and more young folk rode out to join them.` }),
    onParty: (b) => ({ wealthDelta: 150, crimeRateDelta: -6, unrestDelta: -6, narrativeSummary: `The raider camp near ${b} was broken; caravans returned to its gates.` }),
  },
};
BY_EVENT.COMMANDER_TAKE_UNDERWORLD_BRIBE = BY_EVENT.COMMANDER_BRIBED!;

export async function openWorldEventThreads(client: Db, tick: number): Promise<number> {
  const open = await client.query(`SELECT cell_id, rule_id FROM sim_threads WHERE state IN ('open','escalated')`);
  const openWorld = open.rows.filter((r: any) => String(r.rule_id || "").startsWith("WORLD_")).length;
  if (openWorld >= MAX_OPEN) return 0;
  const taken = new Set(open.rows.map((r: any) => `${r.cell_id}:${r.rule_id}`));
  let opened = 0;

  const tryOpen = async (input: Parameters<typeof createThread>[1]) => {
    const key = `${input.cell_id}:${input.rule_id}`;
    if (taken.has(key) || opened >= MAX_NEW_PER_TICK || openWorld + opened >= MAX_OPEN) return;
    try {
      await client.query("SAVEPOINT world_thread");
      await createThread(client, input);
      await client.query("RELEASE SAVEPOINT world_thread");
      taken.add(key);
      opened++;
    } catch (err: any) {
      await client.query("ROLLBACK TO SAVEPOINT world_thread").catch(() => {});
      console.warn(`[World threads] Skipped ${input.rule_id} in cell ${input.cell_id}: ${err.message}`);
    }
  };

  // 1. Seals close to breaking: one thread per prison. The actor is a Warden posted there, or failing
  //    that the cultist besieging it (the thread is then about breaking the siege).
  const seals = await client.query(
    `SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength,
            w.id AS warden_id, w.name AS warden_name, c.id AS cultist_id, c.name AS cultist_name
     FROM sim_sacred_groves g
     LEFT JOIN LATERAL (SELECT id, name FROM sim_agents WHERE role = 'Warden' AND target_grove_id = g.id ORDER BY id LIMIT 1) w ON true
     LEFT JOIN LATERAL (SELECT id, name FROM sim_agents WHERE role = 'Cultist' AND target_grove_id = g.id ORDER BY (state = 'BESIEGING_SEAL') DESC, id LIMIT 1) c ON true
     WHERE g.seal_strength <= 25 ORDER BY g.seal_strength ASC`
  );
  for (const s of seals.rows) {
    const byWarden = Boolean(s.warden_id);
    if (!byWarden && !s.cultist_id) continue;
    await tryOpen({
      question: byWarden
        ? `Can the failing seal of ${s.dragon_name} (${s.power_domain}) be held?`
        : `Can the cult besieging the prison of ${s.dragon_name} be broken before the seal fails?`,
      stakes: `The seal stands at ${s.seal_strength}%. If it breaks, ${s.dragon_name} wakes and the land around the prison burns.`,
      actor_ids: [`agent:${byWarden ? s.warden_id : s.cultist_id}`], cell_id: Number(s.cell_id), rx: 50, ry: 50, clock_max: 8,
      origin: "world", rule_id: "WORLD_SEAL_FAILING", created_tick: tick,
      on_expire: {
        unrestDelta: 15,
        narrativeSummary: byWarden
          ? `No help reached the prison of ${s.dragon_name}; ${s.warden_name} could not hold the seal alone.`
          : `Nobody broke ${s.cultist_name}'s siege; the rites at the prison of ${s.dragon_name} went on unchecked.`,
      },
      on_resolved_by_party: {
        unrestDelta: -5,
        narrativeSummary: byWarden
          ? `The party stood with ${s.warden_name} and the seal of ${s.dragon_name} held, for now.`
          : `The party scattered ${s.cultist_name}'s circle at the prison of ${s.dragon_name}; the seal still holds, barely.`,
      },
    });
  }

  // 2. This tick's major events in burgs
  const events = await client.query(
    `SELECT e.id, e.type, e.burg_id, b.name AS burg, b.cell_id, b.unrest
     FROM sim_events e JOIN sim_burg_economy b ON b.burg_id = e.burg_id
     WHERE e.tick = $1 AND e.type = ANY($2) ORDER BY e.id`,
    [tick, Object.keys(BY_EVENT)]
  );
  for (const ev of events.rows) {
    if (opened >= MAX_NEW_PER_TICK) break;
    const t = BY_EVENT[ev.type]!;
    if (t.minUnrest && Number(ev.unrest) < t.minUnrest) continue;
    if (taken.has(`${ev.cell_id}:${t.rule}`)) continue;
    const paragons = await client.query(`SELECT id, name, title FROM sim_paragons WHERE burg_id = $1 AND outlaw_id IS NULL ORDER BY id`, [ev.burg_id]);
    const actor = paragons.rows.find((p: any) => (t.actor === "security") === isSecurity(p.title)) || paragons.rows[0];
    if (!actor) continue;
    await tryOpen({
      question: t.question(ev.burg, actor), stakes: t.stakes(ev.burg),
      actor_ids: [`paragon:${actor.id}`], cell_id: Number(ev.cell_id), rx: 50, ry: 50, clock_max: t.clock,
      origin: "world", rule_id: t.rule, created_tick: tick,
      on_expire: t.onExpire(ev.burg, actor), on_resolved_by_party: t.onParty(ev.burg, actor),
    });
  }
  return opened;
}
