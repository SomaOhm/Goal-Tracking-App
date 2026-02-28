/**
 * Insert one user into the users table.
 * Edit EMAIL, PASSWORD, NAME below, then run: npm run db:seed-one (from server/)
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';

const EMAIL = 'ab@g.com';
const PASSWORD = 'password123';
const NAME = 'Test User';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [EMAIL, passwordHash, NAME]
    );
    const row = r.rows[0];
    console.log('Inserted 1 user:', { id: row.id, email: row.email, name: row.name, created_at: row.created_at });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      console.error('User with that email already exists.');
    } else {
      console.error(err);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
