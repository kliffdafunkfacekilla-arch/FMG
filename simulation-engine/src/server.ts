import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import pool from './db/pool';

import dmRouter from './api/dmRouter';
import observerRouter from './api/observerRouter';
import { regionalRouter } from './api/regionalRouter';
import tellerRouter from './api/tellerRouter';
import directorRouter from './api/directorRouter';
import { rulesRouter } from './api/rulesRouter';
import { ensureCellTagsTable } from './engine/cellTags';

dotenv.config();

const app = express();
// Only the local player client may call the API from a browser.
// Override with a comma-separated CORS_ORIGINS list in .env if needed.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist-client')));
app.use(express.static(path.join(__dirname, '../public')));

app.get(['/dashboard', '/observer'], (req, res) => {
  res.sendFile(path.join(__dirname, '../dist-client/index.html'));
});

app.use('/api/dm', dmRouter);
app.use('/api/observer', observerRouter);
app.use('/api/regional', regionalRouter);
app.use('/teller', tellerRouter);
app.use('/api/dm/story', directorRouter);
app.use('/api/rules', rulesRouter);

const PORT = Number(process.env.PORT) || 3000;
// Bind to loopback by default so other machines on the network can't reach
// unauthenticated routes like /api/observer/reset. Set HOST=0.0.0.0 to expose it.
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Simulation Engine Server running on http://${HOST}:${PORT}`);
  // Tables added after a world was created (live databases are never reset just to add one).
  ensureCellTagsTable(pool).catch((e) => console.error(`[db] Could not ensure sim_cell_tags: ${e.message}`));
});

