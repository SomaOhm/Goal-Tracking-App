import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

export const goalsRouter = Router();
goalsRouter.use(authMiddleware);

function goalRowToJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? '',
    frequency: row.frequency,
    customDays: row.custom_days ?? undefined,
    checklist: row.checklist ?? undefined,
    completions: [], // filled separately
    visibleToGroups: [], // filled separately
    createdAt: (row.created_at as Date).toISOString(),
  };
}

async function attachCompletionsAndVisibility(goals: Record<string, unknown>[], client: import('pg').PoolClient) {
  if (goals.length === 0) return;
  const goalIds = goals.map((g) => g.id);
  const [compRes, visRes] = await Promise.all([
    client.query(
      `SELECT goal_id, date, reflection FROM goal_completions WHERE goal_id = ANY($1::uuid[]) ORDER BY date DESC`,
      [goalIds]
    ),
    client.query(
      `SELECT goal_id, group_id FROM goal_visibility WHERE goal_id = ANY($1::uuid[])`,
      [goalIds]
    ),
  ]);
  const compByGoal: Record<string, { date: string; reflection?: string }[]> = {};
  const visByGoal: Record<string, string[]> = {};
  for (const g of goals) compByGoal[g.id as string] = [];
  for (const g of goals) visByGoal[g.id as string] = [];
  for (const r of compRes.rows) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
    compByGoal[r.goal_id].push({
      date: dateStr,
      reflection: r.reflection ?? undefined,
    });
  }
  for (const r of visRes.rows) {
    visByGoal[r.goal_id].push(r.group_id);
  }
  for (const g of goals) {
    (g as Record<string, unknown>).completions = compByGoal[g.id as string] ?? [];
    (g as Record<string, unknown>).visibleToGroups = visByGoal[g.id as string] ?? [];
  }
}

goalsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, user_id, title, description, frequency, custom_days, checklist, created_at
       FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    const goals = r.rows.map((row) => goalRowToJson(row));
    await attachCompletionsAndVisibility(goals, client);
    res.json(goals);
  } finally {
    client.release();
  }
});

goalsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { title, description, frequency, visibleToGroups } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  const freq = frequency === 'weekly' || frequency === 'custom' ? frequency : 'daily';
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO goals (user_id, title, description, frequency)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, title, description, frequency, custom_days, checklist, created_at`,
      [req.userId, title.trim(), (description ?? '').trim(), freq]
    );
    const goal = goalRowToJson(r.rows[0]);
    goal.completions = [];
    goal.visibleToGroups = Array.isArray(visibleToGroups) ? visibleToGroups : [];
    if (goal.visibleToGroups.length > 0) {
      await client.query(
        `INSERT INTO goal_visibility (goal_id, group_id) SELECT $1::uuid, unnest($2::uuid[])`,
        [goal.id, goal.visibleToGroups]
      );
    }
    res.status(201).json(goal);
  } finally {
    client.release();
  }
});

goalsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, frequency, visibleToGroups } = req.body;
  const client = await pool.connect();
  try {
    const check = await client.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    const updates: string[] = [];
    const values: unknown[] = [];
    let n = 1;
    if (title !== undefined) {
      updates.push(`title = $${n++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${n++}`);
      values.push(description);
    }
    if (frequency !== undefined) {
      updates.push(`frequency = $${n++}`);
      values.push(frequency);
    }
    if (updates.length > 0) {
      values.push(id);
      await client.query(
        `UPDATE goals SET ${updates.join(', ')} WHERE id = $${n}`,
        values
      );
    }
    if (Array.isArray(visibleToGroups)) {
      await client.query('DELETE FROM goal_visibility WHERE goal_id = $1', [id]);
      if (visibleToGroups.length > 0) {
        await client.query(
          `INSERT INTO goal_visibility (goal_id, group_id) SELECT $1::uuid, unnest($2::uuid[])`,
          [id, visibleToGroups]
        );
      }
    }
    const r = await client.query(
      `SELECT id, user_id, title, description, frequency, custom_days, checklist, created_at FROM goals WHERE id = $1`,
      [id]
    );
    const goal = goalRowToJson(r.rows[0]);
    await attachCompletionsAndVisibility([goal], client);
    res.json(goal);
  } finally {
    client.release();
  }
});

goalsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const r = await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  res.status(204).send();
});

goalsRouter.post('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date, reflection } = req.body;
  if (!date) {
    res.status(400).json({ error: 'date is required' });
    return;
  }
  const client = await pool.connect();
  try {
    const check = await client.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    const existing = await client.query(
      'SELECT id FROM goal_completions WHERE goal_id = $1 AND date = $2',
      [id, date]
    );
    if (existing.rows.length > 0) {
      await client.query('DELETE FROM goal_completions WHERE goal_id = $1 AND date = $2', [id, date]);
      res.json({ completed: false, date, reflection: undefined });
      return;
    }
    await client.query(
      'INSERT INTO goal_completions (goal_id, date, reflection) VALUES ($1, $2, $3)',
      [id, date, reflection ?? null]
    );
    res.json({ completed: true, date, reflection: reflection ?? undefined });
  } finally {
    client.release();
  }
});
