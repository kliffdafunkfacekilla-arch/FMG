declare class PgToSqlitePool {
    query(text: string, params?: any[]): Promise<{
        rows: any[];
    }>;
    connect(): Promise<{
        query: (text: string, params?: any[]) => Promise<{
            rows: any[];
        }>;
        release: () => void;
    }>;
    end(): void;
}
declare const pool: PgToSqlitePool;
export default pool;
//# sourceMappingURL=pool.sqlite.d.ts.map