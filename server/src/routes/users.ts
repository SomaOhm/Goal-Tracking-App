import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(authMiddleware);

/** GET /users?ids=uuid1,uuid2 — returns users by id (for group member display). Only returns users that share a group with the current user. */
usersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const idsParam = req.query.ids;
  if (!idsParam || typeof idsParam !== 'string') {
    res.json([]);
    return;
  }
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const r = await pool.query(
    `SELECT u.id, u.email, u.name, u.avatar
     FROM users u
     INNER JOIN group_members gm ON gm.user_id = u.id
     INNER JOIN group_members my ON my.group_id = gm.group_id AND my.user_id = $1
     WHERE u.id = ANY($2::uuid[])
     GROUP BY u.id, u.email, u.name, u.avatar`,
    [req.userId, ids]
  );
  res.json(
    r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar ?? undefined,
    }))
  );
});
