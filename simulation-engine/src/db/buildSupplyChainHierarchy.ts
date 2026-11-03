import pool from "./pool";

export async function buildSupplyChainHierarchy() {
  console.log("=== BUILDING HIERARCHICAL SUPPLY CHAIN & WORKPLACE NETWORK ===");
  const startTime = Date.now();
  const client = await pool.connect();

  try {
    // 1. Schema Alterations
    await client.query(`
      ALTER TABLE sim_burg_economy
        ADD COLUMN IF NOT EXISTS upstream_burg_id INT REFERENCES sim_burg_economy(burg_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS hierarchy_tier SMALLINT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS dedicated_civic_ratio NUMERIC(4,2) DEFAULT 0.15;

      ALTER TABLE population_demographics
        ADD COLUMN IF NOT EXISTS workplace_type VARCHAR(64),
        ADD COLUMN IF NOT EXISTS workplace_name VARCHAR(128);

      CREATE INDEX IF NOT EXISTS idx_pop_demo_workplace ON population_demographics(workplace_type);
      CREATE INDEX IF NOT EXISTS idx_burg_upstream ON sim_burg_economy(upstream_burg_id);
    `);

    // 2. Fetch all burgs and their faction/coordinates
    const burgRes = await client.query(`
      SELECT b.burg_id, b.name, b.cell_id, b.urban_tier, b.is_capital,
             b.parent_burg_id, b.settlement_type, b.pop_null, b.pop_attuned,
             c.faction_id, c.center_x, c.center_y, f.name as faction_name
      FROM sim_burg_economy b
      JOIN sim_cells c ON b.cell_id = c.id
      LEFT JOIN sim_factions f ON c.faction_id = f.id
      ORDER BY b.burg_id ASC
    `);

    // Group by faction
    const factionBurgs = new Map<number, any[]>();
    for (const b of burgRes.rows) {
      const fId = b.faction_id ?? 0;
      if (!factionBurgs.has(fId)) factionBurgs.set(fId, []);
      factionBurgs.get(fId)!.push(b);
    }

    const tradeRoutesToInsert: Array<{
      source: number;
      dest: number;
      volume: number;
      throughput: number;
      risk: number;
      status: string;
    }> = [];

    const burgUpdates: Array<{
      burg_id: number;
      upstream_id: number | null;
      hierarchy_tier: number;
      civic_ratio: number;
    }> = [];

    // Helper distance
    const distSq = (a: any, b: any) => Math.pow(a.center_x - b.center_x, 2) + Math.pow(a.center_y - b.center_y, 2);

    for (const [factionId, burgs] of factionBurgs.entries()) {
      // Find or determine Capital (Tier 4)
      let capital = burgs.find((b) => b.is_capital);
      if (!capital && burgs.length > 0) {
        // Pick largest
        capital = burgs.slice().sort((a, b) => (b.pop_null || 0) - (a.pop_null || 0))[0];
      }

      // Classify into 5 tiers:
      // Tier 4: Capital
      // Tier 3: City (urban_tier >= 3, pop > 12000, not capital)
      // Tier 2: Town (urban_tier = 2, pop 1200 - 12000, not capital)
      // Tier 1: Village (urban_tier = 1, pop < 1200, not satellite, not capital)
      // Tier 0: Hamlet (settlement_type = 'HAMLET' | 'FARMLAND' | 'LOGGING' | 'WATCHTOWER' or parent_burg_id is set)
      const t4Capitals: any[] = capital ? [capital] : [];
      const t3Cities: any[] = [];
      const t2Towns: any[] = [];
      const t1Villages: any[] = [];
      const t0Hamlets: any[] = [];

      for (const b of burgs) {
        if (capital && b.burg_id === capital.burg_id) continue;

        if (b.parent_burg_id != null || (b.settlement_type && b.settlement_type !== "BURG")) {
          t0Hamlets.push(b);
        } else if (b.urban_tier >= 3 || (b.pop_null || 0) > 12000) {
          t3Cities.push(b);
        } else if (b.urban_tier === 2 || (b.pop_null || 0) > 1200) {
          t2Towns.push(b);
        } else {
          t1Villages.push(b);
        }
      }

      // 1. Hamlets (Tier 0) -> Nearest Village (fallback to Town, City, Capital)
      for (const h of t0Hamlets) {
        const pool = t1Villages.length > 0 ? t1Villages : (t2Towns.length > 0 ? t2Towns : (t3Cities.length > 0 ? t3Cities : t4Capitals));
        let nearest = pool[0];
        let minDist = Infinity;
        for (const candidate of pool) {
          const d = distSq(h, candidate);
          if (d < minDist) {
            minDist = d;
            nearest = candidate;
          }
        }

        const upstreamId = nearest ? nearest.burg_id : null;
        burgUpdates.push({
          burg_id: h.burg_id,
          upstream_id: upstreamId,
          hierarchy_tier: 0,
          civic_ratio: 0.05 // 5% civic overhead, 95% primary collection
        });

        if (upstreamId) {
          tradeRoutesToInsert.push({
            source: h.burg_id,
            dest: upstreamId,
            volume: Math.max(10, Math.floor((h.pop_null || 100) * 0.25)),
            throughput: 100,
            risk: 3,
            status: "ACTIVE"
          });
        }
      }

      // 2. Villages (Tier 1) -> Nearest Town (fallback to City, Capital)
      for (const v of t1Villages) {
        const pool = t2Towns.length > 0 ? t2Towns : (t3Cities.length > 0 ? t3Cities : t4Capitals);
        let nearest = pool[0];
        let minDist = Infinity;
        for (const candidate of pool) {
          const d = distSq(v, candidate);
          if (d < minDist) {
            minDist = d;
            nearest = candidate;
          }
        }

        const upstreamId = nearest ? nearest.burg_id : null;
        burgUpdates.push({
          burg_id: v.burg_id,
          upstream_id: upstreamId,
          hierarchy_tier: 1,
          civic_ratio: 0.15 // 15% civic overhead, 85% productive
        });

        if (upstreamId) {
          tradeRoutesToInsert.push({
            source: v.burg_id,
            dest: upstreamId,
            volume: Math.max(25, Math.floor((v.pop_null || 500) * 0.2)),
            throughput: 200,
            risk: 5,
            status: "ACTIVE"
          });
        }
      }

      // 3. Towns (Tier 2) -> Nearest City (fallback to Capital)
      for (const t of t2Towns) {
        const pool = t3Cities.length > 0 ? t3Cities : t4Capitals;
        let nearest = pool[0];
        let minDist = Infinity;
        for (const candidate of pool) {
          const d = distSq(t, candidate);
          if (d < minDist) {
            minDist = d;
            nearest = candidate;
          }
        }

        const upstreamId = nearest ? nearest.burg_id : null;
        burgUpdates.push({
          burg_id: t.burg_id,
          upstream_id: upstreamId,
          hierarchy_tier: 2,
          civic_ratio: 0.25 // 25% civic overhead, 75% productive/crafting
        });

        if (upstreamId) {
          tradeRoutesToInsert.push({
            source: t.burg_id,
            dest: upstreamId,
            volume: Math.max(80, Math.floor((t.pop_null || 3000) * 0.15)),
            throughput: 400,
            risk: 7,
            status: "ACTIVE"
          });
        }
      }

      // 4. Cities (Tier 3) -> Capital
      for (const c of t3Cities) {
        const upstreamId = capital ? capital.burg_id : null;
        burgUpdates.push({
          burg_id: c.burg_id,
          upstream_id: upstreamId,
          hierarchy_tier: 3,
          civic_ratio: 0.35 // 35% civic overhead, 65% high-tier manufacturing
        });

        if (upstreamId && upstreamId !== c.burg_id) {
          tradeRoutesToInsert.push({
            source: c.burg_id,
            dest: upstreamId,
            volume: Math.max(200, Math.floor((c.pop_null || 15000) * 0.1)),
            throughput: 800,
            risk: 10,
            status: "ACTIVE"
          });
        }
      }

      // 5. Capital (Tier 4)
      if (capital) {
        burgUpdates.push({
          burg_id: capital.burg_id,
          upstream_id: null, // Seat of the sovereign realm
          hierarchy_tier: 4,
          civic_ratio: 0.45 // 45% civic overhead (Imperial Chancellery, Legions, Grand Courts)
        });
      }
    }

    console.log(`Updating ${burgUpdates.length} burgs with hierarchical supply chain tiers...`);
    for (const b of burgUpdates) {
      await client.query(`
        UPDATE sim_burg_economy
        SET upstream_burg_id = $1,
            hierarchy_tier = $2,
            dedicated_civic_ratio = $3
        WHERE burg_id = $4
      `, [b.upstream_id, b.hierarchy_tier, b.civic_ratio, b.burg_id]);
    }

    console.log(`Populating ${tradeRoutesToInsert.length} hierarchical supply chain routes in sim_trade_routes...`);
    await client.query("DELETE FROM sim_trade_routes");
    for (const r of tradeRoutesToInsert) {
      await client.query(`
        INSERT INTO sim_trade_routes (source_burg_id, dest_burg_id, volume, throughput, risk_level, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [r.source, r.dest, r.volume, r.throughput, r.risk, r.status]);
    }

    // 3. Grounding Citizens in Specific Workplaces based on Profession
    console.log("Grounding all adult citizens into purposeful workplaces matching their professions...");
    await client.query(`
      UPDATE population_demographics
      SET workplace_type = CASE
        WHEN profession IN ('Baker') THEN 'BAKERY'
        WHEN profession IN ('Blacksmith', 'Armorer', 'Foundry Worker') THEN 'FORGE'
        WHEN profession IN ('Brewmaster') THEN 'BREWERY'
        WHEN profession IN ('Carpenter') THEN 'CARPENTRY'
        WHEN profession IN ('Tanner') THEN 'TANNERY'
        WHEN profession IN ('Weaver') THEN 'WEAVERY'
        WHEN profession IN ('Potter') THEN 'POTTERY'
        WHEN profession IN ('City Watchman') THEN 'BARRACKS'
        WHEN profession IN ('Farmer', 'Disenfranchised Laborer') THEN 'FARMSTEAD'
        WHEN profession IN ('Fisherman') THEN 'FISHERY'
        WHEN profession IN ('Hedge Herbalist') THEN 'APOTHECARY'
        WHEN profession IN ('Temple Acolyte') THEN 'TEMPLE'
        WHEN profession IN ('Merchant Trader', 'Caravan Drover') THEN 'MARKET_STALL'
        WHEN profession IN ('Town Scribe') THEN 'REGISTRY'
        WHEN profession IN ('Clockmaker') THEN 'PRECISION_ATELIER'
        WHEN profession IN ('Stonemason') THEN 'MASONRY'
        ELSE 'CIVIC_GUILD'
      END,
      workplace_name = CASE
        WHEN profession IN ('Baker') THEN 'Communal Hearth Bakery'
        WHEN profession IN ('Blacksmith', 'Armorer', 'Foundry Worker') THEN 'Ironworks & Armory Forge'
        WHEN profession IN ('Brewmaster') THEN 'Cask & Flagon Brewhouse'
        WHEN profession IN ('Carpenter') THEN 'Timber Framing Workshop'
        WHEN profession IN ('Tanner') THEN 'Leather Currying Tannery'
        WHEN profession IN ('Weaver') THEN 'Draper Loom Guildhouse'
        WHEN profession IN ('Potter') THEN 'Clay Pottery Kiln'
        WHEN profession IN ('City Watchman') THEN 'Sovereign Guard Barracks'
        WHEN profession IN ('Farmer', 'Disenfranchised Laborer') THEN 'Agrarian Farmstead & Granary'
        WHEN profession IN ('Fisherman') THEN 'Harbor Basin Fishery & Quay'
        WHEN profession IN ('Hedge Herbalist') THEN 'Apothecary Herbarium'
        WHEN profession IN ('Temple Acolyte') THEN 'Sanctuary of the Dragon Seals'
        WHEN profession IN ('Merchant Trader', 'Caravan Drover') THEN 'Central Trade Exchange Stalls'
        WHEN profession IN ('Town Scribe') THEN 'Municipal Seal Registry'
        WHEN profession IN ('Clockmaker') THEN 'Horological Precision Atelier'
        WHEN profession IN ('Stonemason') THEN 'Quarry Cutting Yard'
        ELSE 'Provincial Civic Guild'
      END
      WHERE life_stage = 'ADULT' AND workplace_type IS NULL;
    `);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== SUPPLY CHAIN & WORKPLACE NETWORK BUILT IN ${elapsed}s ===`);
    console.log(`Configured: ${burgUpdates.length} Burgs, ${tradeRoutesToInsert.length} Hierarchical Trade Routes.`);
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].includes("buildSupplyChainHierarchy")) {
  buildSupplyChainHierarchy()
    .then(() => {
      console.log("Supply chain hierarchy pipeline completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Pipeline failed:", err);
      process.exit(1);
    });
}
