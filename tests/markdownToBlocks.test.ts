import { describe, expect, it } from 'vitest';
import {
    detectLanguage,
    markdownToBlocks,
    NOTION_TEXT_LIMIT,
    parseInlineFormatting,
    splitText,
} from '../src/shared/markdownToBlocks';

type Block = ReturnType<typeof markdownToBlocks>[number];
const richTextOf = (block: Block) =>
    (block[block.type] as { rich_text: Array<{ text: { content: string } }> }).rich_text;
const textOf = (block: Block) =>
    richTextOf(block)
        .map((r) => r.text.content)
        .join('');

describe('markdownToBlocks', () => {
    it('converts headings, lists, quotes, todos and dividers', () => {
        const blocks = markdownToBlocks(
            [
                '# H1',
                '## H2',
                '### H3',
                '- bullet',
                '* star bullet',
                '1. first',
                '2) second',
                '- [ ] open task',
                '- [x] done task',
                '> quoted',
                '---',
                'plain paragraph',
            ].join('\n'),
        );

        expect(blocks.map((b) => b.type)).toEqual([
            'heading_1',
            'heading_2',
            'heading_3',
            'bulleted_list_item',
            'bulleted_list_item',
            'numbered_list_item',
            'numbered_list_item',
            'to_do',
            'to_do',
            'quote',
            'divider',
            'paragraph',
        ]);
        expect((blocks[7]!['to_do'] as { checked: boolean }).checked).toBe(false);
        expect((blocks[8]!['to_do'] as { checked: boolean }).checked).toBe(true);
        expect(textOf(blocks[3]!)).toBe('bullet');
    });

    it('handles Windows line endings and skips blank lines', () => {
        const blocks = markdownToBlocks('one\r\n\r\ntwo\r\n');
        expect(blocks.map(textOf)).toEqual(['one', 'two']);
    });

    it('keeps fenced code verbatim and maps the language', () => {
        const blocks = markdownToBlocks('```ts\nconst a = **1**;\n```');
        expect(blocks).toHaveLength(1);
        const code = blocks[0]!['code'] as {
            language: string;
            rich_text: Array<{ text: { content: string } }>;
        };
        expect(code.language).toBe('typescript');
        expect(code.rich_text[0]!.text.content).toBe('const a = **1**;');
    });

    it('closes an unterminated code fence at the end of input', () => {
        const blocks = markdownToBlocks('```\nline');
        expect(blocks).toHaveLength(1);
        expect(blocks[0]!.type).toBe('code');
    });

    it('splits text longer than the Notion limit into multiple rich text items', () => {
        const long = 'a'.repeat(NOTION_TEXT_LIMIT * 2 + 10);
        const [block] = markdownToBlocks(long);
        const items = richTextOf(block!);
        expect(items.length).toBe(3);
        expect(items.every((i) => i.text.content.length <= NOTION_TEXT_LIMIT)).toBe(true);
        expect(textOf(block!)).toBe(long);
    });

    it('nests list items and task items', () => {
        const [parent] = markdownToBlocks('- parent\n  - child\n  - [x] done child');
        expect(parent!.type).toBe('bulleted_list_item');
        const children = (parent!['bulleted_list_item'] as { children: Block[] }).children;
        expect(children.map((c) => c.type)).toEqual(['bulleted_list_item', 'to_do']);
        expect((children[1]!['to_do'] as { checked: boolean }).checked).toBe(true);
        expect(textOf(children[1]!)).toBe('done child');
    });

    it('flattens nesting deeper than Notion allows in one request', () => {
        const blocks = markdownToBlocks('- a\n  - b\n    - c\n      - d');
        const a = blocks[0]!;
        const b = (a['bulleted_list_item'] as { children: Block[] }).children[0]!;
        const bChildren = (b['bulleted_list_item'] as { children: Block[] }).children;
        // c sits at the maximum depth; d is moved up next to it rather than lost
        expect(bChildren.map(textOf)).toEqual(['c', 'd']);
        expect(bChildren[0]!['bulleted_list_item']).not.toHaveProperty('children');
    });

    it('keeps single line breaks inside a paragraph', () => {
        const [block] = markdownToBlocks('line one\nline two');
        expect(block!.type).toBe('paragraph');
        expect(textOf(block!)).toBe('line one\nline two');
    });

    it('converts GFM tables', () => {
        const [table] = markdownToBlocks('| a | b |\n|---|---|\n| 1 | 2 |');
        expect(table!.type).toBe('table');
        const t = table!['table'] as { table_width: number; children: Block[] };
        expect(t.table_width).toBe(2);
        expect(t.children).toHaveLength(2);
    });

    it('turns an image-only paragraph into an image block', () => {
        const [img] = markdownToBlocks('![logo](https://x.dev/logo.png)');
        expect(img).toEqual({
            object: 'block',
            type: 'image',
            image: { type: 'external', external: { url: 'https://x.dev/logo.png' } },
        });
    });

    // Exact output captured from the Milkdown editor: empty lines are serialized as <br />,
    // literal Markdown characters are escaped and leading spaces become entities.
    it('handles Milkdown editor output', () => {
        const editorOutput =
            '<br />\n\nSome \\*\\*bold\\*\\* text\n\n<br />\n\n\\- first\n\n&#x20;   nested\n\n\\[ ] a task\n';
        const blocks = markdownToBlocks(editorOutput);
        expect(blocks.map((b) => b.type)).toEqual([
            'paragraph',
            'paragraph',
            'paragraph',
            'paragraph',
            'paragraph',
            'paragraph',
        ]);
        expect(richTextOf(blocks[0]!)).toEqual([]);
        expect(textOf(blocks[1]!)).toBe('Some **bold** text');
        expect(textOf(blocks[3]!)).toBe('- first');
        expect(textOf(blocks[5]!)).toBe('[ ] a task');
        expect(blocks.every((b) => !textOf(b).includes('<br'))).toBe(true);
    });

    it('converts Milkdown-style lists, tasks and inline breaks', () => {
        const blocks = markdownToBlocks('* one\n  * two\n* [x] done\n\nline<br />break');
        expect(blocks.map((b) => b.type)).toEqual(['bulleted_list_item', 'to_do', 'paragraph']);
        expect(textOf(blocks[2]!)).toBe('line\nbreak');
    });

    it('treats raw HTML as text', () => {
        const [block] = markdownToBlocks('<script>alert(1)</script>');
        expect(textOf(block!)).toContain('<script>');
    });
});

describe('parseInlineFormatting', () => {
    it('parses bold, italic, code, strikethrough and links', () => {
        const items = parseInlineFormatting('a **b** *c* `d` ~~e~~ [f](https://x.dev)');
        const find = (content: string) => items.find((i) => i.text.content === content)!;
        expect(find('b').annotations.bold).toBe(true);
        expect(find('c').annotations.italic).toBe(true);
        expect(find('d').annotations.code).toBe(true);
        expect(find('e').annotations.strikethrough).toBe(true);
        expect(find('f').text.link).toEqual({ url: 'https://x.dev' });
    });

    it('does not italicize snake_case identifiers', () => {
        const items = parseInlineFormatting('use my_var_name here');
        expect(items).toHaveLength(1);
        expect(items[0]!.text.content).toBe('use my_var_name here');
        expect(items[0]!.annotations.italic).toBe(false);
    });

    it('never produces links with unsafe protocols', () => {
        const items = parseInlineFormatting('[click](javascript:void)');
        expect(items.every((i) => i.text.link === null)).toBe(true);
    });

    it('autolinks bare URLs and honours escapes', () => {
        const items = parseInlineFormatting(String.raw`see https://example.com and \*not italic\*`);
        expect(items.find((i) => i.text.link)?.text.link).toEqual({ url: 'https://example.com' });
        expect(items.map((i) => i.text.content).join('')).toContain('*not italic*');
        expect(items.every((i) => !i.annotations.italic)).toBe(true);
    });

    it('handles nested emphasis', () => {
        const items = parseInlineFormatting('**bold *both***');
        const both = items.find((i) => i.text.content === 'both')!;
        expect(both.annotations.bold).toBe(true);
        expect(both.annotations.italic).toBe(true);
    });

    it('keeps unmatched markers as plain text', () => {
        const items = parseInlineFormatting('2 * 3 = 6');
        expect(items.map((i) => i.text.content).join('')).toBe('2 * 3 = 6');
    });
});

describe('detectLanguage', () => {
    it('maps aliases and falls back to plain text for unknown languages', () => {
        expect(detectLanguage('py')).toBe('python');
        expect(detectLanguage('TSX')).toBe('typescript');
        expect(detectLanguage('rust')).toBe('rust');
        expect(detectLanguage('')).toBe('plain text');
        expect(detectLanguage('not-a-language')).toBe('plain text');
    });
});

describe('splitText', () => {
    it('never splits a surrogate pair', () => {
        const text = 'a'.repeat(1999) + '😀' + 'b';
        const parts = splitText(text);
        expect(parts.join('')).toBe(text);
        expect(parts[0]!.length).toBe(1999);
    });
});
