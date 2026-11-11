/**
 * Chaos flow tests (rule 9). Read-only: never writes to the database.
 *
 * 1. The canon prison table pins clock -> dragon -> Power to Canon/06 §2, with no retired names.
 * 2. Every flow's course starts at its own prison and ends at The Verge, inside the Holgaland map.
 * 3. The live sim_chaos_flows rows carry their canon identity and endpoints.
 */
import pool from "../db/pool.js";
import { CANON_DRAGON_PRISONS, VERGE_COORD } from "../engine/canon/dragonPrisons.js";
import { computeChaosFlowState, lunarSurgeModifier, parseChaosFlowAnchor } from "../engine/agents/chaosFlowAgent.js";

// Canon/06 §2 roster, by clock. Changing this list means canon changed: update it from canon, never by guess.
const CANON_ROSTER: [number, string, string][] = [
  [1, "Eldra", "Ratio"], [2, "Vecelo", "Motus"], [3, "Lophex", "Lux"], [4, "Sevrath", "Omen"],
  [5, "Grolak", "Anumis"], [6, "Gavusrix", "Vita"], [7, "Stagus", "Ordo"], [8, "Carulkem", "Nexus"],
  [9, "Virantor", "Aura"], [10, "Ulex", "Flux"], [11, "Vahn", "Lex"], [12, "Tiraton", "Mass"],
];
// Canon/02 "Old dragon names": retired, must not appear.
const RETIRED_NAMES = ["Aurgenas", "Tyrustis", "Metrion", "Termhill", "Opecten", "Igni", "Kyras", "Vrak", "Isolde"];

// Holgaland map extent (data/Holgaland.json info.width / info.height).
const MAP_W = 4608;
const MAP_H = 2496;

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  let allPassed = true;
  const run = async (label: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      console.log(`✅ ${label}`);
    } catch (err: any) {
      console.log(`❌ ${label}: ${err.message}`);
      allPassed = false;
    }
  };

  await run("Canon prison table matches Canon/06 roster", () => {
    check(CANON_DRAGON_PRISONS.length === 12, `expected 12 prisons, got ${CANON_DRAGON_PRISONS.length}`);
    for (const [clock, dragon, power] of CANON_ROSTER) {
      const p = CANON_DRAGON_PRISONS.find(x => x.clock === clock);
      check(p, `clock ${clock} missing`);
      check(p.dragon === dragon && p.power === power, `clock ${clock}: expected ${dragon}/${power}, got ${p.dragon}/${p.power}`);
      check(!RETIRED_NAMES.includes(p.dragon), `clock ${clock} uses retired name ${p.dragon}`);
    }
  });

  await run("Flow courses run prison -> The Verge inside the Holgaland map", () => {
    const phases = ["The Waxing Blood", "Full Blood", "Nightmare", "Mercy"];
    for (const p of CANON_DRAGON_PRISONS) {
      const anchor = parseChaosFlowAnchor({
        flow_id: p.clock, name: "x", dragon_name: p.dragon, elemental_power: p.power,
        source_coord: { x: p.x, y: p.y, cell: p.cell }, sink_coord: VERGE_COORD,
      });
      check(anchor, `clock ${p.clock}: anchor did not parse`);
      for (const tick of [0, 1, 97, 3096]) {
        for (const phase of phases) {
          const st = computeChaosFlowState(anchor, tick, { activeFlow: p.power, dragonDomain: p.dragon, lunarSurgeMod: lunarSurgeModifier(phase) });
          const first = st.waypoints[0];
          const last = st.waypoints[st.waypoints.length - 1];
          check(first && last, `clock ${p.clock}: no waypoints`);
          check(first.x === Math.round(p.x) && first.y === Math.round(p.y), `clock ${p.clock} tick ${tick}: starts at (${first.x},${first.y}), not its prison`);
          check(last.x === Math.round(VERGE_COORD.x) && last.y === Math.round(VERGE_COORD.y), `clock ${p.clock} tick ${tick}: ends at (${last.x},${last.y}), not The Verge`);
          for (const w of st.waypoints) {
            check(w.x >= 0 && w.x <= MAP_W && w.y >= 0 && w.y <= MAP_H, `clock ${p.clock} tick ${tick}: waypoint (${w.x},${w.y}) off the map`);
          }
          check(st.dragonName === p.dragon && st.elementalPower === p.power, `clock ${p.clock}: identity changed by computation`);
        }
      }
    }
  });

  await run("Legacy [x, y] coordinates still parse", () => {
    const a = parseChaosFlowAnchor({ flow_id: 1, source_coord: "[10, 20]", sink_coord: [30, 40] });
    check(a && a.source.x === 10 && a.sink.y === 40, "array coordinates not parsed");
    check(parseChaosFlowAnchor({ flow_id: 1, source_coord: null, sink_coord: [1, 2] }) === null, "missing source should be rejected");
  });

  await run("Live sim_chaos_flows rows carry canon identity and endpoints", async () => {
    const res = await pool.query(
      `SELECT flow_id, dragon_name, elemental_power, source_coord, sink_coord FROM sim_chaos_flows ORDER BY flow_id`
    );
    check(res.rows.length === 12, `expected 12 flows, got ${res.rows.length}`);
    const problems: string[] = [];
    for (const p of CANON_DRAGON_PRISONS) {
      const row = res.rows.find((r: any) => Number(r.flow_id) === p.clock);
      const a = row && parseChaosFlowAnchor(row);
      if (!row || !a) { problems.push(`flow ${p.clock}: missing or unparseable`); continue; }
      if (row.dragon_name !== p.dragon || row.elemental_power !== p.power) {
        problems.push(`flow ${p.clock}: ${row.dragon_name}/${row.elemental_power} (canon ${p.dragon}/${p.power})`);
      }
      if (Math.abs(a.source.x - p.x) > 0.5 || Math.abs(a.source.y - p.y) > 0.5) problems.push(`flow ${p.clock}: source not at prison`);
      if (Math.abs(a.sink.x - VERGE_COORD.x) > 0.5 || Math.abs(a.sink.y - VERGE_COORD.y) > 0.5) problems.push(`flow ${p.clock}: sink not at The Verge`);
    }
    check(problems.length === 0, `${problems.length} mismatches. ${problems.join("; ")}. Run scripts/repairChaosFlowIdentity`);
  });

  console.log(allPassed ? "\nALL CHAOS FLOW TESTS PASSED" : "\nCHAOS FLOW TESTS FAILED - COMMIT BLOCKED");
  await pool.end();
  if (!allPassed) process.exit(1);
}

main().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
