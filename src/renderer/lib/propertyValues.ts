// src/renderer/lib/propertyValues.ts — Helpers for database property values in the capture form
import type { PropertyValue } from '../../shared/types';

/** Whether the user has entered something for this property (defaults like an empty date don't count). */
export function isFilled(value: PropertyValue | undefined): boolean {
    if (!value) return false;
    switch (value.type) {
        case 'title':
        case 'rich_text':
        case 'url':
        case 'email':
        case 'phone_number':
        case 'status':
            return value.value.trim().length > 0;
        case 'select':
            return !!value.value;
        case 'number':
            return value.value !== null;
        case 'multi_select':
            return value.value.length > 0;
        case 'checkbox':
            return value.value;
        case 'date':
            return !!value.start;
        case 'people':
            return value.userIds.length > 0;
        case 'relation':
            return value.pageIds.length > 0;
        case 'files':
            return value.urls.length > 0;
        default:
            return false;
    }
}
