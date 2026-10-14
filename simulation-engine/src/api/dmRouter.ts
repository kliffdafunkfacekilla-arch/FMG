import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { ConcordiaGameMaster } from '../engine/rpg/ConcordiaGM.js';

dotenv.config({ override: true });

const router = express.Router();
const pool = new Pool({ connectionString: 'postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres' });

import { getWeapon, getArmor, STAT_WEAPON_GROUPS, STAT_ARMOR_GROUPS } from '../engine/rpg/EquipmentRegistry.js';
import { generateCharacterFromSpecies, buildOstrakaCustomCharacter } from '../engine/rpg/CharacterGenerator.js';
import {
  KINGDOMS,
  LINEAGES,
  INSTITUTIONS,
  MASTERY_PERKS,
  SKILL_DB,
  calcDerivedStats,
  getUnlockedPerks,
  MAIN_TYPES,
  SUB_TYPES,
  FINAL_TYPES,
  POWER_NULL_TRACKS,
  OFFENSE_SKILLS,
  DEFENSE_SKILLS,
  BODY_STAT_TO_KINGDOM,
  KINGDOM_TO_BODY_STAT,
  KINGDOM_LORE,
  SUB_TYPE_LORE
} from '../engine/rpg/CharacterData.js';

import {
  OFFENSIVE_SKILL_TRACKS,
  DEFENSIVE_SKILL_TRACKS,
  REALITY_POWER_TREES,
  REALITY_NULL_TREES
} from '../engine/rpg/MasterSkillProgression.js';

// Initialize Singleton Concordia Game Master
const concordiaGM = new ConcordiaGameMaster(pool, process.env.GEMINI_API_KEY || '');

function parseJsonField(val: any, fallback: any = {}) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function enrichCharacter(p: any) {
  if (!p) return null;
  const weaponDef = getWeapon(p.equipped_weapon || 'Osmium Greatsword');
  const armorDef = getArmor(p.equipped_armor || 'Juggernaut Osmium Plate');

  const stats = {
    might: p.might || 1,
    endurance: p.endurance || 1,
    finesse: p.finesse || 1,
    reflex: p.reflex || 1,
    vitality: p.vitality || 1,
    fortitude: p.fortitude || 1,
    knowledge: p.knowledge || 1,
    logic: p.logic || 1,
    awareness: p.awareness || 1,
    intuition: p.intuition || 1,
    charm: p.charm || 1,
    willpower: p.willpower || 1
  };

  const derived = calcDerivedStats(stats);
  const unlockedPerks = getUnlockedPerks(stats);

  return {
    ...p,
    passive_traits: parseJsonField(p.passive_traits, []),
    skills: parseJsonField(p.skills, []),
    mastery_perks: parseJsonField(p.mastery_perks, unlockedPerks),
    skill_ranks: parseJsonField(p.skill_ranks, {}),
    skill_points: p.skill_points || 0,
    weapon_stat: weaponDef.stat,
    weapon_mod: weaponDef.mod,
    weapon_damage_bonus: weaponDef.damageBonus,
    weapon_metal: weaponDef.conductorMetal,
    weapon_tags: weaponDef.tags,
    weapon_desc: weaponDef.description,
    armor_stat: armorDef.stat,
    armor_mod: armorDef.mod,
    armor_dr: armorDef.damageReduction,
    armor_metal: armorDef.conductorMetal,
    armor_tags: armorDef.tags,
    armor_desc: armorDef.description,
    derived_stats: derived
  };
}

/**
 * GET /rules/skills - Returns the canonical 3-Branch x 4-Rank Skill & Power Progression Trees
 */
router.get('/rules/skills', (req, res) => {
  try {
    res.json({
      offensiveSkillTracks: OFFENSIVE_SKILL_TRACKS,
      defensiveSkillTracks: DEFENSIVE_SKILL_TRACKS,
      realityPowerTrees: REALITY_POWER_TREES,
      realityNullTrees: REALITY_NULL_TREES
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /character/options - Returns full catalogue of Kingdoms, Species Lineages, Institutions, Weapons, Armors, Skills, and Mastery Perks
 */
router.get('/character/options', (req, res) => {
  try {
    res.json({
      kingdoms: KINGDOMS,
      lineages: LINEAGES,
      institutions: INSTITUTIONS,
      mainTypes: MAIN_TYPES,
      subTypes: SUB_TYPES,
      finalTypes: FINAL_TYPES,
      powerNullTracks: POWER_NULL_TRACKS,
      offenseSkills: OFFENSE_SKILLS,
      defenseSkills: DEFENSE_SKILLS,
      weapons: STAT_WEAPON_GROUPS,
      armors: STAT_ARMOR_GROUPS,
      skills: SKILL_DB,
      masteryPerks: MASTERY_PERKS,
      kingdomLore: KINGDOM_LORE,
      subTypeLore: SUB_TYPE_LORE,
      bodyStatToKingdom: BODY_STAT_TO_KINGDOM,
      kingdomToBodyStat: KINGDOM_TO_BODY_STAT,
      offensiveSkillTracks: OFFENSIVE_SKILL_TRACKS,
      defensiveSkillTracks: DEFENSIVE_SKILL_TRACKS,
      realityPowerTrees: REALITY_POWER_TREES,
      realityNullTrees: REALITY_NULL_TREES
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /player - Returns player character sheet with 12-stat equipment enrichment
 */
router.get('/player', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sim_player_character ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) return void res.status(404).json({ error: 'Player not found' });
    res.json(enrichCharacter(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /character/roll - Generates species-attuned 12-stat attributes & equipment preview
 */
router.post('/character/roll', (req, res) => {
  try {
    const rolled = buildOstrakaCustomCharacter(req.body || {});
    const weaponDef = getWeapon(rolled.equippedWeapon);
    const armorDef = getArmor(rolled.equippedArmor);
    res.json({
      ...rolled,
      weapon_stat: weaponDef.stat,
      weapon_mod: weaponDef.mod,
      weapon_damage_bonus: weaponDef.damageBonus,
      weapon_metal: weaponDef.conductorMetal,
      weapon_tags: weaponDef.tags,
      weapon_desc: weaponDef.description,
      armor_stat: armorDef.stat,
      armor_mod: armorDef.mod,
      armor_dr: armorDef.damageReduction,
      armor_metal: armorDef.conductorMetal,
      armor_tags: armorDef.tags,
      armor_desc: armorDef.description
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /character/create - Creates and stores a new character
 */
router.post('/character/create', async (req, res) => {
  try {
    const {
      name, kingdom, lineage, species, institution,
      mainType, subType, finalType,
      powerNullTrack, offenseSkill, defenseSkill,
      might, endurance, finesse, reflex, vitality, fortitude,
      knowledge, logic, awareness, intuition, charm, willpower,
      equippedWeapon, equippedArmor,
      passiveTraits, skills, masteryPerks,
      skillRanks, skillPoints,
      difficulty
    } = req.body;

    const charName = (name && name.trim()) || 'Ostraka Wanderer';
    const charKingdom = kingdom || 'Mammal';
    const charLineage = lineage || 'Ursine';
    const charSpecies = species || 'Bear-Folk';
    const charInstitution = institution || 'Mass';
    const charMainType = mainType || 'Titan';
    const charSubType = subType || 'Arcanist';
    const charFinalType = finalType || 'Vanguard';
    const charTrack = powerNullTrack || 'Mass Track';
    const charOffense = offenseSkill || 'Shatter Impact';
    const charDefense = defenseSkill || 'Brace Impact';
    const charDifficulty = (difficulty && ['casual', 'survivor', 'hardcore'].includes(String(difficulty).toLowerCase()))
      ? String(difficulty).toLowerCase()
      : 'survivor';

    const m = Number(might) || 1;
    const e = Number(endurance) || 1;
    const f = Number(finesse) || 1;
    const r = Number(reflex) || 1;
    const v = Number(vitality) || 1;
    const fort = Number(fortitude) || 1;
    const k = Number(knowledge) || 1;
    const l = Number(logic) || 1;
    const aw = Number(awareness) || 1;
    const it = Number(intuition) || 1;
    const ch = Number(charm) || 1;
    const w = Number(willpower) || 1;

    const stats = { might: m, endurance: e, finesse: f, reflex: r, vitality: v, fortitude: fort, knowledge: k, logic: l, awareness: aw, intuition: it, charm: ch, willpower: w };
    const derived = calcDerivedStats(stats);

    const wpn = (equippedWeapon && equippedWeapon.trim()) || 'Osmium Greatsword';
    const arm = (equippedArmor && equippedArmor.trim()) || 'Juggernaut Osmium Plate';

    const traitsJson = JSON.stringify(passiveTraits || []);
    const skillsJson = JSON.stringify(skills || []);
    const perksJson = JSON.stringify(masteryPerks || getUnlockedPerks(stats));
    const skillRanksJson = JSON.stringify(skillRanks || {});
    const sPoints = Number(skillPoints) || 0;

    const checkRes = await pool.query('SELECT id FROM sim_player_character ORDER BY id ASC LIMIT 1');
    let charRow;
    if (checkRes.rows.length > 0) {
      const updateRes = await pool.query(`
        UPDATE sim_player_character SET
          name = $1, kingdom = $2, lineage = $3, species = $4, institution = $5,
          might = $6, endurance = $7, finesse = $8, reflex = $9, vitality = $10, fortitude = $11,
          knowledge = $12, logic = $13, awareness = $14, intuition = $15, charm = $16, willpower = $17,
          current_hp = $18, max_hp = $18, composure = $19, stamina_max = $20, focus_max = $21,
          phys_defense = $22, speed = $23,
          passive_traits = $24, skills = $25, mastery_perks = $26,
          equipped_weapon = $27, equipped_armor = $28,
          main_type = $29, sub_type = $30, final_type = $31,
          power_null_track = $32, offense_skill = $33, defense_skill = $34,
          difficulty = $35,
          skill_ranks = $36, skill_points = $37,
          gold = 50, inventory = '[]'::jsonb, xp = 0, level = 1, current_quest_beat = 0
        WHERE id = $38
        RETURNING *
      `, [
        charName, charKingdom, charLineage, charSpecies, charInstitution,
        m, e, f, r, v, fort, k, l, aw, it, ch, w,
        derived.maxHp, derived.maxComposure, derived.maxStamina, derived.maxFocus,
        derived.physDefense, derived.speed,
        traitsJson, skillsJson, perksJson,
        wpn, arm,
        charMainType, charSubType, charFinalType,
        charTrack, charOffense, charDefense,
        charDifficulty,
        skillRanksJson, sPoints,
        checkRes.rows[0].id
      ]);
      charRow = updateRes.rows[0];
    } else {
      const insertRes = await pool.query(`
        INSERT INTO sim_player_character (
          name, kingdom, lineage, species, institution,
          might, endurance, finesse, reflex, vitality, fortitude,
          knowledge, logic, awareness, intuition, charm, willpower,
          current_hp, max_hp, composure, stamina_max, focus_max,
          phys_defense, speed,
          passive_traits, skills, mastery_perks,
          equipped_weapon, equipped_armor,
          main_type, sub_type, final_type,
          power_null_track, offense_skill, defense_skill,
          difficulty,
          skill_ranks, skill_points,
          gold, inventory, xp, level, current_quest_beat
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $18, $19, $20, $21,
          $22, $23,
          $24, $25, $26,
          $27, $28,
          $29, $30, $31,
          $32, $33, $34,
          $35,
          $36, $37,
          50, '[]'::jsonb, 0, 1, 0
        )
        RETURNING *
      `, [
        charName, charKingdom, charLineage, charSpecies, charInstitution,
        m, e, f, r, v, fort, k, l, aw, it, ch, w,
        derived.maxHp, derived.maxComposure, derived.maxStamina, derived.maxFocus,
        derived.physDefense, derived.speed,
        traitsJson, skillsJson, perksJson,
        wpn, arm,
        charMainType, charSubType, charFinalType,
        charTrack, charOffense, charDefense,
        charDifficulty,
        skillRanksJson, sPoints
      ]);
      charRow = insertRes.rows[0];
    }

    res.json({ success: true, character: enrichCharacter(charRow) });
  } catch (err: any) {
    console.error('Character creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /player/levelup - Invest skill point into a canonical branch (Rank 1 to 4)
 */
router.post('/player/levelup', async (req, res) => {
  try {
    const { branchId, grantFreeLevel, statBonus } = req.body;
    const playerRes = await pool.query('SELECT * FROM sim_player_character ORDER BY id ASC LIMIT 1');
    if (playerRes.rows.length === 0) return void res.status(404).json({ error: 'Player not found' });
    const p = playerRes.rows[0];

    let currentLevel = Number(p.level) || 1;
    let currentSkillPoints = Number(p.skill_points) || 0;

    if (grantFreeLevel) {
      currentLevel += 1;
      currentSkillPoints += 1;
    }

    if (!branchId && !statBonus) {
      // Just applying a level up or checking status
      const updateRes = await pool.query(
        'UPDATE sim_player_character SET level = $1, skill_points = $2 WHERE id = $3 RETURNING *',
        [currentLevel, currentSkillPoints, p.id]
      );
      return void res.json({ success: true, character: enrichCharacter(updateRes.rows[0]) });
    }

    if (currentSkillPoints <= 0 && !grantFreeLevel) {
      return void res.status(400).json({ error: 'No skill points available to spend.' });
    }

    const currentRanks: Record<string, number> = parseJsonField(p.skill_ranks, {});
    if (branchId) {
      const existingRank = currentRanks[branchId] || 0;
      if (existingRank >= 4) {
        return void res.status(400).json({ error: 'Branch is already at maximum Rank 4.' });
      }
      currentRanks[branchId] = existingRank + 1;
      currentSkillPoints -= 1;
    }

    const VALID_STATS = ['might', 'endurance', 'reflex', 'finesse', 'vitality', 'fortitude', 'knowledge', 'logic', 'awareness', 'intuition', 'charm', 'willpower'];
    let statClause = '';
    const updateParams: any[] = [currentLevel, currentSkillPoints, JSON.stringify(currentRanks)];
    let paramIdx = 4;
    if (statBonus && VALID_STATS.includes(statBonus)) {
      if (!branchId) currentSkillPoints -= 1;
      const newStatVal = (Number(p[statBonus]) || 1) + 1;
      updateParams.push(newStatVal);
      statClause = `, ${statBonus} = $${paramIdx}`;
      paramIdx++;
    }
    updateParams.push(p.id);

    const updateRes = await pool.query(`
      UPDATE sim_player_character
      SET level = $1, skill_points = $2, skill_ranks = $3${statClause}
      WHERE id = $${paramIdx}
      RETURNING *
    `, updateParams);

    res.json({
      success: true,
      branchId: branchId || undefined,
      newRank: branchId ? currentRanks[branchId] : undefined,
      statUpgraded: statBonus || undefined,
      remainingSkillPoints: currentSkillPoints,
      character: enrichCharacter(updateRes.rows[0])
    });
  } catch (err: any) {
    console.error('Level up error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /save - Saves full game state to PostgreSQL slot
 */
router.post('/save', async (req, res) => {
  try {
    const { slotName, characterData, worldPos, storyState } = req.body;
    const now = new Date();
    const defaultName = `Save - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const sName = (slotName && slotName.trim()) || defaultName;
    const playerId = characterData?.id || 1;
    const sDifficulty = (characterData?.difficulty && ['casual', 'survivor', 'hardcore'].includes(String(characterData.difficulty).toLowerCase()))
      ? String(characterData.difficulty).toLowerCase()
      : 'survivor';

    const saveRes = await pool.query(`
      INSERT INTO sim_game_saves (slot_name, player_id, character_data, world_pos, story_state, difficulty, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, slot_name, difficulty, created_at, updated_at
    `, [sName, playerId, JSON.stringify(characterData || {}), JSON.stringify(worldPos || {}), JSON.stringify(storyState || {}), sDifficulty]);

    res.json({ success: true, save: saveRes.rows[0] });
  } catch (err: any) {
    console.error('Save error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /saves - Retrieves all saved game slots
 */
router.get('/saves', async (req, res) => {
  try {
    const savesRes = await pool.query(`
      SELECT id, slot_name, player_id, difficulty,
             character_data->>'name' as player_name,
             character_data->>'level' as player_level,
             character_data->>'current_hp' as player_hp,
             character_data->>'max_hp' as player_max_hp,
             character_data->>'gold' as player_gold,
             character_data->>'equipped_weapon' as equipped_weapon,
             character_data->>'equipped_armor' as equipped_armor,
             world_pos, story_state->'activeBeat'->>'title' as quest_title,
             created_at, updated_at
      FROM sim_game_saves
      ORDER BY updated_at DESC
    `);
    res.json({ success: true, saves: savesRes.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /load/:id - Loads a game save and restores player & story state
 */
router.post('/load/:id', async (req, res) => {
  try {
    const saveId = req.params.id;
    const saveRes = await pool.query('SELECT * FROM sim_game_saves WHERE id = $1', [saveId]);
    if (saveRes.rows.length === 0) return void res.status(404).json({ error: 'Save slot not found' });

    const save = saveRes.rows[0];
    const charData = typeof save.character_data === 'string' ? JSON.parse(save.character_data) : save.character_data;
    const worldPos = typeof save.world_pos === 'string' ? JSON.parse(save.world_pos) : save.world_pos;
    const storyState = typeof save.story_state === 'string' ? JSON.parse(save.story_state) : save.story_state;
    const restoredDiff = charData?.difficulty || save.difficulty || 'survivor';

    if (charData) {
      await pool.query(`
        UPDATE sim_player_character SET
          name = COALESCE($1, name),
          might = COALESCE($2, might), endurance = COALESCE($3, endurance),
          finesse = COALESCE($4, finesse), reflex = COALESCE($5, reflex),
          vitality = COALESCE($6, vitality), fortitude = COALESCE($7, fortitude),
          knowledge = COALESCE($8, knowledge), logic = COALESCE($9, logic),
          awareness = COALESCE($10, awareness), intuition = COALESCE($11, intuition),
          charm = COALESCE($12, charm), willpower = COALESCE($13, willpower),
          current_hp = COALESCE($14, current_hp), max_hp = COALESCE($15, max_hp),
          equipped_weapon = COALESCE($16, equipped_weapon), equipped_armor = COALESCE($17, equipped_armor),
          gold = COALESCE($18, gold), inventory = $19::jsonb, xp = COALESCE($20, xp), level = COALESCE($21, level),
          difficulty = COALESCE($22, difficulty)
        WHERE id = 1
      `, [
        charData.name, charData.might, charData.endurance, charData.finesse, charData.reflex,
        charData.vitality, charData.fortitude, charData.knowledge, charData.logic, charData.awareness,
        charData.intuition, charData.charm, charData.willpower, charData.current_hp, charData.max_hp,
        charData.equipped_weapon, charData.equipped_armor, charData.gold,
        JSON.stringify(charData.inventory || []), charData.xp, charData.level,
        restoredDiff
      ]);
    }

    if (storyState) {
      concordiaGM.restoreState(storyState);
    }

    const playerRes = await pool.query('SELECT * FROM sim_player_character ORDER BY id ASC LIMIT 1');
    const enriched = enrichCharacter(playerRes.rows[0]);

    res.json({
      success: true,
      character: enriched,
      worldPos,
      storyState
    });
  } catch (err: any) {
    console.error('Load error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /saves/:id - Deletes a game save slot
 */
router.delete('/saves/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sim_game_saves WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /player/revive - Restores a fallen hero with partial HP and small gold penalty
 */
router.post('/player/revive', async (req, res) => {
  try {
    const playerRes = await pool.query('SELECT * FROM sim_player_character ORDER BY id ASC LIMIT 1');
    if (playerRes.rows.length === 0) return void res.status(404).json({ error: 'Player not found' });
    const p = playerRes.rows[0];

    const restoredHp = Math.max(10, Math.floor((Number(p.max_hp) || 20) * 0.5));
    const goldCost = Math.min(Number(p.gold) || 0, 25);
    const newGold = Math.max(0, (Number(p.gold) || 0) - goldCost);

    const updateRes = await pool.query(`
      UPDATE sim_player_character
      SET current_hp = $1, gold = $2
      WHERE id = $3
      RETURNING *
    `, [restoredHp, newGold, p.id]);

    const enriched = enrichCharacter(updateRes.rows[0]);
    res.json({
      success: true,
      character: enriched,
      restoredHp,
      goldLost: goldCost,
      respawnPos: { lx: 128, ly: 128 }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /player/permadeath - Records fallen hardcore hero to Hall of the Fallen and wipes saves
 */
router.post('/player/permadeath', async (req, res) => {
  try {
    const { causeOfDeath, sectorX, sectorY } = req.body;
    const playerRes = await pool.query('SELECT * FROM sim_player_character ORDER BY id ASC LIMIT 1');
    if (playerRes.rows.length === 0) return void res.status(404).json({ error: 'Player not found' });
    const p = playerRes.rows[0];

    // Insert into memorials archive
    const memorialRes = await pool.query(`
      INSERT INTO sim_character_memorials (
        player_name, kingdom, species, lineage, level, gold,
        equipped_weapon, equipped_armor, sector_x, sector_y,
        difficulty, cause_of_death, fallen_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *
    `, [
      p.name || 'Unknown Hero',
      p.kingdom || 'Mammal',
      p.species || 'Unknown',
      p.lineage || 'None',
      p.level || 1,
      p.gold || 0,
      p.equipped_weapon || 'Bare Hands',
      p.equipped_armor || 'Rags',
      sectorX ?? 105,
      sectorY ?? 112,
      p.difficulty || 'hardcore',
      causeOfDeath || 'Fell in mortal combat'
    ]);

    // Hardcore wipe: delete all saves for this character
    await pool.query('DELETE FROM sim_game_saves WHERE player_id = $1 OR player_id = 1', [p.id]);

    // Wipe active character record
    await pool.query('DELETE FROM sim_player_character WHERE id = $1', [p.id]);

    res.json({
      success: true,
      memorial: memorialRes.rows[0]
    });
  } catch (err: any) {
    console.error('Permadeath error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /memorials - Retrieves the Hall of the Fallen memorial archive
 */
router.get('/memorials', async (req, res) => {
  try {
    const memorialsRes = await pool.query(`
      SELECT * FROM sim_character_memorials
      ORDER BY fallen_at DESC
      LIMIT 100
    `);
    res.json({ success: true, memorials: memorialsRes.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /state - Returns active grounded entities, props, and WhatELSE campaign state
 */
router.get('/state', (req, res) => {
  try {
    const entities = concordiaGM.getActiveEntities();
    res.json(entities);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /sector_load - Initializes WhatELSE story beat and Concordia world injection for sector
 */
router.post('/sector_load', async (req, res) => {
  try {
    const context = req.body.context || (req.body.cellId ? req.body : null);
    const injected = await concordiaGM.loadSector(context || {
      cellId: 13408,
      biomeName: 'Wetland Swamp',
      isWarzone: false,
      isFamine: true,
      chaosRadiation: 0.2,
      infrastructureMask: 8
    });

    const calRes = await pool.query('SELECT tick, year, month, season, moon_phase, active_flow, dragon_domain FROM sim_calendar ORDER BY id DESC LIMIT 1');
    const calendar = calRes.rows[0] || {
      tick: 1,
      year: 1,
      month: 1,
      season: 'The Bloom',
      moon_phase: 'The Waxing Blood',
      active_flow: 'Mass',
      dragon_domain: 'Tiraton'
    };

    res.json({
      success: true,
      beat: injected.activeBeat,
      props: injected.props.map(p => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        tags: Array.from(p.tags),
        hp: p.hp,
        maxHp: p.maxHp,
        isDestroyed: p.isDestroyed
      })),
      npcs: injected.npcs,
      campaignState: concordiaGM.getStoryEngine().getCampaignState(),
      calendar
    });
  } catch (e: any) {
    console.error('Sector load error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /scene - Generates opening sensory arrival narration
 */
router.post('/scene', async (req, res) => {
  try {
    const { context } = req.body;
    const beat = concordiaGM.getStoryEngine().getCampaignState().activeBeat;

    const calRes = await pool.query('SELECT moon_phase, season, active_flow, dragon_domain FROM sim_calendar ORDER BY id DESC LIMIT 1');
    const cal = calRes.rows[0] || {
      moon_phase: 'The Waxing Blood',
      season: 'The Bloom',
      active_flow: 'Motus',
      dragon_domain: 'Vecelo'
    };

    const arrivalPrompt = `
LUNAR & COSMIC OMENS:
- Moon Phase: Cruorbus (${cal.moon_phase}) radiating the Flow of ${cal.active_flow} (Dragon Domain: ${cal.dragon_domain})
- Season: ${cal.season}

SECTOR & TERRAIN:
- Sector Coordinates: ${context?.sector || 'Wilderness'}
- Biome: ${context?.biome || 'Wilderness'}
- Sovereign Faction: ${context?.factionOwner || 'Wild Frontier'}
- Situation / Landmarks: ${beat?.title || 'Wild Exploration'} - ${beat?.hook || ''}

SURROUNDING ENVIRONMENT:
- Visible Landmarks & Relics: ${(context?.props || []).join(', ')}
- Present Entities & Roaming Life: ${(context?.entities || []).join(', ')}
`;

    const systemInstruction = `You are the Concordia Game Master for a post-apocalyptic dark-fantasy sandbox TTRPG set beneath the blood moon Cruorbus.
The 12 Flows of Chaos radiate from the blood moon into the 12 ancient Dragon Prisons guarded by secretive Grey Wardens and besieged by crazed Cultists.
In 2-3 punchy, evocative, sensory sentences, narrate what the wandering adventurer immediately perceives upon stepping into this sector.
Highlight tangible atmosphere: sounds on the wind, the eerie glow of the blood moon radiating the active Flow of Chaos, the smell of damp earth or ancient ozone, and visible relics or tense standoff of living entities.
Do not list numbers or mechanics. End with an urgent question of what they do.`;

    const sceneText = await (concordiaGM as any).callGeminiWithFallback(
      [{ role: 'user', parts: [{ text: arrivalPrompt }] }],
      systemInstruction,
      250,
      0.7
    );

    res.json({
      success: true,
      scene: sceneText || 'You step into the sector beneath the cold red light of Cruorbus. Shifting winds carry the sound of distant movement across the terrain. What do you do?'
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /action - The Full Concordia GM Execution Loop
 */
router.post('/action', async (req, res) => {
  try {
    const { actionText, playerId, playerPos } = req.body as {
      actionText: string;
      playerId?: number;
      playerPos?: [number, number];
    };

    const result = await concordiaGM.executeTurn({
      actionText,
      playerId: playerId || 1,
      playerPos: playerPos || [128, 128]
    });

    res.json(result);
  } catch (e: any) {
    console.error('Action turn error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /trade/catalog - Dynamically synthesizes available merchant wares from regional stockpiles,
 * live market commodity prices, and cosmological Chaos Flow alignments.
 */
router.get('/trade/catalog', async (req, res) => {
  try {
    const cellId = parseInt(req.query.cellId as string) || 13408;

    // 1. Fetch nearest burg economy & stockpiles
    const burgRes = await pool.query(
      `SELECT * FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 1`,
      [cellId]
    );
    const burg = burgRes.rows[0] || { burg_id: 1, food: 200, wealth: 500, unrest: 15, health: 80, crime_rate: 10 };

    const stockRes = await pool.query(
      `SELECT * FROM sim_industrial_stockpiles WHERE burg_id = $1`,
      [burg.burg_id]
    );
    const stockpile = stockRes.rows[0] || {
      raw_wood: 10, raw_ore: 10, raw_herbs: 10, raw_fiber: 10,
      refined_lumber: 5, forged_steel: 5, alchemical_potions: 2, textiles: 5
    };

    // 2. Fetch live calendar cosmology
    const calRes = await pool.query(
      `SELECT active_flow, dragon_domain, moon_phase FROM sim_calendar ORDER BY id DESC LIMIT 1`
    );
    const calendar = calRes.rows[0] || { active_flow: 'Ordo', dragon_domain: 'Stagus', moon_phase: 'Gibbous' };
    const flow = calendar.active_flow || 'Ordo';

    // 3. Fetch live commodity prices
    const pricesRes = await pool.query('SELECT * FROM sim_commodity_prices ORDER BY commodity ASC');
    const commodities = pricesRes.rows.map(c => ({
      name: c.commodity.charAt(0).toUpperCase() + c.commodity.slice(1),
      type: 'commodity',
      price: Math.max(2, Math.round(c.current_price * 4)),
      sellPrice: Math.max(1, Math.round(c.current_price * 3)),
      desc: `Raw simulated commodity (Supply: ${c.global_supply}, Demand: ${c.global_demand})`,
      icon: '📦'
    }));

    const dynamicWares: any[] = [];

    // Food & Provisions: price & flavor scale with burg food reserves
    if (burg.food < 100) {
      dynamicWares.push({
        name: 'Rationed Hardtack',
        type: 'consumable',
        price: 12,
        sellPrice: 7,
        desc: 'Coarse dried bread. Scarce and dear due to provincial famine (+5 HP)',
        icon: '🍞'
      });
    } else if (burg.food > 300) {
      dynamicWares.push({
        name: 'Hearty Field Provisions',
        type: 'consumable',
        price: 4,
        sellPrice: 2,
        desc: 'Abundant smoked meats and barley bread from full municipal granaries (+8 HP)',
        icon: '🍖'
      });
    } else {
      dynamicWares.push({
        name: 'Trail Provisions',
        type: 'consumable',
        price: 6,
        sellPrice: 3,
        desc: 'Standard dried field provisions (+7 HP)',
        icon: '🍞'
      });
    }

    // Apothecary & Medicinal: scales with herbs and potions stockpiles
    if ((stockpile.alchemical_potions || 0) > 0 || (stockpile.raw_herbs || 0) > 15) {
      dynamicWares.push(
        {
          name: 'Distilled Alchemical Panacea',
          type: 'consumable',
          price: 20,
          sellPrice: 10,
          desc: 'Potent restorative brewed in municipal town alembics (+15 HP)',
          icon: '🧪'
        },
        {
          name: 'Concentrated Healing Salve',
          type: 'consumable',
          price: 10,
          sellPrice: 5,
          desc: 'Refined local botanical poultice (+10 HP)',
          icon: '🌿'
        }
      );
    } else {
      dynamicWares.push({
        name: 'Crude Herbal Poultice',
        type: 'consumable',
        price: 14,
        sellPrice: 6,
        desc: 'Basic wild herb dressing, in short supply (+7 HP)',
        icon: '🌿'
      });
    }

    // Metalworks, Arms & Tools: scales with ore and steel stockpiles
    if ((stockpile.forged_steel || 0) > 0 || (stockpile.raw_ore || 0) > 15) {
      dynamicWares.push(
        {
          name: 'Burg-Forged Steel Dagger',
          type: 'weapon',
          price: 18,
          sellPrice: 9,
          desc: 'Freshly quenched in the municipal forge (+1 Finesse)',
          icon: '🗡️'
        },
        {
          name: 'Precision Lockpick Set',
          type: 'tool',
          price: 12,
          sellPrice: 6,
          desc: 'Tempered steel picks (+3 Tool bonus to Lockpicking)',
          icon: '🗝️'
        },
        {
          name: 'Steel-Rimmed Heater Shield',
          type: 'armor',
          price: 24,
          sellPrice: 12,
          desc: 'Forged plate reinforcement (+2 DR)',
          icon: '🛡️'
        }
      );
    } else {
      dynamicWares.push(
        {
          name: 'Iron-Banded Hunting Knife',
          type: 'weapon',
          price: 22,
          sellPrice: 8,
          desc: 'Workday iron blade (+1 Finesse)',
          icon: '🗡️'
        },
        {
          name: 'Improvised Wire Picks',
          type: 'tool',
          price: 16,
          sellPrice: 5,
          desc: 'Rough wire tools (+2 Tool bonus to Lockpicking)',
          icon: '🗝️'
        }
      );
    }

    // Textiles & Camping Gear: scales with lumber and textiles stockpiles
    if ((stockpile.textiles || 0) > 0 || (stockpile.raw_fiber || 0) > 15) {
      dynamicWares.push(
        {
          name: 'Fine Woven Traveler Cloak',
          type: 'armor',
          price: 15,
          sellPrice: 8,
          desc: 'Weatherproof wool and flax weave (+1 DR)',
          icon: '🧥'
        },
        {
          name: 'Braided Climber Rope & Pitons',
          type: 'tool',
          price: 10,
          sellPrice: 5,
          desc: 'Tough flax cord (+3 Tool bonus to Climbing)',
          icon: '🪢'
        }
      );
    } else {
      dynamicWares.push({
        name: 'Rough Burlap Gambeson',
        type: 'armor',
        price: 18,
        sellPrice: 7,
        desc: 'Padded linen and scrap (+1 DR)',
        icon: '🥋'
      });
    }

    // Universal basic camp gear
    dynamicWares.push({
      name: 'Campfire Firestarter',
      type: 'tool',
      price: 8,
      sellPrice: 4,
      desc: 'Flint and tinderbox. Kindles campfires without fail',
      icon: '🔥'
    });

    // Underworld Black Market Wares (if crime rate elevated or high unrest)
    if (burg.crime_rate > 20 || burg.unrest > 35) {
      dynamicWares.push(
        {
          name: 'Smuggled Aetheric Draught',
          type: 'consumable',
          price: 28,
          sellPrice: 14,
          desc: 'Illicit contraband distillate. Clears exhaustion (+20 HP)',
          icon: '✨'
        },
        {
          name: 'Cartel Skeleton Key',
          type: 'tool',
          price: 32,
          sellPrice: 16,
          desc: 'Black-market master key (+4 Tool bonus to picking locks)',
          icon: '🗝️'
        }
      );
    }

    // Cosmological Chaos Flow Affliction Charm
    const COSMIC_CHARMS: Record<string, any> = {
      Ordo: { name: 'Stasis-Frost Ward Charm', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Ordo. Dampens kinetic friction and cold trauma', icon: '❄️' },
      Mass: { name: 'Tectonic Basalt Weight', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Mass. Resists knockback and gravity distortion', icon: '🪨' },
      Nexus: { name: 'Spatial Phase Mirror', price: 40, sellPrice: 20, desc: 'Humming with the Flow of Nexus. Grants subtle footfalls across reality rifts', icon: '🪞' },
      Flux: { name: 'Alchemical Mutagen Flask', price: 30, sellPrice: 15, desc: 'Humming with the Flow of Flux. Volatile reaction accelerates healing', icon: '⚗️' },
      Vita: { name: 'Primeval Blood-Root Tonic', price: 30, sellPrice: 15, desc: 'Humming with the Flow of Vita. Accelerates biological cellular regeneration', icon: '🌱' },
      Lux: { name: 'Phosphor Sun-Charm', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Lux. Burns away creeping void shadows', icon: '☀️' },
      Ratio: { name: 'Brass Chronometer Spring', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Ratio. Sharpens mechanical deductions', icon: '⚙️' },
      Lex: { name: 'Blood-Bound Iron Seal', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Lex. Hardens willpower against mental intrusion', icon: '📜' },
      Motus: { name: 'Gale-Wing Feather Charm', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Motus. Enhances sprint reflexes and wind dodge', icon: '🪶' },
      Omen: { name: 'Eclipse-Veil Pendant', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Omen. Conceals vitality from dark divination', icon: '🌑' },
      Aura: { name: 'Mirage Lavender Extract', price: 30, sellPrice: 15, desc: 'Humming with the Flow of Aura. Soothes psychic sensory overload', icon: '💜' },
      Anumis: { name: 'Cold Soul-Ash Pouch', price: 35, sellPrice: 18, desc: 'Humming with the Flow of Anumis. Quiets echoes of the restless dead', icon: '🏺' }
    };
    const charm = COSMIC_CHARMS[flow] || COSMIC_CHARMS['Ordo'];
    dynamicWares.push({ ...charm, type: 'tool' });

    res.json({
      success: true,
      burgId: burg.burg_id,
      burgName: burg.name || `Burg #${burg.burg_id}`,
      activeFlow: flow,
      wares: [...dynamicWares, ...commodities]
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /trade/buy - Purchases an item from merchant wares
 */
router.post('/trade/buy', async (req, res) => {
  try {
    const { playerId, itemName, price } = req.body;
    const pId = playerId || 1;

    if (!itemName || typeof itemName !== 'string' || itemName.trim().length === 0) {
      return void res.status(400).json({ error: 'Invalid or missing item name' });
    }

    const itemCost = Math.floor(Number(price));
    if (isNaN(itemCost) || itemCost <= 0) {
      return void res.status(400).json({ error: 'Item price must be a positive number' });
    }

    const playerRes = await pool.query('SELECT * FROM sim_player_character WHERE id = $1', [pId]);
    if (playerRes.rows.length === 0) return void res.status(404).json({ error: 'Player not found' });
    const player = playerRes.rows[0];

    const currentGold = Math.max(0, Number(player.gold) || 0);
    if (currentGold < itemCost) {
      return void res.status(400).json({ error: `Insufficient gold (${currentGold}g available, costs ${itemCost}g)` });
    }

    const inventory: string[] = parseJsonField(player.inventory, []);
    inventory.push(itemName.trim());

    const updateRes = await pool.query(
      `UPDATE sim_player_character
       SET gold = GREATEST(0, COALESCE(gold, 0) - $1), inventory = $2
       WHERE id = $3
       RETURNING *`,
      [itemCost, JSON.stringify(inventory), pId]
    );

    res.json({
      success: true,
      character: enrichCharacter(updateRes.rows[0]),
      message: `Purchased ${itemName} for ${itemCost} gold.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /trade/sell - Sells an item from player inventory for gold
 */
router.post('/trade/sell', async (req, res) => {
  try {
    const { playerId, itemIndex, itemName, salePrice } = req.body;
    const pId = playerId || 1;

    const playerRes = await pool.query('SELECT * FROM sim_player_character WHERE id = $1', [pId]);
    if (playerRes.rows.length === 0) return void res.status(404).json({ error: 'Player not found' });
    const player = playerRes.rows[0];

    const inventory: string[] = parseJsonField(player.inventory, []);
    let removedIndex = itemIndex;
    if (removedIndex === undefined || removedIndex < 0 || removedIndex >= inventory.length) {
      removedIndex = inventory.findIndex(it => it === itemName);
    }

    if (removedIndex === -1) {
      return void res.status(400).json({ error: `Item ${itemName} not in inventory` });
    }

    inventory.splice(removedIndex, 1);
    const goldGain = Math.max(1, Number(salePrice) || 5);

    const updateRes = await pool.query(
      `UPDATE sim_player_character
       SET gold = COALESCE(gold, 0) + $1, inventory = $2
       WHERE id = $3
       RETURNING *`,
      [goldGain, JSON.stringify(inventory), pId]
    );

    res.json({
      success: true,
      character: enrichCharacter(updateRes.rows[0]),
      message: `Sold ${itemName} for ${goldGain} gold.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /bounties - Emergent municipal bounties derived from regional simulation state
 */
router.get('/bounties', async (req, res) => {
  try {
    const cellId = parseInt(req.query.cellId as string) || 13408;

    // 1. Fetch nearest burg economy
    const burgRes = await pool.query(
      `SELECT * FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 1`,
      [cellId]
    );
    const burg = burgRes.rows[0] || { burg_id: 1, name: 'Regional Citadel', food: 100, unrest: 20, crime_rate: 15, cell_id: cellId };

    // 2. Fetch diplomacy (is faction at war?)
    let isWar = false;
    try {
      const diploRes = await pool.query(
        `SELECT * FROM sim_diplomacy WHERE status = 'WAR' LIMIT 1`
      );
      if (diploRes.rows.length > 0) {
        isWar = true;
      }
    } catch {}

    // 3. Fetch calendar cosmology
    const calRes = await pool.query(
      `SELECT active_flow, dragon_domain, moon_phase FROM sim_calendar ORDER BY id DESC LIMIT 1`
    );
    const calendar = calRes.rows[0] || { active_flow: 'Ordo', dragon_domain: 'Stagus', moon_phase: 'Gibbous' };
    const flow = calendar.active_flow || 'Ordo';
    const dragon = calendar.dragon_domain || 'Stagus';

    const burgName = burg.name || `Province #${burg.burg_id}`;

    // 4. Algorithmic multi-vector contracts
    const contracts: any[] = [];

    // Vector 1: Famine / Food crisis
    if (burg.food < 120) {
      contracts.push({
        id: `bounty_famine_${burg.burg_id}`,
        title: `Emergency Requisition: Granary Relief`,
        giver: `Granary Steward of ${burgName}`,
        desc: `Grain stockpiles are critically depleted (${burg.food} units) beneath the Cruorbus moon. Deliver 4 bundles of foraged game meat, edible roots, or dried provisions to replenish the famine reserves.`,
        reward: `45 Gold & ${burgName} Favor`,
        targetType: 'SURVIVAL_SUPPLY',
        status: 'OPEN'
      });
    }

    // Vector 2: Warzone Vanguard
    if (isWar) {
      contracts.push({
        id: `bounty_warzone_${burg.burg_id}`,
        title: `Vanguard Suppression: Skirmisher Intercept`,
        giver: `Garrison Marshal of ${burgName}`,
        desc: `Active faction conflict has pushed vanguard raiders across the provincial frontier. Locate and neutralize enemy vanguard patrols or scout forward trench fortifications.`,
        reward: `65 Gold & Military Commendation`,
        targetType: 'WARZONE_PATROL',
        status: 'OPEN'
      });
    }

    // Vector 3: Crime / Syndicate Cartel
    if (burg.crime_rate > 15 || burg.unrest > 25) {
      contracts.push({
        id: `bounty_cartel_${burg.burg_id}`,
        title: `Warrant: Dismantle Syndicate Smuggling Run`,
        giver: `The High Bailiff of ${burgName}`,
        desc: `Crime rate stands at ${burg.crime_rate}%. Cartel runners have cached contraband along wild thoroughfares. Eliminate highway outlaws or uncover hidden dead-drop lockboxes.`,
        reward: `55 Gold & Safe Conduct Writ`,
        targetType: 'OUTLAW_CULL',
        status: 'OPEN'
      });
    }

    // Vector 4: Cosmological Dragon Barrow Vigil
    contracts.push({
      id: `bounty_cosmic_${burg.burg_id}`,
      title: `Vigilance Decree: Dampen ${flow} Void Resonance`,
      giver: `Grey Warden Hermit & Astral Council`,
      desc: `The Blood Moon radiated intense ${flow} currents, destabilizing ancient wards near the barrow of ${dragon}. Drive an iron ward stake into anomalous rifts or disperse fanatical blood-cultists.`,
      reward: `70 Gold & Astral Ward Shard`,
      targetType: 'CHAOS_SEAL',
      status: 'OPEN'
    });

    // Vector 5: Ecological Apex Beast Cull
    contracts.push({
      id: `bounty_apex_${burg.burg_id}`,
      title: `Bounty: Slay Borderland Apex Hunter`,
      giver: `Frontier Rangers Guild`,
      desc: `A feral apex predator stalks the regional game trails, harrying trade caravans and livestock. Track, slay, and field-dress the beast to secure regional transit.`,
      reward: `60 Gold & Ranger Insignia`,
      targetType: 'BEAST_CULL',
      status: 'OPEN'
    });

    // Try Gemini enrichment if AI is available
    try {
      const prompt = `Live Simulation Context for ${burgName}:
Famine Status: ${burg.food < 120 ? 'Critical Shortage (' + burg.food + ' food)' : 'Stable'}
Crime Rate: ${burg.crime_rate}%, Unrest: ${burg.unrest}
Warfare: ${isWar ? 'Active Faction Warzone' : 'Peacetime'}
Cosmic Flow: Flow of ${flow}, Dragon Domain: ${dragon}
Base Contracts: ${JSON.stringify(contracts.slice(0, 3))}

As the Municipal Reeve of ${burgName}, write 3 punchy, flavorful bulletin board postings for adventurers.
Output ONLY a single valid JSON array of objects with keys: id, title, giver, desc, reward, targetType, status.`;

      const aiText = await concordiaGM.callGeminiWithFallback(
        [{ role: 'user', parts: [{ text: prompt }] }],
        'You are the Reeve of a gritty dark fantasy city. Output only valid JSON array.',
        400,
        0.7
      );

      if (aiText) {
        const clean = aiText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
          return void res.json({
            success: true,
            burgId: burg.burg_id,
            burgName,
            bounties: parsed
          });
        }
      }
    } catch {}

    res.json({
      success: true,
      burgId: burg.burg_id,
      burgName,
      bounties: contracts.slice(0, 4)
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
