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

export interface CitizenMotiveInput {
  citizen_id?: number | string | null | undefined;
  name?: string | null | undefined;
  role?: string | null | undefined;
  profession?: string | null | undefined;
  temper?: string | null | undefined;
  instinct?: string | null | undefined;
  motivation?: string | null | undefined;
  childhood_background?: string | null | undefined;
  allegiance_status?: string | null | undefined;
  traits?: any;
  tags?: string[] | undefined;
  want?: string | null | undefined;
  flaw?: string | null | undefined;
  line_wont_cross?: string | null | undefined;
  lineWontCross?: string | null | undefined;
}

const CITIZEN_ARCHETYPES = {
  CULTIST: {
    want: "Advance the dragon cult in secret and weaken local containment seals",
    flaw: "Zealous — trusts dark omens and whispers over living neighbors",
    lineWontCross: "Will never betray the inner cult cabal or surrender ritual relics",
    wantTag: "#Want_UnsealTheDragons",
    flawTag: "#Flaw_Zealous",
    lineTag: "#Line_NeverBetrayTheCabal"
  },
  MANDATE: {
    want: "Enforce strict orthodoxy against unlicensed chaos channeling across the ward",
    flaw: "Zealous — leaps to suspicion of heresy before weighing material evidence",
    lineWontCross: "Will never bargain with blood-cultists or loosen a ward seal",
    wantTag: "#Want_ArcaneOrthodoxy",
    flawTag: "#Flaw_Zealous",
    lineTag: "#Line_NoUnlicensedHeresy"
  },
  GREEDY: {
    want: "Accumulate coin and squeeze extra profit out of daily trade",
    flaw: "Avaricious — hoards earnings and favors paid bribes over civic duty",
    lineWontCross: "Will never work unpaid corvee labor or burn profitable market stalls",
    wantTag: "#Want_HoardWealth",
    flawTag: "#Flaw_Avaricious",
    lineTag: "#Line_NeverWorkForFree"
  },
  REBELLIOUS: {
    want: "Push back against garrison levies and protect local craft guilds",
    flaw: "Vindictive — nurses grudges against magistrates long after slights pass",
    lineWontCross: "Will never inform on fellow neighbors or sell out striking guildmates",
    wantTag: "#Want_OverturnLevy",
    flawTag: "#Flaw_Vindictive",
    lineTag: "#Line_NeverInformOnNeighbors"
  },
  SECURITY: {
    want: "Keep the ward gates shut at curfew and suppress trouble before it spreads",
    flaw: "Suspicious — treats late-night wayfarers and unlicensed crowds as threats",
    lineWontCross: "Will never abandon assigned post or hand gate keys to strangers",
    wantTag: "#Want_IronOrder",
    flawTag: "#Flaw_Paranoid",
    lineTag: "#Line_NeverAbandonWalls"
  },
  TIMID: {
    want: "Keep family housed, fed, and clear of garrison entanglements",
    flaw: "Timid — hides behind bolted shutters when trouble hits the street",
    lineWontCross: "Will never endanger their household or hand children to recruiters",
    wantTag: "#Want_FamilySurvival",
    flawTag: "#Flaw_Timid",
    lineTag: "#Line_NeverEndangerFamily"
  },
  DEVOUT: {
    want: "Uphold sacred observances and guard the parish against chaos taints",
    flaw: "Zealous — judges neighbors harshly against temple orthodoxy",
    lineWontCross: "Will never bargain with blood-cultists or loosen a ward seal",
    wantTag: "#Want_ArcaneOrthodoxy",
    flawTag: "#Flaw_Zealous",
    lineTag: "#Line_NoUnlicensedHeresy"
  },
  SCHOLARLY: {
    want: "Keep accurate trade ledgers and preserve craft lore in the ward",
    flaw: "Pedantic — stalls urgent action over permits, seals, and proper forms",
    lineWontCross: "Will never forge guild charters or burn written records",
    wantTag: "#Want_CivicStewardship",
    flawTag: "#Flaw_Pedantic",
    lineTag: "#Line_NeverForgeCharters"
  },
  DEFAULT: {
    want: "Keep local tables supplied and help neighbors weather hard times",
    flaw: "Soft-hearted — gives away spare rations before securing tomorrow",
    lineWontCross: "Will never starve a neighbor or gouge bread prices during famine",
    wantTag: "#Want_PublicRelief",
    flawTag: "#Flaw_SoftHearted",
    lineTag: "#Line_NeverTaxTheStarving"
  }
} as const;

/**
 * Deterministically computes a citizen's want, flaw, line they won't cross,
 * and corresponding canonical reaction tags from their demographic fields.
 */
export function deriveCitizenMotives(row: CitizenMotiveInput): ParagonMotiveProfile {
  const tags = (row.tags || []).map(t => String(t).toLowerCase());
  const traits = parseTraitNames(row.traits);
  const extractTagVal = (prefix: string) => {
    const match = tags.find(t => t.startsWith(prefix));
    return match ? match.slice(prefix.length).toUpperCase() : "";
  };

  const temper = String(row.temper || extractTagVal("temper:") || "").toUpperCase();
  const instinct = String(row.instinct || extractTagVal("instinct:") || "").toUpperCase();
  const profession = String(row.profession || row.role || extractTagVal("profession:") || "").toLowerCase();
  const allegiance = String(row.allegiance_status || "").toUpperCase();

  let chosen: ParagonMotiveProfile = { ...CITIZEN_ARCHETYPES.DEFAULT };

  if (allegiance === "CULTIST_INFILTRATOR" || tags.includes("#cultistinfiltrator") || tags.includes("cultist_infiltrator")) {
    chosen = { ...CITIZEN_ARCHETYPES.CULTIST };
  } else if (allegiance === "MANDATE_ZEALOT" || tags.includes("mandate_zealot")) {
    chosen = { ...CITIZEN_ARCHETYPES.MANDATE };
  } else if (["GREEDY", "COMPLICIT", "CORRUPT"].includes(temper) || traits.some(t => /GREEDY|CORRUPT/.test(t))) {
    chosen = { ...CITIZEN_ARCHETYPES.GREEDY };
  } else if (["REBELLIOUS", "BITTER", "VENGEFUL", "ANGRY"].includes(temper) || tags.includes("rebellious") || tags.includes("#rebelinformant")) {
    chosen = { ...CITIZEN_ARCHETYPES.REBELLIOUS };
  } else if (/\b(guard|watch|watchman|sentry|soldier|warder|bailiff|constable)\b/.test(profession) || (temper === "WARY" && profession.includes("watch"))) {
    chosen = { ...CITIZEN_ARCHETYPES.SECURITY };
  } else if (["WARY", "FEARFUL", "DESPERATE", "TERRIFIED"].includes(temper) || ["WARY", "FEARFUL"].includes(instinct)) {
    chosen = { ...CITIZEN_ARCHETYPES.TIMID };
  } else if (["FANATICAL", "DEVOUT"].includes(temper) || instinct === "DEVOUT") {
    chosen = { ...CITIZEN_ARCHETYPES.DEVOUT };
  } else if (["SCHOLARLY", "CURIOUS", "FOCUSED"].includes(temper) || instinct === "CURIOUS") {
    chosen = { ...CITIZEN_ARCHETYPES.SCHOLARLY };
  }

  return {
    want: row.want || chosen.want,
    flaw: row.flaw || chosen.flaw,
    lineWontCross: row.line_wont_cross || row.lineWontCross || chosen.lineWontCross,
    wantTag: chosen.wantTag,
    flawTag: chosen.flawTag,
    lineTag: chosen.lineTag
  };
}

/**
 * Ensures `want`, `flaw`, and `line_wont_cross` columns exist on `population_demographics`
 * and populates any NULL rows with a single set-based deterministic UPDATE in PostgreSQL.
 */
export async function ensureCitizenMotivesPopulated(db: DbLike): Promise<number> {
  const colCheck = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'population_demographics' AND column_name IN ('want', 'flaw', 'line_wont_cross')`
  );
  if ((colCheck.rows?.length || 0) < 3) {
    await db.query(`
      ALTER TABLE population_demographics
        ADD COLUMN IF NOT EXISTS want TEXT,
        ADD COLUMN IF NOT EXISTS flaw TEXT,
        ADD COLUMN IF NOT EXISTS line_wont_cross TEXT
    `);
  }

  const missingCheck = await db.query(
    `SELECT 1 FROM population_demographics WHERE want IS NULL OR flaw IS NULL OR line_wont_cross IS NULL LIMIT 1`
  );
  if (!missingCheck.rows || missingCheck.rows.length === 0) return 0;

  const updateRes = await db.query(`
    UPDATE population_demographics
    SET
      want = CASE
        WHEN allegiance_status = 'CULTIST_INFILTRATOR' THEN $1
        WHEN allegiance_status = 'MANDATE_ZEALOT' THEN $2
        WHEN UPPER(COALESCE(temper, '')) IN ('GREEDY', 'COMPLICIT', 'CORRUPT') THEN $3
        WHEN UPPER(COALESCE(temper, '')) IN ('REBELLIOUS', 'BITTER', 'VENGEFUL', 'ANGRY') THEN $4
        WHEN COALESCE(profession, '') ~* '(guard|watch|sentry|soldier|warder|bailiff|constable)' THEN $5
        WHEN UPPER(COALESCE(temper, '')) IN ('WARY', 'FEARFUL', 'DESPERATE', 'TERRIFIED')
          OR UPPER(COALESCE(instinct, '')) IN ('WARY', 'FEARFUL') THEN $6
        WHEN UPPER(COALESCE(temper, '')) IN ('FANATICAL', 'DEVOUT') OR UPPER(COALESCE(instinct, '')) = 'DEVOUT' THEN $7
        WHEN UPPER(COALESCE(temper, '')) IN ('SCHOLARLY', 'CURIOUS', 'FOCUSED') OR UPPER(COALESCE(instinct, '')) = 'CURIOUS' THEN $8
        ELSE $9
      END,
      flaw = CASE
        WHEN allegiance_status = 'CULTIST_INFILTRATOR' THEN $10
        WHEN allegiance_status = 'MANDATE_ZEALOT' THEN $11
        WHEN UPPER(COALESCE(temper, '')) IN ('GREEDY', 'COMPLICIT', 'CORRUPT') THEN $12
        WHEN UPPER(COALESCE(temper, '')) IN ('REBELLIOUS', 'BITTER', 'VENGEFUL', 'ANGRY') THEN $13
        WHEN COALESCE(profession, '') ~* '(guard|watch|sentry|soldier|warder|bailiff|constable)' THEN $14
        WHEN UPPER(COALESCE(temper, '')) IN ('WARY', 'FEARFUL', 'DESPERATE', 'TERRIFIED')
          OR UPPER(COALESCE(instinct, '')) IN ('WARY', 'FEARFUL') THEN $15
        WHEN UPPER(COALESCE(temper, '')) IN ('FANATICAL', 'DEVOUT') OR UPPER(COALESCE(instinct, '')) = 'DEVOUT' THEN $16
        WHEN UPPER(COALESCE(temper, '')) IN ('SCHOLARLY', 'CURIOUS', 'FOCUSED') OR UPPER(COALESCE(instinct, '')) = 'CURIOUS' THEN $17
        ELSE $18
      END,
      line_wont_cross = CASE
        WHEN allegiance_status = 'CULTIST_INFILTRATOR' THEN $19
        WHEN allegiance_status = 'MANDATE_ZEALOT' THEN $20
        WHEN UPPER(COALESCE(temper, '')) IN ('GREEDY', 'COMPLICIT', 'CORRUPT') THEN $21
        WHEN UPPER(COALESCE(temper, '')) IN ('REBELLIOUS', 'BITTER', 'VENGEFUL', 'ANGRY') THEN $22
        WHEN COALESCE(profession, '') ~* '(guard|watch|sentry|soldier|warder|bailiff|constable)' THEN $23
        WHEN UPPER(COALESCE(temper, '')) IN ('WARY', 'FEARFUL', 'DESPERATE', 'TERRIFIED')
          OR UPPER(COALESCE(instinct, '')) IN ('WARY', 'FEARFUL') THEN $24
        WHEN UPPER(COALESCE(temper, '')) IN ('FANATICAL', 'DEVOUT') OR UPPER(COALESCE(instinct, '')) = 'DEVOUT' THEN $25
        WHEN UPPER(COALESCE(temper, '')) IN ('SCHOLARLY', 'CURIOUS', 'FOCUSED') OR UPPER(COALESCE(instinct, '')) = 'CURIOUS' THEN $26
        ELSE $27
      END
    WHERE want IS NULL OR flaw IS NULL OR line_wont_cross IS NULL
  `, [
    CITIZEN_ARCHETYPES.CULTIST.want,
    CITIZEN_ARCHETYPES.MANDATE.want,
    CITIZEN_ARCHETYPES.GREEDY.want,
    CITIZEN_ARCHETYPES.REBELLIOUS.want,
    CITIZEN_ARCHETYPES.SECURITY.want,
    CITIZEN_ARCHETYPES.TIMID.want,
    CITIZEN_ARCHETYPES.DEVOUT.want,
    CITIZEN_ARCHETYPES.SCHOLARLY.want,
    CITIZEN_ARCHETYPES.DEFAULT.want,
    CITIZEN_ARCHETYPES.CULTIST.flaw,
    CITIZEN_ARCHETYPES.MANDATE.flaw,
    CITIZEN_ARCHETYPES.GREEDY.flaw,
    CITIZEN_ARCHETYPES.REBELLIOUS.flaw,
    CITIZEN_ARCHETYPES.SECURITY.flaw,
    CITIZEN_ARCHETYPES.TIMID.flaw,
    CITIZEN_ARCHETYPES.DEVOUT.flaw,
    CITIZEN_ARCHETYPES.SCHOLARLY.flaw,
    CITIZEN_ARCHETYPES.DEFAULT.flaw,
    CITIZEN_ARCHETYPES.CULTIST.lineWontCross,
    CITIZEN_ARCHETYPES.MANDATE.lineWontCross,
    CITIZEN_ARCHETYPES.GREEDY.lineWontCross,
    CITIZEN_ARCHETYPES.REBELLIOUS.lineWontCross,
    CITIZEN_ARCHETYPES.SECURITY.lineWontCross,
    CITIZEN_ARCHETYPES.TIMID.lineWontCross,
    CITIZEN_ARCHETYPES.DEVOUT.lineWontCross,
    CITIZEN_ARCHETYPES.SCHOLARLY.lineWontCross,
    CITIZEN_ARCHETYPES.DEFAULT.lineWontCross,
  ]);

  return updateRes.rowCount ?? 0;
}

