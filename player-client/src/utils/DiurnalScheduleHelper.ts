/**
 * DIURNAL SCHEDULE & CITIZEN ROUTINES HELPER
 * ===========================================
 * Governs the in-game day/night cycle and autonomous citizen routines on the 256x256 grid:
 * - 4 Diurnal Phases: MORNING (06:00), MIDDAY (12:00), EVENING (18:00), NIGHT (22:00).
 * - Municipal citizens migrate between WORK (forge, market stalls, gateposts),
 *   LEISURE (common taverns & hearths), and SLEEP (barracks & homes).
 * - Canvas ambient night darkness shader with torch & hearth radial punch cutouts.
 */

import type { InjectedNPC } from '../types';

export type DiurnalPhase = 'MORNING' | 'MIDDAY' | 'EVENING' | 'NIGHT';

export interface DiurnalInfo {
  phase: DiurnalPhase;
  name: string;
  timeString: string;
  ambientDarkness: number; // 0.0 (day) to 0.72 (night)
  tintColor: string;
  sensoryNotice: string;
  icon: string;
}

/**
 * Derives current diurnal phase and atmosphere from world tick and step counter.
 * A tick is 1 day; sub-ticks (modulo 4) define the 4 diurnal quarters.
 */
export function getDiurnalPhase(tick: number = 1, stepCounter: number = 0): DiurnalInfo {
  // Combine calendar tick and player step moves to advance the time of day
  const effectiveStep = Math.floor(stepCounter / 25) + tick;
  const phaseIndex = Math.abs(effectiveStep) % 4;

  switch (phaseIndex) {
    case 1:
      return {
        phase: 'MORNING',
        name: 'Early Morning Sun',
        timeString: '07:30',
        ambientDarkness: 0.05,
        tintColor: 'rgba(254, 240, 138, 0.05)',
        sensoryNotice: 'Golden dawn glints over the horizon. Shopkeepers unlock stalls and guard shifts rotate.',
        icon: '🌅'
      };
    case 2:
      return {
        phase: 'MIDDAY',
        name: 'High Zenith Sun',
        timeString: '12:45',
        ambientDarkness: 0.0,
        tintColor: 'rgba(255, 255, 255, 0.0)',
        sensoryNotice: 'The sun beats directly overhead. The marketplace hums with trade and iron anvils ring.',
        icon: '☀️'
      };
    case 3:
      return {
        phase: 'EVENING',
        name: 'Twilight Dusk',
        timeString: '18:15',
        ambientDarkness: 0.32,
        tintColor: 'rgba(124, 45, 18, 0.15)',
        sensoryNotice: 'Long purple shadows stretch across the stones. Workers gather around tavern hearthfires.',
        icon: '🌆'
      };
    case 0:
    default:
      return {
        phase: 'NIGHT',
        name: 'Deep Midnight',
        timeString: '23:30',
        ambientDarkness: 0.68,
        tintColor: 'rgba(2, 6, 23, 0.45)',
        sensoryNotice: 'Cruorbus hangs in the midnight sky. Citizens sleep behind bolted shutters; torches pierce the dark.',
        icon: '🌙'
      };
  }
}

/**
 * Evaluates citizen routines and smoothly migrates municipal NPCs toward their phase destinations.
 */
export function updateNPCDiurnalRoutines(
  npcs: InjectedNPC[],
  phase: DiurnalPhase,
  burgCenter: [number, number] = [128, 128]
): {
  updatedNPCs: InjectedNPC[];
  routineEvents: string[];
} {
  const routineEvents: string[] = [];
  const tavernPos: [number, number] = [burgCenter[0] + 28, burgCenter[1] + 24];

  const updatedNPCs = npcs.map(npc => {
    // Only municipal citizens and civilized NPCs participate in diurnal civic routines
    if (!npc.alive || !npc.homePos || !npc.workPos) {
      return npc;
    }

    const nextNpc = { ...npc, pos: [...npc.pos] as [number, number] };
    let targetPos: [number, number] = npc.workPos;
    let targetState: 'WORK' | 'LEISURE' | 'SLEEP' = 'WORK';
    let taskName = 'Labor & Trade';

    if (phase === 'NIGHT') {
      targetPos = npc.homePos;
      targetState = 'SLEEP';
      taskName = 'Resting in Quarters';
    } else if (phase === 'EVENING') {
      targetPos = tavernPos;
      targetState = 'LEISURE';
      taskName = 'Sharing Ale at Hearth';
    } else {
      targetPos = npc.workPos;
      targetState = 'WORK';
      taskName = npc.role?.includes('Smith')
        ? 'Forging Steel & Weapons'
        : npc.role?.includes('Merchant')
        ? 'Trading Commodities'
        : npc.role?.includes('Guard') || npc.role?.includes('Watch')
        ? 'Standing Guard at Gate'
        : 'Managing Municipal Store';
    }

    nextNpc.scheduleState = targetState;
    nextNpc.currentTask = taskName;

    // Advance 1 step toward target position if not already there
    const dx = targetPos[0] - nextNpc.pos[0];
    const dy = targetPos[1] - nextNpc.pos[1];
    const dist = Math.hypot(dx, dy);

    if (dist > 1.2) {
      const stepX = Math.sign(dx);
      const stepY = Math.sign(dy);
      nextNpc.pos[0] += stepX;
      nextNpc.pos[1] += stepY;

      if (Math.random() < 0.05) {
        routineEvents.push(`${nextNpc.name} is walking toward ${targetState === 'SLEEP' ? 'their quarters' : targetState === 'LEISURE' ? 'the tavern' : 'their workstation'}.`);
      }
    }

    return nextNpc;
  });

  return {
    updatedNPCs,
    routineEvents
  };
}

