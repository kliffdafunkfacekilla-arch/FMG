/**
 * Pure engine-layer AI party session definitions and Ollama intent generator (Phase 12.4, Rule 8).
 */
import { ollamaGenerateStrict, LlmError } from "../llm.js";

export interface PartySessionMember {
  id: number;
  name: string;
  role: string;
  species: string;
  pos: [number, number];
  color: string;
  badge: string;
  weapon: string;
  weaponStat: string;
  armor: string;
  hp: number;
  maxHp: number;
  composure: number;
  maxComposure: number;
  stamina: number;
  maxStamina: number;
  focus: number;
  maxFocus: number;
  owed?: { stamina: number; focus: number };
  spent?: { stamina: boolean; focus: boolean };
  persona: string;
  tacticalGoal: string;
  gold: number;
}

export interface PartySessionState {
  active: boolean;
  cellId: number;
  rx: number;
  ry: number;
  z: number;
  round: number;
  encounterRound?: number | undefined;
  encounterSeconds?: number | undefined;
  turnIndex: number;
  members: PartySessionMember[];
  activeStoryArc?: {
    arc_id: string;
    thread_id?: number;
    inciting_incident: string;
    active_phase: number;
    resolved?: boolean;
    resolution?: string;
    decisiveSuccessCount?: number;
    beats: Array<{ phase: number; objective: string; discovery_method: string }>;
  };
  history: Array<{
    round: number;
    turn: number;
    characterName: string;
    dialogue: string;
    action: string;
    rollOutcome: any;
    narrative: string;
    npcDialogue?: string | null;
    success: boolean;
    threadResolution?: any;
  }>;
}

export const INITIAL_MEMBERS: PartySessionMember[] = [
  {
    id: 101,
    name: "Harrow Grist",
    role: "Vanguard / Brawler",
    species: "Boar",
    pos: [124, 134],
    color: "#f59e0b",
    badge: "H",
    weapon: "Spiked Trench Cleaver",
    weaponStat: "might",
    armor: "Boar-Hide Scalemail",
    hp: 44,
    maxHp: 44,
    composure: 28,
    maxComposure: 28,
    stamina: 6,
    maxStamina: 6,
    focus: 8,
    maxFocus: 8,
    persona: "Gruff veteran of the Caldera trenches. Blunt, protective of allies, distrusts authority, prefers brute leverage.",
    tacticalGoal: "Secure the perimeter, intimidate arrogant guards, or smash obstacles blocking the party's way.",
    gold: 50
  },
  {
    id: 102,
    name: "Lyra Swift-Feather",
    role: "Aerial Scout / Sniper",
    species: "Osprey",
    pos: [132, 138],
    color: "#38bdf8",
    badge: "L",
    weapon: "Recurve Composite Bow",
    weaponStat: "awareness",
    armor: "Reinforced Plume-Vest",
    hp: 30,
    maxHp: 30,
    composure: 24,
    maxComposure: 24,
    stamina: 8,
    maxStamina: 8,
    focus: 9,
    maxFocus: 9,
    persona: "Sharp-eyed high-altitude scout from Skyroost. Analytical, patient, scans elevated perimeters and structural weaknesses.",
    tacticalGoal: "Spot sentries, climb high vantages, snipe hostile guards, or uncover concealed compartments.",
    gold: 50
  },
  {
    id: 103,
    name: "Orlo Mind-Weaver",
    role: "Aether Scholar / Occultist",
    species: "Red Panda",
    pos: [122, 140],
    color: "#a855f7",
    badge: "O",
    weapon: "Resonance Conduit Staff",
    weaponStat: "knowledge",
    armor: "Warded Ley-Silk Vestments",
    hp: 26,
    maxHp: 26,
    composure: 34,
    maxComposure: 34,
    stamina: 4,
    maxStamina: 4,
    focus: 12,
    maxFocus: 12,
    persona: "Curious, soft-spoken scholar from Peculiurus Spire. Fascinated by Ley flows and mechanical locks.",
    tacticalGoal: "Decipher arcane runes, manipulate ancient mechanisms, or assess anomalous chaos radiation.",
    gold: 50
  },
  {
    id: 104,
    name: "Vespera Velvet-Paws",
    role: "Infiltrator / Faceworker",
    species: "Fox",
    pos: [128, 132],
    color: "#10b981",
    badge: "V",
    weapon: "Twin Shadow-Forged Daggers",
    weaponStat: "finesse",
    armor: "Supple Shadow-Leathers",
    hp: 28,
    maxHp: 28,
    composure: 32,
    maxComposure: 32,
    stamina: 7,
    maxStamina: 7,
    focus: 10,
    maxFocus: 10,
    persona: "Charming, cynical syndicate negotiator. Fluent in thief cant and bureaucratic doublespeak.",
    tacticalGoal: "Bribe, distract, or deceive guards, pick complex locks, and slip past checkpoints unnoticed.",
    gold: 50
  }
];

export function createInitialPartySessionState(): PartySessionState {
  return {
    active: false,
    cellId: 30627,
    rx: 50,
    ry: 50,
    z: 0,
    round: 1,
    encounterRound: 0,
    encounterSeconds: 0,
    turnIndex: 0,
    members: JSON.parse(JSON.stringify(INITIAL_MEMBERS)),
    history: []
  };
}

/**
 * Generates an autonomous party member's grounded dialogue and action intent via Ollama.
 */
export async function fetchOllamaPlayerIntent(
  member: PartySessionMember,
  sceneProps: Array<{ id: string; name: string; hp: number; maxHp: number; tags: string[]; description?: string | undefined; pos?: [number, number] | undefined }>,
  sceneNPCs: Array<{ id: string; name: string; role: string; disposition: number; weapon?: string | undefined; tags: string[]; pos?: [number, number] | undefined }>,
  tacticalSight: string,
  activeTrouble: string,
  currentObjective: string,
  recentChronicle: string[]
): Promise<{ dialogue: string; action: string }> {
  const recentJoined = recentChronicle.join(" ").toLowerCase();
  const distSq = (pos?: [number, number]) => pos ? (pos[0] - member.pos[0]) ** 2 + (pos[1] - member.pos[1]) ** 2 : 999999;

  const prioritizedProps = [...sceneProps]
    .sort((a, b) => {
      const aMentioned = recentJoined.includes(a.name.toLowerCase()) ? 0 : 1;
      const bMentioned = recentJoined.includes(b.name.toLowerCase()) ? 0 : 1;
      return aMentioned !== bMentioned ? aMentioned - bMentioned : distSq(a.pos) - distSq(b.pos);
    })
    .slice(0, 6);

  const prioritizedNPCs = [...sceneNPCs]
    .sort((a, b) => {
      const aMentioned = recentJoined.includes(a.name.toLowerCase()) ? 0 : 1;
      const bMentioned = recentJoined.includes(b.name.toLowerCase()) ? 0 : 1;
      return aMentioned !== bMentioned ? aMentioned - bMentioned : distSq(a.pos) - distSq(b.pos);
    })
    .slice(0, 6);

  const propsSummary = prioritizedProps.length > 0
    ? prioritizedProps.map(p => `- "${p.name}" (HP: ${p.hp}/${p.maxHp}, Tags: ${p.tags.join(', ')})`).join('\n')
    : "- Open environment (no special props)";

  const npcsSummary = prioritizedNPCs.length > 0
    ? prioritizedNPCs.map(n => `- "${n.name}" (${n.role}, Armed with: ${n.weapon || 'unarmed'}, Disposition: ${n.disposition >= 0 ? 'Receptive' : 'Hostile/Guarded'})`).join('\n')
    : "- No other persons present";

  const prompt = `You are playing ${member.name}, a ${member.species} ${member.role} in B.R.U.T.A.L. (Ostraka, The Shatterlands).
Persona: ${member.persona}
Tactical Focus: ${member.tacticalGoal}
Equipped Weapon: ${member.weapon} (${member.weaponStat.toUpperCase()})

RECENT PARTY ACTIONS, NPC REPLIES & GM OUTCOMES (CONTINUITY IS PRIORITY #1):
${recentChronicle.length > 0 ? recentChronicle.slice(-4).join('\n') : "The party just arrived at this sector."}

ACTIVE WORLD TROUBLE: ${activeTrouble || "Civic tension and resource disputes in the district."}
CURRENT OBJECTIVE: ${currentObjective || "Investigate the sector and secure an advantage."}

TACTICAL SIGHT:
${tacticalSight}

NEARBY NPCS (prioritized):
${npcsSummary}

NEARBY PROPS (prioritized):
${propsSummary}

STRICT RULES:
1. CONTINUE THE ACTIVE SCENE: If an ally just spoke to or confronted an NPC (or inspected a prop) in RECENT PARTY ACTIONS, stay in that interaction—back up your ally, question/pressure that same NPC, or follow up on the clue they just uncovered instead of wandering off to an unrelated building.
2. DIALOGUE AND ACTION MUST MATCH: Your spoken Dialogue must express the exact same intent as your Action.
3. NO DUPLICATES OR PASSIVE TURNS: Do not repeat any line or action from RECENT PARTY ACTIONS, and never take passive turns ("I survey the area").
4. NAME A REAL TARGET: Target one of the NEARBY NPCS or NEARBY PROPS above by exact name.

Output ONLY valid JSON with two string fields:
{
  "dialogue": "your short in-character spoken line",
  "action": "I [what you do]"
}`;

  const text = await ollamaGenerateStrict(prompt, { stage: "party_intent", json: true, temperature: 0.75, maxTokens: 160, timeoutMs: 60000 });
  const raw = String(text || "").trim();

  let dialogue = "";
  let action = "";

  try {
    const clean = raw.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(clean);
    if (typeof parsed.dialogue === "string") dialogue = parsed.dialogue.trim();
    if (typeof parsed.action === "string") action = parsed.action.trim();
  } catch {
    const dMatch = raw.match(/\*{0,2}Dialogue\*{0,2}:\s*["“]?([^"”\n]+)["”]?/i);
    if (dMatch?.[1]) dialogue = dMatch[1].trim();
    const aMatch = raw.match(/\*{0,2}Action\*{0,2}:\s*([^\n]+)/i);
    if (aMatch?.[1]) action = aMatch[1].trim();
  }

  if (!action) {
    throw new LlmError("party_intent", `Ollama returned no usable action for ${member.name}: ${raw.slice(0, 180)}`, 502);
  }
  if (!action.toLowerCase().startsWith("i ")) {
    action = "I " + action;
  }
  if (!dialogue) {
    throw new LlmError("party_intent", `Ollama returned no usable dialogue for ${member.name}: ${raw.slice(0, 180)}`, 502);
  }

  return { dialogue, action };
}
