import { db } from '../db/connection.js';
import { eavAttributes, eavValues, nodeEavLinks } from '../db/schema/index.js';
import { generateSlug } from './slugify.js';
export async function linkTagToNode(nodeId, attributeCode, valueText, contextRole, metadata) {
    const cleanText = valueText.trim();
    if (!cleanText)
        return;
    const valueSlug = generateSlug(cleanText) || 'tag';
    // 1. Trouver ou créer l'attribut EAV
    const attrQuery = await db.query.eavAttributes.findFirst({
        where: (t, { eq }) => eq(t.code, attributeCode),
    });
    let attributeId;
    if (attrQuery) {
        attributeId = attrQuery.id;
    }
    else {
        const isCustom = attributeCode.startsWith('custom_');
        const [newAttr] = await db
            .insert(eavAttributes)
            .values({
            code: attributeCode,
            displayName: isCustom ? attributeCode.replace('custom_', 'Tag: ') : attributeCode,
            uiZone: isCustom ? 'TECHNICAL_DRAWER' : 'PRIMARY_PILL',
            isDynamicCatchAll: isCustom,
        })
            .returning();
        attributeId = newAttr.id;
    }
    // 2. Trouver ou créer la valeur EAV
    let valQuery = await db.query.eavValues.findFirst({
        where: (t, { and, eq }) => and(eq(t.attributeId, attributeId), eq(t.valueSlug, valueSlug)),
    });
    let valueId;
    if (valQuery) {
        valueId = valQuery.id;
    }
    else {
        const [newVal] = await db
            .insert(eavValues)
            .values({
            attributeId,
            valueText: cleanText,
            valueSlug,
            metadataJson: metadata || {},
        })
            .returning();
        valueId = newVal.id;
    }
    // 3. Lier la valeur au Media Node (Idempotent)
    await db
        .insert(nodeEavLinks)
        .values({
        nodeId,
        valueId,
        contextRole: contextRole || null,
    })
        .onConflictDoNothing();
}
