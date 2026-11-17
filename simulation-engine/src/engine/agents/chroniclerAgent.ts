import { dateForTick } from "../canon/calendar.js";
import { ollamaGenerate } from "../llm.js";

export async function runChroniclerAgent(client: any, tick: number, loreDate: string) {
    // Only log the macro Chronos turn marker on the first day of each month (and of Shadowfall) to prevent event log bloat
    if (dateForTick(tick).dayOfMonth === 1) {
        await client.query(
            "INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'TURN_LOG', $2, 'MINOR', $3)",
            [tick, `The Chronos wheel turns. A new Dragon Month dawns across Ostraka: ${loreDate}.`, loreDate]
        );
    }

    // Cluster 2-3 recent autonomous clash/resolution events from the last 5 ticks into a deterministic REGIONAL_RUMOR
    const recentRumorCheck = await client.query(
        `SELECT 1 FROM sim_events WHERE type = 'REGIONAL_RUMOR' AND tick >= $1 LIMIT 1`,
        [Math.max(0, tick - 2)]
    );
    if ((recentRumorCheck.rowCount || 0) > 0) return;

    const dramaRes = await client.query(
        `SELECT e.burg_id, e.cell_id, e.type, e.message, b.name AS burg_name
         FROM sim_events e
         LEFT JOIN sim_burg_economy b ON b.burg_id = e.burg_id
         WHERE e.tick >= $1
           AND e.type IN ('AUTONOMOUS_CLASH', 'THREAD_THWARTED_BY_LOCALS', 'THREAD_RESOLVED', 'BURG_FAMINE')
         ORDER BY e.tick DESC, e.id DESC
         LIMIT 3`,
        [Math.max(1, tick - 5)]
    );

    if (dramaRes.rows.length >= 2) {
        const anchor = dramaRes.rows[0];
        const summaryBits = dramaRes.rows
            .map((r: any) => String(r.message || "").replace(/^\[[^\]]+\]\s*/, "").trim())
            .filter(Boolean);
        const rumorMsg = `[RUMOR] Travelers along the roads speak of recent upheavals: ${summaryBits.join(" Meanwhile, ")}`;
        await client.query(
            `INSERT INTO sim_events (tick, burg_id, cell_id, type, message, tier, lore_date)
             VALUES ($1, $2, $3, 'REGIONAL_RUMOR', $4, 'MINOR', $5)`,
            [tick, anchor.burg_id ?? null, anchor.cell_id ?? null, rumorMsg.slice(0, 600), loreDate]
        );
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
