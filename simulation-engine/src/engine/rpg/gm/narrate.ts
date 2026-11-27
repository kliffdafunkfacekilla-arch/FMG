/**
 * Component 3 (Rule 6): Visual tactical sight, rumor-grounded NPC dialogue, and budgeted StoryContext turn narration.
 */
import type { Pool } from "pg";
import { LlmError } from "../../llm.js";
import { buildStoryContext, renderStoryContext } from "../../story/context.js";
import type { TaggedObject } from "../TagMatrixEngine.js";
import type { InjectedNPC, SectorContext } from "../WhatElseStoryEngine.js";
import type {
  ActionInput,
  ModelCaller,
  ParsedIntent,
  SocialDialogueRequest,
  StrictModelCaller,
} from "./types.js";

export function generateTacticalVisualSight(
  playerPos: [number, number],
  activeProps: Map<string, TaggedObject>,
  activeNPCs: Map<string, InjectedNPC>,
  grid?: number[] | Uint8Array,
  zLayer: number = 0
): string {
  const [px, py] = playerPos;
  const visualNotes: string[] = [];

  if (zLayer === 1) {
    visualNotes.push("Vantage: Elevated wooden lofts / parapet catwalk with drops into open space below.");
  } else if (zLayer === -1) {
    visualNotes.push("Vantage: Damp subterranean sewer flume / cavern vault beneath heavy stone arches.");
  } else {
    visualNotes.push("Vantage: Surface ground level among urban quays and cobblestone lanes.");
  }

  if (grid && grid.length >= 256 * 256) {
    const getTile = (x: number, y: number) => {
      if (x < 0 || x >= 256 || y < 0 || y >= 256) return 0;
      return grid[y * 256 + x];
    };

    const underfoot = getTile(Math.floor(px), Math.floor(py)) ?? 0;
    const tileName = (t: number) => {
      switch (t) {
        case 1: return "packed flagstone / timber floor";
        case 2: return "flowing water canal / flume";
        case 3: return "earthen lane / cave trail";
        case 4: return "worn cobblestone pavement";
        case 5: return "heavy masonry stone wall (full cover)";
        case 6: return "solid bedrock / reinforced masonry";
        case 7: return "iron portcullis grating / spiked barrier";
        case 8: return "brazier / forge / torch station";
        default: return "open ground / clear pathway";
      }
    };

    visualNotes.push(`Immediate Ground: Standing upon ${tileName(underfoot)} at grid coordinate (${Math.floor(px)}, ${Math.floor(py)}).`);

    const north = getTile(Math.floor(px), Math.floor(py - 5));
    const south = getTile(Math.floor(px), Math.floor(py + 5));
    const east = getTile(Math.floor(px + 5), Math.floor(py));
    const west = getTile(Math.floor(px - 5), Math.floor(py));

    if (north === 5 || north === 6 || north === 7) visualNotes.push(`North (5m): ${tileName(north)} blocks direct advance.`);
    if (south === 5 || south === 6 || south === 7) visualNotes.push(`South (5m): ${tileName(south)} blocks direct advance.`);
    if (east === 5 || east === 6 || east === 7) visualNotes.push(`East (5m): ${tileName(east)} blocks direct advance.`);
    if (west === 5 || west === 6 || west === 7) visualNotes.push(`West (5m): ${tileName(west)} blocks direct advance.`);

    if (north === 2 || south === 2 || east === 2 || west === 2) {
      visualNotes.push(`Water Hazard: Churning canal water within 5m.`);
    }
  }

  const propSightings: string[] = [];
  for (const [, prop] of activeProps.entries()) {
    const [tx, ty] = prop.pos || [128, 128];
    const dist = Math.hypot(tx - px, ty - py);
    const distMeters = Math.round(dist * 0.5);
    const dirX = tx > px ? "East" : tx < px ? "West" : "";
    const dirY = ty > py ? "South" : ty < py ? "North" : "";
    const bearing = `${dirY}${dirX}` || "underfoot";

    const stateDesc = prop.hp <= 0 ? "DESTROYED/SHATTERED" : prop.tags.has("opened") ? "OPENED" : prop.tags.has("locked") ? "LOCKED" : "INTACT";
    propSightings.push(`- ${prop.name} (${stateDesc}, HP: ${prop.hp}/${prop.maxHp}): ${distMeters}m to the ${bearing}. Direct line of sight.`);
  }
  if (propSightings.length > 0) {
    visualNotes.push("Visible Props in Sight:\n" + propSightings.join("\n"));
  }

  const npcSightings: string[] = [];
  for (const [, npc] of activeNPCs.entries()) {
    const [nx, ny] = npc.pos || [128, 128];
    const dist = Math.hypot(nx - px, ny - py);
    const distMeters = Math.round(dist * 0.5);
    const dirX = nx > px ? "East" : nx < px ? "West" : "";
    const dirY = ny > py ? "South" : ny < py ? "North" : "";
    const bearing = `${dirY}${dirX}` || "at close quarters";

    npcSightings.push(`- ${npc.name} (${npc.role}, ${npc.hp <= 0 ? "UNCONSCIOUS" : "ACTIVE"}): ${distMeters}m to the ${bearing}. Stance: ${npc.disposition >= 0 ? "Watchful" : "Hostile/Wary"}.`);
  }
  if (npcSightings.length > 0) {
    visualNotes.push("Visible Entities in Sight:\n" + npcSightings.join("\n"));
  }

  return visualNotes.join("\n");
}

export async function synthesizeNpcDialogue(params: {
  pool: Pool;
  activeContext: SectorContext | null;
  req: SocialDialogueRequest;
  strictLlm: boolean;
  callModel: ModelCaller;
  callModelStrict: StrictModelCaller;
}): Promise<string> {
  const { pool, activeContext, req, strictLlm, callModel, callModelStrict } = params;
  const { npcName, npcRole, npcFaction, targetNPC, targetFactionRep, actionText, hit, socialOutcomeNote, isMoraleBroken } = req;

  let recentRumors = "";
  try {
    const localBurgId = activeContext?.burg?.burg_id ?? null;
    const isTravelerOrTavern = targetNPC?.tags?.includes("merchant") ||
      targetNPC?.tags?.includes("wayfarer") ||
      targetNPC?.tags?.includes("innkeeper") ||
      targetNPC?.tags?.includes("courier") ||
      targetNPC?.tags?.includes("scholar") ||
      targetNPC?.role?.toLowerCase().includes("innkeeper") ||
      targetNPC?.role?.toLowerCase().includes("caravan") ||
      targetNPC?.role?.toLowerCase().includes("messenger") ||
      targetNPC?.role?.toLowerCase().includes("trader");

    let eventsRes;
    if (isTravelerOrTavern) {
      eventsRes = await pool.query(
        `SELECT message, tier FROM sim_events 
         WHERE tier IN ('CRITICAL', 'MAJOR') 
            OR burg_id = $1 
            OR id IN (SELECT id FROM sim_events ORDER BY id DESC LIMIT 15)
         ORDER BY id DESC LIMIT 4`,
        [localBurgId]
      );
    } else if (localBurgId) {
      eventsRes = await pool.query(
        `SELECT message, tier FROM sim_events 
         WHERE tier IN ('CRITICAL', 'MAJOR') 
            OR burg_id = $1 
         ORDER BY id DESC LIMIT 3`,
        [localBurgId]
      );
    } else {
      eventsRes = await pool.query(
        `SELECT message, tier FROM sim_events 
         WHERE tier IN ('CRITICAL', 'MAJOR') 
            OR type IN ('ECOLOGICAL', 'TROPHIC_DISRUPTION', 'APEX_BEAST_SLAIN', 'CARTEL_EXPANSION')
         ORDER BY id DESC LIMIT 3`
      );
    }

    if (eventsRes && eventsRes.rows.length > 0) {
      recentRumors = eventsRes.rows.map((r: any) => `- ${r.message}`).join("\n");
    }
  } catch {}

  const repNote = targetFactionRep !== 0
    ? `The player has an underlying reputation of ${targetFactionRep} with your faction ('${npcFaction}'). Reflect this subtly in your tone, respect, suspicion, or hostility without mentioning numbers.`
    : "";
  const breakdownNote = isMoraleBroken
    ? `Your Composure has been completely shattered! You are demoralized, conceding, surrendering, or breaking into a nervous confession.`
    : "";

  const npcTagsStr = targetNPC ? targetNPC.tags.join(", ") : "disciplined, armed, watchful";
  const motiveStr = targetNPC?.want || targetNPC?.flaw || targetNPC?.lineWontCross
    ? `\nPersonal Want: ${targetNPC.want || "N/A"}\nPersonal Flaw: ${targetNPC.flaw || "N/A"}\nLine You Will Never Cross: ${targetNPC.lineWontCross || "N/A"}`
    : "";
  const lifeStr = targetNPC?.lifeStory?.length
    ? `\nYour own life so far (true; let it color what you say, and bring it up if the player asks about you or your town):\n${targetNPC.lifeStory.map((l) => `- ${l}`).join("\n")}`
    : "";
  const dialoguePrompt = `You are ${npcName}, a ${npcRole} aligned with '${npcFaction}'. Your traits are: [${npcTagsStr}].${motiveStr}${lifeStr}
The player spoke: "${actionText}".
Social result: ${hit ? "SUCCESS" : "FAILURE"} (${socialOutcomeNote}). Current disposition: ${targetNPC ? targetNPC.disposition : (hit ? 1 : -1)}.
${breakdownNote}
${repNote}
${recentRumors ? `Recent genuine rumors & occurrences across the realm:\n${recentRumors}\nIf appropriate to the player's query or disposition, weave one of these rumors into your dialogue.` : ""}
Speak 1-2 sentences of direct in-character spoken dialogue in quotation marks responding to the player. Mention your faction or secret motives.`;

  const dialogueSystem = "You are an actor playing an authentic dark fantasy character. Output only spoken dialogue in quotation marks.";
  const dialogueRes = strictLlm
    ? await callModelStrict("npc_dialogue", [{ role: "user", parts: [{ text: dialoguePrompt }] }], dialogueSystem, 150, 0.8)
    : await callModel([{ role: "user", parts: [{ text: dialoguePrompt }] }], dialogueSystem, 150, 0.8);

  return dialogueRes || (hit
    ? `"${npcName} relaxes their guard. 'Very well, traveler. If you seek what was taken, look to the old ruins.'"`
    : `"${npcName} sneers with contempt. 'Your hollow words carry no weight here. Begone or draw steel!'"`
  );
}

export async function synthesizeTurnNarration(params: {
  pool: Pool;
  activeContext: SectorContext | null;
  activeProps: Map<string, TaggedObject>;
  activeNPCs: Map<string, InjectedNPC>;
  input: ActionInput;
  player: any;
  playerId: number;
  intent: ParsedIntent;
  playerRoll: number;
  playerStatVal: number;
  dcOrDefenderRoll: number;
  difference: number;
  hit: boolean;
  injuryPoints: number;
  detailedRollOutcome: any;
  lootAwarded?: { gold: number; item?: string | undefined } | undefined;
  inCharacterDialogue?: string | undefined;
  systemLog: string;
  customNarrative?: string | undefined;
  strictLlm: boolean;
  callModel: ModelCaller;
  callModelStrict: StrictModelCaller;
}): Promise<string> {
  const {
    pool,
    activeContext,
    activeProps,
    activeNPCs,
    input,
    player,
    playerId,
    intent,
    playerRoll,
    playerStatVal,
    dcOrDefenderRoll,
    difference,
    hit,
    injuryPoints,
    detailedRollOutcome,
    lootAwarded,
    inCharacterDialogue,
    systemLog,
    customNarrative,
    strictLlm,
    callModel,
    callModelStrict,
  } = params;

  let recentMemoriesContext = "";
  try {
    const narrCellId = Number(activeContext?.cellId || 0);
    if (narrCellId > 0) {
      const storyCtx = await buildStoryContext(
        pool,
        {
          cellId: narrCellId,
          rx: Number(activeContext?.rx ?? 50),
          ry: Number(activeContext?.ry ?? 50),
          z: Number(input.zLayer ?? activeContext?.z ?? 0),
        },
        { playerId },
        { tokenBudget: 1200 }
      );
      recentMemoriesContext = `WORLD & STORY CONTEXT:\n${renderStoryContext(storyCtx)}\n`;
    } else {
      const memRes = await pool.query(
        `SELECT summary FROM sim_gm_memories WHERE player_id = $1 ORDER BY id DESC LIMIT 3`,
        [playerId]
      );
      if (memRes.rows.length > 0) {
        recentMemoriesContext = `Recent Historical Memory Traces:\n${memRes.rows.map((r: any) => `- ${r.summary}`).reverse().join("\n")}\n`;
      }
    }
  } catch {}

  const pPos = input.playerPos || [128, 128];
  const distSq = (pos?: [number, number]) => {
    if (!pos) return 999999;
    return (pos[0] - pPos[0]) ** 2 + (pos[1] - pPos[1]) ** 2;
  };

  const relevantProps = Array.from(activeProps.values())
    .sort((a, b) => (a.id === intent.targetId ? -1 : b.id === intent.targetId ? 1 : distSq(a.pos) - distSq(b.pos)))
    .slice(0, 5);
  const scenePropsStr = relevantProps
    .map(p => `- ${p.name} (HP: ${p.hp}/${p.maxHp}${p.tags.has("locked") ? ", Locked" : ""}${p.tags.has("opened") ? ", Opened" : ""})`)
    .join("\n");

  const relevantNPCs = Array.from(activeNPCs.values())
    .sort((a, b) => (a.id === intent.targetId ? -1 : b.id === intent.targetId ? 1 : distSq(a.pos) - distSq(b.pos)))
    .slice(0, 5);
  const sceneNPCsStr = relevantNPCs
    .map(n => `- ${n.name} (${n.role}, ${n.faction}, Disposition: ${n.disposition >= 0 ? "Neutral/Friendly" : "Hostile/Suspicious"}, HP: ${n.hp}/${n.maxHp})`)
    .join("\n");

  const tacticalVisualContext = generateTacticalVisualSight(
    pPos,
    activeProps,
    activeNPCs,
    input.grid,
    input.zLayer || 0
  );

  const burgTitle = (activeContext as any)?.burgName ? `Burg of ${(activeContext as any).burgName}` : "Urban Sector";
  const playerSpokenWords = input.spokenDialogue?.trim();
  const recentSceneContext = input.recentContext && input.recentContext.length > 0
    ? `RECENT SCENE & CONVERSATION:\n${input.recentContext.slice(-4).join("\n")}\n\n`
    : "";
  const shownRoll = detailedRollOutcome?.attackerRoll ?? playerRoll;
  const shownStat = detailedRollOutcome?.attackerStatVal ?? playerStatVal;
  const shownTotal = detailedRollOutcome?.attackerTotal ?? (shownRoll + shownStat);
  const shownDefense = detailedRollOutcome?.defenderTotal ?? dcOrDefenderRoll;
  const narrativePrompt = `${recentMemoriesContext}${recentSceneContext}LOCATION: ${burgTitle} (Cell #${activeContext?.cellId || "Unknown"})
TACTICAL SIGHT:
${tacticalVisualContext}

NEARBY PROPS:
${scenePropsStr || "None"}
NEARBY NPCS:
${sceneNPCsStr || "None"}

ACTOR: ${player.name} (${player.species || "Humanoid"})
SPOKEN WORDS: ${playerSpokenWords ? `"${playerSpokenWords}"` : "None"}
ACTION: "${input.actionText}"
NPC REPLY: ${inCharacterDialogue ? `"${inCharacterDialogue}"` : "None"}

OUTCOME: ${intent.category} (${intent.verb}) on '${intent.targetName}' | Roll ${shownRoll} + Stat ${shownStat} = ${shownTotal} vs ${shownDefense} -> ${hit ? "SUCCESS" : "FAILED"} (Margin ${difference >= 0 ? "+" : ""}${difference})
DAMAGE/LOOT: ${injuryPoints > 0 ? `${injuryPoints} damage` : "0 damage"}${lootAwarded ? `, Loot: ${JSON.stringify(lootAwarded)}` : ""}
NOTES: ${systemLog || "None"}`;

  const gmInstruction = `You are the narrator of a dark low-fantasy tabletop RPG (B.R.U.T.A.L., Ostraka).
Write ONLY 2 to 4 crisp in-world sentences describing the immediate outcome of ${player.name}'s turn.

RULES:
- Speak strictly in-world as the GM narrator. NEVER break character, NEVER say "It seems you've created", NEVER summarize the prompt, and NEVER offer numbered options or "What would you like to do next?" lists.
- Continue directly from RECENT SCENE & CONVERSATION, acknowledge SPOKEN WORDS, and describe what happens to '${intent.targetName}' based on OUTCOME.
- If NPC REPLY is present, weave that exact NPC response into the scene.
- On a successful search/inspect, reveal a concrete tactical clue (lock condition, patrol gap, tracks, hidden latch).
- No purple prose or invented props/NPCs.`;

  const rawNarrative = customNarrative || (strictLlm
    ? await callModelStrict(
        "gm_narration",
        [{ role: "user", parts: [{ text: narrativePrompt }] }],
        gmInstruction,
        220,
        0.55
      )
    : await callModel(
        [{ role: "user", parts: [{ text: narrativePrompt }] }],
        gmInstruction,
        220,
        0.55
      ));
  const looksMeta = !rawNarrative || /\b(it seems (that )?you'?ve|to progress the story|choose one of the following|to proceed, i'?ll summarize|what would you like to do)\b/i.test(rawNarrative);
  if (strictLlm && !customNarrative && looksMeta) {
    throw new LlmError(
      "gm_narration",
      `GM model broke character with meta-assistant output instead of in-world narration: "${String(rawNarrative || "").slice(0, 140)}"`,
      502
    );
  }
  const npcReplyBit = inCharacterDialogue ? ` ${inCharacterDialogue}` : "";
  return (!looksMeta && rawNarrative) ? rawNarrative : (hit
    ? `${player.name} acts on ${intent.targetName} (${intent.verb.toLowerCase().replace(/_/g, " ")}) and succeeds.${npcReplyBit}`
    : `${player.name} presses ${intent.targetName}, but the attempt falls short (${shownTotal} vs ${shownDefense}).${npcReplyBit}`);
}
