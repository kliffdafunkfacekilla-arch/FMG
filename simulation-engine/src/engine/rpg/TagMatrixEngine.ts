/**
 * OSTRAKA & CONCORDIA UNIVERSAL TAG MATRIX & REACTION ENGINE
 * ==========================================================
 * Implements 5-facet tag categories (Material, Active, Reactive, Actionable, Environmental)
 * and resolves physical/combat interactions, status effects, and environmental cascades.
 */

export enum TagCategory {
  MATERIAL = 'MATERIAL',
  ACTIVE = 'ACTIVE',
  REACTIVE = 'REACTIVE',
  ACTIONABLE = 'ACTIONABLE',
  ENVIRONMENTAL = 'ENVIRONMENTAL'
}

export interface TaggedObject {
  id: string;
  name: string;
  type: 'PROP' | 'NPC' | 'PLAYER' | 'TILE' | 'WEAPON' | 'ARMOR';
  pos: [number, number]; // [x, y] tile
  tags: Set<string>;
  hp: number;
  maxHp: number;
  isDestroyed: boolean;
  inventory?: string[];
}

export interface TagInteractionResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'RESISTED';
  actionVerb: string;
  targetName: string;
  logs: string[];
  damageDealt: number;
  appliedTags: string[];
  removedTags: string[];
  destroyed: boolean;
  cascades: Array<{
    targetId: string;
    effect: string;
    damage?: number;
  }>;
}

export class TagMatrixEngine {
  /**
   * Resolves an interaction between an actor and a tagged target based on their tag intersections.
   */
  public static resolveInteraction(
    actorName: string,
    actionVerb: string,
    target: TaggedObject,
    toolOrSpellTags: string[] = [],
    nearbyProps: TaggedObject[] = []
  ): TagInteractionResult {
    const verb = actionVerb.toUpperCase();
    const logs: string[] = [];
    const appliedTags: string[] = [];
    const removedTags: string[] = [];
    const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
    let damage = 0;
    let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'RESISTED' = 'SUCCESS';

    logs.push(`[${actorName.toUpperCase()} INTENT]: ${verb} on ${target.name}`);

    // Combined attack/action tags
    const actionTags = new Set<string>(toolOrSpellTags.map(t => t.toLowerCase()));
    
    // Map common verbs to intrinsic interaction tags
    const verbTagMap: Record<string, string[]> = {
      'SLASH': ['cut', 'slashing', 'edged'],
      'STAB': ['pierce', 'piercing', 'pointed'],
      'THRUST': ['pierce', 'piercing', 'reach'],
      'SMASH': ['bludgeon', 'heavy', 'impact'],
      'BLUDGEON': ['bludgeon', 'heavy', 'impact'],
      'SEVER': ['cut', 'slashing', 'severing'],
      'IGNITE': ['fire', 'heat', 'burning'],
      'CAST_FIRE': ['fire', 'heat', 'burning', 'magic'],
      'CAST_LIGHTNING': ['electric', 'shocking', 'conductive_arc', 'magic'],
      'CAST_ICE': ['cold', 'freezing', 'brittle', 'magic'],
      'PUSH': ['force', 'shove', 'impact'],
      'MOVE': ['force', 'shove'],
      'UNLOCK': ['manipulate', 'key', 'finesse'],
      'PICK_LOCK': ['manipulate', 'lockpick', 'finesse'],
      'OPEN': ['manipulate'],
      'DEFUSE': ['finesse', 'disarm'],
      'DESECRATE': ['willpower', 'corrupt', 'chaos']
    };

    const derived = verbTagMap[verb] || [verb.toLowerCase()];
    derived.forEach(t => actionTags.add(t));

    // --- 1. SEVER (Cables, Chains, Chandelier Ropes) ---
    if (verb === 'SEVER' || actionTags.has('severing') || actionTags.has('cut')) {
      if (target.tags.has('severable') || target.tags.has('swinging')) {
        logs.push(`SUCCESS: Support holding '${target.name}' is severed!`);
        target.tags.delete('swinging');
        target.tags.add('falling');
        removedTags.push('swinging');
        appliedTags.push('falling');

        if (target.tags.has('heavy')) {
          logs.push(`Heavy Impact: Deals crushing damage to entities beneath!`);
          damage += 6;
        }

        if (target.tags.has('burning')) {
          logs.push(`Fire Spread: Burning fragments scatter across surrounding tiles!`);
          appliedTags.push('burning');
          // Ignite nearby flammable props
          nearbyProps.forEach(other => {
            if (other.id !== target.id && other.tags.has('flammable')) {
              other.tags.add('burning');
              cascades.push({ targetId: other.id, effect: 'Ignited by falling burning debris' });
              logs.push(`CASCADE: '${other.name}' catches fire!`);
            }
          });
        }
      } else if (verb === 'SEVER') {
        status = 'FAILED';
        logs.push(`FAILED: '${target.name}' has no severable supports.`);
      }
    }

    // --- 2. FIRE / IGNITE (Flammable wood, fabric, web, parchment) ---
    if (actionTags.has('fire') || actionTags.has('burning') || verb === 'IGNITE') {
      if (target.tags.has('flammable') || target.tags.has('wood') || target.tags.has('cloth') || target.tags.has('dry')) {
        target.tags.add('burning');
        appliedTags.push('burning');
        damage += 4;
        logs.push(`SUCCESS: '${target.name}' catches fire and begins burning!`);

        // Smoke / Hindrance
        if (target.tags.has('wood') || target.tags.has('cloth')) {
          logs.push(`Smoke billows from the burning materials, applying visibility hindrance.`);
        }
      } else if (target.tags.has('stone') || target.tags.has('metal') || target.tags.has('water')) {
        status = 'RESISTED';
        logs.push(`RESISTED: '${target.name}' is fire-resistant material.`);
      }
    }

    // --- 3. ELECTRICITY / LIGHTNING (Metal, Water, Wet, Conductive) ---
    if (actionTags.has('electric') || actionTags.has('shocking')) {
      if (target.tags.has('metal') || target.tags.has('conductive') || target.tags.has('wet') || target.tags.has('water')) {
        logs.push(`CONDUCTIVE SURGE: Current arcs violently through '${target.name}'!`);
        damage += 5;
        appliedTags.push('electrified');
        target.tags.add('electrified');

        // Shock arc to adjacent wet or metal props
        nearbyProps.forEach(other => {
          if (other.id !== target.id && (other.tags.has('metal') || other.tags.has('wet'))) {
            cascades.push({ targetId: other.id, effect: 'Shock arc discharge', damage: 3 });
            logs.push(`CASCADE: Shock arcs into nearby '${other.name}'!`);
          }
        });
      } else {
        logs.push(`Normal lightning impact on '${target.name}'.`);
        damage += 2;
      }
    }

    // --- 4. COLD / FREEZING (Brittle, Slippery) ---
    if (actionTags.has('cold') || actionTags.has('freezing')) {
      if (target.tags.has('water') || target.tags.has('wet')) {
        target.tags.add('frozen');
        appliedTags.push('frozen');
        logs.push(`FREEZE: Liquid hardens into treacherous, slippery ice!`);
      } else if (target.tags.has('stone') || target.tags.has('metal')) {
        target.tags.add('brittle');
        appliedTags.push('brittle');
        logs.push(`CRYSTALLIZATION: Thermal shock makes '${target.name}' brittle (-2 structural armor).`);
      }
    }

    // --- 5. PHYSICAL IMPACT (Smash, Push, Bludgeon) ---
    if (actionTags.has('bludgeon') || actionTags.has('heavy') || verb === 'SMASH') {
      if (target.tags.has('brittle') || target.tags.has('fragile')) {
        logs.push(`SHATTER: Brittle structure fractures under the heavy blow!`);
        damage += 8;
      } else if (target.tags.has('heavy_armor') || target.tags.has('reinforced')) {
        damage += 2;
        logs.push(`Impact partially absorbed by heavy reinforcement.`);
      } else {
        damage += 4;
      }

      if (target.tags.has('movable') || target.tags.has('rolling')) {
        logs.push(`KINETIC PUSH: '${target.name}' is shoved across the grid!`);
        appliedTags.push('pushed');
      }
    }

    // --- 6. LOCKS & CONTAINERS ---
    if (verb === 'UNLOCK' || verb === 'PICK_LOCK') {
      if (target.tags.has('locked')) {
        target.tags.delete('locked');
        target.tags.add('unlocked');
        removedTags.push('locked');
        appliedTags.push('unlocked');
        logs.push(`SUCCESS: Lock mechanism clicks open!`);
      } else {
        logs.push(`Notice: '${target.name}' was not locked.`);
      }
    }

    if (verb === 'OPEN') {
      if (target.tags.has('locked')) {
        status = 'FAILED';
        logs.push(`BLOCKED: '${target.name}' is firmly locked.`);
      } else if (target.tags.has('openable')) {
        target.tags.add('open');
        appliedTags.push('open');
        logs.push(`SUCCESS: '${target.name}' swings wide open.`);
      }
    }

    // Apply Damage & Destruction Check
    if (damage > 0) {
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0 && !target.isDestroyed) {
        target.isDestroyed = true;
        target.tags.add('destroyed');
        appliedTags.push('destroyed');
        logs.push(`CRITICAL DESTRUCTION: '${target.name}' has been completely destroyed!`);
      }
    }

    return {
      status,
      actionVerb: verb,
      targetName: target.name,
      logs,
      damageDealt: damage,
      appliedTags,
      removedTags,
      destroyed: target.isDestroyed,
      cascades
    };
  }

  /**
   * Helper to construct a fresh tagged object
   */
  public static createProp(
    id: string,
    name: string,
    pos: [number, number],
    tags: string[],
    hp: number = 20
  ): TaggedObject {
    return {
      id,
      name,
      type: 'PROP',
      pos,
      tags: new Set<string>(tags.map(t => t.toLowerCase())),
      hp,
      maxHp: hp,
      isDestroyed: false
    };
  }
}
