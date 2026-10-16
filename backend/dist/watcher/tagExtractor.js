import { db } from '../db/connection.js';
import { eavAttributes, eavValues, nodeEavLinks } from '../db/schema/index.js';
import { generateSlug } from './slugify.js';
import { eq } from 'drizzle-orm';
const ATTRIBUTE_DEFAULTS = {
    certification: { displayName: 'Classification', uiZone: 'HERO_BADGE', iconName: 'ShieldAlert', colorTheme: 'orange', displayOrder: 5 },
    genre: { displayName: 'Genre', uiZone: 'PRIMARY_PILL', iconName: 'Film', colorTheme: 'indigo', displayOrder: 10 },
    arc: { displayName: 'Arc narratif', uiZone: 'PRIMARY_PILL', iconName: 'Layers', colorTheme: 'purple', displayOrder: 15 },
    subject: { displayName: 'Tag', uiZone: 'PRIMARY_PILL', iconName: 'Hash', colorTheme: 'blue', displayOrder: 20 },
    actor: { displayName: 'Acteurs', uiZone: 'PERSON_CAROUSEL', iconName: 'Users', colorTheme: 'violet', displayOrder: 30 },
    director: { displayName: 'Réalisateur', uiZone: 'PERSON_CAROUSEL', iconName: 'Clapperboard', colorTheme: 'amber', displayOrder: 40 },
    writer: { displayName: 'Scénariste / Auteur', uiZone: 'PERSON_CAROUSEL', iconName: 'FileEdit', colorTheme: 'emerald', displayOrder: 50 },
    producer: { displayName: 'Producteur', uiZone: 'PERSON_CAROUSEL', iconName: 'Briefcase', colorTheme: 'cyan', displayOrder: 55 },
    composer: { displayName: 'Musique', uiZone: 'PERSON_CAROUSEL', iconName: 'Music', colorTheme: 'rose', displayOrder: 60 },
    studio: { displayName: 'Studio', uiZone: 'PRIMARY_PILL', iconName: 'Building2', colorTheme: 'sky', displayOrder: 70 },
    country: { displayName: 'Pays', uiZone: 'PRIMARY_PILL', iconName: 'Globe', colorTheme: 'slate', displayOrder: 80 },
    video_quality: { displayName: 'Qualité', uiZone: 'TECHNICAL_DRAWER', iconName: 'Tv', colorTheme: 'teal', displayOrder: 90 },
    video_codec: { displayName: 'Codec Vidéo', uiZone: 'TECHNICAL_DRAWER', iconName: 'Cpu', colorTheme: 'slate', displayOrder: 91 },
    aspect_ratio: { displayName: 'Format', uiZone: 'TECHNICAL_DRAWER', iconName: 'Maximize', colorTheme: 'slate', displayOrder: 92 },
    audio_codec: { displayName: 'Codec Audio', uiZone: 'TECHNICAL_DRAWER', iconName: 'Volume2', colorTheme: 'slate', displayOrder: 93 },
    audio_channels: { displayName: 'Canaux Audio', uiZone: 'TECHNICAL_DRAWER', iconName: 'Headphones', colorTheme: 'slate', displayOrder: 94 },
    audio_language: { displayName: 'Langue Audio', uiZone: 'TECHNICAL_DRAWER', iconName: 'Languages', colorTheme: 'slate', displayOrder: 95 },
    subtitle_language: { displayName: 'Sous-titres', uiZone: 'TECHNICAL_DRAWER', iconName: 'Subtitles', colorTheme: 'slate', displayOrder: 96 },
    subtitle_codec: { displayName: 'Format ST', uiZone: 'TECHNICAL_DRAWER', iconName: 'FileText', colorTheme: 'slate', displayOrder: 97 },
};
export async function linkTagToNode(nodeId, attributeCode, valueText, contextRole, metadata) {
    const cleanText = valueText.trim();
    if (!cleanText)
        return;
    const valueSlug = generateSlug(cleanText) || 'tag';
    // 1. Trouver ou créer l'attribut EAV de façon concurrente et sécurisée
    const attrQuery = await db.query.eavAttributes.findFirst({
        where: (t, { eq }) => eq(t.code, attributeCode),
    });
    const defaults = ATTRIBUTE_DEFAULTS[attributeCode];
    let attributeId;
    if (attrQuery) {
        attributeId = attrQuery.id;
        if (defaults && attrQuery.uiZone !== defaults.uiZone) {
            await db
                .update(eavAttributes)
                .set({
                uiZone: defaults.uiZone,
                displayName: defaults.displayName,
                iconName: defaults.iconName,
                colorTheme: defaults.colorTheme,
                displayOrder: defaults.displayOrder,
            })
                .where(eq(eavAttributes.id, attributeId));
        }
    }
    else {
        try {
            const isCustom = attributeCode.startsWith('custom_');
            const [newAttr] = await db
                .insert(eavAttributes)
                .values({
                code: attributeCode,
                displayName: defaults?.displayName || (isCustom ? attributeCode.replace('custom_', 'Tag: ') : attributeCode),
                uiZone: defaults?.uiZone || (isCustom ? 'TECHNICAL_DRAWER' : 'PRIMARY_PILL'),
                iconName: defaults?.iconName || 'Tag',
                colorTheme: defaults?.colorTheme || 'slate',
                displayOrder: defaults?.displayOrder ?? (isCustom ? 200 : 100),
                isDynamicCatchAll: isCustom,
            })
                .onConflictDoNothing()
                .returning();
            if (newAttr) {
                attributeId = newAttr.id;
            }
            else {
                const existingAttr = await db.query.eavAttributes.findFirst({
                    where: (t, { eq }) => eq(t.code, attributeCode),
                });
                if (!existingAttr)
                    return;
                attributeId = existingAttr.id;
            }
        }
        catch {
            const existingAttr = await db.query.eavAttributes.findFirst({
                where: (t, { eq }) => eq(t.code, attributeCode),
            });
            if (!existingAttr)
                return;
            attributeId = existingAttr.id;
        }
    }
    // 2. Trouver ou créer la valeur EAV de façon concurrente et sécurisée
    const valQuery = await db.query.eavValues.findFirst({
        where: (t, { and, eq }) => and(eq(t.attributeId, attributeId), eq(t.valueSlug, valueSlug)),
    });
    let valueId;
    if (valQuery) {
        valueId = valQuery.id;
        if (metadata && Object.keys(metadata).length > 0) {
            const currentMeta = valQuery.metadataJson || {};
            const merged = { ...currentMeta, ...metadata };
            if (JSON.stringify(merged) !== JSON.stringify(currentMeta)) {
                await db.update(eavValues).set({ metadataJson: merged }).where(eq(eavValues.id, valueId));
            }
        }
    }
    else {
        try {
            const [newVal] = await db
                .insert(eavValues)
                .values({
                attributeId,
                valueText: cleanText,
                valueSlug,
                metadataJson: metadata || {},
            })
                .onConflictDoNothing()
                .returning();
            if (newVal) {
                valueId = newVal.id;
            }
            else {
                const existingVal = await db.query.eavValues.findFirst({
                    where: (t, { and, eq }) => and(eq(t.attributeId, attributeId), eq(t.valueSlug, valueSlug)),
                });
                if (!existingVal)
                    return;
                valueId = existingVal.id;
            }
        }
        catch {
            const existingVal = await db.query.eavValues.findFirst({
                where: (t, { and, eq }) => and(eq(t.attributeId, attributeId), eq(t.valueSlug, valueSlug)),
            });
            if (!existingVal)
                return;
            valueId = existingVal.id;
        }
    }
    // 3. Lier la valeur au Media Node (Idempotent et protégé contre les doublons)
    try {
        await db
            .insert(nodeEavLinks)
            .values({
            nodeId,
            valueId,
            contextRole: contextRole || null,
        })
            .onConflictDoNothing();
    }
    catch {
        // Protégé par l'index unique idx_node_val_role_coalesce
    }
}
