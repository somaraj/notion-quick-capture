// src/main/notion/search.ts — Page/database search via Notion API
import log from 'electron-log';
import { getNotionClient, notionRequest } from './client';
import type { SearchResult } from '../../shared/types';

interface NotionSearchResult {
    id: string;
    object: string;
    title?: Array<{ plain_text: string }>;
    icon?: { type: string; emoji?: string } | null;
    parent?: { type: string; database_id?: string; page_id?: string };
    properties?: Record<
        string,
        {
            type: string;
            title?: Array<{ plain_text: string }>;
        }
    >;
}

function extractTitle(result: NotionSearchResult): string {
    // For databases, title is directly on the object
    if (result.title) {
        return result.title.map((t) => t.plain_text).join('');
    }

    // For pages, title is in the properties
    if (result.properties) {
        for (const prop of Object.values(result.properties)) {
            if (prop.type === 'title' && prop.title) {
                return prop.title.map((t) => t.plain_text).join('');
            }
        }
    }

    return 'Untitled';
}

export async function searchNotion(query: string): Promise<SearchResult[]> {
    const client = await getNotionClient();

    log.info(`[search] Searching for: "${query}"`);

    const response = await notionRequest(() =>
        client.search({
            query,
            page_size: 20,
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time',
            },
        }),
    );

    const results: SearchResult[] = (response.results as unknown as NotionSearchResult[]).map(
        (item) => {
            const type = item.object === 'database' ? ('database' as const) : ('page' as const);
            const icon = item.icon?.type === 'emoji' ? item.icon.emoji : undefined;

            return {
                id: item.id,
                type,
                title: extractTitle(item),
                icon,
            };
        },
    );

    log.info(`[search] Found ${results.length} results`);
    return results;
}
