/**
 * Notable lives: the named people of each town age, make friends and rivals, marry, have children,
 * come of age, live through (or die in) what the rest of the tick did to their town, and mourn each other.
 *
 * Pure: a snapshot in (loadLives), a plan out (applied by applyLives). Every chance is a per-day rate in
 * RATES below, so the world can be tuned in one place.
 */

export interface LifeLink {
  targetNpcId: string;   // "citizen:<id>" (the shape npcMindPure's NPCSocialLink reads)
  citizenId: number;
  name: string;
  /** What the target is to the holder: spouse | friend | rival | parent | child. */
  relation: string;
  relationship: string;  // same value, for the older prerender shape
  trust: number;
  since: number;
}

export interface LifeNotable {
  citizenId: number;
  burgId: number;
  homeCellId: number;
  name: string;
  profession: string;
  species: string;
  isNull: boolean;
  sparkTier: string;
  unitSize: number;
  lifeStage: string;
  age: number;
  temper: string;
  status: string;
  links: LifeLink[];
  /** Older links that name a person without an id (from world generation): kept as they are. */
  legacyLinks: unknown[];
}

export interface LifeRaid {
  shipmentId: number;
  citizenIds: number[];
  destName: string;
}

export interface ChildCohort {
  burgId: number;
  species: string;
  profession: string;
  sparkTier: string;
  isNull: boolean;
  count: number;
}

export interface LivesSnapshot {
  tick: number;
  notables: LifeNotable[];
  burgNames: Map<number, string>;
  famineBurgs: Set<number>;
  battleBurgs: Set<number>;
  murderBurgs: Set<number>;
  witchHuntBurgs: Set<number>;
  stormBurgs: Set<number>;
  raids: LifeRaid[];
  /** The largest civilian CHILD cohort per burg + species (where a newborn notable is drawn from). */
  childCohorts: Map<string, ChildCohort>;
  firstNames: Record<string, string[]>;
}

export interface LifeEventPlan {
  citizenId: number;
  kind: string;
  text: string;
  otherCitizenId: number | null;
  burgId: number;
}

export interface DeathPlan {
  notable: LifeNotable;
  cause: string;
}

export interface BirthPlan {
  burgId: number;
  homeCellId: number;
  name: string;
  species: string;
  cohort: ChildCohort;
  parentIds: [number, number];
}

export interface TownEventPlan {
  burgId: number;
  cellId: number;
  type: string;
  message: string;
}

export interface LivesPlan {
  deaths: DeathPlan[];
  births: BirthPlan[];
  comingOfAge: number[];
  /** Full new social_links per citizen whose links changed (older id-less links included). */
  links: Map<number, unknown[]>;
  lifeEvents: LifeEventPlan[];
  townEvents: TownEventPlan[];
}

/** Per-day chances. A year is 576 days. */
export const RATES = {
  /** Yearly natural mortality is BASE * e^(SLOPE * age): ~0.5% at 30, ~6.5% at 60, ~24% at 75. */
  naturalBase: 0.0004,
  naturalSlope: 0.085,
  daysPerYear: 576,
  famineDeath: 0.005,
  famineHunger: 0.02,
  battleDeathFighter: 0.04,
  battleDeathOther: 0.005,
  /** Crews ride caravan after caravan, so this is per raid: ~8% keeps the road deadly without emptying the guilds. */
  raidDeath: 0.08,
  /** One named victim per cartel contract killing / witch-hunt execution in the town, at this chance. */
  murderNamed: 0.25,
  witchNamed: 0.2,
  stormDeath: 0.004,
  newTie: 0.003,
  marriage: 0.0008,
  birthPerCouple: 0.0012,
  maxLinks: 8,
  comingOfAgeAt: 16,
};

const FIGHTERS = /guard|soldier|watch|warden|mercenar|militia|garrison|knight|legion|hunter/i;
const RIVAL_TEMPERS = new Set(["GREEDY", "VENGEFUL", "FANATICAL"]);

function pick<T>(arr: readonly T[], random: () => number): T | undefined {
  return arr.length ? arr[Math.floor(random() * arr.length)] : undefined;
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "";
}

function hasLink(n: LifeNotable, otherId: number, relation?: string): boolean {
  return n.links.some((l) => l.citizenId === otherId && (!relation || l.relation === relation));
}

function spouseOf(n: LifeNotable): number | null {
  const l = n.links.find((x) => x.relation === "spouse");
  return l ? l.citizenId : null;
}

export function stepLives(snap: LivesSnapshot, random: () => number = Math.random): LivesPlan {
  const { tick } = snap;
  const plan: LivesPlan = { deaths: [], births: [], comingOfAge: [], links: new Map(), lifeEvents: [], townEvents: [] };
  const byId = new Map<number, LifeNotable>();
  for (const n of snap.notables) byId.set(n.citizenId, { ...n, links: [...n.links] });
  const dead = new Set<number>();
  const town = (burgId: number) => snap.burgNames.get(burgId) || `Burg #${burgId}`;
  const life = (n: LifeNotable, kind: string, text: string, other: number | null = null) =>
    plan.lifeEvents.push({ citizenId: n.citizenId, kind, text, otherCitizenId: other, burgId: n.burgId });
  const touch = (n: LifeNotable) => plan.links.set(n.citizenId, [...n.legacyLinks, ...n.links]);
  const link = (a: LifeNotable, b: LifeNotable, relation: string, trust: number) => {
    a.links = a.links.filter((l) => !(l.citizenId === b.citizenId && l.relation === relation));
    a.links.push({ targetNpcId: `citizen:${b.citizenId}`, citizenId: b.citizenId, name: b.name, relation, relationship: relation, trust, since: tick });
    if (a.links.length > RATES.maxLinks) {
      // Keep family; drop the oldest friendship or rivalry.
      const idx = a.links.findIndex((l) => l.relation === "friend" || l.relation === "rival");
      if (idx >= 0) a.links.splice(idx, 1);
    }
    touch(a);
  };
  const kill = (n: LifeNotable, cause: string) => {
    if (dead.has(n.citizenId)) return;
    dead.add(n.citizenId);
    plan.deaths.push({ notable: n, cause });
    life(n, "death", cause);
    plan.townEvents.push({
      burgId: n.burgId,
      cellId: n.homeCellId,
      type: "NOTABLE_DEATH",
      message: `🕯️ ${n.name}, ${n.profession} of ${town(n.burgId)}, has died: ${cause}`,
    });
  };

  // Group the living by town, in a stable order.
  const towns = new Map<number, LifeNotable[]>();
  for (const n of Array.from(byId.values()).sort((a, b) => a.citizenId - b.citizenId)) {
    let list = towns.get(n.burgId);
    if (!list) towns.set(n.burgId, (list = []));
    list.push(n);
  }

  // 1. What the day did to them: raids first (named crews), then their town's troubles, then age.
  for (const raid of snap.raids) {
    for (const cid of raid.citizenIds) {
      const n = byId.get(cid);
      if (!n || dead.has(cid)) continue;
      if (random() < RATES.raidDeath) kill(n, `slain when bandits took the caravan bound for ${raid.destName}.`);
      else life(n, "survived_raid", `Survived bandits who seized the caravan bound for ${raid.destName}.`);
    }
  }
  for (const [burgId, people] of towns) {
    const place = town(burgId);
    if (snap.murderBurgs.has(burgId) && random() < RATES.murderNamed) {
      const v = pick(people.filter((p) => !dead.has(p.citizenId) && p.lifeStage !== "CHILD"), random);
      if (v) kill(v, `murdered in ${place} on a cartel contract.`);
    }
    if (snap.witchHuntBurgs.has(burgId) && random() < RATES.witchNamed) {
      const v = pick(people.filter((p) => !dead.has(p.citizenId) && !p.isNull && p.lifeStage !== "CHILD"), random);
      if (v) kill(v, `burned as a witch by Chain inquisitors in ${place}.`);
    }
    for (const n of people) {
      if (dead.has(n.citizenId)) continue;
      if (snap.famineBurgs.has(burgId)) {
        const r = random();
        if (r < RATES.famineDeath) { kill(n, `starved during the famine in ${place}.`); continue; }
        if (r < RATES.famineDeath + RATES.famineHunger) life(n, "hunger", `Went hungry through the famine in ${place}.`);
      }
      if (snap.battleBurgs.has(burgId)) {
        const p = FIGHTERS.test(n.profession) ? RATES.battleDeathFighter : RATES.battleDeathOther;
        if (random() < p) { kill(n, `fell when ${place} came under attack.`); continue; }
      }
      if (snap.stormBurgs.has(burgId) && random() < RATES.stormDeath) { kill(n, `killed by a chaos storm over ${place}.`); continue; }
      const yearly = Math.min(0.95, RATES.naturalBase * Math.exp(RATES.naturalSlope * n.age));
      if (random() < yearly / RATES.daysPerYear) {
        kill(n, n.age >= 60 ? `died of old age in ${place}, aged ${n.age}.` : `died of a sudden illness in ${place}, aged ${n.age}.`);
      }
    }
  }

  // 2. Grief: everyone tied to someone who died today hears of it.
  for (const d of plan.deaths) {
    for (const l of d.notable.links) {
      const other = byId.get(l.citizenId);
      if (!other || dead.has(other.citizenId)) continue;
      const verb =
        l.relation === "spouse" ? `Widowed: lost their spouse ${d.notable.name}.` :
        l.relation === "child" ? `Lost their parent ${d.notable.name}.` :
        l.relation === "parent" ? `Buried their child ${d.notable.name}.` :
        l.relation === "rival" ? `Outlived their rival ${d.notable.name}.` :
        `Mourned their friend ${d.notable.name}.`;
      // Read from the dead person's side: their "child" link is `other`, so `other` lost a parent, and so on.
      life(other, "grief", verb, d.notable.citizenId);
    }
  }

  // 3. The living: coming of age, new friends and rivals, marriages, children.
  for (const [burgId, people] of towns) {
    const living = people.filter((p) => !dead.has(p.citizenId));
    const adults = living.filter((p) => p.lifeStage !== "CHILD");
    const place = town(burgId);
    for (const n of living) {
      if (n.lifeStage === "CHILD" && n.age >= RATES.comingOfAgeAt) {
        plan.comingOfAge.push(n.citizenId);
        n.lifeStage = "ADULT";
        life(n, "came_of_age", `Came of age in ${place}.`);
      }
    }
    if (adults.length < 2) continue;
    for (const n of adults) {
      if (random() < RATES.newTie) {
        const other = pick(adults.filter((o) => o.citizenId !== n.citizenId && !hasLink(n, o.citizenId)), random);
        if (other) {
          const rival = (RIVAL_TEMPERS.has(n.temper) || RIVAL_TEMPERS.has(other.temper)) && n.temper !== other.temper
            ? random() < 0.6
            : random() < 0.15;
          const rel = rival ? "rival" : "friend";
          const trust = rival ? -0.6 : 0.6;
          link(n, other, rel, trust);
          link(other, n, rel, trust);
          const text = rival ? `Fell out with ${other.name}; they are rivals now.` : `Became friends with ${other.name}.`;
          life(n, rel, text, other.citizenId);
          life(other, rel, rival ? `Fell out with ${n.name}; they are rivals now.` : `Became friends with ${n.name}.`, n.citizenId);
        }
      }
      if (spouseOf(n) === null && n.age >= 18 && n.age <= 55 && random() < RATES.marriage) {
        const partner = pick(
          adults.filter((o) => o.citizenId !== n.citizenId && o.species === n.species && spouseOf(o) === null
            && o.age >= 18 && o.age <= 55 && !hasLink(n, o.citizenId, "rival")),
          random
        );
        if (partner) {
          link(n, partner, "spouse", 0.9);
          link(partner, n, "spouse", 0.9);
          life(n, "married", `Married ${partner.name} in ${place}.`, partner.citizenId);
          life(partner, "married", `Married ${n.name} in ${place}.`, n.citizenId);
          plan.townEvents.push({ burgId, cellId: n.homeCellId, type: "NOTABLE_WEDDING", message: `💍 ${n.name} and ${partner.name} were married in ${place}.` });
        }
      }
    }
    // Children: each couple once (from the lower id's side).
    for (const n of adults) {
      const sid = spouseOf(n);
      if (sid === null || sid < n.citizenId) continue;
      const s = byId.get(sid);
      if (!s || dead.has(sid) || s.burgId !== burgId) continue;
      if (Math.min(n.age, s.age) > 42) continue;
      const kids = n.links.filter((l) => l.relation === "child").length;
      if (kids >= 4 || random() >= RATES.birthPerCouple) continue;
      const cohort = snap.childCohorts.get(`${burgId}:${n.species}`);
      if (!cohort || cohort.count < 1) continue;
      cohort.count -= 1;
      const first = pick(snap.firstNames[n.species] || snap.firstNames.Human || ["Elian"], random) || "Elian";
      const name = `${first} ${surname(random() < 0.5 ? n.name : s.name)}`;
      plan.births.push({ burgId, homeCellId: n.homeCellId, name, species: n.species, cohort, parentIds: [n.citizenId, s.citizenId] });
      life(n, "child_born", `Welcomed a child, ${name}.`);
      life(s, "child_born", `Welcomed a child, ${name}.`);
      plan.townEvents.push({ burgId, cellId: n.homeCellId, type: "NOTABLE_BIRTH", message: `👶 ${name} was born to ${n.name} and ${s.name} in ${place}.` });
    }
  }

  return plan;
}
