import { db } from '../db/connection.js';
import { uiRails } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { KYOO_DEFAULT_RAILS } from './railsData.js';
export async function seedKyooPreset() {
    console.log('🌱 Checking Kyoo Native Preset in PostgreSQL...');
    // 1. Initialisation des Rails d'accueil
    const existingRails = await db.select({ count: sql `count(*)` }).from(uiRails);
    const railCount = Number(existingRails[0]?.count || 0);
    if (railCount === 0) {
        for (const rail of KYOO_DEFAULT_RAILS) {
            await db.insert(uiRails).values(rail);
        }
        console.log(`✨ Seeded ${KYOO_DEFAULT_RAILS.length} home UI rails.`);
    }
    console.log('✅ Kyoo Native Preset ready out of the box.');
}
