import { flushStepDeltas } from "../deltas/index.js";
import { ollamaGenerate } from "../llm.js";
import { loadChronicler } from "../macro/chronicler/load.js";
import { stepChronicler } from "../macro/chronicler/step.js";

export async function runChroniclerAgent(client: any, tick: number, loreDate: string) {
    const snap = await loadChronicler(client, tick, loreDate);
    const deltas = stepChronicler(snap);
    if (deltas.length > 0) {
        await flushStepDeltas(client, "agent:chronicler", tick, deltas);
    }
}

/**
 * Optional post-tick journalist helper (for API/UI consumption outside deterministic replay):
 * turns a cluster of factual sim_events lines into a 2-sentence tavern rumor without inventing names.
 */
export async function polishRumorWithOllama(factualSummary: string): Promise<string> {
    const prompt = `Turn these verified world facts into a 2-sentence tavern rumor in Ostraka. Use ONLY the exact names and places given; do NOT invent any character, town, or faction.\n\nFACTS:\n${factualSummary}`;
    const res = await ollamaGenerate(prompt, {
        system: "You are a concise dark-fantasy town crier. Output 2 grounded sentences only.",
        maxTokens: 110,
        temperature: 0.4,
        timeoutMs: 25000
    });
    return res ? res.trim() : factualSummary;
}
