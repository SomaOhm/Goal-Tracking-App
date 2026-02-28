import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { authMiddleware, signToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Email, password, and name are required' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  let client;
  try {
    client = await pool.connect();
    const r = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar, created_at`,
      [email.trim().toLowerCase(), hash, name.trim()]
    );
    const row = r.rows[0];
    const user = {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar ?? undefined,
    };
    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({ user, token });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      res.status(400).json({ error: 'User already exists' });
      return;
    }
    if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'Database unavailable. Check your network and DigitalOcean Trusted Sources.',
      });
      return;
    }
    throw err;
  } finally {
    client?.release();
  }
});

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  try {
  const r = await pool.query(
    'SELECT id, email, name, avatar, password_hash FROM users WHERE email = $1',
    [email.trim().toLowerCase()]
  );
  const row = r.rows[0];
  if (!row) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar ?? undefined,
  };
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ user, token });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'Database unavailable. Check your network and DigitalOcean Trusted Sources.',
      });
      return;
    }
    throw err;
  }
});

authRouter.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const r = await pool.query(
    'SELECT id, email, name, avatar FROM users WHERE id = $1',
    [req.userId]
  );
  const row = r.rows[0];
  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar ?? undefined,
  });
});
