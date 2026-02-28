import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { goalsRouter } from './routes/goals.js';
import { checkInsRouter } from './routes/checkIns.js';
import { groupsRouter } from './routes/groups.js';
import { usersRouter } from './routes/users.js';
import './types.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'MindBuddy API', status: 'running', docs: '/api/health' });
});

app.use('/api/auth', authRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/check-ins', checkInsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

function isDbConnectionError(err: unknown): boolean {
  const e = err as { code?: string; syscall?: string };
  return e?.code === 'ETIMEDOUT' || e?.code === 'ECONNREFUSED' || e?.syscall === 'connect';
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isDbConnectionError(err)) {
    res.status(503).json({
      error: 'Database unavailable. Check your network and add your IP to DigitalOcean Trusted Sources.',
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`MindBuddy API running at http://localhost:${port}`);
});
