"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostgresDatabase = createPostgresDatabase;
exports.getDatabase = getDatabase;
require("server-only");
const pg_1 = require("pg");
const config_1 = __importDefault(require("@/server/config"));
function executor(queryable) {
    return {
        async query(text, values = []) {
            const result = await queryable.query(text, [...values]);
            return { rows: result.rows, rowCount: result.rowCount };
        },
        async executeScript(sql) {
            await queryable.query(sql);
        },
    };
}
function createPostgresDatabase() {
    const pool = new pg_1.Pool({
        connectionString: config_1.default.databaseUrl,
        max: config_1.default.databasePoolMax,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 15000,
        application_name: 'pmii-saintek-web',
        ...(config_1.default.databaseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    pool.on('error', (error) => {
        console.error('PostgreSQL idle client error', error);
    });
    const root = executor(pool);
    const database = {
        ...root,
        async close() {
            await pool.end();
            if (globalThis.__pmiiDatabase === database)
                globalThis.__pmiiDatabase = undefined;
        },
        async transaction(operation) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await operation(executor(client));
                await client.query('COMMIT');
                return result;
            }
            catch (error) {
                try {
                    await client.query('ROLLBACK');
                }
                catch (rollbackError) {
                    console.error('PostgreSQL transaction rollback failed', rollbackError);
                }
                throw error;
            }
            finally {
                client.release();
            }
        },
    };
    return database;
}
function getDatabase() {
    if (!globalThis.__pmiiDatabase)
        globalThis.__pmiiDatabase = createPostgresDatabase();
    return globalThis.__pmiiDatabase;
}
