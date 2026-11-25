/**
 * Consolidates storyline proposals from all story sources (reaction, drama, world, director, gm)
 * without directly opening active threads (Phase 9.2). Every actor ID is verified via the
 * unified entity registry (Rule 7) and comes with cited fact IDs and a short "why".
 */
import type { Db } from "../../deltas/types.js";
import { validateActorIds } from "../../threads/threadEngine.js";
import { evaluateSectorReactions, type SectorContext } from "../../rpg/narrativeReactionEngine.js";
import { synthesizeProceduralStoryArc, buildDirectorInputPayload } from "../../rpg/directorBridge.js";
import { facts, factTags } from "../../facts/facts.js";
import { buildStoryContext } from "../context.js";
import { promoteFromCohort } from "../../lod/promote.js";
import type { StoryProposalSpec } from "./types.js";

export interface CollectProposalsInput {
  cellId: number;
  rx?: number | undefined;
  ry?: number | undefined;
  z?: number | undefined;
  tick?: number | undefined;
}

function isSecurityTitle(title: string): boolean {
  return /commander|marshal|warden|captain|sheriff|constable|watch/i.test(title || "");
}

export async function collectStoryProposals(
  db: Db,
  input: CollectProposalsInput
): Promise<StoryProposalSpec[]> {
  const cellId = Number(input.cellId) || 30627;
  const rx = input.rx ?? 50;
  const ry = input.ry ?? 50;
  const z = input.z ?? 0;

  let currentTick = input.tick ?? 0;
  if (!currentTick) {
    const calRes = await db.query(`SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1`);
    currentTick = Number(calRes.rows[0]?.tick || 1);
  }

  const proposals: StoryProposalSpec[] = [];

  const burgRes = await db.query(
    `SELECT b.burg_id, b.name, b.cell_id, b.food, b.wealth, b.unrest, b.crime_rate,
            b.pop_null, b.pop_attuned, c.faction_id
     FROM sim_burg_economy b
     LEFT JOIN sim_cells c ON c.id = b.cell_id
     WHERE b.cell_id = $1
     ORDER BY b.burg_id ASC
     LIMIT 1`,
    [cellId]
  );
  const burg = burgRes.rows[0] || null;
  const burgName = burg ? String(burg.name) : `Cell #${cellId}`;

  // Fetch cached layer assets (deep-copied so reaction source never mutates live DB rows directly)
  const layerRes = await db.query(
    `SELECT npcs, props, features FROM sim_sector_layers
     WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4
     LIMIT 1`,
    [cellId, rx, ry, z]
  );
  const rawNpcs: any[] = Array.isArray(layerRes.rows[0]?.npcs)
    ? layerRes.rows[0].npcs.map((n: any) => ({ ...n, tags: Array.isArray(n.tags) ? [...n.tags] : [] }))
    : [];
  const rawProps: any[] = Array.isArray(layerRes.rows[0]?.props)
    ? layerRes.rows[0].props.map((p: any) => ({ ...p, tags: Array.isArray(p.tags) ? [...p.tags] : [] }))
    : [];
  const envTags: string[] = Array.isArray(layerRes.rows[0]?.features?.environmental_tags)
    ? layerRes.rows[0].features.environmental_tags.map(String)
    : [];

  // 1. Reaction source
  if (rawNpcs.length > 0 || rawProps.length > 0) {
    const globalTags = [...envTags];
    if (burg) {
      const bf = {
        food: Number(burg.food || 0),
        wealth: Number(burg.wealth || 0),
        unrest: Number(burg.unrest || 0),
        pop_null: Number(burg.pop_null || 0),
        pop_attuned: Number(burg.pop_attuned || 0),
        occupier_faction_id: null,
      };
      const tags = factTags(bf);
      globalTags.push(...tags.econTags, ...tags.factionTags);
    }
    const secCtx: SectorContext = {
      burgId: burg ? Number(burg.burg_id) : null,
      burgName,
      cellId,
      unrest: burg ? Number(burg.unrest || 0) : 0,
      food: burg ? Number(burg.food || 0) : 0,
      wealth: burg ? Number(burg.wealth || 0) : 0,
      tick: currentTick,
      rx,
      ry,
    };
    const rxResult = evaluateSectorReactions([...rawNpcs, ...rawProps], globalTags, secCtx);
    for (const cand of (rxResult.threadsToOpen || []).slice(0, 2)) {
      const firstProp = rawProps[0];
      proposals.push({
        scale: "thread",
        scope_cells: [cellId],
        cell_id: cellId,
        rx,
        ry,
        z,
        question: cand.question,
        stakes: cand.stakes,
        actor_ids: cand.actor_ids,
        clock_max: cand.clock_max || 6,
        source: "reaction",
        origin: "reaction",
        rule_id: cand.rule_id || "REACTION_PROPOSAL",
        why: `Local conditions in ${burgName} triggered reaction ${cand.rule_id || "collision"}.`,
        facts: [
          { kind: "cell", id: `cell:${cellId}`, summary: `${burgName} unrest=${Number(burg?.unrest || 0)} food=${Number(burg?.food || 0)}` },
          ...cand.actor_ids.map((aid) => ({ kind: "entity", id: String(aid), summary: `Actor ${aid}` })),
        ],
        hook: {
          dialogueLine: `Voices around ${burgName} whisper: ${cand.question}`,
          clueName: `Torn Dispatch (${burgName})`,
          clueDescription: `${cand.stakes}`,
          targetObjectRef: firstProp ? String(firstProp.id) : null,
          rumor: `${burgName}: ${cand.stakes}`,
        },
        rank_score: 75 + (burg && facts.famine(burg) ? 15 : 0),
        on_expire: cand.on_expire,
        on_resolved_by_party: cand.on_resolved_by_party,
      });
    }
  }

  // 2. Drama source (paragon want/flaw vs local rival or citizen)
  if (burg) {
    const paragonsRes = await db.query(
      `SELECT id, name, title, want, flaw, line_wont_cross, corruption_score
       FROM sim_paragons
       WHERE burg_id = $1 AND outlaw_id IS NULL
       ORDER BY corruption_score DESC, id ASC
       LIMIT 3`,
      [burg.burg_id]
    );
    const p1 = paragonsRes.rows[0];
    if (p1) {
      const p2 = paragonsRes.rows[1];
      let rivalRef = p2 ? `paragon:${p2.id}` : null;
      let rivalLabel = p2 ? `${p2.name} (${p2.title || "Paragon"})` : "";
      if (!rivalRef) {
        const citRes = await db.query(
          `SELECT citizen_id, name, profession
           FROM population_demographics
           WHERE settlement_id = $1 AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
           ORDER BY citizen_id ASC LIMIT 1`,
          [burg.burg_id]
        );
        if (citRes.rows[0]) {
          rivalRef = `citizen:${citRes.rows[0].citizen_id}`;
          rivalLabel = `${citRes.rows[0].name} (${citRes.rows[0].profession || "Citizen"})`;
        } else {
          const prom = await promoteFromCohort(db, Number(burg.burg_id), { ageBand: "ADULT", allegiance: "CIVILIAN" }, `proposal:${cellId}:${currentTick}`, currentTick);
          if (prom) {
            rivalRef = prom.entityRef;
            rivalLabel = `${prom.name} (${prom.profession || "Citizen"})`;
          }
        }
      }
      const actorIds = rivalRef ? [`paragon:${p1.id}`, rivalRef] : [`paragon:${p1.id}`];
      const wantTxt = String(p1.want || "secure leverage").replace(/\.$/, "");
      const flawTxt = String(p1.flaw || "rivalry").replace(/\.$/, "");
      const q = rivalLabel
        ? `Will ${p1.name} force "${wantTxt}" past ${rivalLabel} in ${burgName}?`
        : `Will ${p1.name}'s ${flawTxt.toLowerCase()} split leadership in ${burgName}?`;
      const stakes = `${p1.name} (${p1.title || "Paragon"}) wants to ${wantTxt.toLowerCase()} in ${burgName}, strained by ${flawTxt.toLowerCase()} and unrest ${Math.round(Number(burg.unrest || 0))}.`;
      const firstProp = rawProps[0];
      proposals.push({
        scale: "thread",
        scope_cells: [cellId],
        cell_id: cellId,
        rx,
        ry,
        z,
        question: q,
        stakes,
        actor_ids: actorIds,
        clock_max: 6,
        source: "drama",
        origin: "reaction",
        rule_id: "DRAMA_PARAGON_CLASH",
        why: `${p1.name}'s motive collided with local unrest (${Math.round(Number(burg.unrest || 0))}) in ${burgName}.`,
        facts: [
          { kind: "entity", id: `paragon:${p1.id}`, summary: `${p1.name}: want=${wantTxt}, flaw=${flawTxt}` },
          ...(rivalRef ? [{ kind: "entity", id: rivalRef, summary: rivalLabel }] : []),
          { kind: "burg", id: `burg:${burg.burg_id}`, summary: `${burgName} unrest=${Math.round(Number(burg.unrest || 0))}` },
        ],
        hook: {
          dialogueLine: `Did you hear ${p1.name} is pressing ${rivalLabel || "the council"} over "${wantTxt}"?`,
          clueName: `Sealed Writ of ${p1.name}`,
          clueDescription: `A stamped ledger detailing ${p1.name}'s push to ${wantTxt.toLowerCase()}.`,
          targetObjectRef: firstProp ? String(firstProp.id) : null,
          rumor: `${p1.name} and ${rivalLabel || "the council"} are nearing an open rupture in ${burgName}.`,
        },
        rank_score: 70 + Math.min(25, Number(burg.unrest || 0) * 0.4 + Number(p1.corruption_score || 0) * 0.2),
        on_expire: { unrestDelta: 8, crimeRateDelta: 4, narrativeSummary: `${p1.name} forced their hand in ${burgName}.` },
        on_resolved_by_party: { unrestDelta: -6, wealthDelta: 90, narrativeSummary: `The party defused ${p1.name}'s confrontation in ${burgName}.` },
      });
    }
  }

  // 3. World event source (recent major events / threatened seals in region)
  const evRes = await db.query(
    `SELECT e.id, e.type, e.message, e.tick
     FROM sim_events e
     WHERE e.cell_id = $1 OR (e.burg_id IS NOT NULL AND e.burg_id = $2)
     ORDER BY e.tick DESC, e.id DESC
     LIMIT 3`,
    [cellId, burg ? Number(burg.burg_id) : -1]
  );
  if (evRes.rows.length > 0 && burg) {
    const ev = evRes.rows[0];
    const paragonsRes = await db.query(
      `SELECT id, name, title FROM sim_paragons WHERE burg_id = $1 AND outlaw_id IS NULL ORDER BY id ASC LIMIT 5`,
      [burg.burg_id]
    );
    const secParagon = paragonsRes.rows.find((p: any) => isSecurityTitle(p.title)) || paragonsRes.rows[0];
    if (secParagon) {
      const firstProp = rawProps[0];
      proposals.push({
        scale: "thread",
        scope_cells: [cellId],
        cell_id: cellId,
        rx,
        ry,
        z,
        question: `Who answers the fallout of "${String(ev.type)}" in ${burgName}?`,
        stakes: `Following "${String(ev.message).slice(0, 120)}", ${secParagon.name} seeks allies before order frays further.`,
        actor_ids: [`paragon:${secParagon.id}`],
        clock_max: 7,
        source: "world",
        origin: "world",
        rule_id: `WORLD_EVENT_${String(ev.type || "INCIDENT").slice(0, 32)}`,
        why: `Recent event #${ev.id} (${ev.type} at tick ${ev.tick}) left unresolved fallout in ${burgName}.`,
        facts: [
          { kind: "event", id: `event:${ev.id}`, summary: String(ev.message).slice(0, 120) },
          { kind: "entity", id: `paragon:${secParagon.id}`, summary: `${secParagon.name} (${secParagon.title})` },
        ],
        hook: {
          dialogueLine: `${secParagon.name} needs reliable hands since ${String(ev.type).toLowerCase().replace(/_/g, " ")}.`,
          clueName: `Posted Proclamation (#${ev.id})`,
          clueDescription: `Notice posted after ${String(ev.message).slice(0, 100)}`,
          targetObjectRef: firstProp ? String(firstProp.id) : null,
          rumor: `${burgName} buzzes over ${String(ev.message).slice(0, 90)}.`,
        },
        rank_score: 68,
        on_expire: { unrestDelta: 7, wealthDelta: -80, narrativeSummary: `The aftermath of ${ev.type} festered unanswered in ${burgName}.` },
        on_resolved_by_party: { unrestDelta: -7, wealthDelta: 110, narrativeSummary: `The party stabilized ${burgName} after ${ev.type}.` },
      });
    }
  }

  // 4. Director source (StoryContext-grounded tactical arc proposal)
  try {
    const storyCtx = await buildStoryContext(db, { cellId, rx, ry, z }, {}, { tokenBudget: 2400 });
    const firstActor = storyCtx.focus.entities[0];
    if (firstActor) {
      const directorPayload = await buildDirectorInputPayload(cellId, rx, ry, z).catch(() => null);
      const blueprint = directorPayload ? synthesizeProceduralStoryArc(directorPayload) : null;
      const firstProp = storyCtx.focus.objects[0];
      const beats = blueprint?.story_arc_framework?.beats?.map((b, i) => ({
        phase: i + 1,
        objective: b.objective,
        discovery: b.discovery_method,
      })) || [
        { phase: 1, objective: `Question ${firstActor.name} about rising trouble at (${rx},${ry})`, discovery: "Sector interview or inspected cache" },
        { phase: 2, objective: `Cut off the threat backing the pressure around ${burgName}`, discovery: "Follow the physical trail" },
      ];
      proposals.push({
        scale: "arc",
        scope_cells: Array.from(new Set([cellId, ...storyCtx.region.burgs.slice(0, 3).map((b) => b.cellId)])),
        cell_id: cellId,
        rx,
        ry,
        z,
        question: blueprint?.story_arc_framework?.inciting_incident || `What links ${firstActor.name} to the pressure in ${burgName}?`,
        stakes: blueprint?.story_arc_framework?.inciting_incident || `${firstActor.name} holds a clue tying ${burgName} to wider regional trouble.`,
        actor_ids: [firstActor.ref],
        clock_max: 8,
        source: "director",
        origin: "arc",
        rule_id: blueprint?.story_arc_framework?.arc_id || "DIRECTOR_FOCUS_ARC",
        arc_key: blueprint?.story_arc_framework?.arc_id || `director_${cellId}_${rx}_${ry}`,
        why: `Synthesized from ${storyCtx.focus.entities.length} focus entities, ${storyCtx.region.openStorylines.length} open regional storylines, and ${storyCtx.history.recentEvents.length} recent events.`,
        facts: [
          { kind: "entity", id: firstActor.ref, summary: `${firstActor.name} (${firstActor.role})` },
          ...(firstProp ? [{ kind: "object", id: firstProp.id, summary: firstProp.name }] : []),
          ...storyCtx.region.burgs.slice(0, 2).map((b) => ({ kind: "burg", id: `burg:${b.burgId}`, summary: `${b.name} unrest=${b.unrest}` })),
        ],
        hook: {
          dialogueLine: `If you're asking about trouble here, speak carefully with ${firstActor.name}.`,
          clueName: `Marked Ledger at ${storyCtx.focus.tile.layerName || burgName}`,
          clueDescription: `${blueprint?.story_arc_framework?.inciting_incident || `Notes referencing ${firstActor.name}`}`,
          targetObjectRef: firstProp ? firstProp.id : null,
          rumor: `Whispered trouble around ${firstActor.name} in ${burgName}.`,
        },
        rank_score: 72 + Math.min(20, storyCtx.region.openStorylines.length * 4),
        beats,
      });
    }
  } catch {
    // Director context may skip if sector has no cached assets yet
  }

  // 5. GM Memory source (follow-up hook grounded in party memories / local sector NPC)
  const memRes = await db.query(
    `SELECT id, summary FROM sim_gm_memories ORDER BY id DESC LIMIT 1`
  );
  if (memRes.rows[0] && rawNpcs.length > 0) {
    const npc = rawNpcs.find((n) => n.alive !== false && n.entity_ref) || rawNpcs[0];
    const actorRef = String(npc.entity_ref || npc.id || "");
    if (actorRef) {
      proposals.push({
        scale: "scene",
        scope_cells: [cellId],
        cell_id: cellId,
        rx,
        ry,
        z,
        question: `How does ${npc.name || "the witness"} respond to the party's latest move?`,
        stakes: `Recalling "${String(memRes.rows[0].summary).slice(0, 120)}", ${npc.name || "locals"} expect a decisive follow-up.`,
        actor_ids: [actorRef],
        clock_max: 4,
        source: "gm",
        origin: "reaction",
        rule_id: `GM_FOLLOWUP_${memRes.rows[0].id}`,
        why: `Connected party memory #${memRes.rows[0].id} to present NPC ${npc.name || actorRef}.`,
        facts: [
          { kind: "memory", id: `memory:${memRes.rows[0].id}`, summary: String(memRes.rows[0].summary).slice(0, 120) },
          { kind: "entity", id: actorRef, summary: String(npc.name || actorRef) },
        ],
        hook: {
          dialogueLine: `We remember what you did last time — don't leave this half-finished.`,
          clueName: `Chalk Sigil by ${npc.name || "the door"}`,
          clueDescription: `A chalk mark left in response to earlier events.`,
          targetObjectRef: rawProps[0] ? String(rawProps[0].id) : null,
          rumor: `${npc.name || "Someone"} at (${rx},${ry}) has unfinished business with the party.`,
        },
        rank_score: 64,
      });
    }
  }

  // Filter strictly through Rule 7 actor validation
  const verified: StoryProposalSpec[] = [];
  for (const p of proposals) {
    if (!p.actor_ids || p.actor_ids.length === 0) continue;
    const chk = await validateActorIds(db, p.actor_ids);
    if (chk.valid) {
      verified.push(p);
    }
  }

  verified.sort((a, b) => (b.rank_score ?? 0) - (a.rank_score ?? 0) || a.question.localeCompare(b.question));
  return verified;
}
