import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

export const checkInsRouter = Router();
checkInsRouter.use(authMiddleware);

function checkInRowToJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    mood: Number(row.mood),
    reflection: row.reflection ?? '',
    visibleToGroups: [], // filled when needed
  };
}

checkInsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const r = await pool.query(
    `SELECT c.id, c.user_id, c.date, c.mood, c.reflection
     FROM check_ins c
     WHERE c.user_id = $1
     ORDER BY c.date DESC`,
    [req.userId]
  );
  const checkIns = r.rows.map((row) => checkInRowToJson(row));
  if (checkIns.length === 0) {
    res.json(checkIns);
    return;
  }
  const client = await pool.connect();
  try {
    const ids = checkIns.map((c) => c.id);
    const vis = await client.query(
      `SELECT check_in_id, group_id FROM check_in_visibility WHERE check_in_id = ANY($1::uuid[])`,
      [ids]
    );
    const byId: Record<string, string[]> = {};
    for (const c of checkIns) byId[c.id] = [];
    for (const row of vis.rows) byId[row.check_in_id].push(row.group_id);
    for (const c of checkIns) c.visibleToGroups = byId[c.id] ?? [];
    res.json(checkIns);
  } finally {
    client.release();
  }
});

checkInsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { date, mood, reflection, visibleToGroups } = req.body;
  if (!date || mood == null) {
    res.status(400).json({ error: 'date and mood are required' });
    return;
  }
  const m = Math.max(1, Math.min(5, Number(mood)));
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO check_ins (user_id, date, mood, reflection)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, date, mood, reflection`,
      [req.userId, date, m, (reflection ?? '').trim()]
    );
    const checkIn = checkInRowToJson(r.rows[0]);
    const groups = Array.isArray(visibleToGroups) ? visibleToGroups : [];
    checkIn.visibleToGroups = groups;
    if (groups.length > 0) {
      await client.query(
        `INSERT INTO check_in_visibility (check_in_id, group_id) SELECT $1::uuid, unnest($2::uuid[])`,
        [checkIn.id, groups]
      );
    }
    res.status(201).json(checkIn);
  } finally {
    client.release();
  }
});
