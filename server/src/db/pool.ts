import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const connectionString = process.env.DATABASE_URL;
const isLocalhost = /localhost|127\.0\.0\.1/i.test(connectionString);
const sslOff = /sslmode=disable/i.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: isLocalhost || sslOff ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});
