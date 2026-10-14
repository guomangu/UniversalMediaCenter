import { Hono } from 'hono';
import { requireAuth } from '../middleware/access.js';
import { repostMediaRouter } from './repostMediaRoutes.js';
import { repostFeedRouter } from './repostFeedRoutes.js';

export const repostRouter = new Hono();
repostRouter.use('*', requireAuth);

repostRouter.route('/', repostMediaRouter);
repostRouter.route('/', repostFeedRouter);
