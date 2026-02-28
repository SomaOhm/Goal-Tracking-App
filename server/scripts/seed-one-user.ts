/**
 * Insert one user into the users table.
 *
 * Usage:
 *   npm run db:seed-one -- <email> <password> <name>
 *
 * Example:
 *   npm run db:seed-one -- alice@example.com mypass123 "Alice Smith"
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';

const [email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ');

if (!email || !password || !name) {
  console.error('Usage: npm run db:seed-one -- <email> <password> <name>');
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, created_at`,
      [email.trim().toLowerCase(), passwordHash, name.trim()]
    );
    if (r.rowCount === 0) {
      console.log(`User "${email}" already exists, skipped.`);
    } else {
      const row = r.rows[0];
      console.log('Created user:', { id: row.id, email: row.email, name: row.name });
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
