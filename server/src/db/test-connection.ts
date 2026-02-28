/**
 * Test database connectivity. Run: npm run db:test
 */
import 'dotenv/config';
import { pool } from './pool.js';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const host = process.env.DATABASE_URL.replace(/^[^@]+@/, '').replace(/\/.*$/, '').split(':')[0];
  console.log('Connecting to', host, '...');
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
