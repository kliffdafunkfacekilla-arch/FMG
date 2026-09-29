import Database from 'better-sqlite3';
import path from 'path';
// Create a local SQLite DB for persistence since Postgres isn't running
const dbPath = path.resolve(__dirname, '../../aetheria.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// Provide a mock `Pool` interface that mimics `pg` package
class PgToSqlitePool {
    async query(text, params) {
        // Convert Postgres $1, $2, etc. to SQLite ? placeholders
        let sqliteText = text.replace(/\$\d+/g, '?');
        sqliteText = sqliteText.replace(/JSONB/gi, 'TEXT');
        sqliteText = sqliteText.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
        sqliteText = sqliteText.replace(/BIGINT/gi, 'INTEGER');
        sqliteText = sqliteText.replace(/FLOAT/gi, 'REAL');
        // SQLite doesn't support multiple commands in prepare. If there are no params and multiple statements, use exec.
        if (!params && sqliteText.includes(';') && sqliteText.split(';').length > 2) {
            db.exec(sqliteText);
            return { rows: [] };
        }
        db.pragma('foreign_keys = ON');
        try {
            const isReturningOrSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.toUpperCase().includes('RETURNING');
            if (isReturningOrSelect) {
                const stmt = db.prepare(sqliteText);
                const rows = stmt.all(...(params || []));
                return { rows };
            }
            else {
                const stmt = db.prepare(sqliteText);
                stmt.run(...(params || []));
                return { rows: [] };
            }
        }
        catch (e) {
            console.error('SQL Error:', e.message, 'Query:', sqliteText);
            throw e;
        }
    }
    async connect() {
        return {
            query: this.query.bind(this),
            release: () => { }
        };
    }
    end() {
        db.close();
    }
}
const pool = new PgToSqlitePool();
export default pool;
