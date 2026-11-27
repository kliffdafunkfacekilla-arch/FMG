/**
 * Named people's lives for the player and dashboard (read-only):
 *   GET /api/people/npc/:npcId       the life behind an NPC on a map (404 when it has none: beasts, squads)
 *   GET /api/people/:citizenId       one person's full life
 *   GET /api/people/town/:burgId     who lives there (with a line or two each), the recently dead, the town's latest life news
 */
import express from "express";
import pool from "../db/pool.js";
import { citizenIdOfNpc, getLifeStories } from "../engine/entities/lifeStory.js";

export const peopleRouter = express.Router();

async function sendStory(res: express.Response, citizenId: number | null) {
  if (!citizenId) return res.status(404).json({ error: "No named person behind this id." });
  const story = (await getLifeStories(pool, [citizenId], 200)).get(citizenId);
  if (!story) return res.status(404).json({ error: `No person #${citizenId}.` });
  return res.json(story);
}

peopleRouter.get("/npc/:npcId", async (req, res) => {
  try {
    await sendStory(res, citizenIdOfNpc({ id: String(req.params.npcId) }));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

peopleRouter.get("/town/:burgId", async (req, res) => {
  try {
    const burgId = Number(req.params.burgId);
    const [livingRes, deadRes, newsRes, townRes] = await Promise.all([
      pool.query(
        `SELECT p.citizen_id, COUNT(le.id)::int AS n
         FROM population_demographics p LEFT JOIN sim_life_events le ON le.citizen_id = p.citizen_id
         WHERE p.settlement_id = $1 AND p.allegiance_status IN ('CIVILIAN', 'ON_CARAVAN')
         GROUP BY p.citizen_id ORDER BY n DESC, p.citizen_id LIMIT 40`,
        [burgId]
      ),
      pool.query(
        `SELECT p.citizen_id FROM population_demographics p
         JOIN sim_life_events le ON le.citizen_id = p.citizen_id AND le.kind = 'death'
         WHERE p.settlement_id = $1 ORDER BY le.tick DESC LIMIT 15`,
        [burgId]
      ),
      pool.query(
        `SELECT le.tick, le.kind, le.text, le.citizen_id, p.name
         FROM sim_life_events le JOIN population_demographics p ON p.citizen_id = le.citizen_id
         WHERE le.burg_id = $1 AND le.kind IN ('death', 'married', 'born', 'came_of_age', 'survived_raid', 'rival')
         ORDER BY le.tick DESC, le.id DESC LIMIT 30`,
        [burgId]
      ),
      pool.query(`SELECT name FROM sim_burg_economy WHERE burg_id = $1`, [burgId]),
    ]);
    const ids = [...livingRes.rows, ...deadRes.rows].map((r: any) => Number(r.citizen_id));
    const stories = await getLifeStories(pool, ids, 12);
    const brief = (id: number) => {
      const s = stories.get(id);
      return s && { citizenId: id, name: s.name, profession: s.profession, age: s.age, alive: s.alive, causeOfDeath: s.causeOfDeath, summary: s.summary };
    };
    res.json({
      burgId,
      town: townRes.rows[0]?.name || null,
      living: livingRes.rows.map((r: any) => brief(Number(r.citizen_id))).filter(Boolean),
      recentlyDead: deadRes.rows.map((r: any) => brief(Number(r.citizen_id))).filter(Boolean),
      news: newsRes.rows.map((r: any) => ({ tick: Number(r.tick), kind: String(r.kind), citizenId: Number(r.citizen_id), name: String(r.name), text: String(r.text) })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

peopleRouter.get("/:citizenId", async (req, res) => {
  try {
    await sendStory(res, Number(req.params.citizenId) || null);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});
