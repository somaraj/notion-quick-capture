// src/main/notion/schema.ts — Database property schema fetch + LRU cache
import { LRUCache } from 'lru-cache';
import log from 'electron-log';
import { getNotionClient, notionRequest } from './client';
import { getConfig } from '../store/appConfig';
import type {
    DatabaseSchema,
    PropertyConfig,
    SelectOption,
    StatusGroup,
    NotionPropertyType,
} from '../../shared/types';

let schemaCache: LRUCache<string, DatabaseSchema> | null = null;

function getCache(): LRUCache<string, DatabaseSchema> {
    if (!schemaCache) {
        const ttl = getConfig('schemaCacheTtl');
        schemaCache = new LRUCache<string, DatabaseSchema>({
            max: 50,
            ttl,
        });
    }
    return schemaCache;
}

export function resetSchemaCache(): void {
    schemaCache = null;
}

interface NotionSelectOption {
    id: string;
    name: string;
    color: string;
}

interface NotionStatusGroup {
    id: string;
    name: string;
    color: string;
    option_ids: string[];
}

interface NotionProperty {
    id: string;
    name: string;
    type: string;
    select?: { options: NotionSelectOption[] };
    multi_select?: { options: NotionSelectOption[] };
    status?: {
        options: NotionSelectOption[];
        groups: NotionStatusGroup[];
    };
    relation?: { database_id: string; type: string };
    number?: { format: string };
    formula?: { expression: string };
    rollup?: { rollup_property_name: string; relation_property_name: string; function: string };
}

function mapProperty(name: string, prop: NotionProperty): PropertyConfig {
    const type = prop.type as NotionPropertyType;
    const config: PropertyConfig = {
        id: prop.id,
        name,
        type,
        // Notion accepts untitled pages, so nothing blocks saving a body-only note
        required: false,
    };

    if (prop.select?.options) {
        config.options = prop.select.options.map((o: NotionSelectOption): SelectOption => ({
            id: o.id,
            name: o.name,
            color: o.color,
        }));
    }

    if (prop.multi_select?.options) {
        config.options = prop.multi_select.options.map((o: NotionSelectOption): SelectOption => ({
            id: o.id,
            name: o.name,
            color: o.color,
        }));
    }

    if (prop.status) {
        config.options = prop.status.options.map((o: NotionSelectOption): SelectOption => ({
            id: o.id,
            name: o.name,
            color: o.color,
        }));
        config.statusGroups = prop.status.groups.map((g: NotionStatusGroup): StatusGroup => ({
            id: g.id,
            name: g.name,
            color: g.color,
            optionIds: g.option_ids,
        }));
    }

    if (prop.relation) {
        config.relationDatabaseId = prop.relation.database_id;
    }

    if (prop.number) {
        config.numberFormat = prop.number.format;
    }

    if (prop.formula) {
        config.formulaType = 'formula';
    }

    if (prop.rollup) {
        config.rollupType = 'rollup';
    }

    return config;
}

export async function getDatabaseSchema(
    databaseId: string,
    forceRefresh = false,
): Promise<DatabaseSchema> {
    const cache = getCache();

    if (!forceRefresh && cache.has(databaseId)) {
        log.info(`[schema] Cache hit for database: ${databaseId}`);
        return cache.get(databaseId)!;
    }

    log.info(`[schema] Fetching schema for database: ${databaseId}`);
    const client = await getNotionClient();

    const dbResponse = await notionRequest(() =>
        client.databases.retrieve({ database_id: databaseId }),
    );

    const db = dbResponse as unknown as {
        id: string;
        title: Array<{ plain_text: string }>;
        icon: { type: string; emoji?: string } | null;
        properties: Record<string, NotionProperty>;
    };

    const titleParts = db.title.map((t) => t.plain_text);
    const icon = db.icon?.type === 'emoji' ? db.icon.emoji : undefined;

    const properties: PropertyConfig[] = Object.entries(db.properties).map(([name, prop]) =>
        mapProperty(name, prop as NotionProperty),
    );

    // Sort: title first, then alphabetically
    properties.sort((a, b) => {
        if (a.type === 'title') return -1;
        if (b.type === 'title') return 1;
        return a.name.localeCompare(b.name);
    });

    const schema: DatabaseSchema = {
        id: db.id,
        title: titleParts.join(''),
        icon,
        properties,
    };

    cache.set(databaseId, schema);
    log.info(
        `[schema] Cached schema for database: ${databaseId} (${properties.length} properties)`,
    );

    return schema;
}
