export interface TagAction {
  verb: string;
  stat: string;
  dc: number;
}

export interface TagDef {
  label: string;
  actions: TagAction[];
}

export const TAG_DEFINITIONS: Record<string, TagDef> = {
  "LOCKED_DOOR": {
    label: "Locked Door",
    actions: [
      { verb: "Force Open", stat: "might", dc: 12 },
      { verb: "Pick Lock", stat: "finesse", dc: 14 },
    ],
  },
  "GUARD": {
    label: "Guard",
    actions: [
      { verb: "Attack", stat: "might", dc: 10 },
      { verb: "Sneak Past", stat: "finesse", dc: 13 },
      { verb: "Bribe", stat: "charm", dc: 11 },
    ],
  },
  "ALTAR": {
    label: "Altar",
    actions: [
      { verb: "Examine", stat: "knowledge", dc: 10 },
      { verb: "Commune", stat: "intuition", dc: 14 },
      { verb: "Desecrate", stat: "willpower", dc: 12 },
    ],
  },
  "CHEST": {
    label: "Chest",
    actions: [
      { verb: "Open", stat: "might", dc: 8 },
      { verb: "Inspect", stat: "awareness", dc: 10 },
    ],
  },
  "REFUGEE": {
    label: "Refugee",
    actions: [
      { verb: "Talk To", stat: "charm", dc: 8 },
      { verb: "Intimidate", stat: "might", dc: 10 },
      { verb: "Heal", stat: "vitality", dc: 10 },
    ],
  },
  "BANDIT": {
    label: "Bandit",
    actions: [
      { verb: "Attack", stat: "might", dc: 12 },
      { verb: "Sneak Past", stat: "finesse", dc: 14 },
      { verb: "Persuade", stat: "charm", dc: 16 },
    ],
  },
  "CULTIST": {
    label: "Cultist",
    actions: [
      { verb: "Attack", stat: "might", dc: 13 },
      { verb: "Reason With", stat: "knowledge", dc: 18 },
      { verb: "Flee", stat: "reflex", dc: 10 },
    ],
  },
  "CANNIBAL": {
    label: "Cannibal",
    actions: [
      { verb: "Attack", stat: "might", dc: 14 },
      { verb: "Flee", stat: "reflex", dc: 12 },
    ],
  },
  "RUINS": {
    label: "Ruins",
    actions: [
      { verb: "Search", stat: "awareness", dc: 12 },
      { verb: "Study", stat: "knowledge", dc: 14 },
    ],
  },
  "CAVERN": {
    label: "Cavern",
    actions: [
      { verb: "Enter", stat: "fortitude", dc: 10 },
      { verb: "Scout", stat: "awareness", dc: 12 },
    ],
  },
  "ROAD": {
    label: "Road",
    actions: [
      { verb: "Follow Road", stat: "awareness", dc: 6 },
    ],
  },
  "CAMPFIRE": {
    label: "Campfire",
    actions: [
      { verb: "Rest", stat: "vitality", dc: 6 },
      { verb: "Ambush", stat: "finesse", dc: 12 },
    ],
  },
};

/**
 * Looks up a tag and verb and returns the stat and DC to roll against.
 * Returns null if the tag or verb is not found.
 */
export function resolveTagAction(
  tag: string,
  verb: string
): { stat: string; dc: number } | null {
  const def = TAG_DEFINITIONS[tag];
  if (!def) return null;

  const action = def.actions.find((a) => a.verb === verb);
  if (!action) return null;

  return { stat: action.stat, dc: action.dc };
}
