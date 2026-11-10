/**
 * OSTRAKA & B.R.U.T.A.L. DECLARATIVE TAG MATRIX & REACTION ENGINE
 * ==============================================================
 * Implements a comprehensive, data-driven declarative reaction table.
 * Resolves physical, combat, elemental status effects, environmental cascades,
 * subterfuge traps, structural collapses, and social reactions.
 */

export enum TagCategory {
  MATERIAL = "MATERIAL",
  ACTIVE = "ACTIVE",
  REACTIVE = "REACTIVE",
  ACTIONABLE = "ACTIONABLE",
  ENVIRONMENTAL = "ENVIRONMENTAL",
  SOCIAL = "SOCIAL"
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
 * COMPREHENSIVE DECLARATIVE TAG REACTION RULES TABLE
 */
export const TAG_REACTION_RULES: TagReactionRule[] = [
  // -------------------------------------------------------------
  // 1. SEVER SUPPORTS & STRUCTURAL TETHERING
  // -------------------------------------------------------------
  {
    id: "RULE_SEVER_SUPPORT",
    name: "Sever Support",
    triggerVerbs: ["SEVER", "CUT", "SLICE"],
    triggerActionTags: ["severing", "cut", "slashing", "edged"],
    targetRequiresAny: ["severable", "swinging", "suspended", "rope", "tether", "cable"],
    removeTags: ["swinging", "suspended"],
    applyTags: ["falling", "severed"],
    bonusDamageCondition: (target) => (target.tags.has("heavy") ? 8 : 2),
    successLog: (name) => `STRUCTURAL SEVER: Support holding '${name}' is sliced and plummets downward!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 6) {
            cascades.push({
              targetId: other.id,
              effect: `Struck by falling debris from severed '${target.name}'`,
              damage: target.tags.has("heavy") ? 8 : 4
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 2. FIRE & IGNITION
  // -------------------------------------------------------------
  {
    id: "RULE_FIRE_IGNITION",
    name: "Fire Ignition",
    triggerVerbs: ["IGNITE", "CAST_FIRE", "BURN", "TORCH"],
    triggerActionTags: ["fire", "burning", "heat", "flame"],
    targetRequiresAny: ["flammable", "wood", "cloth", "dry", "tinder", "oil", "tar", "grain", "canvas"],
    targetResistsAny: ["stone", "metal", "water", "wet", "damp", "adobe", "brick"],
    applyTags: ["burning"],
    damage: 6,
    bonusDamageCondition: (target) => (target.tags.has("oil") || target.tags.has("tar") ? 8 : 0),
    successLog: (name) => `IGNITION CASCADE: '${name}' catches fire and begins burning fiercely!`,
    resistedLog: (name) => `FIRE RESISTED: '${name}' is non-flammable mineral or too damp to ignite.`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      if (target.tags.has("explosive") || target.tags.has("oil") || target.tags.has("gunpowder")) {
        nearby.forEach(other => {
          if (other.id !== target.id) {
            const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
            if (dist <= 8) {
              cascades.push({
                targetId: other.id,
                effect: `Caught in catastrophic fuel blast from burning '${target.name}'`,
                damage: 10
              });
              if (other.tags.has("flammable")) {
                other.tags.add("burning");
              }
            }
          }
        });
      }
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 3. WATER EXTINGUISH & DOUSE
  // -------------------------------------------------------------
  {
    id: "RULE_WATER_DOUSE",
    name: "Water Douse & Smother",
    triggerVerbs: ["DOUSE", "EXTINGUISH", "SPLASH", "FLOOD"],
    triggerActionTags: ["water", "wet", "liquid", "douse"],
    targetRequiresAny: ["burning", "fire", "heated"],
    removeTags: ["burning", "heated"],
    applyTags: ["wet", "extinguished", "steaming"],
    successLog: (name) => `SMOTHERED: Flames on '${name}' are quenched with a hiss of thick white steam!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 4) {
            other.tags.add("obscured");
            cascades.push({
              targetId: other.id,
              effect: "Obscured by thick plumes of scalding quenching steam",
              damage: 1
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 4. ELECTRIC SHOCK & WATER CONDUCTION
  // -------------------------------------------------------------
  {
    id: "RULE_ELECTRIC_SURGE",
    name: "Electric Shock Arc",
    triggerVerbs: ["CAST_LIGHTNING", "SHOCK", "DISCHARGE"],
    triggerActionTags: ["electric", "shocking", "conductive_arc", "lightning"],
    targetRequiresAny: ["metal", "conductive", "wet", "water", "iron", "steel", "bronze"],
    applyTags: ["electrified"],
    damage: 7,
    bonusDamageCondition: (target) => (target.tags.has("water") || target.tags.has("wet") ? 5 : 0),
    successLog: (name) => `CONDUCTIVE SURGE: High-voltage arc crackles violently through '${name}'!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id && (other.tags.has("metal") || other.tags.has("wet") || other.tags.has("water"))) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 7) {
            other.tags.add("electrified");
            cascades.push({
              targetId: other.id,
              effect: "Chain-shock conducted through contiguous conductive medium",
              damage: 5
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 5. COLD & THERMAL SHOCK FREEZE
  // -------------------------------------------------------------
  {
    id: "RULE_COLD_FREEZE",
    name: "Cold Freezing",
    triggerVerbs: ["CAST_ICE", "FREEZE", "CHILL"],
    triggerActionTags: ["cold", "freezing", "ice", "frost"],
    targetRequiresAny: ["water", "wet", "liquid", "stone", "metal"],
    applyTags: ["frozen", "slippery"],
    bonusDamageCondition: (target) => {
      if (target.tags.has("stone") || target.tags.has("metal") || target.tags.has("burning")) {
        target.tags.add("brittle");
        return 4; // Thermal shock damage
      }
      return 0;
    },
    successLog: (name) => `CRYSTALLIZATION: Moisture around '${name}' freezes solid into treacherous, brittle rime!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      if (target.tags.has("brittle")) {
        cascades.push({
          targetId: target.id,
          effect: "Thermal shock causes micro-fractures in structural integrity (vulnerable to bludgeoning)"
        });
      }
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 6. HEAVY PHYSICAL SMASH & BLUDGEONING
  // -------------------------------------------------------------
  {
    id: "RULE_PHYSICAL_SMASH",
    name: "Heavy Kinetic Smash",
    triggerVerbs: ["SMASH", "BLUDGEON", "CRUSH", "BATTER"],
    triggerActionTags: ["bludgeon", "heavy", "impact", "force", "might"],
    applyTags: ["battered"],
    damage: 6,
    bonusDamageCondition: (target) => {
      if (target.tags.has("brittle") || target.tags.has("fragile") || target.tags.has("glass")) {
        target.tags.add("shattered");
        return 12; // Massive shatter bonus
      }
      if (target.tags.has("reinforced") || target.tags.has("heavy_armor")) {
        return -3;
      }
      return 0;
    },
    successLog: (name) => `KINETIC IMPACT: Heavy physical blow craters into '${name}'!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      if (target.tags.has("shattered") || target.isDestroyed) {
        nearby.forEach(other => {
          if (other.id !== target.id) {
            const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
            if (dist <= 4) {
              cascades.push({
                targetId: other.id,
                effect: "Shrapnel from shattered debris peppers surrounding area",
                damage: 3
              });
            }
          }
        });
      }
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 7. STRUCTURAL COLLAPSE (Load-Bearing destruction)
  // -------------------------------------------------------------
  {
    id: "RULE_STRUCTURAL_COLLAPSE",
    name: "Structural Collapse",
    triggerVerbs: ["COLLAPSE", "TOPPLE", "PULL_DOWN", "DEMOLISH"],
    triggerActionTags: ["demolish", "heavy", "leverage", "might"],
    targetRequiresAny: ["load_bearing", "pillar", "archway", "scaffolding", "support_beam"],
    applyTags: ["collapsed", "rubble"],
    damage: 14,
    successLog: (name) => `CATASTROPHIC COLLAPSE: Keystone '${name}' gives way, bringing down masonry and rafters!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 7) {
            other.tags.add("pinned");
            cascades.push({
              targetId: other.id,
              effect: "Crushed beneath tons of falling masonry and collapsing scaffolding",
              damage: 12
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 8. LOCKPICKING & DELICATE BYPASS
  // -------------------------------------------------------------
  {
    id: "RULE_UNLOCK_MECHANISM",
    name: "Unlock Mechanism",
    triggerVerbs: ["UNLOCK", "PICK_LOCK", "SHIM"],
    triggerActionTags: ["manipulate", "lockpick", "key", "finesse", "subterfuge"],
    targetRequiresAny: ["locked"],
    removeTags: ["locked"],
    applyTags: ["unlocked", "openable"],
    successLog: (name) => `TENSION CLICK: Internal pins in '${name}' align and the cylinder rotates open!`,
    cascadeHandler: (target) => {
      return [{ targetId: target.id, effect: "Lock mechanism successfully picked without noise" }];
    }
  },

  // -------------------------------------------------------------
  // 9. OPEN CONTAINER / DOOR
  // -------------------------------------------------------------
  {
    id: "RULE_OPEN_CONTAINER",
    name: "Open Container / Portal",
    triggerVerbs: ["OPEN", "UNLATCH", "SWING_OPEN"],
    triggerActionTags: ["manipulate", "open"],
    targetRequiresAny: ["openable", "door", "chest", "crate", "sluice", "valve", "hatch"],
    targetResistsAny: ["locked", "barred", "jammed", "welded"],
    removeTags: ["closed"],
    applyTags: ["opened", "accessible"],
    successLog: (name) => `SUCCESS: '${name}' swings open, revealing what lies within!`,
    resistedLog: (name) => `OBSTRUCTED: '${name}' is firmly locked, barred, or jammed shut.`
  },

  // -------------------------------------------------------------
  // 10. CORROSIVE ACID & RUST
  // -------------------------------------------------------------
  {
    id: "RULE_CORROSIVE_ACID",
    name: "Corrosive Acid & Rust",
    triggerVerbs: ["CORRODE", "ACID", "RUST"],
    triggerActionTags: ["acid", "corrosive", "chemical", "rust"],
    targetRequiresAny: ["metal", "wood", "iron", "armor", "chain", "hinge", "organic"],
    applyTags: ["corroded", "weakened"],
    damage: 7,
    successLog: (name) => `DISSOLUTION: Acid hisses, dissolving outer armor and chewing through structural integrity of '${name}'!`,
    cascadeHandler: (target) => {
      if (target.tags.has("locked")) {
        target.tags.delete("locked");
        target.tags.add("eaten_through");
        return [{ targetId: target.id, effect: "Acid eats directly through lock tumblers, rendering mechanism useless" }];
      }
      return [];
    }
  },

  // -------------------------------------------------------------
  // 11. ACOUSTIC DISTRACTION & SOUND LURE
  // -------------------------------------------------------------
  {
    id: "RULE_ACOUSTIC_DISTRACTION",
    name: "Acoustic Distraction",
    triggerVerbs: ["DISTRACT", "LURE", "THROW_STONE", "WHISTLE"],
    triggerActionTags: ["subterfuge", "noise", "distraction", "sound"],
    targetRequiresAny: ["sentry", "guard", "patrol", "npc"],
    applyTags: ["distracted", "investigating"],
    successLog: (name) => `TACTICAL LURE: '${name}' hears the sharp clatter and turns away to investigate!`,
    cascadeHandler: (target) => {
      return [{ targetId: target.id, effect: "Line of sight broken for 1 round (Stealth checks have Advantage)" }];
    }
  },

  // -------------------------------------------------------------
  // 12. EXTINGUISH LIGHT (Stealth & Shadow)
  // -------------------------------------------------------------
  {
    id: "RULE_SNUFF_LIGHT",
    name: "Extinguish Light Source",
    triggerVerbs: ["SNUFF", "SMOTHER", "DOUSE", "BREAK"],
    triggerActionTags: ["douse", "smother", "snuff", "darkness"],
    targetRequiresAny: ["brazier", "torch", "lantern", "light_source", "illuminated"],
    removeTags: ["illuminated", "burning"],
    applyTags: ["extinguished", "darkness"],
    successLog: (name) => `SHADOW VEIL: Light from '${name}' is extinguished, plunging the area into deep shadow!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 8) {
            other.tags.add("shadow_covered");
            cascades.push({ targetId: other.id, effect: "Concealed by darkness; sentry sight range reduced to 3m" });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 13. WINCH & SLUICE VALVE MANIPULATION
  // -------------------------------------------------------------
  {
    id: "RULE_OPERATE_WINCH",
    name: "Operate Winch / Valve",
    triggerVerbs: ["OPERATE", "CRANK", "PULL_LEVER", "TURN_VALVE"],
    triggerActionTags: ["manipulate", "winch", "lever", "valve", "might", "logic"],
    targetRequiresAny: ["winch", "mechanism", "lever", "valve", "pulley"],
    applyTags: ["activated"],
    successLog: (name) => `GEAR ENGAGEMENT: Heavy iron cogs grind in '${name}', shifting linked sluice gates and counterweights!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id && (other.tags.has("gate") || other.tags.has("sluice") || other.tags.has("portcullis"))) {
          other.tags.delete("locked");
          other.tags.delete("closed");
          other.tags.add("opened");
          cascades.push({ targetId: other.id, effect: "Heavy portcullis raises 3 meters, clearing passage" });
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 14. BRIBERY & GREED CORRUPTION
  // -------------------------------------------------------------
  {
    id: "RULE_BRIBERY_CORRUPTION",
    name: "Bribery & Financial Leverage",
    triggerVerbs: ["BRIBE", "PAY_OFF", "GREASE_PALM"],
    triggerActionTags: ["bribe", "gold", "charm", "coin", "social"],
    targetRequiresAny: ["bribable", "corrupt", "underpaid", "greedy", "guard", "customs"],
    targetResistsAny: ["zealot", "fanatic", "uncompromising", "automaton"],
    removeTags: ["hostile", "suspicious", "watchful"],
    applyTags: ["bribed", "complacent", "friendly"],
    successLog: (name) => `GREASED PALM: Heavy pouch of coin slips into '${name}'s cloak. Their eyes turn away from your business.`,
    resistedLog: (name) => `INCORRUPTIBLE: '${name}' spits on the offered coin and raises their weapon in outrage!`
  },

  // -------------------------------------------------------------
  // 15. INTIMIDATION & MORALE SHRED
  // -------------------------------------------------------------
  {
    id: "RULE_INTIMIDATION_FRIGHT",
    name: "Intimidation & Morale Terror",
    triggerVerbs: ["INTIMIDATE", "TERRIFY", "DEMORALIZE", "ROAR"],
    triggerActionTags: ["intimidate", "might", "terror", "menacing", "social"],
    targetRequiresAny: ["mortal", "cowardly", "unseasoned", "isolated", "outnumbered"],
    targetResistsAny: ["fearless", "undead", "berserker", "fanatic"],
    applyTags: ["frightened", "wavering"],
    damage: 4, // Moral Composure damage
    successLog: (name) => `TERROR STRIKE: '${name}' blanches at the display of violence, backing away with trembling hands!`,
    resistedLog: (name) => `UNFAZED: '${name}' holds their ground and sneers at the empty threat.`
  },

  // -------------------------------------------------------------
  // 16. OIL SLICK & TRACTION HAZARD
  // -------------------------------------------------------------
  {
    id: "RULE_OIL_SLICK",
    name: "Oil Slick & Slip Hazard",
    triggerVerbs: ["POUR_OIL", "SLICK", "SPILL"],
    triggerActionTags: ["oil", "grease", "slick"],
    targetRequiresAny: ["ground", "floor", "stairs", "cobblestone", "timber"],
    applyTags: ["flammable", "slippery", "hazard"],
    successLog: (name) => `OIL HAZARD: Viscous flammable grease coats '${name}', creating a lethal slip-and-burn trap!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 5) {
            other.tags.add("off_balance");
            cascades.push({ targetId: other.id, effect: "Footing compromised on greasy slick (Disadvantage on Dodge)" });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 17. CHAOS DESECRATION & LEY SPIKE
  // -------------------------------------------------------------
  {
    id: "RULE_CHAOS_DESECRATION",
    name: "Chaos Desecration & Ley Spike",
    triggerVerbs: ["DESECRATE", "CORRUPT", "CHANNEL_CHAOS"],
    triggerActionTags: ["willpower", "corrupt", "chaos", "occult"],
    targetRequiresAny: ["sacred", "altar", "shrine", "seal", "ward", "prison"],
    applyTags: ["desecrated", "chaos_corrupted"],
    damage: 8,
    successLog: (name) => `RAW CONDUIT: Sacred seal of '${name}' shatters under black-violet chaos radiation!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 6) {
            cascades.push({
              targetId: other.id,
              effect: "Psychic backlash from shattered chaos seal shreds Composure",
              damage: 6
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 18. TACTICAL COVER: FLIP TABLE / BARRIER
  // -------------------------------------------------------------
  {
    id: "RULE_FLIP_TABLE",
    name: "Flip for Tactical Cover",
    triggerVerbs: ["FLIP_TABLE", "FLIP", "OVERTURN"],
    triggerActionTags: ["might", "reflex", "flippable", "cover"],
    targetRequiresAny: ["flippable", "table", "bench", "desk", "counter"],
    applyTags: ["overturned", "cover_half", "barrier"],
    removeTags: ["standing"],
    successLog: (name) => `TACTICAL COVER: '${name}' is heaved onto its side, establishing reliable ballistic half-cover!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 2.5) {
            cascades.push({
              targetId: other.id,
              effect: `Scattering debris and tableware from overturned ${target.name} forces backstep`
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 19. TACTICAL ACROBATICS: SWING CHANDELIER / ROPE
  // -------------------------------------------------------------
  {
    id: "RULE_SWING_CHANDELIER",
    name: "Swing Chandelier / Rope Traverse",
    triggerVerbs: ["SWING_CHANDELIER", "SWING", "VAULT"],
    triggerActionTags: ["reflex", "might", "acrobatics", "swingable"],
    targetRequiresAny: ["swingable", "chandelier", "rope", "hoist", "chain"],
    applyTags: ["dislodged", "swinging"],
    damage: 5,
    successLog: (name) => `ACROBATIC TRAVERSAL: Swings via '${name}' across the melee, converting momentum into tactical positioning!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 3.5) {
            other.tags.add("prone");
            cascades.push({
              targetId: other.id,
              effect: "Swinging dropkick momentum knocks target prone to the floor!",
              damage: 5
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 20. TACTICAL ROLLING HAZARD: PUSH BARREL / CRATE
  // -------------------------------------------------------------
  {
    id: "RULE_PUSH_HAZARD",
    name: "Push Rolling / Crushing Hazard",
    triggerVerbs: ["PUSH_OBJECT", "PUSH", "ROLL", "SHOVE"],
    triggerActionTags: ["might", "force", "shove", "pushable"],
    targetRequiresAny: ["pushable", "barrel", "crate", "boulder", "cart"],
    applyTags: ["rolling", "displaced"],
    damage: 4,
    successLog: (name) => `CRUSHING MOMENTUM: '${name}' is hurled rolling forward, plowing into the engagement zone!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 4.0) {
            other.tags.add("prone");
            cascades.push({
              targetId: other.id,
              effect: `Crushed beneath rolling ${target.name}! Knocked flat.`,
              damage: 6
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 21. TACTICAL IMPROVISED THROW: MUG / BOTTLE / CHAIR
  // -------------------------------------------------------------
  {
    id: "RULE_THROW_IMPROVISED",
    name: "Throw Improvised Object",
    triggerVerbs: ["THROW_IMPROVISED", "THROW", "HURL"],
    triggerActionTags: ["reflex", "finesse", "might", "throwable"],
    targetRequiresAny: ["throwable", "mug", "bottle", "stone", "chair", "improvised_weapon"],
    applyTags: ["shattered", "broken"],
    damage: 4,
    successLog: (name) => `IMPROVISED IMPACT: '${name}' shatters violently against the target, disorienting them!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 2.0) {
            other.tags.add("distracted");
            cascades.push({
              targetId: other.id,
              effect: "Flying shards from shattered projectile cause stinging distraction (-1 on next Guard)"
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 22. TACTICAL DARKENING: SNUFF TORCH / BRAZIER
  // -------------------------------------------------------------
  {
    id: "RULE_SNUFF_FLAME",
    name: "Snuff Light Source",
    triggerVerbs: ["SNUFF_FLAME", "SNUFF", "EXTINGUISH", "SMOTHER"],
    triggerActionTags: ["snuff", "douse", "smother", "snuffable"],
    targetRequiresAny: ["snuffable", "torch", "brazier", "candle", "lantern", "fire"],
    applyTags: ["snuffed", "extinguished", "darkness"],
    removeTags: ["burning", "flame", "illuminated"],
    successLog: (name) => `DARKNESS DESCENDS: '${name}' is violently snuffed out, plunging the immediate radius into shadow!`,
    cascadeHandler: (target, nearby) => {
      const cascades: Array<{ targetId: string; effect: string; damage?: number }> = [];
      nearby.forEach(other => {
        if (other.id !== target.id) {
          const dist = Math.hypot(other.pos[0] - target.pos[0], other.pos[1] - target.pos[1]);
          if (dist <= 6.0) {
            other.tags.add("concealed_in_shadow");
            cascades.push({
              targetId: other.id,
              effect: "Enveloped in abrupt gloom (+2 to Stealth rolls from obscurity)"
            });
          }
        }
      });
      return cascades;
    }
  },

  // -------------------------------------------------------------
  // 23. TACTICAL DEFENSE: BARRICADE DOORWAY / PORTAL
  // -------------------------------------------------------------
  {
    id: "RULE_BARRICADE_WAY",
    name: "Barricade Way / Portal",
    triggerVerbs: ["BARRICADE_WAY", "BARRICADE", "BLOCK", "REINFORCE"],
    triggerActionTags: ["might", "fortitude", "carpentry", "barricadeable"],
    targetRequiresAny: ["barricadeable", "door", "gate", "window", "passageway"],
    applyTags: ["barricaded", "reinforced", "impassable"],
    successLog: (name) => `FORTIFIED CHOKEPOINT: '${name}' is solidly barricaded, barring entry to pursuit!`
  }
];

export class TagMatrixEngine {
  /**
   * Resolves an interaction between an actor and a tagged target using the comprehensive declarative table.
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
      "SLASH": ["cut", "slashing", "edged", "severing"],
      "CUT": ["cut", "slashing", "edged", "severing"],
      "STAB": ["pierce", "piercing", "pointed"],
      "THRUST": ["pierce", "piercing", "reach"],
      "SMASH": ["bludgeon", "heavy", "impact", "force"],
      "BLUDGEON": ["bludgeon", "heavy", "impact"],
      "BATTER": ["bludgeon", "heavy", "impact"],
      "SEVER": ["cut", "slashing", "severing"],
      "IGNITE": ["fire", "heat", "burning", "flame"],
      "BURN": ["fire", "heat", "burning", "flame"],
      "TORCH": ["fire", "heat", "burning", "flame"],
      "CAST_FIRE": ["fire", "heat", "burning", "flame", "magic"],
      "CAST_LIGHTNING": ["electric", "shocking", "conductive_arc", "magic"],
      "SHOCK": ["electric", "shocking", "conductive_arc"],
      "CAST_ICE": ["cold", "freezing", "brittle", "ice", "frost", "magic"],
      "FREEZE": ["cold", "freezing", "ice"],
      "DOUSE": ["water", "wet", "liquid", "douse"],
      "EXTINGUISH": ["water", "wet", "douse", "smother"],
      "SPLASH": ["water", "wet", "liquid"],
      "PUSH": ["force", "shove", "impact"],
      "TOPPLE": ["force", "demolish", "heavy"],
      "COLLAPSE": ["demolish", "heavy", "leverage"],
      "DEMOLISH": ["demolish", "heavy", "impact"],
      "UNLOCK": ["manipulate", "key", "finesse", "subterfuge"],
      "PICK_LOCK": ["manipulate", "lockpick", "finesse", "subterfuge"],
      "SHIM": ["manipulate", "finesse", "subterfuge"],
      "OPEN": ["manipulate", "open"],
      "OPERATE": ["manipulate", "winch", "lever", "valve"],
      "CRANK": ["manipulate", "winch", "lever"],
      "PULL_LEVER": ["manipulate", "lever"],
      "BRIBE": ["bribe", "gold", "charm", "coin", "social"],
      "INTIMIDATE": ["intimidate", "might", "terror", "menacing", "social"],
      "DISTRACT": ["subterfuge", "noise", "distraction", "sound"],
      "SNUFF": ["douse", "smother", "snuff", "darkness"],
      "SNUFF_FLAME": ["douse", "smother", "snuff", "darkness", "snuffable"],
      "CORRODE": ["acid", "corrosive", "chemical"],
      "DESECRATE": ["willpower", "corrupt", "chaos", "occult"],
      "FLIP_TABLE": ["might", "reflex", "flippable", "cover"],
      "FLIP": ["might", "reflex", "flippable", "cover"],
      "SWING_CHANDELIER": ["reflex", "might", "acrobatics", "swingable"],
      "SWING": ["reflex", "might", "acrobatics", "swingable"],
      "PUSH_OBJECT": ["might", "force", "shove", "pushable"],
      "THROW_IMPROVISED": ["reflex", "finesse", "might", "throwable"],
      "BARRICADE_WAY": ["might", "fortitude", "carpentry", "barricadeable"],
      "BARRICADE": ["might", "fortitude", "carpentry", "barricadeable"]
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
        logs.push(`CRITICAL DESTRUCTION: '${target.name}' has been completely shattered / destroyed!`);
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
