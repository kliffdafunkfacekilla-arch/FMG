/**
 * citizenPersonaHelper.ts - Generates authentic living citizens and calculates
 * how their distinct human personalities influence their behavior as Cultists,
 * Wardens, or Mandate Zealots.
 */
import { flushStepDeltas } from "../deltas/index.js";
import type { Delta } from "../deltas/types.js";
import {
  type CitizenPersona,
  recruitCultistPersona,
  recruitWardenPersona,
  recruitMandatePersona,
} from "../macro/shared/personas.js";

export type { CitizenPersona };
export { recruitCultistPersona, recruitWardenPersona, recruitMandatePersona };

/**
 * Backfills any existing agents in sim_agents that lack citizen personas via deltas.
 */
export async function backfillBlankPersonas(client: any): Promise<number> {
  const blankRes = await client.query(`
    SELECT id, role, sub_role, home_burg_id, name
    FROM sim_agents
    WHERE citizen_name IS NULL OR citizen_name = '' ORDER BY id
  `);

  if (!blankRes.rows || blankRes.rows.length === 0) return 0;

  const deltas: Delta[] = [];
  for (const row of blankRes.rows) {
    let persona: CitizenPersona;
    if (row.role === "Cultist") {
      persona = recruitCultistPersona(`Burg #${row.home_burg_id || 1}`);
    } else if (row.role === "Warden") {
      persona = recruitWardenPersona();
    } else {
      persona = recruitMandatePersona(`Burg #${row.home_burg_id || 1}`);
    }

    const title = `${persona.citizenName} the ${persona.profession}`;
    const curName = String(row.name || "");
    const shouldRename =
      curName.startsWith("Cabal of ") ||
      curName === "Grey Warden Flow-Patrol" ||
      curName.startsWith("Chain Chapter of ");

    deltas.push({
      kind: "agent.update",
      agentId: Number(row.id),
      fields: {
        citizen_name: persona.citizenName,
        profession: persona.profession,
        species: persona.species,
        spark_tier: persona.sparkTier,
        personality_temper: persona.temper,
        personality_instinct: persona.instinct,
        motivation: persona.motivation,
        ...(shouldRename ? { name: title } : {}),
      },
    });
  }

  if (deltas.length > 0) {
    await flushStepDeltas(client, "agent:setup", 0, deltas);
  }

  return blankRes.rows.length;
}

