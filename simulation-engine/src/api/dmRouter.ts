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
  DEFENSE_SKILLS
} from '../engine/rpg/CharacterData.js';

// Initialize Singleton Concordia Game Master
const concordiaGM = new ConcordiaGameMaster(pool, process.env.GEMINI_API_KEY || '');

function parseJsonField(val: any, fallback: any = []) {
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
      masteryPerks: MASTERY_PERKS
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
      passiveTraits, skills, masteryPerks
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
          gold = 50, inventory = '[]'::jsonb, xp = 0, level = 1, current_quest_beat = 0
        WHERE id = $35
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
        charTrack, charOffense, charDefense
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
 * POST /save - Saves full game state to PostgreSQL slot
 */
router.post('/save', async (req, res) => {
  try {
    const { slotName, characterData, worldPos, storyState } = req.body;
    const now = new Date();
    const defaultName = `Save - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const sName = (slotName && slotName.trim()) || defaultName;
    const playerId = characterData?.id || 1;

    const saveRes = await pool.query(`
      INSERT INTO sim_game_saves (slot_name, player_id, character_data, world_pos, story_state, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, slot_name, created_at, updated_at
    `, [sName, playerId, JSON.stringify(characterData || {}), JSON.stringify(worldPos || {}), JSON.stringify(storyState || {})]);

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
      SELECT id, slot_name, player_id,
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
          gold = COALESCE($18, gold), inventory = $19::jsonb, xp = COALESCE($20, xp), level = COALESCE($21, level)
        WHERE id = 1
      `, [
        charData.name, charData.might, charData.endurance, charData.finesse, charData.reflex,
        charData.vitality, charData.fortitude, charData.knowledge, charData.logic, charData.awareness,
        charData.intuition, charData.charm, charData.willpower, charData.current_hp, charData.max_hp,
        charData.equipped_weapon, charData.equipped_armor, charData.gold,
        JSON.stringify(charData.inventory || []), charData.xp, charData.level
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
    const { context } = req.body;
    const injected = concordiaGM.loadSector(context || {
      cellId: 13408,
      biomeName: 'Wetland Swamp',
      isWarzone: false,
      isFamine: true,
      chaosRadiation: 0.2,
      infrastructureMask: 8
    });

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
      campaignState: concordiaGM.getStoryEngine().getCampaignState()
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

    const arrivalPrompt = `Sector: ${context?.sector || 'Unknown'}. Biome: ${context?.biome || 'Wilderness'}. Active Crisis: ${beat?.title || 'Unknown Quest'} - ${beat?.hook || ''}. Props in sight: ${(context?.props || []).join(', ')}. Entities: ${(context?.entities || []).join(', ')}.`;

    const sceneText = await (concordiaGM as any).callGeminiWithFallback(
      [{ role: 'user', parts: [{ text: arrivalPrompt }] }],
      'You are the Concordia Game Master for a dark, atmospheric TTRPG. Describe the arrival into this tactical sector in 2-3 punchy, evocative sentences. Mention sensory details (weather, stench, sound) and visible landmarks or threats. End with an urgent prompt.',
      250,
      0.7
    );

    res.json({
      success: true,
      scene: sceneText || 'You arrive at the edge of the sector. The wind howls across the uneven ground. What do you do?'
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

export default router;
