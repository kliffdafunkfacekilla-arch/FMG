/**
 * OSTRAKA & CONCORDIA DECLARATIVE TAG MATRIX & REACTION ENGINE
 * ==============================================================
 * Implements a data-driven declarative reaction rule table replacing procedural if-chains.
 * Resolves physical/combat interactions, elemental status effects, and environmental cascades.
 */

export enum TagCategory {
  MATERIAL = "MATERIAL",
  ACTIVE = "ACTIVE",
  REACTIVE = "REACTIVE",
  ACTIONABLE = "ACTIONABLE",
  ENVIRONMENTAL = "ENVIRONMENTAL"
}

export interface TaggedObject {
  id: string;
  name: string;
  type: "PROP" | "NPC" | "PLAYER" | "TILE" | "WEAPON" | "ARMOR";
  pos: [number, number]; // [x, y] tile
  tags: Set<string>;
  hp: number;
  maxHp: number;
  isDestroyed: boolean;
  inventory?: string[];
  description?: string;
}

export interface TagInteractionResult {
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "RESISTED";
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

export interface TagReactionRule {
  id: string;
  name: string;
  triggerVerbs?: string[];
  triggerActionTags?: string[];
  targetRequiresAny?: string[];
  targetRequiresAll?: string[];
  targetResistsAny?: string[];
  applyTags?: string[];
  removeTags?: string[];
  damage?: number;
  bonusDamageCondition?: (target: TaggedObject) => number;
  successLog: (targetName: string) => string;
  resistedLog?: (targetName: string) => string;
  cascadeHandler?: (target: TaggedObject, nearbyProps: TaggedObject[]) => Array<{ targetId: string; effect: string; damage?: number }>;
}

/**
 * DECLARATIVE TAG REACTION RULES TABLE
 */
export const TAG_REACTION_RULES: TagReactionRule[] = [
  // 1. SEVER SUPPORTS
  {
    id: "RULE_SEVER_SUPPORT",
    name: "Sever Support",
    triggerVerbs: ["SEVER"],
    triggerActionTags: ["severing", "cut", "slashing"],
    targetRequiresAny: ["severable", "swinging"],
    removeTags: ["swinging"],
    applyTags: ["falling"],
    bonusDamageCondition: (target) => (target.tags.has("heavy") ? 6 : 0),
    successLog: (name) => `SUCCESS: Support holding '${name}' is severed and collapses!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      if (target.tags.has("burning")) {
        nearby.forEach(other => {
          if (other.id !== target.id && other.tags.has("flammable")) {
            other.tags.add("burning");
            cascades.push({ targetId: other.id, effect: "Ignited by falling burning debris", damage: 3 });
          }
        });
      }
      return cascades;
    }
  },

  // 2. FIRE & IGNITION
  {
    id: "RULE_FIRE_IGNITION",
    name: "Fire Ignition",
    triggerVerbs: ["IGNITE", "CAST_FIRE"],
    triggerActionTags: ["fire", "burning", "heat"],
    targetRequiresAny: ["flammable", "wood", "cloth", "dry", "tinder", "oil"],
    targetResistsAny: ["stone", "metal", "water", "wet", "clay", "adobe", "brick"],
    applyTags: ["burning"],
    damage: 4,
    successLog: (name) => `SUCCESS: '${name}' catches fire and begins burning!`,
    resistedLog: (name) => `RESISTED: '${name}' is non-flammable mineral or damp material.`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      if (target.tags.has("explosive") || target.tags.has("oil")) {
        nearby.forEach(other => {
          if (other.id !== target.id) {
            cascades.push({ targetId: other.id, effect: "Blown back by exploding fire barrel", damage: 8 });
          }
        });
      }
      return cascades;
    }
  },

  // 3. ELECTRICITY & SHOCK CONDUCTION
  {
    id: "RULE_ELECTRIC_SURGE",
    name: "Electric Shock Arc",
    triggerVerbs: ["CAST_LIGHTNING"],
    triggerActionTags: ["electric", "shocking", "conductive_arc"],
    targetRequiresAny: ["metal", "conductive", "wet", "water"],
    applyTags: ["electrified"],
    damage: 5,
    successLog: (name) => `CONDUCTIVE SURGE: Current arcs violently through '${name}'!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id && (other.tags.has("metal") || other.tags.has("wet") || other.tags.has("water"))) {
          cascades.push({ targetId: other.id, effect: "Conductive shock discharge", damage: 3 });
        }
      });
      return cascades;
    }
  },

  // 4. COLD & THERMAL SHOCK FREEZE
  {
    id: "RULE_COLD_FREEZE",
    name: "Cold Freezing",
    triggerVerbs: ["CAST_ICE"],
    triggerActionTags: ["cold", "freezing", "ice"],
    targetRequiresAny: ["water", "wet", "liquid", "stone", "metal"],
    applyTags: ["frozen"],
    bonusDamageCondition: (target) => {
      if (target.tags.has("stone") || target.tags.has("metal")) {
        target.tags.add("brittle");
      }
      return 0;
    },
    successLog: (name) => `CRYSTALLIZATION: Moisture around '${name}' freezes solid into brittle, slippery ice!`
  },

  // 5. PHYSICAL IMPACT & BLUDGEONING
  {
    id: "RULE_PHYSICAL_SMASH",
    name: "Heavy Kinetic Smash",
    triggerVerbs: ["SMASH", "BLUDGEON"],
    triggerActionTags: ["bludgeon", "heavy", "impact", "force"],
    applyTags: ["pushed"],
    damage: 4,
    bonusDamageCondition: (target) => {
      if (target.tags.has("brittle") || target.tags.has("fragile")) {
        target.tags.add("shattered");
        return 8;
      }
      return target.tags.has("heavy_armor") ? -2 : 0;
    },
    successLog: (name) => `KINETIC IMPACT: Heavy physical blow shatters into '${name}'!`
  },

  // 6. LOCK MECHANISMS
  {
    id: "RULE_UNLOCK_MECHANISM",
    name: "Unlock Mechanism",
    triggerVerbs: ["UNLOCK", "PICK_LOCK"],
    triggerActionTags: ["manipulate", "lockpick", "key"],
    targetRequiresAny: ["locked"],
    removeTags: ["locked"],
    applyTags: ["unlocked"],
    successLog: (name) => `SUCCESS: Lock mechanism in '${name}' clicks open!`
  },

  // 7. CONTAINER OPENING
  {
    id: "RULE_OPEN_CONTAINER",
    name: "Open Container",
    triggerVerbs: ["OPEN"],
    triggerActionTags: ["manipulate"],
    targetRequiresAny: ["openable"],
    targetResistsAny: ["locked"],
    applyTags: ["open"],
    successLog: (name) => `SUCCESS: '${name}' swings wide open!`,
    resistedLog: (name) => `BLOCKED: '${name}' is firmly locked.`
  },

  // 8. CORROSIVE ACID
  {
    id: "RULE_CORROSIVE_ACID",
    name: "Corrosive Acid",
    triggerActionTags: ["acid", "corrosive"],
    targetRequiresAny: ["metal", "wood", "organic", "armor"],
    applyTags: ["corroded"],
    damage: 5,
    successLog: (name) => `DISSOLUTION: Acid hisses, dissolving outer armor and integrity of '${name}'!`
  },

  // 9. CHAOS DESECRATION
  {
    id: "RULE_CHAOS_DESECRATION",
    name: "Chaos Desecration",
    triggerVerbs: ["DESECRATE"],
    triggerActionTags: ["willpower", "corrupt", "chaos"],
    targetRequiresAny: ["sacred", "altar", "shrine", "temple"],
    applyTags: ["desecrated"],
    damage: 4,
    successLog: (name) => `DEFIANCE: Sacred seal of '${name}' is shattered by raw chaos flow!`
  }
];

export class TagMatrixEngine {
  /**
   * Resolves an interaction between an actor and a tagged target using the declarative rule table.
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
    let totalDamage = 0;
    let status: "SUCCESS" | "PARTIAL" | "FAILED" | "RESISTED" = "SUCCESS";

    logs.push(`[${actorName.toUpperCase()} INTENT]: ${verb} on ${target.name}`);

    // Combined action tags (normalized to lowercase)
    const actionTags = new Set<string>(toolOrSpellTags.map(t => t.toLowerCase()));
    
    // Semantic verb mappings
    const verbTagMap: Record<string, string[]> = {
      "SLASH": ["cut", "slashing", "edged"],
      "STAB": ["pierce", "piercing", "pointed"],
      "THRUST": ["pierce", "piercing", "reach"],
      "SMASH": ["bludgeon", "heavy", "impact"],
      "BLUDGEON": ["bludgeon", "heavy", "impact"],
      "SEVER": ["cut", "slashing", "severing"],
      "IGNITE": ["fire", "heat", "burning"],
      "CAST_FIRE": ["fire", "heat", "burning", "magic"],
      "CAST_LIGHTNING": ["electric", "shocking", "conductive_arc", "magic"],
      "CAST_ICE": ["cold", "freezing", "brittle", "ice", "magic"],
      "PUSH": ["force", "shove", "impact"],
      "MOVE": ["force", "shove"],
      "UNLOCK": ["manipulate", "key", "finesse"],
      "PICK_LOCK": ["manipulate", "lockpick", "finesse"],
      "OPEN": ["manipulate"],
      "DEFUSE": ["finesse", "disarm"],
      "DESECRATE": ["willpower", "corrupt", "chaos"]
    };

    const derived = verbTagMap[verb] || [verb.toLowerCase()];
    derived.forEach(t => actionTags.add(t));

    let matchedAnyRule = false;

    // Evaluate declarative reaction rules
    for (const rule of TAG_REACTION_RULES) {
      // Check trigger verbs or action tags
      const verbMatch = rule.triggerVerbs ? rule.triggerVerbs.includes(verb) : false;
      const tagMatch = rule.triggerActionTags ? rule.triggerActionTags.some(t => actionTags.has(t)) : false;

      if (!verbMatch && !tagMatch) continue;

      // Check target resistance
      if (rule.targetResistsAny && rule.targetResistsAny.some(t => target.tags.has(t))) {
        status = "RESISTED";
        if (rule.resistedLog) {
          logs.push(rule.resistedLog(target.name));
        }
        matchedAnyRule = true;
        continue;
      }

      // Check target requirements
      if (rule.targetRequiresAny && !rule.targetRequiresAny.some(t => target.tags.has(t))) {
        continue;
      }
      if (rule.targetRequiresAll && !rule.targetRequiresAll.every(t => target.tags.has(t))) {
        continue;
      }

      matchedAnyRule = true;

      // Apply tag removals
      if (rule.removeTags) {
        for (const rt of rule.removeTags) {
          target.tags.delete(rt);
          removedTags.push(rt);
        }
      }

      // Apply tag additions
      if (rule.applyTags) {
        for (const at of rule.applyTags) {
          target.tags.add(at);
          appliedTags.push(at);
        }
      }

      // Calculate damage
      let dmg = rule.damage || 0;
      if (rule.bonusDamageCondition) {
        dmg += rule.bonusDamageCondition(target);
      }
      totalDamage += Math.max(0, dmg);

      // Log success
      logs.push(rule.successLog(target.name));

      // Handle cascades
      if (rule.cascadeHandler) {
        const subCascades = rule.cascadeHandler(target, nearbyProps);
        cascades.push(...subCascades);
        for (const sc of subCascades) {
          logs.push(`CASCADE: ${sc.effect}`);
        }
      }
    }

    if (!matchedAnyRule) {
      logs.push(`Standard interaction: ${verb} performed on '${target.name}'.`);
    }

    // Apply Damage & Destruction Check
    if (totalDamage > 0) {
      target.hp = Math.max(0, target.hp - totalDamage);
      if (target.hp === 0 && !target.isDestroyed) {
        target.isDestroyed = true;
        target.tags.add("destroyed");
        appliedTags.push("destroyed");
        logs.push(`CRITICAL DESTRUCTION: '${target.name}' has been completely destroyed!`);
      }
    }

    return {
      status,
      actionVerb: verb,
      targetName: target.name,
      logs,
      damageDealt: totalDamage,
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
      type: "PROP",
      pos,
      tags: new Set<string>(tags.map(t => t.toLowerCase())),
      hp,
      maxHp: hp,
      isDestroyed: false
    };
  }
}
