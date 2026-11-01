import type { InjectedNPC, InjectedProp } from '../types';
import { evaluateLineOfSight, getGridDistance } from './TacticalCombatHelper';

export type CombatArchetype = 'MELEE' | 'RANGED' | 'ARCANE';

export interface SquadTacticsDecision {
  newPos: [number, number];
  tacticalTactic: 'CHARGE' | 'FLANK' | 'COVER_SEEK' | 'RETREAT_RANGED' | 'FLEE_WOUNDED';
  declaredActionName: string;
  actionType: 'stamina' | 'focus';
  staminaCost: number;
  focusCost: number;
  isFlanking: boolean;
  coverBonus: number;
}

/**
 * Classifies an NPC into a combat tactical archetype based on equipment and attributes
 */
export function determineArchetype(npc: InjectedNPC): CombatArchetype {
  const w = (npc.equippedWeapon || '').toLowerCase();
  const tags = Array.isArray(npc.tags) ? npc.tags.map(t => t.toLowerCase()) : [];
  const stat = npc.statAffinity || '';

  if (w.includes('bow') || w.includes('sling') || tags.includes('ranged') || tags.includes('archer') || stat === 'reflex') {
    return 'RANGED';
  }
  if (w.includes('wand') || w.includes('staff') || tags.includes('cultist') || tags.includes('magic') || stat === 'knowledge' || stat === 'willpower' || stat === 'logic') {
    return 'ARCANE';
  }
  return 'MELEE';
}

/**
 * Checks whether two or more enemies are positioning on opposite sides of the player (Flanking)
 */
export function isPlayerFlanked(
  enemyPos: [number, number],
  allEnemyPositions: [number, number][],
  playerPos: [number, number]
): boolean {
  const distToPlayer = Math.hypot(enemyPos[0] - playerPos[0], enemyPos[1] - playerPos[1]);
  if (distToPlayer > 1.8) return false;

  const myAngle = Math.atan2(enemyPos[1] - playerPos[1], enemyPos[0] - playerPos[0]);

  for (const other of allEnemyPositions) {
    if (other[0] === enemyPos[0] && other[1] === enemyPos[1]) continue;
    const otherDist = Math.hypot(other[0] - playerPos[0], other[1] - playerPos[1]);
    if (otherDist <= 1.8) {
      const otherAngle = Math.atan2(other[1] - playerPos[1], other[0] - playerPos[0]);
      let diff = Math.abs(myAngle - otherAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      // If angle difference is roughly opposite (> 100 degrees / ~1.75 rad)
      if (diff >= 1.75) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes intelligent tactical movement and action declarations for squad enemies
 */
export function computeSquadTactics(
  enemy: InjectedNPC,
  allHostiles: InjectedNPC[],
  playerPos: [number, number],
  tilemap: { grid: Uint8Array; size: number },
  props: InjectedProp[]
): SquadTacticsDecision {
  const archetype = determineArchetype(enemy);
  const moveRange = enemy.moveRange || 3;
  const currentDist = getGridDistance(enemy.pos[0], enemy.pos[1], playerPos[0], playerPos[1]);
  const isWounded = enemy.hp < enemy.maxHp * 0.28;

  let destX = enemy.pos[0];
  let destY = enemy.pos[1];
  let tactic: SquadTacticsDecision['tacticalTactic'] = 'CHARGE';

  const isTilePassable = (tx: number, ty: number) => {
    if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) return false;
    const t = tilemap.grid[ty * tilemap.size + tx];
    if (t === 1 || t === 2 || t === 3 || t === 5 || t === 12) return false;
    // Don't walk onto player
    if (tx === playerPos[0] && ty === playerPos[1]) return false;
    // Don't walk onto existing alive NPC
    const occupied = allHostiles.some(h => h.id !== enemy.id && h.alive && h.pos[0] === tx && h.pos[1] === ty);
    if (occupied) return false;
    return true;
  };

  // --- TACTICAL BEHAVIOR 1: CRITICALLY WOUNDED FOES FLEE & DISENGAGE ---
  if (isWounded) {
    tactic = 'FLEE_WOUNDED';
    // Move directly away from player
    const awayDx = Math.sign(enemy.pos[0] - playerPos[0]);
    const awayDy = Math.sign(enemy.pos[1] - playerPos[1]);
    const candidateX = enemy.pos[0] + awayDx * moveRange;
    const candidateY = enemy.pos[1] + awayDy * moveRange;
    if (isTilePassable(candidateX, candidateY)) {
      destX = candidateX;
      destY = candidateY;
    } else if (isTilePassable(enemy.pos[0] + awayDx, enemy.pos[1] + awayDy)) {
      destX = enemy.pos[0] + awayDx;
      destY = enemy.pos[1] + awayDy;
    }

    return {
      newPos: [destX, destY],
      tacticalTactic: tactic,
      declaredActionName: 'Desperate Retreat & Guard (0 Stamina)',
      actionType: 'stamina',
      staminaCost: 0,
      focusCost: 0,
      isFlanking: false,
      coverBonus: 2
    };
  }

  // --- TACTICAL BEHAVIOR 2: RANGED & ARCANE SEEK COVER & MAINTAIN DISTANCE ---
  if (archetype === 'RANGED' || archetype === 'ARCANE') {
    if (currentDist <= 2) {
      // Too close! Retreat backwards
      tactic = 'RETREAT_RANGED';
      const awayDx = Math.sign(enemy.pos[0] - playerPos[0]);
      const awayDy = Math.sign(enemy.pos[1] - playerPos[1]);
      for (let step = moveRange; step >= 1; step--) {
        const tx = enemy.pos[0] + awayDx * step;
        const ty = enemy.pos[1] + awayDy * step;
        if (isTilePassable(tx, ty)) {
          destX = tx;
          destY = ty;
          break;
        }
      }
    } else {
      // Seek cover tile within movement range that retains Line of Sight to player
      tactic = 'COVER_SEEK';
      let bestTile: [number, number] | null = null;
      let bestCoverBonus = 0;

      for (let dy = -moveRange; dy <= moveRange; dy++) {
        for (let dx = -moveRange; dx <= moveRange; dx++) {
          const tx = enemy.pos[0] + dx;
          const ty = enemy.pos[1] + dy;
          if (Math.abs(dx) + Math.abs(dy) <= moveRange && isTilePassable(tx, ty)) {
            const los = evaluateLineOfSight(tx, ty, playerPos[0], playerPos[1], props, tilemap);
            if (los.hasLos && los.coverBonus > bestCoverBonus) {
              bestCoverBonus = los.coverBonus;
              bestTile = [tx, ty];
            }
          }
        }
      }

      if (bestTile) {
        destX = bestTile[0];
        destY = bestTile[1];
      }
    }

    const losFromDest = evaluateLineOfSight(destX, destY, playerPos[0], playerPos[1], props, tilemap);
    const finalDist = getGridDistance(destX, destY, playerPos[0], playerPos[1]);

    if (archetype === 'ARCANE') {
      return {
        newPos: [destX, destY],
        tacticalTactic: tactic,
        declaredActionName: losFromDest.hasLos && finalDist <= 8
          ? 'Eldritch Mind Blast (1 Focus)'
          : 'Channel Occult Dread (1 Focus)',
        actionType: 'focus',
        staminaCost: 0,
        focusCost: 1,
        isFlanking: false,
        coverBonus: losFromDest.coverBonus
      };
    } else {
      return {
        newPos: [destX, destY],
        tacticalTactic: tactic,
        declaredActionName: losFromDest.hasLos && finalDist <= 8
          ? 'Aimed Ranged Volley (1 Stamina)'
          : 'Reposition & Draw (1 Stamina)',
        actionType: 'stamina',
        staminaCost: 1,
        focusCost: 0,
        isFlanking: false,
        coverBonus: losFromDest.coverBonus
      };
    }
  }

  // --- TACTICAL BEHAVIOR 3: MELEE ASSAULT & FLANKING ALGORITHM ---
  // Check if another melee ally is already engaging
  const otherMeleeAllies = allHostiles.filter(h => h.id !== enemy.id && h.alive && determineArchetype(h) === 'MELEE');

  if (otherMeleeAllies.length > 0) {
    tactic = 'FLANK';
    const primaryAlly = otherMeleeAllies[0];
    const allyAngle = Math.atan2(primaryAlly.pos[1] - playerPos[1], primaryAlly.pos[0] - playerPos[0]);
    // Target flank angle opposite primary ally (+180 deg)
    const flankAngle = allyAngle + Math.PI;
    const targetFlankX = Math.round(playerPos[0] + Math.cos(flankAngle));
    const targetFlankY = Math.round(playerPos[1] + Math.sin(flankAngle));

    // Path toward target flank tile
    const stepDx = Math.sign(targetFlankX - enemy.pos[0]);
    const stepDy = Math.sign(targetFlankY - enemy.pos[1]);

    for (let s = moveRange; s >= 1; s--) {
      const tx = enemy.pos[0] + stepDx * s;
      const ty = enemy.pos[1] + stepDy * s;
      if (isTilePassable(tx, ty)) {
        destX = tx;
        destY = ty;
        break;
      }
    }
  } else {
    // Single melee foe charges directly
    tactic = 'CHARGE';
    const dist = getGridDistance(enemy.pos[0], enemy.pos[1], playerPos[0], playerPos[1]);
    if (dist > 1) {
      const moveDist = Math.min(moveRange, dist - 1);
      const dx = Math.sign(playerPos[0] - enemy.pos[0]) * moveDist;
      const dy = Math.sign(playerPos[1] - enemy.pos[1]) * moveDist;
      if (isTilePassable(enemy.pos[0] + dx, enemy.pos[1] + dy)) {
        destX = enemy.pos[0] + dx;
        destY = enemy.pos[1] + dy;
      }
    }
  }

  const allOtherPos = allHostiles.filter(h => h.id !== enemy.id && h.alive).map(h => h.pos);
  const isFlanking = isPlayerFlanked([destX, destY], allOtherPos, playerPos);
  const distFromDest = getGridDistance(destX, destY, playerPos[0], playerPos[1]);

  return {
    newPos: [destX, destY],
    tacticalTactic: tactic,
    declaredActionName: distFromDest <= 1.8
      ? (isFlanking ? 'Flanking Assault (+2 Rating) (1 Stamina)' : 'Physical Strike (1 Stamina)')
      : 'Advance & Stance (1 Stamina)',
    actionType: 'stamina',
    staminaCost: 1,
    focusCost: 0,
    isFlanking,
    coverBonus: 0
  };
}

/**
 * Resolves an Opposed Resilience Save against environmental trauma or psychic dread
 */
export function resolveResilienceSave(
  resilienceVal: number,
  hazardDC: number,
  hazardName: string
): { saved: boolean; roll: number; total: number; message: string } {
  const d20 = Math.floor(Math.random() * 20) + 1;
  const mod = Math.floor((resilienceVal - 10) / 2);
  const total = d20 + mod;
  const saved = total >= hazardDC;

  return {
    saved,
    roll: d20,
    total,
    message: `[RESILIENCE SAVE vs ${hazardName.toUpperCase()}]: 1d20(${d20}) + ${mod} = ${total} vs DC ${hazardDC} | ${
      saved ? 'SUCCESS (Endured / Negated)' : 'FAILED (Trauma Inflicted)'
    }`
  };
}

