import { db } from '../db/connection.js';
import { eavAttributes, uiRails, users } from '../db/schema/index.js';
import { KYOO_DEFAULT_ATTRIBUTES } from './attributesData.js';
import { KYOO_DEFAULT_RAILS } from './railsData.js';
import { sql } from 'drizzle-orm';

export async function seedKyooPreset(): Promise<void> {
  console.log('🌱 Starting Kyoo Native Zero-Config Seeder...');

  // 1. Ingestion des groupes d'attributs EAV
  for (const attr of KYOO_DEFAULT_ATTRIBUTES) {
    await db
      .insert(eavAttributes)
      .values(attr)
      .onConflictDoUpdate({
        target: eavAttributes.code,
        set: {
          displayName: attr.displayName,
          uiZone: attr.uiZone,
          displayOrder: attr.displayOrder,
          iconName: attr.iconName,
          colorTheme: attr.colorTheme,
        },
      });
  }
  console.log(`✨ Seeded ${KYOO_DEFAULT_ATTRIBUTES.length} EAV tag groups.`);

  // 2. Ingestion des rails Server-Driven UI par défaut
  const existingRails = await db.select({ count: sql<number>`count(*)` }).from(uiRails);
  const railCount = Number(existingRails[0]?.count || 0);

  if (railCount === 0) {
    for (const rail of KYOO_DEFAULT_RAILS) {
      await db.insert(uiRails).values(rail);
    }
    console.log(`✨ Seeded ${KYOO_DEFAULT_RAILS.length} home UI rails.`);
  }

  // 3. Ingestion de l'administrateur par défaut
  const existingUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
  const userCount = Number(existingUsers[0]?.count || 0);

  if (userCount === 0) {
    await db.insert(users).values({
      email: 'admin@ums.local',
      displayName: 'Administrateur',
      isAdmin: true,
      canDownload: true,
      canTranscode: true,
      canWatchIptv: true,
      pinHash: null,
    });
    console.log('✨ Seeded default admin profile (admin@ums.local).');
  }

  console.log('✅ Kyoo Native Preset ready out of the box.');
}
