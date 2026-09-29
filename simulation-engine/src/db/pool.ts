import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

// Create a Postgres Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres@localhost:5432/postgres",
});

export default pool;
