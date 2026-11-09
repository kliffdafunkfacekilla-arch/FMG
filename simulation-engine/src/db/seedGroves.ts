// @ts-nocheck
import pool from "./pool";

export const CANONICAL_DRAGONS = [
    { name: "Tiraton", domain: "Mass", prime: "lead", title: "The Crushing Anchor" },
    { name: "Eldra", domain: "Ratio", prime: "copper", title: "The Galvanic Lattice" },
    { name: "Vecelo", domain: "Motus", prime: "quicksilver", title: "The Kinetic Scream" },
    { name: "Lophex", domain: "Lux", prime: "electrum", title: "The Revealing Glare" },
    { name: "Sevrath", domain: "Omen", prime: "jet", title: "The Inevitable Rot" },
    { name: "Grolak", domain: "Anumis", prime: "tin", title: "The Unmaking" },
    { name: "Gavusrix", domain: "Vita", prime: "silver", title: "The Fecund Spark" },
    { name: "Stagus", domain: "Ordo", prime: "quartz", title: "The Unyielding Glazier" },
    { name: "Carulkem", domain: "Nexus", prime: "iron", title: "The Furnace Eternal" },
    { name: "Virantor", domain: "Aura", prime: "amber", title: "The Siren Deep" },
    { name: "Ulex", domain: "Flux", prime: "gold", title: "The Shifting Melt" },
    { name: "Vahn", domain: "Lex", prime: "lodestone", title: "The Divine Mandate" }
];

async function seedGroves() {
    try {
        console.log("Fetching random cell_ids for Sacred Groves...");
        const res = await pool.query("SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 12");
        const cellIds = res.rows.map((row: { id: number }) => row.id);

        if (cellIds.length < 12) {
            console.warn(`Only found ${cellIds.length} cells. We need 12 for all dragons.`);
        }

        console.log("Seeding Canonical Sacred Groves (Canon/06)...");
        for (let i = 0; i < Math.min(CANONICAL_DRAGONS.length, cellIds.length); i++) {
            const dragon = CANONICAL_DRAGONS[i];
            const cellId = cellIds[i];

            await pool.query(
                "INSERT INTO sim_sacred_groves (cell_id, dragon_name, power_domain, seal_strength) VALUES ($1, $2, $3, $4)",
                [cellId, dragon.name, dragon.domain, 100]
            );
            console.log(`Seeded ${dragon.name} (${dragon.domain}) at cell ${cellId}`);
        }
        console.log("Seeder script finished successfully.");
    } catch (error) {
        console.error("Failed to seed groves:", error);
    } finally {
        pool.end();
    }
}

if (process.argv[1]?.includes("seedGroves")) {
    seedGroves();
}
