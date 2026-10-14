import { createSchemaTables } from './migrate.js';
import { createSecondaryTables } from './migrateSecondary.js';

export async function runAllMigrations(): Promise<void> {
  console.log('🔄 Checking database extensions and tables...');
  try {
    await createSchemaTables();
    await createSecondaryTables();
    console.log('✅ Database schema initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to run database migrations:', err);
    throw err;
  }
}
