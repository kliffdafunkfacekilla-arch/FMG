import type { Delta } from "../../deltas/types.js";

export interface DramaParagonSnapshot {
  id: number;
  name: string;
  title: string | null;
  want: string | null;
  flaw: string | null;
  lineWontCross: string | null;
  corruptionScore: number;
}

export interface DramaCitizenSnapshot {
  targetTypedId: string;
  name: string;
  profession: string | null;
}

export interface DramaBurgSnapshot {
  burgId: number;
  name: string;
  cellId: number;
  unrest: number;
  crimeRate: number;
  food: number;
  wealth: number;
  paragons: DramaParagonSnapshot[];
  citizens: DramaCitizenSnapshot[];
  cellTags: string[];
}

export interface AutonomousDramaSnapshot {
  tick: number;
  loreDate: string;
  burgs: DramaBurgSnapshot[];
}

/**
 * Pure Autonomous Drama step: collides local paragons' wants/flaws/lines against local targets
 * and cell tags via deterministic dice, emitting burg pressure, clash threads, and minor events.
 */
export function stepAutonomousDrama(
  snap: AutonomousDramaSnapshot
): { clashesOpened: number; deltas: Delta[] } {
  const deltas: Delta[] = [];
  let clashesOpened = 0;

  for (const burg of snap.burgs) {
    if (burg.paragons.length === 0) continue;

    const instigator = burg.paragons[(snap.tick + burg.burgId) % burg.paragons.length]!;
    const rivalParagon = burg.paragons.find((p) => p.id !== instigator.id);

    let targetTypedId: string | null = null;
    let targetLabel = "";
    let targetBonus = 1;

    if (rivalParagon && (snap.tick + burg.burgId) % 2 === 0) {
      targetTypedId = `paragon:${rivalParagon.id}`;
      targetLabel = `${rivalParagon.name} (${rivalParagon.title || "Paragon"})`;
      targetBonus = 2;
    } else if (burg.citizens.length > 0) {
      const cit = burg.citizens[(snap.tick + instigator.id) % burg.citizens.length]!;
      targetTypedId = cit.targetTypedId;
      targetLabel = `${cit.name} (${cit.profession || "Citizen"})`;
      targetBonus = 1;
    } else if (rivalParagon) {
      targetTypedId = `paragon:${rivalParagon.id}`;
      targetLabel = `${rivalParagon.name} (${rivalParagon.title || "Paragon"})`;
      targetBonus = 2;
    }

    if (!targetTypedId) continue;

    const tagNote = burg.cellTags.length > 0 ? ` [${burg.cellTags.slice(0, 3).join(", ")}]` : "";

    const corruption = Number(instigator.corruptionScore || 0);
    const unrest = Number(burg.unrest || 0);
    const oathBroken = unrest > 55 || corruption > 70;
    const instRoll = ((snap.tick * 19 + instigator.id * 7) % 12) + 1 + Math.floor(corruption / 25);
    const targRoll = ((snap.tick * 23 + burg.burgId * 11) % 12) + 1 + targetBonus;
    const instWon = instRoll >= targRoll;

    const wantTxt = String(instigator.want || "consolidate leverage").trim().replace(/\.$/, "");
    const flawTxt = String(instigator.flaw || "ruthlessness").trim().replace(/\.$/, "");
    const lineTxt = String(instigator.lineWontCross || "open bloodshed").trim().replace(/\.$/, "");

    const unrestBump = instWon ? (oathBroken ? 6 : 4) : 1;
    const crimeBump = instWon ? 2 : 0;

    deltas.push({
      kind: "burg.adjust",
      burgId: burg.burgId,
      unrest: unrestBump,
      crime: crimeBump,
    });

    const question = `Will ${instigator.name} force "${wantTxt}" over ${targetLabel} in ${burg.name}?`;
    const stakes = `${instigator.name} (${instigator.title || "Paragon"}, flaw: ${flawTxt}) collided with ${targetLabel} in ${burg.name}${tagNote}. ${oathBroken ? `Pressure pushed past their line (${lineTxt}).` : `Held back by line (${lineTxt}).`} Opening check ${instRoll} vs ${targRoll}.`;

    deltas.push({
      kind: "thread.open",
      spec: {
        question,
        stakes,
        actor_ids: [`paragon:${instigator.id}`, targetTypedId],
        cell_id: burg.cellId,
        rx: 50,
        ry: 50,
        clock: instWon ? 1 : 0,
        clock_max: 5,
        origin: "reaction",
        rule_id: "AUTONOMOUS_CLASH",
        created_tick: snap.tick,
        on_expire: {
          unrestDelta: 8,
          crimeRateDelta: 4,
          narrativeSummary: `${instigator.name} prevailed over ${targetLabel} in ${burg.name}, deepening local instability.`,
        },
        on_resolved_by_party: {
          unrestDelta: -6,
          crimeRateDelta: -3,
          narrativeSummary: `The clash between ${instigator.name} and ${targetLabel} in ${burg.name} was contained.`,
        },
      },
    });

    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      loreDate: snap.loreDate,
      type: "AUTONOMOUS_CLASH",
      tier: "MINOR",
      burgId: burg.burgId,
      cellId: burg.cellId,
      message: `[CLASH] ${instigator.name} pressed "${wantTxt}" against ${targetLabel} in ${burg.name}${tagNote} (Roll ${instRoll} vs ${targRoll}; Unrest +${unrestBump}).`,
    });

    clashesOpened++;
  }

  return { clashesOpened, deltas };
}
