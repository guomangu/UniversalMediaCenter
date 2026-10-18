import { Hono } from 'hono';
import { requireAuth } from '../middleware/access.js';
import { userProfileRouter } from './userProfileRoutes.js';
import { userStatsRouter } from './userStatsRoutes.js';
import { userWatchRouter } from './userWatchRoutes.js';
import { userFavoritesRouter } from './userFavoritesRoutes.js';
import { userForumsRouter } from './userForumsRoutes.js';
import { userDeviceRouter } from './userDeviceRoutes.js';

export const userRouter = new Hono();
userRouter.use('*', requireAuth);

userRouter.route('/', userProfileRouter);
userRouter.route('/', userStatsRouter);
userRouter.route('/', userWatchRouter);
userRouter.route('/', userFavoritesRouter);
userRouter.route('/', userForumsRouter);
userRouter.route('/', userDeviceRouter);
