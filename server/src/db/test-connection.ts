/**
 * Test database connectivity. Run: npm run db:test
 * Use this to see the real error when the app times out.
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

let connectionString = process.env.DATABASE_URL;
if (connectionString.includes('sslmode=require')) {
  connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
}
const useSsl = connectionString.includes('sslmode=verify-full') || connectionString.includes('sslmode=require');
const insecureSsl = process.env.DB_INSECURE_SSL === 'true' || process.env.DB_INSECURE_SSL === '1';

const pool = new Pool({
  connectionString,
  ssl: useSsl
    ? { rejectUnauthorized: !insecureSsl }
    : undefined,
  connectionTimeoutMillis: 15_000,
});

async function main() {
  const hostMatch = connectionString.match(/@([^/]+?)(?:\/|$)/);
  const host = hostMatch ? hostMatch[1].split(':')[0] : 'unknown';
  console.log('Connecting to database...');
  console.log('Host:', host);
  if (insecureSsl) console.log('(DB_INSECURE_SSL=true: skipping certificate verification)');
  const start = Date.now();
  try {
    const client = await pool.connect();
    const r = await client.query('SELECT 1 as ok, current_database(), current_user');
    client.release();
    console.log('Connected in', Date.now() - start, 'ms');
    console.log('Database:', r.rows[0].current_database, '| User:', r.rows[0].current_user);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err);
    await pool.end();
    process.exit(1);
  }
}

main();
