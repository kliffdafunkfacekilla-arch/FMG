/**
 * Component 1 (Rule 6): Intent & target parser translating player free-text into a structured B.R.U.T.A.L. action.
 */
import { LlmError } from "../../llm.js";
import type { TaggedObject } from "../TagMatrixEngine.js";
import type { InjectedNPC } from "../WhatElseStoryEngine.js";
import type { ActionCategory, ModelCaller, ParsedIntent, StrictModelCaller } from "./types.js";

export async function parsePlayerIntent(params: {
  actionText: string;
  strictLlm: boolean;
  activeProps: Map<string, TaggedObject>;
  activeNPCs: Map<string, InjectedNPC>;
  callModel: ModelCaller;
  callModelStrict: StrictModelCaller;
}): Promise<ParsedIntent> {
  const { actionText, strictLlm, activeProps, activeNPCs, callModel, callModelStrict } = params;
  const text = String(actionText || "").trim();
  const availableTargets = [
    ...Array.from(activeProps.values()).map(p => ({ id: p.id, name: p.name, tags: Array.from(p.tags) })),
    ...Array.from(activeNPCs.values()).map(n => ({ id: n.id, name: n.name, tags: n.tags }))
  ];

  const prompt = `Available Sector Targets: ${JSON.stringify(availableTargets)}
Player Action: "${text}"
Parse the action into JSON. Output ONLY valid JSON with keys:
{
  "category": "COMBAT|MAGIC|SOCIAL|SUBTERFUGE|EXPLORATION|SURVIVAL",
  "verb": "SLASH|STAB|SMASH|CAST_FIRE|CAST_LIGHTNING|IGNITE|TALK|PERSUADE|INTIMIDATE|BRIBE|DECEIVE|SNEAK|PICK_LOCK|UNLOCK|INSPECT|SEARCH|REST|FORAGE|HARVEST|GATHER|HUNT|TRACK|FIELD_DRESS|BUTCHER|COOK|BREW|USE_ITEM",
  "targetId": "<matching target id or empty>",
  "targetName": "<target name>",
  "statUsed": "might|endurance|finesse|reflex|vitality|fortitude|knowledge|logic|awareness|intuition|charm|willpower"
}`;

  try {
    const systemPrompt = "You are an exact intent parser for a dark fantasy RPG engine. Output only JSON.";
    const raw = strictLlm
      ? await callModelStrict("intent_parse", [{ role: "user", parts: [{ text: prompt }] }], systemPrompt, 400, 0.1)
      : await callModel([{ role: "user", parts: [{ text: prompt }] }], systemPrompt, 400, 0.1);

    if (raw) {
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Intent parser returned non-object JSON");
      }
      const category: ActionCategory = parsed.category || "CREATIVE_CHECK";
      const isCombat = category === "COMBAT";
      const verb = (parsed.verb || "CUSTOM_CHECK").toUpperCase();

      // Deterministically verify targetId against entities explicitly named in actionText
      const lowerText = text.toLowerCase();
      const textTokens = new Set(lowerText.split(/[^a-z0-9']+/).filter(w => w.length >= 3));
      const allEntities: Array<{ id: string; name: string }> = [
        ...Array.from(activeNPCs.values()).map(n => ({ id: n.id, name: n.name })),
        ...Array.from(activeProps.values()).map(p => ({ id: p.id, name: p.name }))
      ];
      let bestMatch: { id: string; name: string; score: number } | null = null;
      for (const ent of allEntities) {
        const entLower = ent.name.toLowerCase();
        if (lowerText.includes(entLower)) {
          const score = entLower.length + 100;
          if (!bestMatch || score > bestMatch.score) bestMatch = { ...ent, score };
          continue;
        }
        const entTokens = entLower.split(/[^a-z0-9']+/).filter(w => w.length >= 3);
        const overlap = entTokens.filter(t => textTokens.has(t)).length;
        if (overlap >= 2) {
          const score = overlap * 10 - Math.abs(entTokens.length - overlap);
          if (!bestMatch || score > bestMatch.score) bestMatch = { ...ent, score };
        }
      }

      const resolvedTargetId = bestMatch ? bestMatch.id : (parsed.targetId || "");
      const resolvedTargetName = bestMatch ? bestMatch.name : (parsed.targetName || "Surroundings");
      return {
        category,
        verb,
        targetId: resolvedTargetId,
        targetName: resolvedTargetName,
        statUsed: parsed.statUsed || "intuition",
        isCombat
      };
    }
  } catch (e: any) {
    if (strictLlm) {
      if (e instanceof LlmError) throw e;
      throw new LlmError("intent_parse", `Intent parser failed to produce valid JSON: ${e?.message || String(e)}`, 502);
    }
    console.warn("[BrutalGM] Intent parser fallback:", e);
  }

  // Heuristic Fallback
  const lower = text.toLowerCase();

  // Helper for boundary-safe keyword matching
  const hasWord = (...words: string[]) => words.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower));

  // Explicit combat check to avoid attacking innocent bystanders
  const isExplicitAttack = hasWord("attack", "slash", "strike", "stab", "shoot", "smash", "kill", "thrust", "cleave", "behead");

  let category: ActionCategory = isExplicitAttack ? "COMBAT" : "CREATIVE_CHECK";
  let verb = isExplicitAttack ? "SLASH" : "CUSTOM_CHECK";
  let statUsed = isExplicitAttack ? "might" : "intuition";

  if (hasWord("play", "lute", "flute", "song", "sing", "dance", "perform", "poem", "recite", "ballad", "melody", "lullaby")) {
    category = "CREATIVE_CHECK";
    verb = "PERFORM";
    statUsed = "charm";
  } else if (hasWord("use", "apply", "drink", "consume", "eat", "swallow", "potion", "salve", "poultice", "draught") && (hasWord("ration", "salve", "potion", "draught", "meat", "herb") || hasWord("use", "drink", "eat"))) {
    category = "SURVIVAL";
    verb = "USE_ITEM";
    statUsed = "vitality";
  } else if (hasWord("forage", "harvest", "gather", "botany", "flora", "herbs", "herb", "mushrooms", "roots")) {
    category = "SURVIVAL";
    verb = "FORAGE";
    statUsed = "awareness";
  } else if (hasWord("butcher", "field dress", "dress", "skin", "carcass", "pelt", "flesh", "gut")) {
    category = "SURVIVAL";
    verb = "FIELD_DRESS";
    statUsed = "finesse";
  } else if (hasWord("hunt", "track", "stalk")) {
    category = "SURVIVAL";
    verb = "HUNT";
    statUsed = "awareness";
  } else if (hasWord("cook", "roast", "bake", "fry")) {
    category = "SURVIVAL";
    verb = "COOK";
    statUsed = "vitality";
  } else if (hasWord("brew", "concoct", "distill")) {
    category = "SURVIVAL";
    verb = "BREW";
    statUsed = "knowledge";
  } else if (hasWord("rest", "sleep", "camp", "bivouac", "nap") && !hasWord("wrestle", "forest", "crested", "arrest", "chest")) {
    category = "SURVIVAL";
    verb = "REST";
    statUsed = "vitality";
  } else if (hasWord("talk", "speak", "converse", "negotiate", "chat", "greet", "hail") || (hasWord("ask") && !hasWord("cask", "flask", "mask", "task"))) {
    category = "SOCIAL";
    verb = "TALK";
    statUsed = "charm";
  } else if (hasWord("bribe") || (hasWord("pay") && !hasWord("spray"))) {
    category = "SOCIAL";
    verb = "BRIBE";
    statUsed = "charm";
  } else if (hasWord("intimidate", "threaten", "scare", "bully", "interrogate")) {
    category = "SOCIAL";
    verb = "INTIMIDATE";
    statUsed = "might";
  } else if (hasWord("pray", "meditate", "commune", "channel", "invoke")) {
    category = "MAGIC";
    verb = "CHANNEL_CHAOS";
    statUsed = "willpower";
  } else if (hasWord("fire", "burn", "ignite", "torch", "fireball")) {
    category = "MAGIC";
    verb = "IGNITE";
    statUsed = "intuition";
  } else if (hasWord("lightning", "shock", "electric", "spark", "zap")) {
    category = "MAGIC";
    verb = "CAST_LIGHTNING";
    statUsed = "intuition";
  } else if (hasWord("freeze", "frost", "ice", "chill")) {
    category = "MAGIC";
    verb = "CAST_ICE";
    statUsed = "intuition";
  } else if (hasWord("sneak", "shadow", "creep", "skulk", "hide")) {
    category = "SUBTERFUGE";
    verb = "SNEAK";
    statUsed = "finesse";
  } else if (hasWord("lock", "lockpick", "pick") && !hasWord("pickpocket")) {
    category = "SUBTERFUGE";
    verb = "PICK_LOCK";
    statUsed = "finesse";
  } else if (hasWord("search", "inspect", "examine", "look", "study", "read", "scrutinize", "scan", "scout", "climb", "survey", "watch")) {
    category = "EXPLORATION";
    verb = "SEARCH";
    statUsed = "awareness";
  } else if (hasWord("cross", "ford", "traverse", "leap", "jump", "fly", "dash", "swim") && (hasWord("river", "flow", "torrent", "cataract", "chasm", "water", "ford", "current", "chaos", "vein", "strand", "ribbon", "stones", "airship", "skyship") || lower.includes("ford") || lower.includes("flow"))) {
    category = "EXPLORATION";
    verb = "CROSS_CHAOS_FLOW";
    statUsed = hasWord("fly", "airship", "skyship") ? "logic" : (hasWord("leap", "jump", "dash", "sprint") ? "reflex" : "endurance");
  }

  // Pick matching target ONLY if explicitly mentioned in action text (excluding stop-words)
  const stopWords = new Set(["the", "a", "an", "of", "in", "to", "for", "with", "on", "at", "from", "by", "about"]);
  let matchedTarget: any = null;
  for (const t of availableTargets) {
    const cleanName = t.name.toLowerCase().replace(/^(the|a|an)\s+/i, "").trim();
    const tokens = cleanName.split(/\s+/).filter((tok: string) => tok.length > 2 && !stopWords.has(tok));
    if (tokens.some((tok: string) => new RegExp(`\\b${tok}\\b`, "i").test(lower))) {
      matchedTarget = t;
      break;
    }
  }

  return {
    category,
    verb,
    targetId: matchedTarget ? matchedTarget.id : "",
    targetName: matchedTarget ? matchedTarget.name : "Surroundings",
    statUsed,
    isCombat: category === "COMBAT"
  };
}
