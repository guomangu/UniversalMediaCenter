import { Hono } from 'hono';
import { requireAdmin } from '../middleware/access.js';
import { discoverPhysicalFolders } from '../services/folderExplorer.js';

export const adminFolderRouter = new Hono();
adminFolderRouter.use('*', requireAdmin);

/**
 * GET /api/admin/folders
 * Retourne l'arborescence des dossiers physiques indexés et détectés sur disque
 * avec le compte de médias et les chemins relatifs/absolus.
 */
adminFolderRouter.get('/', async (c) => {
  try {
    const result = await discoverPhysicalFolders();
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Erreur lors de la découverte des dossiers' }, 500);
  }
});
