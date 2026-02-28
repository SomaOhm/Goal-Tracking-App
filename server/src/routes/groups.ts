import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { randomBytes } from 'crypto';

export const groupsRouter = Router();
groupsRouter.use(authMiddleware);

function groupRowToJson(row: Record<string, unknown>, members: string[] = []) {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    members,
    createdBy: row.created_by,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

function makeInviteCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

groupsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const r = await pool.query(
    `SELECT g.id, g.name, g.invite_code, g.created_by, g.created_at
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.created_at DESC`,
    [req.userId]
  );
  const groups = [];
  for (const row of r.rows) {
    const mem = await pool.query(
      'SELECT user_id FROM group_members WHERE group_id = $1',
      [row.id]
    );
    groups.push(groupRowToJson(row, mem.rows.map((m) => m.user_id)));
  }
  res.json(groups);
});

groupsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  let code = makeInviteCode();
  const client = await pool.connect();
  try {
    for (let i = 0; i < 10; i++) {
      const exists = await client.query('SELECT 1 FROM groups WHERE invite_code = $1', [code]);
      if (exists.rows.length === 0) break;
      code = makeInviteCode();
    }
    const r = await client.query(
      `INSERT INTO groups (name, invite_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, invite_code, created_by, created_at`,
      [name.trim(), code, req.userId]
    );
    await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [r.rows[0].id, req.userId]);
    const group = groupRowToJson(r.rows[0], [req.userId!]);
    res.status(201).json(group);
  } finally {
    client.release();
  }
});

groupsRouter.post('/join', async (req: Request, res: Response): Promise<void> => {
  const { inviteCode } = req.body;
  if (!inviteCode || !String(inviteCode).trim()) {
    res.status(400).json({ error: 'inviteCode is required' });
    return;
  }
  const code = String(inviteCode).trim().toUpperCase();
  const r = await pool.query(
    'SELECT id, name, invite_code, created_by, created_at FROM groups WHERE invite_code = $1',
    [code]
  );
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Invalid invite code' });
    return;
  }
  const g = r.rows[0];
  const existing = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [g.id, req.userId]
  );
  if (existing.rows.length > 0) {
    const mem = await pool.query('SELECT user_id FROM group_members WHERE group_id = $1', [g.id]);
    res.json(groupRowToJson(g, mem.rows.map((m) => m.user_id)));
    return;
  }
  await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [g.id, req.userId]);
  const mem = await pool.query('SELECT user_id FROM group_members WHERE group_id = $1', [g.id]);
  res.json(groupRowToJson(g, mem.rows.map((m) => m.user_id)));
});

groupsRouter.post('/:id/leave', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const r = await pool.query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING 1',
    [id, req.userId]
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Not a member or group not found' });
    return;
  }
  res.status(204).send();
});
