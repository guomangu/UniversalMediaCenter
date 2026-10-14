import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://ums:ums_secret@localhost:5432/ums_db';

export const sqlClient = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(sqlClient, { schema });
export { schema };
