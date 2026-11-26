import { SHADOWFALL, seasonByName } from "../../canon/calendar.js";
import type { Delta } from "../../deltas/types.js";
import { frontToMapCircle, type WeatherBurgRow, type WeatherSnapshot } from "./load.js";

export interface WeatherStepContext {
  random: () => number;
}

const SPAWN_CHANCE: Record<string, number> = {
  Shadowburn: 0.04,
  Dryspell: 0.04,
  Frostin: 0.08,
  Greenspan: 0.05,
  Dimburn: 0.10,
  Cropfade: 0.08,
  Dimfreeze: 0.12,
  Thawrise: 0.06,
};

const SEASON_BASE_TEMPS: Record<string, number> = {
  Shadowburn: 28,
  Dimburn: 24,
  Greenspan: 18,
  Dryspell: 14,
  Cropfade: 10,
  Thawrise: 8,
  Frostin: -2,
  Dimfreeze: -12,
  [SHADOWFALL]: -15,
};

function pgRound(x: number): number {
  return x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5);
}

/**
 * Pure weather, front propagation, lunar chaos phase, and 5-day climate cycle step.
 */
export function stepWeather(snap: WeatherSnapshot, ctx: WeatherStepContext): Delta[] {
  const deltas: Delta[] = [];
  const { tick, season, dayOfMonth, loreDate, phase, bounds } = snap;
  const rnd = ctx.random;

  // Working copies for intra-step consistency (multiple fronts or NIGHTMARE)
  const burgs: WeatherBurgRow[] = snap.burgs.map((b) => ({ ...b }));
  const activeFronts: Array<{ type: string; x: number; y: number; dx: number; dy: number; radius: number; lifetime: number; isNew?: boolean }> = [];

  // ── 1. MOVE & AGE existing weather fronts ────────────────────────────────
  for (const f of snap.fronts) {
    const nextX = f.x + f.dx;
    const nextY = f.y + f.dy;
    const nextLife = f.lifetime - 1;
    if (nextLife <= 0) {
      deltas.push({ kind: "weatherFront.remove", frontId: f.id });
    } else {
      deltas.push({ kind: "weatherFront.update", frontId: f.id, x: nextX, y: nextY, lifetime: nextLife });
      activeFronts.push({
        type: f.type,
        x: nextX,
        y: nextY,
        dx: f.dx,
        dy: f.dy,
        radius: f.radius,
        lifetime: nextLife,
      });
    }
  }

  // ── 2. SPAWN new weather fronts based on season + lunar phase ─────────────
  let lunarMult = 1.0;
  if (phase === "BLEED") lunarMult = 2.5;
  if (phase === "NIGHTMARE") lunarMult = 3.0;
  if (phase === "MERCY") lunarMult = 0.3;

  const spawnChance = (SPAWN_CHANCE[season] || 0.05) * lunarMult;
  if (rnd() < spawnChance) {
    let stormType = "STORM";
    const kind = seasonByName(season)?.kind;
    if (kind === "Winter") stormType = "BLIZZARD";
    else if (season === "Shadowburn") stormType = rnd() < 0.45 ? "WILDFIRE" : "DROUGHT";
    else if (season === "Dryspell") stormType = "DROUGHT";
    else if (season === "Greenspan") stormType = rnd() < 0.25 ? "EARTHQUAKE" : "DROUGHT";
    else if (phase === "BLEED" || phase === "NIGHTMARE") stormType = "CHAOS_STORM";
    else if (season === "Dimburn") stormType = "HURRICANE";

    const fromEdge = rnd() < 0.5;
    const sx = fromEdge ? (rnd() < 0.5 ? -60 : 160) : rnd() * 100;
    const sy = fromEdge ? rnd() * 100 : (rnd() < 0.5 ? -60 : 160);
    const dx = (50 - sx) / (25 + rnd() * 20);
    const dy = (50 - sy) / (25 + rnd() * 20);
    const radius = 15 + rnd() * 20;
    const lifetime = 8 + Math.floor(rnd() * 16);

    const created = { type: stormType, x: sx, y: sy, dx, dy, radius, lifetime };
    deltas.push({ kind: "weatherFront.create", ...created });
    activeFronts.push({ ...created, isNew: true });
  }

  // ── 3. APPLY active fronts to cells & burgs under them ────────────────────
  for (const front of activeFronts) {
    const { fx, fy, radiusMap } = frontToMapCircle(front, bounds);
    const r2 = radiusMap * radiusMap;
    // Where this front stood last tick: a burg already under it then is weathering a lingering storm,
    // which does a small fraction of the damage of the day the storm arrives (fronts last 8-24 ticks).
    const prev = front.isNew ? null : frontToMapCircle({ x: front.x - front.dx, y: front.y - front.dy, radius: front.radius }, bounds);

    for (const burg of burgs) {
      if (burg.cell_id === null) continue;
      if (burg.pop_null <= 0 && burg.pop_attuned <= 0) continue;
      const dist2 = (burg.center_x - fx) * (burg.center_x - fx) + (burg.center_y - fy) * (burg.center_y - fy);
      if (dist2 > r2) continue;

      // Damage scales with half the total population (Nulls and attuned alike), which matches the
      // original pop_null scaling at world start without collapsing once one group shrinks.
      const basePop = Math.floor((Math.max(0, burg.pop_null) + Math.max(0, burg.pop_attuned)) / 2);
      if (prev) {
        const pd2 = (burg.center_x - prev.fx) * (burg.center_x - prev.fx) + (burg.center_y - prev.fy) * (burg.center_y - prev.fy);
        if (pd2 <= prev.radiusMap * prev.radiusMap) {
          const lingerFood = -Math.floor(basePop * 0.03);
          burg.food = Math.max(0, burg.food + lingerFood);
          burg.unrest = Math.min(100, burg.unrest + 1);
          deltas.push({ kind: "burg.adjust", burgId: burg.burg_id, food: lingerFood, unrest: 1 });
          continue;
        }
      }

      let foodDelta = 0;
      let unrestDelta = 0;
      let healthDelta = 0;
      let popDelta = 0;
      let eventMsg: string | null = null;
      let weatherTags: string[] = [];

      const arch = (burg.architecture_type || "WOOD").toUpperCase();
      const isWood = arch === "WOOD" || arch.includes("TIMBER") || arch === "HALF_TIMBERED" || arch === "REED_STILT";
      const isStone = arch === "STONE" || arch.includes("ASHLAR") || arch === "DRYSTONE";
      const isClay = arch === "CLAY" || arch.includes("ADOBE");

      const riverId = burg.river_id;
      const riverDischarge = burg.river_discharge;
      const cellFlux = burg.cell_flux;
      const hasMajorRiver = riverId > 0 && (riverDischarge >= 150 || cellFlux >= 35);

      if (front.type === "WILDFIRE") {
        if (isWood) {
          foodDelta = -Math.floor(basePop * 0.9);
          healthDelta = -18;
          unrestDelta = +28;
          popDelta = -Math.floor(basePop * 0.03);
          weatherTags = ["#WildfireInferno", "#TimberQuarterAshes", "#BurnedHomes"];
          eventMsg = `🔥 CATASTROPHIC WILDFIRE: Raging wildfires swept into ${burg.name}! Because the town is built primarily of wood, the timber framing and thatched roofs ignited instantly. Entire residential quarters burned to nothing, leaving hundreds homeless amidst smoking ash!`;
          deltas.push({
            kind: "citizen.tagBurg",
            burgId: burg.burg_id,
            tags: ["#BurnedOutRefugee", "#AshRuinsSurvivor"],
            temper: "TERRIFIED",
            motivation: `Lost their home to the wildfire inferno that consumed the wooden districts of ${burg.name}.`,
            professionFilter: null,
            limit: 4,
            randomSeed: rnd(),
          });
        } else {
          foodDelta = -Math.floor(basePop * 0.2);
          healthDelta = -2;
          unrestDelta = +5;
          weatherTags = ["#FireResisted", "#ScorchedWalls"];
          eventMsg = `Wildfires roared against the fortified masonry perimeter of ${burg.name}. The town's heavy ${arch.toLowerCase()} construction resisted the flames, sparing the structures while surrounding scrubland scorched.`;
        }
      } else if (front.type === "EARTHQUAKE") {
        if (isStone) {
          foodDelta = -Math.floor(basePop * 0.4);
          healthDelta = -12;
          unrestDelta = +22;
          popDelta = -Math.floor(basePop * 0.02);
          weatherTags = ["#EarthquakeRubble", "#CollapsedMasonry"];
          eventMsg = `A violent earthquake shook ${burg.name}! Brittle ashlar stone arches and heavy masonry towers cracked and collapsed into street rubble.`;
          deltas.push({
            kind: "citizen.tagBurg",
            burgId: burg.burg_id,
            tags: ["#QuakeSurvivor", "#RubbleClearingWorker"],
            temper: "WARY",
            motivation: `Shoveling fallen masonry after an earthquake damaged ${burg.name}.`,
            professionFilter: null,
            limit: 3,
            randomSeed: rnd(),
          });
        } else {
          foodDelta = -Math.floor(basePop * 0.2);
          healthDelta = -4;
          unrestDelta = +8;
          weatherTags = ["#TremorsFelt"];
          eventMsg = `Ground tremors shook ${burg.name}. The settlement's flexible timber framing swayed and absorbed the shock with minimal structural damage.`;
        }
      } else if (front.type === "BLIZZARD") {
        foodDelta = -Math.floor(basePop * 0.8);
        healthDelta = -5;
        unrestDelta = +8;
        weatherTags = ["#BlizzardGrounded", "#FrozenSupplyLine"];
        if (rnd() < 0.25) {
          eventMsg = `A brutal blizzard has buried the roads around ${burg.name}, cutting off supply lines and freezing the populace.`;
          deltas.push({
            kind: "citizen.tagBurg",
            burgId: burg.burg_id,
            tags: ["#FrostbittenPeasant", "#SnowboundForager"],
            temper: "DESPERATE",
            motivation: `Trapped inside ${burg.name} by howling snowdrifts and sub-zero blizzard gales.`,
            professionFilter: null,
            limit: 3,
            randomSeed: rnd(),
          });
        }
      } else if (front.type === "DROUGHT") {
        foodDelta = -Math.floor(basePop * 0.5);
        healthDelta = -3;
        unrestDelta = +5;
        weatherTags = ["#DroughtStricken", "#BarrenHarvest"];
        if (riverId > 0 && (riverDischarge >= 150 || cellFlux >= 30)) {
          foodDelta = Math.round(foodDelta * 0.5);
          unrestDelta = Math.max(1, unrestDelta - 2);
          weatherTags.push("#RiverIrrigated");
        } else if (riverId === 0 && cellFlux <= 3) {
          foodDelta = Math.round(foodDelta * 1.5);
          unrestDelta += 3;
        }
        if (rnd() < 0.22) {
          eventMsg = `Parched drought has cracked the earth around ${burg.name}. Wellsprings ran dry and crops withered to ash.`;
          deltas.push({
            kind: "citizen.tagBurg",
            burgId: burg.burg_id,
            tags: ["#ThirstyLaborer", "#DustBowlRefugee"],
            temper: "BITTER",
            motivation: `Enduring scorching heat and water rations in drought-stricken ${burg.name}.`,
            professionFilter: null,
            limit: 3,
            randomSeed: rnd(),
          });
        }
      } else if (front.type === "HURRICANE") {
        if (isClay) {
          foodDelta = -Math.floor(basePop * 0.7);
          healthDelta = -10;
          unrestDelta = +16;
          popDelta = -Math.floor(basePop * 0.02);
          weatherTags = ["#HurricaneGales", "#FloodedTerrain", "#AdobeErosion"];
          if (rnd() < 0.35) {
            eventMsg = `Torrential hurricane floods inundated ${burg.name}! Earthen adobe brickwork softened and eroded under relentless gale floods.`;
            deltas.push({
              kind: "citizen.tagBurg",
              burgId: burg.burg_id,
              tags: ["#StormDisplaced", "#FloodedSurvivor"],
              temper: "DESPERATE",
              motivation: `Rebuilding washed-out adobe homes after a hurricane struck ${burg.name}.`,
              professionFilter: null,
              limit: 3,
              randomSeed: rnd(),
            });
          }
        } else {
          foodDelta = -Math.floor(basePop * 0.4);
          healthDelta = -4;
          unrestDelta = +6;
          popDelta = -Math.floor(basePop * 0.01);
          weatherTags = ["#HurricaneGales", "#FloodedTerrain"];
          if (rnd() < 0.25) {
            eventMsg = `A massive hurricane tore through ${burg.name}, damaging roofs and drowning surrounding lowlands.`;
            deltas.push({
              kind: "citizen.tagBurg",
              burgId: burg.burg_id,
              tags: ["#StormDisplaced", "#FloodedSurvivor"],
              temper: "DESPERATE",
              motivation: `Rebuilding flooded homes and salvaging ruined timber after a hurricane struck ${burg.name}.`,
              professionFilter: null,
              limit: 3,
              randomSeed: rnd(),
            });
          }
        }
        if (hasMajorRiver) {
          const floodLoss = Math.min(400, Math.round(riverDischarge * 0.25 + cellFlux * 2));
          foodDelta -= floodLoss;
          unrestDelta += 4;
          weatherTags.push("#RiverFlooding");
          const rName = burg.river_name ? burg.river_name : "the nearby river";
          eventMsg = `🌊 RIVER FLOOD: Hurricane stormwaters swelled ${rName} over its banks in ${burg.name}, drowning fields (-${floodLoss} food) and sweeping quays.`;
        }
      } else if (front.type === "CHAOS_STORM") {
        foodDelta = -Math.floor(basePop * (0.3 + rnd() * 0.7));
        healthDelta = -Math.floor(5 + rnd() * 10);
        unrestDelta = +Math.floor(10 + rnd() * 20);
        popDelta = -Math.floor(basePop * 0.02 * rnd());
        weatherTags = ["#ChaosStormRift", "#RealityWarped", "#CrimsonAtmosphere"];
        if (rnd() < 0.35) {
          eventMsg = `A Chaos Storm — vomited from the Broken Moon Cruorbus — erupted over ${burg.name}. Gravity stutters, shadows detach, and crimson rain falls upwards.`;
          deltas.push({
            kind: "citizen.tagBurg",
            burgId: burg.burg_id,
            tags: ["#AetherStormSurvivor", "#VoidTouchedMind"],
            temper: "FANATICAL",
            motivation: `Witnessed reality warp during a Cruorbus chaos storm over ${burg.name}.`,
            professionFilter: null,
            limit: 3,
            randomSeed: rnd(),
          });
        }
      } else {
        foodDelta = -Math.floor(basePop * 0.2);
        unrestDelta = +3;
        weatherTags = ["#HeavyRainfall", "#MuddyHighways"];
        if (hasMajorRiver) {
          const floodLoss = Math.min(250, Math.round(riverDischarge * 0.15 + cellFlux * 1.5));
          foodDelta -= floodLoss;
          unrestDelta += 2;
          weatherTags.push("#RiverFlooding");
          const rName = burg.river_name ? burg.river_name : "the nearby river";
          eventMsg = `🌊 RIVER FLOOD: Sustained downpours overflowed ${rName} through ${burg.name}, swamping low meadows and cellars (-${floodLoss} food).`;
        } else if (rnd() < 0.12) {
          eventMsg = `Violent rainstorms battered ${burg.name} for days, washing out roads and flooding cellars.`;
        }
      }

      if (burg.cell_id && weatherTags.length > 0) {
        deltas.push({
          kind: "tags.add",
          target: { kind: "cell", cellId: burg.cell_id, zLayer: 0 },
          tags: weatherTags,
        });
      }

      burg.food = Math.max(0, burg.food + foodDelta);
      burg.unrest = Math.min(100, Math.max(0, burg.unrest + unrestDelta));
      burg.health = Math.min(100, Math.max(0, burg.health + healthDelta));
      // Deaths fall on Nulls and attuned in proportion to their numbers.
      const livePop = Math.max(0, burg.pop_null) + Math.max(0, burg.pop_attuned);
      const nullLoss = popDelta < 0 && livePop > 0 ? Math.round((popDelta * Math.max(0, burg.pop_null)) / livePop) : 0;
      const attunedLoss = popDelta - nullLoss;
      burg.pop_null = Math.max(0, burg.pop_null + nullLoss);
      burg.pop_attuned = Math.max(0, burg.pop_attuned + attunedLoss);

      if (foodDelta !== 0 || unrestDelta !== 0 || healthDelta !== 0 || popDelta !== 0) {
        deltas.push({
          kind: "burg.adjust",
          burgId: burg.burg_id,
          food: foodDelta,
          unrest: unrestDelta,
          health: healthDelta,
          ...(nullLoss !== 0 ? { popNull: nullLoss } : {}),
          ...(attunedLoss !== 0 ? { popAttuned: attunedLoss } : {}),
        });
      }

      if (eventMsg) {
        deltas.push({
          kind: "event.log",
          tick,
          type: front.type,
          message: eventMsg,
          tier: "MAJOR",
          burgId: burg.burg_id,
          loreDate,
        });
      }
    }
  }

  // ── 4. CHAOS FLOW — Cruorbus's faces & Shadowfall ────────────────────────
  if (phase === "SHADOW_WEEK") {
    if (tick % 3 === 0) {
      deltas.push({
        kind: "event.log",
        tick,
        type: "SHADOW_WEEK_ECLIPSE",
        message: `Shadowfall Day ${dayOfMonth}: Total darkness blankets Ostraka as Cruorbus blots out the sun. Ambient chaos flows still, depriving the ancient seals of ley energy as Shlaar's whispers intensify in the void.`,
        tier: "MAJOR",
        loreDate,
      });
    }
  } else if (phase === "BLEED") {
    for (const grove of snap.bleedGroves) {
      if (rnd() < 0.3) {
        deltas.push({
          kind: "chaosZone.upsert",
          cellId: grove.cell_id,
          intensity: 20 + rnd() * 40,
          type: "VOID_RIFT",
        });
      }
    }
    if (rnd() < 0.5) {
      const sx = rnd() * 100;
      const sy = rnd() * 100;
      deltas.push({
        kind: "weatherFront.create",
        type: "CHAOS_STORM",
        x: sx,
        y: sy,
        dx: (rnd() - 0.5) * 3,
        dy: (rnd() - 0.5) * 3,
        radius: 30,
        lifetime: 12,
      });
    }
    deltas.push({
      kind: "event.log",
      tick,
      type: "LUNAR_HEMORRHAGE",
      message: `Cruorbus bleeds crimson as the Open Eye faces the world — the broken moon vomits raw chaos onto the land. The 12 Seals strain against the tide. Chaos storms birth across the continent.`,
      tier: "MAJOR",
      loreDate,
    });
  } else if (phase === "CHAOS_FLOW") {
    deltas.push({ kind: "chaosZone.adjust", intensityDelta: 5 });
    deltas.push({
      kind: "event.log",
      tick,
      type: "CHAOS_FLOW",
      message: `Chaos rivers flow from the Seals toward the central Void. The land hums with wrongness.`,
      tier: "MINOR",
      loreDate,
    });
  } else if (phase === "NIGHTMARE") {
    deltas.push({ kind: "chaosZone.adjust", intensityDelta: 10 });
    for (const b of burgs) {
      if (b.unrest < 100) {
        deltas.push({ kind: "burg.adjust", burgId: b.burg_id, unrest: 3 });
      }
    }
    deltas.push({
      kind: "event.log",
      tick,
      type: "NIGHTMARE_ALIGNMENT",
      message: `The Nightmare Alignment grips the land. Cruorbus glows black-red. Citizens wake screaming. Shadows move wrong. Cultists grow bold.`,
      tier: "MAJOR",
      loreDate,
    });
  } else if (phase === "MERCY") {
    for (const c of snap.damagedCells) {
      if (c.eco_health < c.eco_max) {
        deltas.push({ kind: "cell.adjust", cellId: c.id, ecoHealth: 3 });
      }
    }
    deltas.push({ kind: "chaosZone.adjust", intensityDelta: -8, deleteAtOrBelowZero: true });
    deltas.push({
      kind: "event.log",
      tick,
      type: "MERCY_ALIGNMENT",
      message: `The Mercy Alignment of Cruorbus brings an eerie stillness. The chaos recedes. Forests breathe. Wounds close a little faster.`,
      tier: "MINOR",
      loreDate,
    });
  } else if (phase === "VOID_DRAIN" && dayOfMonth % 12 === 5) {
    for (const c of snap.damagedCells) {
      if (c.eco_health < c.eco_max) {
        deltas.push({ kind: "cell.adjust", cellId: c.id, ecoHealth: 2 });
      }
    }
    deltas.push({
      kind: "event.log",
      tick,
      type: "VOID_DRAIN",
      message: `The central Void drinks the last of the surface chaos, leaking it upward into the Broken Moon. The cycle of Cruorbus begins anew.`,
      tier: "MINOR",
      loreDate,
    });
  }

  // ── 5. NATURAL CONTINENTAL TEMPERATURE & CLIMATE CYCLE ───────────────────
  if (tick % 5 === 0 && snap.climateCells.length > 0) {
    const baseTemp = SEASON_BASE_TEMPS[season] ?? 14;
    const blizCircles = activeFronts
      .filter((f) => f.type === "BLIZZARD")
      .map((f) => frontToMapCircle(f, bounds));
    const droughtCircles = activeFronts
      .filter((f) => f.type === "DROUGHT")
      .map((f) => frontToMapCircle(f, bounds));

    for (const c of snap.climateCells) {
      let temp = pgRound(
        baseTemp - c.elevation * 0.22 - (c.center_y < 500 ? (500 - c.center_y) * 0.015 : 0)
      );
      for (const b of blizCircles) {
        const d2 = (c.center_x - b.fx) ** 2 + (c.center_y - b.fy) ** 2;
        if (d2 <= b.radiusMap ** 2) temp -= 14;
      }
      for (const d of droughtCircles) {
        const d2 = (c.center_x - d.fx) ** 2 + (c.center_y - d.fy) ** 2;
        if (d2 <= d.radiusMap ** 2) temp += 14;
      }
      if (c.current_temp !== temp) {
        deltas.push({ kind: "cell.set", cellId: c.id, fields: { current_temp: temp } });
      }
    }
  }

  return deltas;
}
