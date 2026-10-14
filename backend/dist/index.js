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
const app = new Hono();
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['*'],
    exposeHeaders: ['Content-Length', 'X-Total-Count', 'Content-Range'],
}));
app.use('*', authMiddleware);
app.onError((err, c) => {
    console.error('Unhandled API Error:', err);
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', '*');
    return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
});
app.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Universal Media Stack v3.0' }));
app.route('/api/auth', authRouter);
app.route('/api/ui', uiRouter);
app.route('/api/media', mediaRouter);
app.route('/api/search', searchRouter);
app.route('/api/iptv', iptvRouter);
app.route('/api/admin', adminRouter);
app.route('/api/cast', castRouter);
app.route('/api/forum', forumRouter);
app.route('/api/user', userRouter);
app.route('/api/friends', friendRouter);
app.route('/api/reposts', repostRouter);
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
            console.error('⚠️ Boot scan error:', err);
        });
    }
    catch (err) {
        console.error('⚠️ Initial boot warning (will retry on incoming traffic):', err);
    }
    serve({ fetch: app.fetch, port }, (info) => {
        console.log(`🍿 Universal Media Stack API listening at http://localhost:${info.port}`);
    });
}
startServer();
