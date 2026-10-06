"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
// Create a local SQLite DB for persistence since Postgres isn't running
const dbPath = path_1.default.resolve(__dirname, "../../aetheria.sqlite");
const db = new better_sqlite3_1.default(dbPath);
db.pragma("journal_mode = WAL");
// Provide a mock `Pool` interface that mimics `pg` package
class PgToSqlitePool {
    async query(text, params) {
        // Convert Postgres $1, $2, etc. to SQLite anonymous ? AND expand the array to match
        // e.g. "WHERE a=$1 AND b=$2 AND a=$1" with params [X, Y] becomes
        //      "WHERE a=? AND b=? AND a=?" with sqliteParams [X, Y, X]
        const sqliteParams = [];
        let sqliteText = text.replace(/\$(\d+)/g, (_match, p1) => {
            if (params) {
                sqliteParams.push(params[parseInt(p1, 10) - 1]);
            }
            return "?";
        });
        // If no $N params found but raw ? were already in query, just use params as-is
        if (sqliteParams.length === 0 && params && params.length > 0) {
            sqliteParams.push(...params);
        }
        sqliteText = sqliteText.replace(/JSONB/gi, "TEXT");
        sqliteText = sqliteText.replace(/SERIAL PRIMARY KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
        sqliteText = sqliteText.replace(/BIGINT/gi, "INTEGER");
        sqliteText = sqliteText.replace(/FLOAT/gi, "REAL");
        // SQLite doesn't support multiple commands in prepare. Use exec for schema-only multi-statements.
        if (sqliteParams.length === 0 && sqliteText.includes(";") && sqliteText.split(";").length > 2) {
            db.exec(sqliteText);
            return { rows: [] };
        }
        db.pragma("foreign_keys = ON");
        try {
            const isSelect = sqliteText.trim().toUpperCase().startsWith("SELECT") ||
                sqliteText.toUpperCase().includes("RETURNING");
            if (isSelect) {
                const stmt = db.prepare(sqliteText);
                const rows = stmt.all(...sqliteParams);
                return { rows };
            }
            else {
                const stmt = db.prepare(sqliteText);
                stmt.run(...sqliteParams);
                return { rows: [] };
            }
        }
        catch (e) {
            console.error("SQL Error:", e.message, "Query:", sqliteText);
            throw e;
        }
    }
    async connect() {
        return {
            query: this.query.bind(this),
            release: () => { },
        };
    }
    end() {
        db.close();
    }
}
const pool = new PgToSqlitePool();
exports.default = pool;
//# sourceMappingURL=pool.sqlite.js.map