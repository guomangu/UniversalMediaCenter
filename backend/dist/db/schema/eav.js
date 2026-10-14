import { pgTable, uuid, text, integer, boolean, jsonb, index, uniqueIndex, } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tagZoneEnum } from './enums.js';
import { mediaNodes } from './nodes.js';
export const eavAttributes = pgTable('eav_attributes', {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    displayName: text('display_name').notNull(),
    uiZone: tagZoneEnum('ui_zone').default('PRIMARY_PILL').notNull(),
    displayOrder: integer('display_order').default(100).notNull(),
    iconName: text('icon_name').default('Tag').notNull(),
    colorTheme: text('color_theme').default('slate').notNull(),
    isFilterable: boolean('is_filterable').default(true).notNull(),
    isDynamicCatchAll: boolean('is_dynamic_catch_all').default(false).notNull(),
});
export const eavValues = pgTable('eav_values', {
    id: uuid('id').defaultRandom().primaryKey(),
    attributeId: uuid('attribute_id')
        .references(() => eavAttributes.id, { onDelete: 'cascade' })
        .notNull(),
    valueText: text('value_text').notNull(),
    valueSlug: text('value_slug').notNull(),
    metadataJson: jsonb('metadata_json').$type().default({}),
}, (table) => ({
    attrValueUnique: uniqueIndex('idx_eav_attr_val_unique').on(table.attributeId, table.valueSlug),
    trgmValIdx: index('idx_eav_values_trgm').using('gin', sql `${table.valueText} gin_trgm_ops`),
}));
export const nodeEavLinks = pgTable('node_eav_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    nodeId: uuid('node_id')
        .references(() => mediaNodes.id, { onDelete: 'cascade' })
        .notNull(),
    valueId: uuid('value_id')
        .references(() => eavValues.id, { onDelete: 'cascade' })
        .notNull(),
    contextRole: text('context_role'),
    orderIndex: integer('order_index').default(0).notNull(),
}, (table) => ({
    nodeValIdx: uniqueIndex('idx_node_val_role').on(table.nodeId, table.valueId, table.contextRole),
    valueLookupIdx: index('idx_node_eav_by_value').on(table.valueId, table.nodeId),
}));
