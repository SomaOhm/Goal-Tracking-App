import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Use verify-full for strict SSL; normalize URL to silence pg connection-string warning
let connectionString = process.env.DATABASE_URL;
if (connectionString.includes('sslmode=require')) {
  connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
}

const useSsl = connectionString.includes('sslmode=verify-full') || connectionString.includes('sslmode=require');
// Set DB_INSECURE_SSL=true in .env only to test; DigitalOcean certs sometimes need this from Node
const rejectUnauthorized = process.env.DB_INSECURE_SSL !== 'true' && process.env.DB_INSECURE_SSL !== '1';

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized } : undefined,
  connectionTimeoutMillis: 10_000,
});
