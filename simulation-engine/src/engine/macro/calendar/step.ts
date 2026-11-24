import { dateForTick } from "../../canon/calendar.js";
import type { Delta } from "../../deltas/types.js";
import type { CalendarSnapshot } from "./load.js";

export interface ChaosFlowInfo {
  domain: string;
  dragon: string;
  description: string;
  omen: string;
}

export interface DragonMonthDef {
  id: number;
  name: string;
  domain: string;
  dragon: string;
  description: string;
  omen: string;
}

export const DRAGON_MONTHS: DragonMonthDef[] = [
  { id: 1,  name: "Nexar",   domain: "Nexus",  dragon: "Carulkem", description: "Spatial fold mirages, forge-bonds, and furnace heat", omen: "Spatial tears and forge-heat shimmer in the air" },
  { id: 2,  name: "Massis",  domain: "Mass",   dragon: "Tiraton",  description: "Gravitic weight, crushing density, and unyielding bedrock", omen: "Tremors and heavy gravity weigh upon the land" },
  { id: 3,  name: "Motom",   domain: "Motus",  dragon: "Vecelo",   description: "Kinetic scream, storm squalls, and relentless acceleration", omen: "Fierce gale squalls and howling kinetic currents rake the earth" },
  { id: 4,  name: "Fluxen",  domain: "Flux",   dragon: "Ulex",     description: "Shifting melt, metamorphic change, and volatile alchemy", omen: "Unstable alchemical mists mutate strange flora overnight" },
  { id: 5,  name: "Vitan",   domain: "Vita",   dragon: "Gavusrix", description: "Fecund spark, primeval hyper-growth, and carnivorous botany", omen: "A feral blood surge awakens predatory instincts and wild growth" },
  { id: 6,  name: "Lexis",   domain: "Lex",    dragon: "Vahn",     description: "Divine mandate, runic iron compacts, and sovereign decrees", omen: "Runic iron decrees echo in blood and binding compacts" },
  { id: 7,  name: "Ration",  domain: "Ratio",  dragon: "Eldra",    description: "Galvanic lattice, crystalline mind, and cold lightning", omen: "Clockwork humming resonates from deep underground fault lines" },
  { id: 8,  name: "Ordis",   domain: "Ordo",   dragon: "Stagus",   description: "Unyielding glazier, stasis frost, and absolute containment", omen: "Unearthly stillness and creeping stasis frost crystallize on stone" },
  { id: 9,  name: "Luxen",   domain: "Lux",    dragon: "Lophex",   description: "Revealing glare, blinding phosphor, and piercing truth", omen: "Blinding celestial phosphor flares beneath the blood moon" },
  { id: 10, name: "Omin",    domain: "Omen",   dragon: "Sevrath",  description: "Inevitable rot, shadow auguries, and creeping decay", omen: "Black augury shadows stretch unnaturally across the twilight" },
  { id: 11, name: "Aurum",   domain: "Aura",   dragon: "Virantor", description: "Siren deep, phantasmagoric mists, and resonant echoes", omen: "Phantasmagoric violet mists whisper forgotten pasts to travelers" },
  { id: 12, name: "Anum",    domain: "Anumis", dragon: "Grolak",   description: "The Unmaking, soul ash, and void whispers", omen: "Chilling necrotic frost and ash-whispers rise from ancient tombs" },
];

export const CHAOS_FLOWS: ChaosFlowInfo[] = DRAGON_MONTHS;

export interface CalendarStepResult {
  tick: number;
  year: number;
  month: number;
  monthName: string;
  dayOfMonth: number;
  dayOfYear: number;
  season: string;
  cruorbusPhase: string;
  activeFlow: ChaosFlowInfo;
  isShadowWeek: boolean;
  loreDate: string;
}

/**
 * Pure calendar advancement and Day 48 Cruorbus Hemorrhage calculation.
 */
export function stepCalendar(snap: CalendarSnapshot): { calendar: CalendarStepResult; deltas: Delta[] } {
  const { tick } = snap;
  const date = dateForTick(tick);
  const { year, month, dayOfMonth, dayOfYear, season } = date;
  const cruorbusPhase = date.moonPhase;
  const isShadowWeek = date.isShadowfall;

  let monthName: string;
  let activeFlow: ChaosFlowInfo;

  if (!isShadowWeek) {
    const dMonth = DRAGON_MONTHS[month - 1]!;
    monthName = dMonth.name;
    activeFlow = {
      domain: dMonth.domain,
      dragon: dMonth.dragon,
      description: dMonth.description,
      omen: dMonth.omen,
    };
  } else {
    monthName = "Shadowfall";
    activeFlow = {
      domain: "Chaos",
      dragon: "The Void",
      description: "Cruorbus passes into perfect alignment with the sun, causing a total solar eclipse for thirteen days (Shadowfall).",
      omen: "Total darkness covers the sky. The thirteen signs appear in the Shatter as cosmic flows calm.",
    };
  }

  const loreDate = isShadowWeek
    ? `Year ${year}, Shadowfall, Day ${dayOfMonth} (${cruorbusPhase})`
    : `Year ${year}, Month ${month} (${monthName}), Day ${dayOfMonth} (${season}, ${cruorbusPhase})`;

  const deltas: Delta[] = [
    {
      kind: "calendar.set",
      id: snap.calendarRowId ?? undefined,
      tick,
      year,
      month,
      monthName,
      dayOfMonth,
      dayOfYear,
      season,
      moonPhase: cruorbusPhase,
      activeFlow: activeFlow.domain,
      dragonDomain: activeFlow.dragon,
      isShadowWeek,
    },
  ];

  if (dayOfMonth === 48 && !isShadowWeek) {
    for (const burgId of snap.chaosBurgIds) {
      deltas.push({ kind: "burg.adjust", burgId, unrest: 4, health: -2 });
    }
    for (const burgId of snap.unrestBurgIds) {
      deltas.push({ kind: "burg.adjust", burgId, unrest: 2 });
    }
  }

  return {
    calendar: {
      tick,
      year,
      month,
      monthName,
      dayOfMonth,
      dayOfYear,
      season,
      cruorbusPhase,
      activeFlow,
      isShadowWeek,
      loreDate,
    },
    deltas,
  };
}
