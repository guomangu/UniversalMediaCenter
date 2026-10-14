import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { runAllMigrations } from './db/runMigrations.js';
import { seedKyooPreset } from './seed/kyooPreset.js';
import { startMultiRootNfoWatcher } from './watcher/index.js';
import { parseMediaChaosRoots } from './watcher/rootConfig.js';
import { authMiddleware } from './middleware/access.js';
import { authRouter } from './routes/auth.js';
import { uiRouter } from './routes/ui.js';
import { mediaRouter } from './routes/media.js';
import { searchRouter } from './routes/search.js';
import { iptvRouter } from './routes/iptv.js';
import { adminRouter } from './routes/admin.js';
import { castRouter } from './routes/cast.js';

const app = new Hono();

app.use('*', cors());
app.use('*', authMiddleware);

app.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Universal Media Stack v3.0' }));
app.route('/api/auth', authRouter);
app.route('/api/ui', uiRouter);
app.route('/api/media', mediaRouter);
app.route('/api/search', searchRouter);
app.route('/api/iptv', iptvRouter);
app.route('/api/admin', adminRouter);
app.route('/api/cast', castRouter);

async function startServer() {
  const port = parseInt(process.env.API_PORT || '3000', 10);
  const chaosRoots = parseMediaChaosRoots(process.env.MEDIA_CHAOS_ROOT);

  try {
    await runAllMigrations();
    if (process.env.AUTO_SEED_KYOO_PRESET !== 'false') {
      await seedKyooPreset();
    }
    startMultiRootNfoWatcher(chaosRoots);
  } catch (err) {
    console.error('⚠️ Initial boot warning (will retry on incoming traffic):', err);
  }

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`🍿 Universal Media Stack API listening at http://localhost:${info.port}`);
  });
}

startServer();
