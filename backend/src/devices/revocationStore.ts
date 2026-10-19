import { sqlClient } from '../db/connection.js';

/**
 * Persistance des révocations d'appareils.
 *
 * Le registre d'appareils vit en mémoire pour rester extrêmement rapide, mais
 * une révocation doit survivre à un redémarrage : sinon un appareil déconnecté
 * à distance retrouverait immédiatement l'accès après un restart du conteneur.
 */

export interface StoredDeviceRevocation {
  userId: string;
  deviceId: string;
}

export async function persistDeviceRevocation(userId: string, deviceId: string): Promise<void> {
  if (!userId || !deviceId) return;
  try {
    await sqlClient`
      INSERT INTO device_revocations (user_id, device_id)
      VALUES (${userId}, ${deviceId})
      ON CONFLICT (user_id, device_id) DO NOTHING
    `;
  } catch (err) {
    console.warn('Impossible de persister la révocation de l’appareil:', err);
  }
}

export async function removeDeviceRevocation(userId: string, deviceId: string): Promise<void> {
  if (!userId || !deviceId) return;
  try {
    const baseDeviceId = deviceId.split('_tab_')[0];
    await sqlClient`
      DELETE FROM device_revocations
      WHERE user_id = ${userId}
        AND split_part(device_id, '_tab_', 1) = ${baseDeviceId}
    `;
  } catch (err) {
    console.warn('Impossible de supprimer la révocation de l’appareil:', err);
  }
}

export async function loadDeviceRevocations(): Promise<StoredDeviceRevocation[]> {
  try {
    const rows = await sqlClient`
      SELECT user_id, device_id FROM device_revocations
    `;
    return rows.map((row: any) => ({
      userId: String(row.user_id),
      deviceId: String(row.device_id),
    }));
  } catch (err) {
    console.warn('Impossible de charger les révocations d’appareils:', err);
    return [];
  }
}

/**
 * Supprime les révocations devenues inutiles (utilisateur supprimé ou
 * appareils très anciens) afin de garder la table compacte.
 */
export async function pruneDeviceRevocations(): Promise<void> {
  try {
    await sqlClient`
      DELETE FROM device_revocations
      WHERE created_at < NOW() - INTERVAL '180 days'
    `;
  } catch {
    // Nettoyage best-effort : ne jamais bloquer le démarrage.
  }
}
