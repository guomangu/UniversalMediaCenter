import { Hono } from 'hono';
import { getSiteParams, saveSiteParams } from '../config/paramManager.js';
import { requireAdmin } from '../middleware/access.js';
export const configRouter = new Hono();
configRouter.use('*', requireAdmin);
// Lecture de l'intégralité des paramètres param.yaml
configRouter.get('/', (c) => {
    const params = getSiteParams();
    return c.json({ success: true, params });
});
// Mise à jour modulaire synchronisée dans param.yaml
configRouter.put('/', async (c) => {
    try {
        const body = await c.req.json();
        const updated = saveSiteParams(body);
        return c.json({
            success: true,
            message: 'Paramètres mis à jour et synchronisés avec param.yaml',
            params: updated,
        });
    }
    catch (err) {
        return c.json({ success: false, error: err.message }, 400);
    }
});
// Ajout ou retrait rapide de code d'invitation
configRouter.post('/invitations', async (c) => {
    try {
        const { action, code } = await c.req.json();
        if (!code || typeof code !== 'string') {
            return c.json({ error: 'Code manquant ou invalide' }, 400);
        }
        const current = getSiteParams();
        let codes = [...current.security.invitationCodes];
        if (action === 'remove') {
            codes = codes.filter((c) => c !== code.trim());
        }
        else {
            const trimmed = code.trim();
            if (!codes.includes(trimmed))
                codes.push(trimmed);
        }
        const updated = saveSiteParams({
            security: { ...current.security, invitationCodes: codes },
        });
        return c.json({ success: true, invitationCodes: updated.security.invitationCodes });
    }
    catch (err) {
        return c.json({ success: false, error: err.message }, 400);
    }
});
