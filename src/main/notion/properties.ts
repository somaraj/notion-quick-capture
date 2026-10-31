// src/main/notion/properties.ts — Pure builders that turn capture payload values into Notion API shapes
import { splitText } from '../../shared/markdownToBlocks';
import type { PropertyValue } from '../../shared/types';

interface NotionRichText {
    type: 'text';
    text: { content: string };
}

export function buildRichText(text: string): NotionRichText[] {
    return splitText(text).map((content) => ({ type: 'text', text: { content } }));
}

export function buildPropertyValue(value: PropertyValue): Record<string, unknown> | null {
    switch (value.type) {
        case 'title':
            return { title: buildRichText(value.value) };
        case 'rich_text':
            return { rich_text: buildRichText(value.value) };
        case 'number':
            return { number: value.value };
        case 'select':
            return value.value ? { select: { name: value.value } } : null;
        case 'multi_select':
            return { multi_select: value.value.map((name) => ({ name })) };
        case 'date': {
            // Skip if start date is empty — Notion rejects empty date strings
            if (!value.start) return null;
            const dateObj: Record<string, string> = { start: value.start };
            if (value.end) {
                dateObj['end'] = value.end;
            }
            return { date: dateObj };
        }
        case 'checkbox':
            return { checkbox: value.value };
        case 'url':
            return value.value ? { url: value.value } : null;
        case 'email':
            return value.value ? { email: value.value } : null;
        case 'phone_number':
            return value.value ? { phone_number: value.value } : null;
        case 'people':
            return { people: value.userIds.map((id) => ({ id })) };
        case 'relation':
            return { relation: value.pageIds.map((id) => ({ id })) };
        case 'status':
            return value.value ? { status: { name: value.value } } : null;
        case 'files':
            return {
                files: value.urls.map((url) => ({
                    type: 'external',
                    name: (url.split('/').pop() || 'file').slice(0, 100),
                    external: { url },
                })),
            };
        default:
            return null;
    }
}

/**
 * Build the `properties` object for pages.create.
 * If no title property is supplied, the plain title is set via the `title` property id,
 * which Notion accepts for both page parents and database parents (whatever the column is named).
 */
export function buildProperties(
    properties: Record<string, PropertyValue>,
    fallbackTitle: string,
): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};

    for (const [key, value] of Object.entries(properties)) {
        const built = buildPropertyValue(value);
        if (built) {
            result[key] = built;
        }
    }

    if (fallbackTitle && !Object.values(result).some((p) => 'title' in p)) {
        result['title'] = { title: buildRichText(fallbackTitle) };
    }

    return result;
}
