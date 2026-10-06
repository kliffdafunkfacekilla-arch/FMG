/**
 * resetWorld.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Wipes all simulation state tables and re-seeds them from the canonical
 * SQLite source file (aetheria.sqlite).  This is designed to be called
 * frequently — from the /api/observer/reset endpoint or from the CLI.
 *
 * Rules:
 *  - Never touches non-sim tables (characters, game_sessions, etc.)
 *  - Always Math.floor() float→integer coercions before Postgres insertion
 *  - Cells arrive in 500-row chunks to avoid parameter-limit issues
 *  - The fringe factions are hard-coded lore; they are always re-inserted fresh
 */
export declare function resetWorld(): Promise<{
    message: string;
    stats: Record<string, number>;
}>;
//# sourceMappingURL=resetWorld_Oct2_Backup.d.ts.map