import { Hono } from 'hono';
import { requireAuth } from '../middleware/access.js';
import { friendActionRouter } from './friendActionRoutes.js';
import { friendSearchRouter } from './friendSearchRoutes.js';
export const friendRouter = new Hono();
friendRouter.use('*', requireAuth);
friendRouter.route('/', friendActionRouter);
friendRouter.route('/', friendSearchRouter);
