import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { runAllMigrations } from './db/runMigrations.js';
import { seedKyooPreset } from './seed/kyooPreset.js';
import { startMultiRootNfoWatcher } from './watcher/index.js';
import { parseMediaChaosRoots } from './watcher/rootConfig.js';
import { runBootMediaScan } from './watcher/bootScanner.js';
import { authMiddleware } from './middleware/access.js';
import { authRouter } from './routes/auth.js';
import { uiRouter } from './routes/ui.js';
import { mediaRouter } from './routes/media.js';
import { searchRouter } from './routes/search.js';
import { iptvRouter } from './routes/iptv.js';
import { adminRouter } from './routes/admin.js';
import { castRouter } from './routes/cast.js';
import { forumRouter } from './routes/forumRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import { friendRouter } from './routes/friendRoutes.js';
import { repostRouter } from './routes/repostRoutes.js';
import { sessionRouter } from './routes/sessionRoutes.js';
import { ratingRouter } from './routes/ratingRoutes.js';
import { taxonomyRouter } from './routes/taxonomyRoutes.js';
import { inviteRouter } from './routes/inviteRoutes.js';
import { playbackSyncRouter } from './routes/userPlaybackSync.js';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Authorization', 'Content-Type', 'X-User-Id', 'X-Device-Id', 'x-device-id', 'Cache-Control', 'Accept', 'Origin', 'Range', '*'],
  exposeHeaders: ['Content-Length', 'X-Total-Count', 'Content-Range'],
  credentials: true,
  maxAge: 86400,
}));

app.use('*', authMiddleware);

app.onError((err, c) => {
  console.error('Unhandled API Error:', err);
  const reqOrigin = c.req.header('origin') || '*';
  c.header('Access-Control-Allow-Origin', reqOrigin);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-User-Id, X-Device-Id, x-device-id, Cache-Control, Accept, Origin, Range, *');
  return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
});

app.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Universal Media Stack v3.0' }));
app.route('/api/auth', authRouter);
app.route('/api/ui', uiRouter);
app.route('/api/taxonomy', taxonomyRouter);
app.route('/api/media', mediaRouter);
app.route('/api/search', searchRouter);
app.route('/api/iptv', iptvRouter);
app.route('/api/admin', adminRouter);
app.route('/api/cast', castRouter);
app.route('/api/playback', playbackSyncRouter);
app.route('/api/forum', forumRouter);
app.route('/api/user', userRouter);
app.route('/api/friends', friendRouter);
app.route('/api/reposts', repostRouter);
app.route('/api/sessions', sessionRouter);
app.route('/api/ratings', ratingRouter);
app.route('/', inviteRouter);

async function startServer() {
  const port = parseInt(process.env.API_PORT || '3000', 10);
  const chaosRoots = parseMediaChaosRoots(process.env.MEDIA_CHAOS_ROOT);

  try {
    await runAllMigrations();
    if (process.env.AUTO_SEED_KYOO_PRESET !== 'false') {
      await seedKyooPreset();
    }
    startMultiRootNfoWatcher(chaosRoots);
    runBootMediaScan(chaosRoots).catch((err) => {
      console.warn('Boot scan warning:', err);
    });
  } catch (err) {
    console.error('Error during startup initialization:', err);
  }

  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`Backend API ready on http://localhost:${info.port}`);
  });
}

startServer();
