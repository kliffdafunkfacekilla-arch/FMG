/**
 * The Ostraka calendar: year, months, seasons and Cruorbus's faces.
 *
 * Canon source (read-only): Shatterlands/Canon/04_Sky_Moons_and_Calendar.md §2 and §5.
 * If this file disagrees with canon, this file is wrong (AGENT_RULES rule 3).
 * Every agent reads year length, seasons and moon phases from here; never retype them.
 * testCalendar.ts pins this file to canon and fails on hard-coded copies elsewhere.
 */

export const DAYS_PER_MONTH = 48;
export const MONTHS_PER_YEAR = 12;
export const MONTH_DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 576
export const SHADOWFALL_DAYS = 13;
export const DAYS_PER_YEAR = MONTH_DAYS_PER_YEAR + SHADOWFALL_DAYS; // 589
export const DAYS_PER_WEEK = 12;
/** Month number the calendar uses for the intercalary Shadowfall days. */
export const SHADOWFALL_MONTH = 13;

export type SeasonKind = "Summer" | "Autumn" | "Winter" | "Spring";
export type WobbleFace = "The Leering" | "The Open Eye" | "The Receding" | "The Halo";

export interface CanonSeason {
  name: string;
  kind: SeasonKind;
  /** First and last day of the year (1-based, inclusive). */
  start: number;
  end: number;
  /** Months (1-12) the season covers. */
  months: number[];
  wobble: "Upper" | "Lower";
  face: WobbleFace;
}

// Canon/04 §5. The face column follows the canon "The moon" notes and the §2 wobble order.
export const CANON_SEASONS: readonly CanonSeason[] = [
  { name: "Shadowburn", kind: "Summer", start: 1, end: 96, months: [1, 2], wobble: "Upper", face: "The Open Eye" },
  { name: "Dryspell", kind: "Autumn", start: 97, end: 144, months: [3], wobble: "Upper", face: "The Receding" },
  { name: "Frostin", kind: "Winter", start: 145, end: 192, months: [4], wobble: "Upper", face: "The Halo" },
  { name: "Greenspan", kind: "Spring", start: 193, end: 288, months: [5, 6], wobble: "Upper", face: "The Leering" },
  { name: "Dimburn", kind: "Summer", start: 289, end: 336, months: [7], wobble: "Lower", face: "The Open Eye" },
  { name: "Cropfade", kind: "Autumn", start: 337, end: 432, months: [8, 9], wobble: "Lower", face: "The Receding" },
  { name: "Dimfreeze", kind: "Winter", start: 433, end: 528, months: [10, 11], wobble: "Lower", face: "The Halo" },
  { name: "Thawrise", kind: "Spring", start: 529, end: 576, months: [12], wobble: "Lower", face: "The Leering" },
];

/** Shadowfall is not a season (Canon/04 §5); the calendar stores this name in its season field. */
export const SHADOWFALL = "Shadowfall";

export const NIGHTMARE_ALIGNMENT = "The Nightmare Alignment";
export const MERCY_ALIGNMENT = "The Mercy Alignment";
export const SHADOWFALL_ECLIPSE = "The Shadowfall Eclipse";

export interface CalendarDate {
  year: number;
  dayOfYear: number; // 1..589
  month: number; // 1..12, or 13 for Shadowfall
  dayOfMonth: number; // 1..48, or 1..13 in Shadowfall
  isShadowfall: boolean;
  season: string; // a CANON_SEASONS name, or SHADOWFALL
  moonPhase: string;
}

/** Tick 1 is Year 1, Day 1. */
export function dateForTick(tick: number): CalendarDate {
  const zeroDay = Math.max(0, tick - 1);
  const year = Math.floor(zeroDay / DAYS_PER_YEAR) + 1;
  const dayOfYear = (zeroDay % DAYS_PER_YEAR) + 1;
  if (dayOfYear > MONTH_DAYS_PER_YEAR) {
    return {
      year, dayOfYear, month: SHADOWFALL_MONTH, dayOfMonth: dayOfYear - MONTH_DAYS_PER_YEAR,
      isShadowfall: true, season: SHADOWFALL, moonPhase: SHADOWFALL_ECLIPSE,
    };
  }
  const month = Math.floor((dayOfYear - 1) / DAYS_PER_MONTH) + 1;
  const dayOfMonth = ((dayOfYear - 1) % DAYS_PER_MONTH) + 1;
  const s = seasonForDay(dayOfYear)!;
  return { year, dayOfYear, month, dayOfMonth, isShadowfall: false, season: s.name, moonPhase: moonPhaseFor(s, dayOfMonth) };
}

export function seasonForDay(dayOfYear: number): CanonSeason | undefined {
  return CANON_SEASONS.find(s => dayOfYear >= s.start && dayOfYear <= s.end);
}

export function seasonByName(name: string | null | undefined): CanonSeason | undefined {
  return CANON_SEASONS.find(s => s.name === name);
}

export function seasonKind(name: string | null | undefined): SeasonKind | undefined {
  return seasonByName(name)?.kind;
}

export function seasonForMonth(month: number): CanonSeason | undefined {
  return CANON_SEASONS.find(s => s.months.includes(month));
}

/**
 * Cruorbus's face for the season, upgraded to an Alignment when the Open Eye meets a full or new moon.
 * ENGINE ASSUMPTION (canon gives no lunation length): the moon's light runs in 12-day quarters of each
 * 48-day month, matching the canon week. Week 1 is new moon and week 3 is full moon.
 */
export function moonPhaseFor(season: CanonSeason, dayOfMonth: number): string {
  const week = Math.ceil(dayOfMonth / DAYS_PER_WEEK); // 1..4
  if (season.face === "The Open Eye" && week === 3) return NIGHTMARE_ALIGNMENT;
  if (season.face === "The Open Eye" && week === 1) return MERCY_ALIGNMENT;
  return season.face;
}

/** The Bleed (Canon/04 §2): the wound faces the world full on. True for the Open Eye and the Nightmare Alignment. */
export function isChaosPeak(moonPhase: string | null | undefined): boolean {
  return moonPhase === "The Open Eye" || moonPhase === NIGHTMARE_ALIGNMENT;
}

export function isYearEnd(tick: number): boolean {
  return tick > 0 && tick % DAYS_PER_YEAR === 0;
}
