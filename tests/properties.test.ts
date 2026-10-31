import { describe, expect, it } from 'vitest';
import { buildProperties, buildPropertyValue } from '../src/main/notion/properties';

describe('buildPropertyValue', () => {
    it('omits empty optional values that Notion would reject', () => {
        expect(buildPropertyValue({ type: 'select', value: null })).toBeNull();
        expect(buildPropertyValue({ type: 'url', value: '' })).toBeNull();
        expect(buildPropertyValue({ type: 'email', value: '' })).toBeNull();
        expect(buildPropertyValue({ type: 'status', value: '' })).toBeNull();
        expect(buildPropertyValue({ type: 'date', start: '', includeTime: false })).toBeNull();
    });

    it('builds date ranges', () => {
        expect(
            buildPropertyValue({
                type: 'date',
                start: '2026-01-01',
                end: '2026-01-02',
                includeTime: false,
            }),
        ).toEqual({ date: { start: '2026-01-01', end: '2026-01-02' } });
    });

    it('builds relations, people and multi-select', () => {
        expect(buildPropertyValue({ type: 'relation', pageIds: ['p1'] })).toEqual({
            relation: [{ id: 'p1' }],
        });
        expect(buildPropertyValue({ type: 'people', userIds: ['u1'] })).toEqual({
            people: [{ id: 'u1' }],
        });
        expect(buildPropertyValue({ type: 'multi_select', value: ['A', 'B'] })).toEqual({
            multi_select: [{ name: 'A' }, { name: 'B' }],
        });
    });

    it('names external files from their URL', () => {
        expect(buildPropertyValue({ type: 'files', urls: ['https://x.dev/a/report.pdf'] })).toEqual(
            {
                files: [
                    {
                        type: 'external',
                        name: 'report.pdf',
                        external: { url: 'https://x.dev/a/report.pdf' },
                    },
                ],
            },
        );
    });
});

describe('buildProperties', () => {
    it('uses the title property id when no title property is supplied', () => {
        expect(buildProperties({}, 'My note')).toEqual({
            title: { title: [{ type: 'text', text: { content: 'My note' } }] },
        });
    });

    it('does not add a fallback title when the database title property is set', () => {
        const result = buildProperties({ Task: { type: 'title', value: 'From form' } }, 'ignored');
        expect(Object.keys(result)).toEqual(['Task']);
    });

    it('omits the title entirely when it is empty', () => {
        expect(buildProperties({}, '')).toEqual({});
    });
});
