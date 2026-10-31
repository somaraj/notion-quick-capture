import { describe, expect, it } from 'vitest';
import { isFilled } from '../src/renderer/lib/propertyValues';
import { addRecent, MAX_RECENT_DESTINATIONS } from '../src/renderer/lib/recentDestinations';
import { hasContent } from '../src/renderer/lib/unsavedNote';
import type { DestinationRef } from '../src/shared/types';

describe('isFilled', () => {
    it('ignores the empty defaults the form starts with', () => {
        expect(isFilled({ type: 'select', value: null })).toBe(false);
        expect(isFilled({ type: 'date', start: '', includeTime: false })).toBe(false);
        expect(isFilled({ type: 'checkbox', value: false })).toBe(false);
        expect(isFilled({ type: 'multi_select', value: [] })).toBe(false);
        expect(isFilled({ type: 'rich_text', value: '   ' })).toBe(false);
        expect(isFilled(undefined)).toBe(false);
    });

    it('detects entered values', () => {
        expect(isFilled({ type: 'select', value: 'High' })).toBe(true);
        expect(isFilled({ type: 'number', value: 0 })).toBe(true);
        expect(isFilled({ type: 'checkbox', value: true })).toBe(true);
        expect(isFilled({ type: 'people', userIds: ['u1'] })).toBe(true);
    });
});

describe('hasContent', () => {
    it('is false for an untouched form', () => {
        expect(
            hasContent({
                title: '',
                body: '\n',
                properties: { Done: { type: 'checkbox', value: false } },
            }),
        ).toBe(false);
    });

    it('is true when any field has content', () => {
        expect(hasContent({ title: 'x', body: '', properties: {} })).toBe(true);
        expect(hasContent({ title: '', body: 'note', properties: {} })).toBe(true);
        expect(
            hasContent({
                title: '',
                body: '',
                properties: { P: { type: 'select', value: 'High' } },
            }),
        ).toBe(true);
    });
});

describe('addRecent', () => {
    const dest = (id: string): DestinationRef => ({ id, type: 'page', title: id });

    it('moves an existing destination to the front without duplicating it', () => {
        expect(addRecent([dest('a'), dest('b')], dest('b')).map((d) => d.id)).toEqual(['b', 'a']);
    });

    it('keeps the list short', () => {
        const list = ['a', 'b', 'c', 'd', 'e'].map(dest);
        const result = addRecent(list, dest('f'));
        expect(result).toHaveLength(MAX_RECENT_DESTINATIONS);
        expect(result[0]!.id).toBe('f');
    });
});
