/**
 * Component 4 (Rule 6): World write-backs, player progression, Cosmic Dread, witnessed `actions` rows,
 * PostgreSQL simulation backfeed (A-E), and episodic GM memory storage.
 */
import type { Pool } from "pg";
import { resolveCosmicDreadCheck } from "../../socialCombat.js";
import { writeBackNpcDeath, writeBackPropChange } from "../../micro/writeBack.js";
import { recordAction, normalizeActionVerb } from "../../story/actions.js";
import { mapNpcIdToEntityRef } from "../../entities/refs.js";
import { TagMatrixEngine, TaggedObject } from "../TagMatrixEngine.js";
import { InjectedNPC, SectorContext } from "../WhatElseStoryEngine.js";
import type { ActionInput, ParsedIntent } from "./types.js";

export async function applyTurnConsequences(params: {
  pool: Pool;
  input: ActionInput;
  intent: ParsedIntent;
  player: any;
  playerId: number;
  initialPlayerComposure: number;
  playerMaxComposure: number;
  playerReputations: Record<string, number>;
  targetProp: TaggedObject | undefined;
  targetNPC: InjectedNPC | undefined;
  activeProps: Map<string, TaggedObject>;
  activeNPCs: Map<string, InjectedNPC>;
  activeContext: SectorContext | null;
  hit: boolean;
  difference: number;
  propLooted: boolean;
  lootAwarded?: { gold: number; item?: string | undefined } | undefined;
  xpGained: number;
  initialSystemLog: string;
}): Promise<{
  propsDestroyed: string[];
  npcsDefeated: string[];
  playerComposure: number;
  systemLog: string;
}> {
  const {
    pool,
    input,
    intent,
    player,
    playerId,
    initialPlayerComposure,
    playerMaxComposure,
    playerReputations,
    targetProp,
    targetNPC,
    activeProps,
    activeNPCs,
    activeContext,
    hit,
    difference,
    propLooted,
    lootAwarded,
    xpGained,
    initialSystemLog,
  } = params;

  const { actionText } = input;
  let playerComposure = initialPlayerComposure;
  let systemLog = initialSystemLog;

  const propsDestroyed: string[] = [];
  const npcsDefeated: string[] = [];
  const ctxCellId = Number(activeContext?.cellId || 0);
  const ctxRx = Number(activeContext?.rx ?? 50);
  const ctxRy = Number(activeContext?.ry ?? 50);
  const ctxZ = Number(input.zLayer ?? activeContext?.z ?? 0);

  if (targetProp && (targetProp.isDestroyed || targetProp.tags.has("burning") || targetProp.tags.has("burnt"))) {
    const isBurnt = targetProp.tags.has("burning") || targetProp.tags.has("burnt");
    if (targetProp.isDestroyed) {
      propsDestroyed.push(targetProp.name);
      activeProps.delete(targetProp.id);
    }
    if (ctxCellId > 0) {
      try {
        await writeBackPropChange(pool, {
          prop: targetProp,
          change: isBurnt ? "burnt" : "destroyed",
          cellId: ctxCellId,
          rx: ctxRx,
          ry: ctxRy,
          z: ctxZ,
        });
      } catch (err) {
        console.error("Error writing back prop destruction/burn overlay:", err);
      }
    }
  } else if (targetProp && propLooted && ctxCellId > 0) {
    try {
      await writeBackPropChange(pool, {
        prop: targetProp,
        change: "looted",
        cellId: ctxCellId,
        rx: ctxRx,
        ry: ctxRy,
        z: ctxZ,
      });
    } catch (err) {
      console.error("Error writing back prop loot overlay:", err);
    }
  }

  if (targetNPC && (!targetNPC.alive || targetNPC.hp <= 0)) {
    targetNPC.alive = false;
    targetNPC.hp = 0;
    npcsDefeated.push(targetNPC.name);
    activeNPCs.delete(targetNPC.id);

    const corpsePropId = `prop_corpse_${targetNPC.id}`;
    if (!activeProps.has(corpsePropId)) {
      const corpseProp = TagMatrixEngine.createProp(
        corpsePropId,
        `${targetNPC.name}'s Remains`,
        targetNPC.pos,
        ["corpse", "carcass", "remains", "organic", "lootable"],
        10
      );
      corpseProp.inventory = Array.isArray(targetNPC.inventory) ? [...targetNPC.inventory] : [];
      activeProps.set(corpsePropId, corpseProp);
    }

    if (ctxCellId > 0) {
      try {
        await writeBackNpcDeath(pool, {
          npc: targetNPC,
          cellId: ctxCellId,
          rx: ctxRx,
          ry: ctxRy,
          z: ctxZ,
          cause: `Slain by ${player.name || "party"} (${intent.verb})`,
        });
      } catch (err) {
        console.error("Error writing back micro NPC death to macro state:", err);
      }
    }
  }

  if (targetNPC) {
    try {
      await pool.query(
        `UPDATE sim_npc_instances
         SET hp = $1, alive = $2, disposition = $3, inventory = $4, updated_at = NOW()
         WHERE id = $5`,
        [
          Math.max(0, targetNPC.hp),
          targetNPC.alive ?? (targetNPC.hp > 0),
          targetNPC.disposition,
          JSON.stringify(targetNPC.inventory || []),
          targetNPC.id
        ]
      );
    } catch (err) {
      console.error("Error persisting NPC mutation to sim_npc_instances:", err);
    }
  }

  if (lootAwarded?.item) {
    player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
    player.inventory.push(lootAwarded.item);
  }

  if (xpGained > 0) {
    let currentXp = (Number(player.xp) || 0) + xpGained;
    let currentLevel = Number(player.level) || 1;
    let currentSkillPoints = Number(player.skill_points) || 0;
    let leveledUp = false;

    let xpNeeded = currentLevel * 100;
    while (currentXp >= xpNeeded) {
      currentXp -= xpNeeded;
      currentLevel += 1;
      currentSkillPoints += 1;
      leveledUp = true;
      xpNeeded = currentLevel * 100;
    }

    player.xp = currentXp;
    player.level = currentLevel;
    player.skill_points = currentSkillPoints;

    systemLog += ` | [XP +${xpGained} (${currentXp}/${xpNeeded} XP)]`;
    if (leveledUp) {
      systemLog += ` | [🌟 LEVEL UP! You attained Level ${currentLevel}! +1 Skill Point gained! Total SP: ${currentSkillPoints}]`;
    }
  }

  if (activeContext?.chaosRadiation && activeContext.chaosRadiation > 0.35 && playerComposure > 0) {
    const dreadDC = Math.round(11 + activeContext.chaosRadiation * 10);
    const dreadRes = resolveCosmicDreadCheck(
      {
        id: playerId,
        name: player.name || "Hero",
        stats: player,
        equippedSocialWeapon: player.equipped_social_weapon || "Iron Warmaster Baton",
        equippedSocialArmor: player.equipped_social_armor || "Keepsake Locket of the Hearth",
        composure: playerComposure,
        maxComposure: playerMaxComposure,
        skillRanks: player.skill_ranks || {}
      },
      dreadDC,
      "willpower"
    );
    playerComposure = dreadRes.remainingComposure;
    if (!dreadRes.passed) {
      systemLog += ` | ${dreadRes.log}`;
    }
  }

  await pool.query(
    `UPDATE sim_player_character
     SET current_hp = $1, gold = $2, inventory = $3, xp = $4, level = $5, skill_points = $6, composure = $7, faction_reputations = $8
     WHERE id = $9`,
    [player.current_hp, player.gold, JSON.stringify(player.inventory || []), player.xp || 0, player.level || 1, player.skill_points || 0, playerComposure, JSON.stringify(playerReputations), playerId]
  ).catch(() => {});

  const cellId = activeContext?.cellId ?? 30627;
  const rx = activeContext?.rx ?? 105;
  const ry = activeContext?.ry ?? 112;
  let simDeltaNotice = "";

  const stampRes = await pool.query(
    `SELECT (SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1) AS tick,
            (SELECT 'Year ' || year || ', ' || month_name || ' ' || day_of_month FROM sim_calendar ORDER BY id DESC LIMIT 1) AS lore_date,
            (SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1) AS burg_id,
            (SELECT faction_id FROM sim_cells WHERE id = $1) AS faction_id`,
    [cellId]
  ).catch(() => ({ rows: [] as any[] }));
  const stamp = {
    tick: Number(stampRes.rows[0]?.tick) || 1,
    loreDate: stampRes.rows[0]?.lore_date || "Unknown date",
    burgId: stampRes.rows[0]?.burg_id ?? null,
    factionId: stampRes.rows[0]?.faction_id ?? null,
  };

  // Record structured party action into the action ledger with nearby witnesses (Phase 11.1)
  try {
    const targetRef = targetNPC
      ? (targetNPC.entity_ref || mapNpcIdToEntityRef(String(targetNPC.id), { cellId, rx, ry }))
      : targetProp
        ? String(targetProp.id)
        : null;
    const originPos: [number, number] = targetNPC?.pos || targetProp?.pos || input.playerPos;
    const witnesses: string[] = [];
    for (const npc of activeNPCs.values()) {
      if (!npc.alive || (npc.hp !== undefined && npc.hp <= 0)) continue;
      if (targetNPC && String(npc.id) === String(targetNPC.id)) continue;
      const dx = (npc.pos?.[0] ?? 128) - originPos[0];
      const dy = (npc.pos?.[1] ?? 128) - originPos[1];
      if (Math.hypot(dx, dy) <= 40) {
        witnesses.push(npc.entity_ref || mapNpcIdToEntityRef(String(npc.id), { cellId, rx, ry }));
      }
    }
    const clockRes = await pool.query(`SELECT minute_of_day FROM world_clock WHERE id = 1 LIMIT 1`).catch(() => ({ rows: [] as any[] }));
    const minute = Number(clockRes.rows[0]?.minute_of_day || 0);
    const stRes = await pool.query(
      `SELECT id, actor_ids FROM storylines
       WHERE scale IN ('scene', 'thread', 'arc')
         AND state IN ('open', 'escalated')
         AND ($1 = cell_id OR $1 = ANY(scope_cells))
       ORDER BY id ASC
       LIMIT 5`,
      [cellId]
    ).catch(() => ({ rows: [] as any[] }));
    const matchedStoryline =
      (targetRef && stRes.rows.find((r: any) => Array.isArray(r.actor_ids) && r.actor_ids.includes(targetRef))) ||
      stRes.rows[0] ||
      null;
    const outcomeLabel = hit ? `success:margin=${difference}` : `fail:margin=${difference}`;
    await recordAction(pool, {
      tick: stamp.tick,
      minute,
      actorRef: `player:${playerId}`,
      verb: normalizeActionVerb(intent.verb, intent.category),
      targetRef,
      location: { cellId, rx: ctxRx, ry: ctxRy, z: ctxZ, x: input.playerPos[0], y: input.playerPos[1] },
      method: intent.statUsed || intent.category,
      result: outcomeLabel,
      storylineId: matchedStoryline ? Number(matchedStoryline.id) : null,
      witnesses,
    });
  } catch {}

  // A. Outlaw / Raider Defeated
  if (targetNPC && !targetNPC.alive && (targetNPC.tags.includes("outlaw") || targetNPC.tags.includes("bandit") || targetNPC.tags.includes("cannibal") || targetNPC.role.toLowerCase().includes("outlaw") || targetNPC.role.toLowerCase().includes("marauder"))) {
    try {
      if (activeContext?.factionOwner) {
        playerReputations[activeContext.factionOwner] = (playerReputations[activeContext.factionOwner] || 0) + 3;
      }
      await pool.query(
        `UPDATE sim_burg_economy
         SET crime_rate = GREATEST(0, COALESCE(crime_rate, 20) - 3),
             unrest = GREATEST(0, COALESCE(unrest, 10) - 2)
         WHERE cell_id = $1 OR burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY cell_dist2(cell_id, $1) ASC LIMIT 1)`,
        [cellId]
      );
      await pool.query(
        `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [1, "MINOR", "Cruorbus 1st Era", 1, 1, "HIGHWAY_PATROL_VICTORY", `Highway brigand ${targetNPC.name} was eliminated by ${player.name} in Sector (${rx}, ${ry}). Road safety improved.`]
      );
      simDeltaNotice += " | 🌍 SIMULATION: Crime Rate -3 & Unrest -2 in Regional Province";
    } catch (err) {
      console.error("Backfeed crime error:", err);
    }
  }

  // B. Underworld Cartel Enforcer Defeated or Cache Plundered
  if ((targetNPC && !targetNPC.alive && targetNPC.faction.includes("Smuggler")) || (targetProp && targetProp.tags.has("valuable") && hit && intent.category === "SUBTERFUGE")) {
    try {
      playerReputations["Smugglers Syndicate"] = (playerReputations["Smugglers Syndicate"] || 0) - 8;
      if (activeContext?.factionOwner) {
        playerReputations[activeContext.factionOwner] = (playerReputations[activeContext.factionOwner] || 0) + 4;
      }
      await pool.query(
        `UPDATE sim_fringe_lairs
         SET manpower = GREATEST(0, manpower - 4),
             heat = LEAST(100, heat + 8)
         WHERE id = (SELECT id FROM sim_fringe_lairs ORDER BY cell_dist2(cell_id, $1) ASC LIMIT 1)`,
        [cellId]
      );
      await pool.query(
        `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [1, "MINOR", "Cruorbus 1st Era", 1, 1, "CARTEL_INTERRUPTED", `Smuggler ring disrupted by ${player.name} in Sector (${rx}, ${ry}). Cartel manpower fractured.`]
      );
      simDeltaNotice += " | 🕵️ SIMULATION: Cartel Manpower -4, Heat +8 in Underworld";
    } catch (err) {
      console.error("Backfeed cartel error:", err);
    }
  }

  // C. Apex Beast / Predator Vanquished
  if (targetNPC && !targetNPC.alive && (targetNPC.role.includes("Apex Predator") || targetNPC.tags.includes("predator"))) {
    try {
      await pool.query(
        `UPDATE sim_cells
         SET eco_health = LEAST(100.0, COALESCE(eco_health, 100.0) + 3.0),
             eco_predators = GREATEST(0.0, COALESCE(eco_predators, 5.0) - 1.0),
             eco_apex = GREATEST(0.0, COALESCE(eco_apex, 1.0) - 1.0)
         WHERE id = $1`,
        [cellId]
      );
      await pool.query(
        `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [1, "MAJOR", "Cruorbus 1st Era", 1, 1, "APEX_BEAST_SLAIN", `The predator ${targetNPC.name} was vanquished by ${player.name} in Sector (${rx}, ${ry}). The wild balance shifts.`]
      );
      await pool.query(
        `INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
         VALUES ('ECOLOGICAL', 'APEX_BEAST_SLAIN', $1, $2, $3, 10, 0.8, 0, 0, 5)`,
        [`Apex predator ${targetNPC.name} vanquished by ${player.name}`, rx, ry]
      );
      simDeltaNotice += " | 🦁 SIMULATION: Eco-Predators -1.0, Eco-Health +3.0";
    } catch (err) {
      console.error("Backfeed eco predator error:", err);
    }
  }

  // C2. Prey / Wild Game Slain or Butchered
  if ((targetNPC && !targetNPC.alive && (targetNPC.tags.includes("prey") || targetNPC.tags.includes("game"))) || (hit && (intent.verb === "FIELD_DRESS" || intent.verb === "BUTCHER"))) {
    try {
      await pool.query(
        `UPDATE sim_cells
         SET eco_prey = GREATEST(0.0, COALESCE(eco_prey, 10.0) - 1.0)
         WHERE id = $1`,
        [cellId]
      );
      player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
      const preyItem = targetNPC ? `Fresh ${targetNPC.name} Haunch` : "Fresh Wild Game Haunch";
      const hideItem = targetNPC ? `${targetNPC.name} Pelt` : "Cured Game Hide";
      player.inventory.push(preyItem);
      if (Math.random() < 0.6) player.inventory.push(hideItem);
      simDeltaNotice += ` | 🦌 ECOLOGY: Local Prey -1.0 | Harvested [${preyItem}] into traveler satchel`;
    } catch (err) {
      console.error("Backfeed eco prey error:", err);
    }
  }

  // C3. Botanical Flora Foraged / Harvested
  if (hit && (intent.verb === "FORAGE" || intent.verb === "HARVEST" || intent.verb === "EXAMINE_BOTANY" || intent.verb === "GATHER")) {
    try {
      await pool.query(
        `UPDATE sim_cells
         SET eco_plants = GREATEST(0.0, COALESCE(eco_plants, 10.0) - 1.0)
         WHERE id = $1`,
        [cellId]
      );
      player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
      const herbNames = ["Wild Mountain Ginseng", "Silverleaf Stems", "Marsh Reed Fibre", "Earth-Root Tubers", "Bitter-Bark Lichen"];
      const foundHerb = herbNames[Math.floor(Math.random() * herbNames.length)];
      player.inventory.push(foundHerb);
      simDeltaNotice += ` | 🌿 ECOLOGY: Local Flora -1.0 | Harvested [${foundHerb}] into satchel`;
    } catch (err) {
      console.error("Backfeed flora error:", err);
    }
  }

  // C3b. Grounded Settlement Commerce
  const isTradingAction = intent.category === "SOCIAL" && (
    intent.verb === "TRADE" || intent.verb === "TALK" || intent.verb === "BRIBE" ||
    actionText.toLowerCase().includes("sell") || actionText.toLowerCase().includes("trade") ||
    actionText.toLowerCase().includes("provision") || actionText.toLowerCase().includes("deliver food")
  );
  const isMerchantTarget = targetNPC && (
    targetNPC.tags.includes("merchant") || targetNPC.tags.includes("vendor") ||
    targetNPC.tags.includes("provisioner") || targetNPC.tags.includes("innkeeper") ||
    targetNPC.tags.includes("reeve") || targetNPC.role.toLowerCase().includes("provisioner") ||
    targetNPC.role.toLowerCase().includes("merchant") || targetNPC.role.toLowerCase().includes("innkeeper")
  );

  if (hit && isTradingAction && isMerchantTarget) {
    try {
      player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
      let foodSold = 0;
      let matsSold = 0;
      const remainingInv: string[] = [];

      for (const item of player.inventory) {
        const itemLower = item.toLowerCase();
        const isFood = itemLower.includes("haunch") || itemLower.includes("meat") || itemLower.includes("ration") ||
                       itemLower.includes("venison") || itemLower.includes("tuber") || itemLower.includes("bread") ||
                       itemLower.includes("fruit") || itemLower.includes("game");
        const isMat = itemLower.includes("ginseng") || itemLower.includes("silverleaf") || itemLower.includes("herb") ||
                      itemLower.includes("pelt") || itemLower.includes("hide") || itemLower.includes("fibre") ||
                      itemLower.includes("ore") || itemLower.includes("lichen");

        if (isFood && foodSold < 3) {
          foodSold++;
        } else if (isMat && matsSold < 3) {
          matsSold++;
        } else {
          remainingInv.push(item);
        }
      }

      if (foodSold > 0 || matsSold > 0) {
        player.inventory = remainingInv;
        const goldEarned = (foodSold * 12) + (matsSold * 16);
        player.gold = (Number(player.gold) || 0) + goldEarned;

        if (foodSold > 0) {
          const foodUnits = foodSold * 4;
          await pool.query(
            `UPDATE sim_burg_economy
             SET food = COALESCE(food, 0) + $1,
                 unrest = GREATEST(0, COALESCE(unrest, 0) - 1)
             WHERE cell_id = $2 OR burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY cell_dist2(cell_id, $2) ASC LIMIT 1)`,
            [foodUnits, cellId]
          );
          if (activeContext?.factionOwner) {
            playerReputations[activeContext.factionOwner] = (playerReputations[activeContext.factionOwner] || 0) + 2;
          }
        }

        if (matsSold > 0) {
          await pool.query(
            `UPDATE sim_industrial_stockpiles
             SET raw_herbs = COALESCE(raw_herbs, 0) + $1
             WHERE burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY cell_dist2(cell_id, $2) ASC LIMIT 1)`,
            [matsSold, cellId]
          );
          await pool.query(
            `UPDATE sim_commodity_prices
             SET global_supply = global_supply + $1,
                 current_price = GREATEST(0.4, current_price * 0.99)
             WHERE commodity = 'medicine'`,
            [matsSold]
          );
        }

        simDeltaNotice += ` | ⚖️ COMMERCE: Sold ${foodSold} food & ${matsSold} materials for +${goldEarned} Gold! Municipal Granary & Stockpiles replenished.`;
      }
    } catch (err) {
      console.error("Backfeed commerce error:", err);
    }
  }

  // C4. Cultist Threat Purged
  if (targetNPC && !targetNPC.alive && (targetNPC.tags.includes("cultist") || targetNPC.role.toLowerCase().includes("cultist") || targetNPC.faction.toLowerCase().includes("cult"))) {
    try {
      playerReputations["Grey Wardens"] = (playerReputations["Grey Wardens"] || 0) + 5;
      playerReputations["Blood Cult"] = (playerReputations["Blood Cult"] || 0) - 10;
      await pool.query(
        `UPDATE sim_sacred_groves
         SET seal_strength = LEAST(100, seal_strength + 4)
         WHERE cell_id = $1 OR cell_id = (SELECT cell_id FROM sim_sacred_groves ORDER BY cell_dist2(cell_id, $1) ASC LIMIT 1)`,
        [cellId]
      );
      await pool.query(
        `UPDATE sim_cells
         SET eco_blight = GREATEST(0.0, COALESCE(eco_blight, 0.0) - 0.5)
         WHERE id = $1`,
        [cellId]
      );
      simDeltaNotice += " | 🕊️ SIMULATION: Cultist Threat Purged! Dragon Seal Restored +4, Eco-Blight -0.5";
    } catch (err) {
      console.error("Backfeed cultist error:", err);
    }
  }

  // C5. Mandate of the Chain Inquisitor Defeated
  if (targetNPC && !targetNPC.alive && (targetNPC.tags.includes("mandate") || targetNPC.role.toLowerCase().includes("mandate") || targetNPC.faction.toLowerCase().includes("chain"))) {
    try {
      playerReputations["Mandate of the Chain"] = (playerReputations["Mandate of the Chain"] || 0) - 10;
      playerReputations["Hedge Practitioners"] = (playerReputations["Hedge Practitioners"] || 0) + 5;
      simDeltaNotice += " | ⛓️ SIMULATION: Mandate Inquisitor Defeated! Elemental shackles shattered.";
    } catch (err) {
      console.error("Backfeed mandate error:", err);
    }
  }

  // D. Metaphysical Reality Fracture / Dragon Seal Strained or Shattered
  const isDragonSeal = targetProp && (targetProp.id.includes("dragon_prison") || targetProp.tags.has("dragon_seal") || targetProp.tags.has("wardstone"));
  const isBloodAltar = targetProp && (targetProp.id.includes("blood_altar") || targetProp.tags.has("blood_magic") || targetProp.tags.has("altar"));
  const isChaosFissure = targetProp && (targetProp.id.includes("fissure") || targetProp.tags.has("fissure"));

  if (hit && (isDragonSeal || isBloodAltar || isChaosFissure)) {
    try {
      const isDestroyed = targetProp.isDestroyed || (targetProp.hp <= 0);
      const sealDmg = isDestroyed ? 50 : 25;

      const groveUpdate = await pool.query(
        `UPDATE sim_sacred_groves
         SET seal_strength = GREATEST(0, seal_strength - $1)
         WHERE cell_id = $2 OR cell_id = (SELECT cell_id FROM sim_sacred_groves ORDER BY cell_dist2(cell_id, $2) ASC LIMIT 1)
         RETURNING dragon_name, power_domain, seal_strength`,
        [sealDmg, cellId]
      );

      const grove = groveUpdate.rows[0] || { dragon_name: "Ancient Dragon", power_domain: "Chaos", seal_strength: 50 };
      const chaosIntensity = isDestroyed ? 1.0 : Math.min(0.95, 0.4 + (100 - Number(grove.seal_strength)) / 100);
      await pool.query(
        `INSERT INTO sim_chaos_zones (cell_id, intensity, type)
         VALUES ($1, $2, $3)`,
        [cellId, chaosIntensity, `${grove.power_domain.toUpperCase()}_RUPTURE`]
      );

      const shockwaveRadius = isDestroyed ? 75 : 30;
      await pool.query(
        `INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
         VALUES ('MAGICAL', $1, $2, $3, $4, $5, $6, 0, 0, $7)`,
        [
          isDestroyed ? "APOCALYPTIC_SEAL_BREACH" : "METAPHYSICAL_FRACTURE",
          `${player.name} fractured the ${grove.power_domain} containment seal of ${grove.dragon_name} in Sector (${rx}, ${ry})!`,
          rx, ry, shockwaveRadius, chaosIntensity, isDestroyed ? 40 : 15
        ]
      );

      await pool.query(
        `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stamp.tick,
          isDestroyed ? "CRITICAL" : "MAJOR",
          stamp.loreDate,
          stamp.burgId, stamp.factionId,
          isDestroyed ? "DRAGON_SEAL_SHATTERED" : "SEAL_STRAINED",
          isDestroyed
            ? `REALITY CATACLYSM: The prison of Dragon ${grove.dragon_name} has been BROKEN by ${player.name} in Sector (${rx}, ${ry})! Leylines convulse!`
            : `METAPHYSICAL ANOMALY: ${player.name} severely damaged the ${grove.power_domain} seal in Sector (${rx}, ${ry}) (Seal: ${grove.seal_strength}%).`
        ]
      );

      if (isDestroyed) {
        await pool.query(
          `UPDATE sim_burg_economy
           SET unrest = LEAST(100, COALESCE(unrest, 0) + 25)
           WHERE cell_id = $1 OR burg_id IN (SELECT burg_id FROM sim_burg_economy ORDER BY cell_dist2(cell_id, $1) ASC LIMIT 3)`,
          [cellId]
        );
      }

      simDeltaNotice += ` | ⚡ SIMULATION STRAIN: Dragon ${grove.dragon_name} Seal ${isDestroyed ? "SHATTERED (0%)" : `Damaged (-${sealDmg}% -> ${grove.seal_strength}%)`}, Chaos Zone Radiation ${Math.round(chaosIntensity * 100)}%, Shockwave Radius ${shockwaveRadius} Sectors!`;
    } catch (err) {
      console.error("Backfeed dragon seal error:", err);
    }
  }

  // E. Write-back to DB events
  if (hit) {
    await pool.query(
      `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        stamp.tick,
        "MINOR",
        stamp.loreDate,
        stamp.burgId,
        stamp.factionId,
        "PLAYER_ACTION",
        `${player.name} executed ${intent.verb} on ${intent.targetName}: ${hit ? "SUCCESS" : "FAILED"}`
      ]
    ).catch(() => {});
  }

  await pool.query(
    `UPDATE sim_player_character
     SET gold = $1, inventory = $2, faction_reputations = $3
     WHERE id = $4`,
    [player.gold, JSON.stringify(player.inventory || []), JSON.stringify(playerReputations), playerId]
  ).catch(() => {});

  if (simDeltaNotice) {
    systemLog += simDeltaNotice;
  }

  return {
    propsDestroyed,
    npcsDefeated,
    playerComposure,
    systemLog,
  };
}

export async function recordTurnMemory(params: {
  pool: Pool;
  memoryStream: Array<{ timestamp: number; summary: string; tags: string[] }>;
  playerId: number;
  intent: ParsedIntent;
  hit: boolean;
}): Promise<void> {
  const { pool, memoryStream, playerId, intent, hit } = params;
  const memSummary = `${intent.verb} on ${intent.targetName}: ${hit ? "Success" : "Failed"}`;
  const memTags = [intent.verb, intent.targetName, hit ? "success" : "failed"];
  const memNow = Date.now();
  memoryStream.push({
    timestamp: memNow,
    summary: memSummary,
    tags: memTags
  });
  await pool.query(
    `INSERT INTO sim_gm_memories (player_id, timestamp, summary, tags) VALUES ($1, $2, $3, $4)`,
    [playerId, memNow, memSummary, JSON.stringify(memTags)]
  ).catch(() => {});
}
