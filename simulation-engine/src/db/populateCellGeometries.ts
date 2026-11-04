import fs from "fs";
import path from "path";
import pool from "./pool";

export async function populateCellGeometries() {
  console.log("Loading Okasha.json to extract Voronoi cell boundary polygons...");
  const candidatePaths = [
    path.resolve(process.cwd(), "Okasha.json"),
    path.resolve(process.cwd(), "../Okasha.json"),
    path.resolve(__dirname, "../../../Okasha.json"),
    path.resolve(__dirname, "../../Okasha.json"),
    path.resolve("c:/Users/krazy/Desktop/FMG/Okasha.json")
  ];
  const jsonPath = candidatePaths.find(p => fs.existsSync(p));
  if (!jsonPath) {
    throw new Error(`Okasha.json not found in candidate paths: ${candidatePaths.join(", ")}`);
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);
  const { cells, vertices } = data.pack;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Creating temporary table for bulk geometry update...");
    await client.query(`
      CREATE TEMP TABLE tmp_cell_geom (
        id INT PRIMARY KEY,
        geometry TEXT
      ) ON COMMIT DROP;
    `);

    const cellEntries = Object.entries(cells);
    const BATCH_SIZE = 1000;
    console.log(`Processing ${cellEntries.length} cells in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < cellEntries.length; i += BATCH_SIZE) {
      const chunk = cellEntries.slice(i, i + BATCH_SIZE);
      const values: string[] = [];
      const params: any[] = [];

      chunk.forEach(([strId, cell]: [string, any], idx) => {
        const id = Number(strId);
        if (!cell || !Array.isArray(cell.v)) return;
        
        // Map vertices
        const ring = cell.v
          .map((vIdx: number) => vertices[vIdx]?.p)
          .filter((p: any) => Array.isArray(p) && p.length === 2)
          .map(([x, y]: [number, number]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

        if (ring.length >= 3) {
          // Close polygon if not closed
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push([ring[0][0], ring[0][1]]);
          }

          const geomObj = {
            type: "Polygon",
            coordinates: [ring]
          };

          const pIdx = params.length + 1;
          params.push(id, JSON.stringify(geomObj));
          values.push(`($${pIdx}, $${pIdx + 1})`);
        }
      });

      if (values.length > 0) {
        await client.query(`
          INSERT INTO tmp_cell_geom (id, geometry)
          VALUES ${values.join(", ")}
          ON CONFLICT (id) DO UPDATE SET geometry = EXCLUDED.geometry;
        `, params);
      }
    }

    console.log("Applying bulk geometry updates to sim_cells...");
    const updateRes = await client.query(`
      UPDATE sim_cells c
      SET geometry = t.geometry
      FROM tmp_cell_geom t
      WHERE c.id = t.id AND c.z_layer = 0;
    `);

    await client.query("COMMIT");
    console.log(`Successfully populated Voronoi geometry for ${updateRes.rowCount} cells in sim_cells!`);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  populateCellGeometries()
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error populating cell geometries:", err);
      process.exit(1);
    });
}
