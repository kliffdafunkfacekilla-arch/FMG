/**
 * Deterministic Paragon Motives (STORY_AUDIT Step 6)
 * ==================================================
 * Gives every authoritative `sim_paragons` leader a grounded:
 * - `want`: what they are actively pushing for
 * - `flaw`: the blind spot that gets them (and the burg) into trouble
 * - `lineWontCross`: the hard boundary they refuse to cross
 *
 * Derived deterministically from each paragon's real `outlaw_id`, `title`,
 * `traits`, and `corruption_score` — never invented entities or generic text.
 */

type DbLike = { query: (text: string, params?: any[]) => Promise<any> };

export interface ParagonMotiveInput {
  id: number;
  title?: string | null | undefined;
  traits?: any;
  corruption_score?: number | null | undefined;
  outlaw_id?: number | null | undefined;
}

export interface ParagonMotiveProfile {
  want: string;
  flaw: string;
  lineWontCross: string;
  wantTag: string;
  flawTag: string;
  lineTag: string;
}

function parseTraitNames(traits: any): string[] {
  const list: string[] = [];
  if (!traits) return list;
  try {
    const parsed = typeof traits === "string" ? JSON.parse(traits) : traits;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") list.push(item.toUpperCase());
        else if (item && item.name) list.push(String(item.name).toUpperCase());
      }
    }
  } catch {
    // Ignore malformed trait JSON; fall back to title/corruption
  }
  return list;
}

/**
 * Deterministically computes a paragon's want, flaw, line they won't cross,
 * and corresponding canonical reaction tags.
 */
export function deriveParagonMotives(row: ParagonMotiveInput): ParagonMotiveProfile {
  const traits = parseTraitNames(row.traits);
  const title = String(row.title || "").toLowerCase();
  const corruption = Number(row.corruption_score || 0);
  const hasTrait = (...keys: string[]) => keys.some(k => traits.some(t => t.includes(k)));
  const isSecurity = /\b(commander|marshal|warden|captain|sheriff|constable|watch)\b/.test(title);

  if (row.outlaw_id != null) {
    return {
      want: "Control contraband routes and extract protection tribute across the ward",
      flaw: "Vindictive — answers any slight against the syndicate with blood",
      lineWontCross: "Will never burn the market stalls that pay the syndicate's cut",
      wantTag: "#Want_ContrabandMonopoly",
      flawTag: "#Flaw_Vindictive",
      lineTag: "#Line_NeverBurnTheMarket"
    };
  }

  if (hasTrait("GREEDY", "USURIOUS", "AVARICE", "CORRUPT") || corruption >= 50) {
    return {
      want: "Monopolize municipal grain stores and skim trade tariffs into private vaults",
      flaw: "Avaricious — hoards coin and emergency grain even when shortages bite",
      lineWontCross: "Will not openly order daylight slaughter of chartered guildmasters",
      wantTag: "#Want_HoardWealth",
      flawTag: "#Flaw_Avaricious",
      lineTag: "#Line_NoOpenSlaughter"
    };
  }

  if (hasTrait("FEARFUL", "PARANOID", "WARY") && (isSecurity || !hasTrait("COMPASSIONATE", "SCHOLARLY"))) {
    return {
      want: "Lock down the gates under iron curfew and root out every hidden informant",
      flaw: "Suspicious — treats every unlicensed guild gathering as impending sedition",
      lineWontCross: "Will never abandon the burg walls or surrender a gatehouse to raiders",
      wantTag: "#Want_IronOrder",
      flawTag: "#Flaw_Paranoid",
      lineTag: "#Line_NeverAbandonWalls"
    };
  }

  if (hasTrait("FANATICAL", "DEVOUT", "ZEALOUS", "SUPERSTITIOUS")) {
    return {
      want: "Purge unlicensed chaos channeling and enforce strict orthodoxy across the parish",
      flaw: "Zealous — leaps to suspicion of heresy before weighing material evidence",
      lineWontCross: "Will never bargain with blood-cultists or loosen a ward seal",
      wantTag: "#Want_ArcaneOrthodoxy",
      flawTag: "#Flaw_Zealous",
      lineTag: "#Line_NoUnlicensedHeresy"
    };
  }

  if (hasTrait("COMPASSIONATE", "BENEVOLENT", "GENEROUS")) {
    return {
      want: "Keep municipal granaries stocked and shield the commons from punitive debt",
      flaw: "Soft-hearted — empties reserve coffers on relief before pricing frontier defense",
      lineWontCross: "Will never levy starvation taxes on hungry ward households",
      wantTag: "#Want_PublicRelief",
      flawTag: "#Flaw_SoftHearted",
      lineTag: "#Line_NeverTaxTheStarving"
    };
  }

  if (hasTrait("SCHOLARLY", "CURIOUS", "LOGICIAN", "BUREAUCRATIC") && corruption < 35) {
    return {
      want: "Preserve orderly civic ledgers, guild charters, and safe overland trade routes",
      flaw: "Rigid — insists on slow notarized decrees even when an alley burns",
      lineWontCross: "Will never forge civic tallies or sell burg charters to an outlaw ring",
      wantTag: "#Want_CivicStewardship",
      flawTag: "#Flaw_Pedantic",
      lineTag: "#Line_NeverForgeCharters"
    };
  }

  if (isSecurity || hasTrait("VENGEFUL", "BITTER", "HARSH", "AGGRESSIVE", "TYRANNICAL", "DESPERATE")) {
    if (isSecurity) {
      return {
        want: "Lock down the gates under iron curfew and enforce strict garrison discipline",
        flaw: "Suspicious — treats dissent and smuggling as threats to the garrison",
        lineWontCross: "Will never abandon the burg walls or surrender a gatehouse to raiders",
        wantTag: "#Want_IronOrder",
        flawTag: "#Flaw_Paranoid",
        lineTag: "#Line_NeverAbandonWalls"
      };
    }
    return {
      want: "Expand border patrols and crush rival claims before they reach the gates",
      flaw: "Vainglorious — doubles down on costly reprisals rather than concede a slight",
      lineWontCross: "Will never kneel or pay tribute to a rival sovereign house",
      wantTag: "#Want_BorderExpansion",
      flawTag: "#Flaw_Vainglorious",
      lineTag: "#Line_NeverYieldTribute"
    };
  }

  return {
    want: "Keep municipal granaries stocked and protect steady trade across the ward",
    flaw: "Complacent — delays tough security audits until trouble reaches the square",
    lineWontCross: "Will never levy starvation taxes on hungry ward households",
    wantTag: "#Want_PublicRelief",
    flawTag: "#Flaw_Complacent",
    lineTag: "#Line_NeverTaxTheStarving"
  };
}

/**
 * Ensures `want`, `flaw`, and `line_wont_cross` exist on `sim_paragons` and populates
 * any NULL rows deterministically from real DB paragon fields.
 */
export async function ensureParagonMotivesPopulated(db: DbLike): Promise<number> {
  const colCheck = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'sim_paragons' AND column_name IN ('want', 'flaw', 'line_wont_cross')`
  );
  if ((colCheck.rows?.length || 0) < 3) {
    await db.query(`
      ALTER TABLE sim_paragons
        ADD COLUMN IF NOT EXISTS want TEXT,
        ADD COLUMN IF NOT EXISTS flaw TEXT,
        ADD COLUMN IF NOT EXISTS line_wont_cross TEXT
    `);
  }

  const missing = await db.query(
    `SELECT id, title, traits, corruption_score, outlaw_id
     FROM sim_paragons
     WHERE want IS NULL OR flaw IS NULL OR line_wont_cross IS NULL
     ORDER BY id`
  );
  if (!missing.rows || missing.rows.length === 0) return 0;

  const ids: number[] = [];
  const wants: string[] = [];
  const flaws: string[] = [];
  const lines: string[] = [];

  for (const row of missing.rows) {
    const profile = deriveParagonMotives(row);
    ids.push(Number(row.id));
    wants.push(profile.want);
    flaws.push(profile.flaw);
    lines.push(profile.lineWontCross);
  }

  await db.query(
    `UPDATE sim_paragons AS p
     SET want = v.want,
         flaw = v.flaw,
         line_wont_cross = v.line_wont_cross
     FROM (
       SELECT unnest($1::int[]) AS id,
              unnest($2::text[]) AS want,
              unnest($3::text[]) AS flaw,
              unnest($4::text[]) AS line_wont_cross
     ) AS v
     WHERE p.id = v.id`,
    [ids, wants, flaws, lines]
  );

  return ids.length;
}

