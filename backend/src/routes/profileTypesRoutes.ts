import { Hono } from 'hono';
import { getSiteParams, saveSiteParams } from '../config/paramManager.js';
import { requireAdmin } from '../middleware/access.js';
import type { ProfileTypeDefinition } from '../config/paramSchema.js';

export const profileTypesRouter = new Hono();
profileTypesRouter.use('*', requireAdmin);

// Liste des types de profils configurés
profileTypesRouter.get('/', (c) => {
  const params = getSiteParams();
  return c.json({ success: true, profileTypes: params.profileTypes || [] });
});

// Création d’un nouveau type de profil
profileTypesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { id, label, description, isAdmin, canDownload, canTranscode, canWatchIptv, maxCsaAgeLimit, allowedTags, blockedTags, blockedFolders } = body;

    if (!id || !label) {
      return c.json({ error: 'L’identifiant et le libellé du type de profil sont obligatoires' }, 400);
    }

    const cleanId = String(id).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const params = getSiteParams();
    const existing = (params.profileTypes || []).find((p) => p.id === cleanId);
    if (existing) {
      return c.json({ error: 'Un type de profil avec cet identifiant existe déjà' }, 400);
    }

    const newType: ProfileTypeDefinition = {
      id: cleanId,
      label: String(label).trim(),
      description: description ? String(description).trim() : undefined,
      isAdmin: Boolean(isAdmin),
      canDownload: canDownload !== undefined ? Boolean(canDownload) : true,
      canTranscode: canTranscode !== undefined ? Boolean(canTranscode) : true,
      canWatchIptv: canWatchIptv !== undefined ? Boolean(canWatchIptv) : true,
      maxCsaAgeLimit: maxCsaAgeLimit !== null && maxCsaAgeLimit !== undefined && maxCsaAgeLimit !== '' ? Number(maxCsaAgeLimit) : null,
      allowedTags: Array.isArray(allowedTags) ? allowedTags : [],
      blockedTags: Array.isArray(blockedTags) ? blockedTags : [],
      blockedFolders: Array.isArray(blockedFolders) ? blockedFolders : [],
    };

    const updatedTypes = [...(params.profileTypes || []), newType];
    saveSiteParams({ profileTypes: updatedTypes });

    return c.json({ success: true, profileType: newType });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// Modification d’un type de profil
profileTypesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id').toUpperCase();
    const body = await c.req.json().catch(() => ({}));
    const params = getSiteParams();
    const currentTypes = params.profileTypes || [];
    const index = currentTypes.findIndex((p) => p.id === id);

    if (index === -1) {
      return c.json({ error: 'Type de profil introuvable' }, 404);
    }

    const prev = currentTypes[index];
    const updated: ProfileTypeDefinition = {
      ...prev,
      label: body.label !== undefined ? String(body.label).trim() : prev.label,
      description: body.description !== undefined ? String(body.description).trim() : prev.description,
      isAdmin: body.isAdmin !== undefined ? Boolean(body.isAdmin) : prev.isAdmin,
      canDownload: body.canDownload !== undefined ? Boolean(body.canDownload) : prev.canDownload,
      canTranscode: body.canTranscode !== undefined ? Boolean(body.canTranscode) : prev.canTranscode,
      canWatchIptv: body.canWatchIptv !== undefined ? Boolean(body.canWatchIptv) : prev.canWatchIptv,
      maxCsaAgeLimit: body.maxCsaAgeLimit !== undefined ? (body.maxCsaAgeLimit === '' || body.maxCsaAgeLimit === null ? null : Number(body.maxCsaAgeLimit)) : prev.maxCsaAgeLimit,
      allowedTags: body.allowedTags !== undefined ? (Array.isArray(body.allowedTags) ? body.allowedTags : []) : prev.allowedTags,
      blockedTags: body.blockedTags !== undefined ? (Array.isArray(body.blockedTags) ? body.blockedTags : []) : prev.blockedTags,
      blockedFolders: body.blockedFolders !== undefined ? (Array.isArray(body.blockedFolders) ? body.blockedFolders : []) : prev.blockedFolders,
    };

    currentTypes[index] = updated;
    saveSiteParams({ profileTypes: currentTypes });

    return c.json({ success: true, profileType: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// Suppression d’un type de profil
profileTypesRouter.delete('/:id', (c) => {
  const id = c.req.param('id').toUpperCase();
  if (id === 'ADMINISTRATEUR' || id === 'MEMBRE') {
    return c.json({ error: 'Les profils de base Administrateur et Membre ne peuvent pas être supprimés' }, 400);
  }

  const params = getSiteParams();
  const filtered = (params.profileTypes || []).filter((p) => p.id !== id);
  saveSiteParams({ profileTypes: filtered });

  return c.json({ success: true, message: `Type de profil ${id} supprimé` });
});
