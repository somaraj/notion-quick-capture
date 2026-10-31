// src/shared/markdownToBlocks.ts — Markdown → Notion block array converter
//
// Parsing is done by markdown-it (CommonMark + GFM tables/strikethrough + autolinks); this module
// only maps its token stream onto Notion's block and rich-text shapes. It is pure (no Electron or
// DOM imports) so it runs in the main process and in unit tests.
import MarkdownIt from 'markdown-it';
import type { Token as MarkdownItToken } from 'markdown-it';

type Token = MarkdownItToken;

/** Notion rejects any single rich-text `content` longer than this. */
export const NOTION_TEXT_LIMIT = 2000;
/** Notion accepts at most this many rich-text items per block. */
const MAX_RICH_TEXT_ITEMS = 100;
/** pages.create / blocks.children.append accept at most two levels of nested children. */
const MAX_NESTING_DEPTH = 2;

interface RichTextAnnotation {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: 'default';
}

export interface RichTextItem {
    type: 'text';
    text: { content: string; link: { url: string } | null };
    annotations: RichTextAnnotation;
}

export interface NotionBlock {
    object: 'block';
    type: string;
    [key: string]: unknown;
}

// Languages accepted by the Notion API for code blocks. Anything else is rejected with a 400.
const NOTION_CODE_LANGUAGES = new Set([
    'abap',
    'agda',
    'arduino',
    'ascii art',
    'assembly',
    'bash',
    'basic',
    'bnf',
    'c',
    'c#',
    'c++',
    'clojure',
    'coffeescript',
    'coq',
    'css',
    'dart',
    'dhall',
    'diff',
    'docker',
    'ebnf',
    'elixir',
    'elm',
    'erlang',
    'f#',
    'flow',
    'fortran',
    'gherkin',
    'glsl',
    'go',
    'graphql',
    'groovy',
    'haskell',
    'hcl',
    'html',
    'idris',
    'java',
    'javascript',
    'json',
    'julia',
    'kotlin',
    'latex',
    'less',
    'lisp',
    'livescript',
    'llvm ir',
    'lua',
    'makefile',
    'markdown',
    'markup',
    'matlab',
    'mathematica',
    'mermaid',
    'nix',
    'notion formula',
    'objective-c',
    'ocaml',
    'pascal',
    'perl',
    'php',
    'plain text',
    'powershell',
    'prolog',
    'protobuf',
    'purescript',
    'python',
    'r',
    'racket',
    'reason',
    'ruby',
    'rust',
    'sass',
    'scala',
    'scheme',
    'scss',
    'shell',
    'smalltalk',
    'solidity',
    'sql',
    'swift',
    'toml',
    'typescript',
    'vb.net',
    'verilog',
    'vhdl',
    'visual basic',
    'webassembly',
    'xml',
    'yaml',
    'java/c/c++/c#',
]);

const LANGUAGE_ALIASES: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    yml: 'yaml',
    md: 'markdown',
    cs: 'c#',
    csharp: 'c#',
    cpp: 'c++',
    kt: 'kotlin',
    dockerfile: 'docker',
    golang: 'go',
    text: 'plain text',
    txt: 'plain text',
    '': 'plain text',
};

// html: true — lets us recognise <br> (the editor writes empty lines as "<br />"). HTML is never
//   rendered: every other HTML token is passed to Notion as plain text.
// breaks: true — a single newline is a line break, which is what people expect when jotting notes.
const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

const BR_TAG = /^<br\s*\/?>$/i;

function defaultAnnotations(): RichTextAnnotation {
    return {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: 'default',
    };
}

/** Split a string into pieces no longer than `limit`, without breaking surrogate pairs. */
export function splitText(text: string, limit = NOTION_TEXT_LIMIT): string[] {
    if (text.length <= limit) return [text];
    const parts: string[] = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + limit, text.length);
        // Don't split in the middle of a UTF-16 surrogate pair
        const code = text.charCodeAt(end - 1);
        if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--;
        parts.push(text.slice(start, end));
        start = end;
    }
    return parts;
}

/** A token attribute as a string ('' when absent). */
function attr(token: Token, name: string): string {
    const value = token.attrGet(name);
    return value === null ? '' : String(value);
}

function isSafeLink(url: string): boolean {
    return /^(https?:\/\/|mailto:)/i.test(url);
}

function sameStyle(a: RichTextItem, b: RichTextItem): boolean {
    if ((a.text.link?.url ?? null) !== (b.text.link?.url ?? null)) return false;
    const keys = Object.keys(a.annotations) as Array<keyof RichTextAnnotation>;
    return keys.every((k) => a.annotations[k] === b.annotations[k]);
}

/** Merge adjacent runs with identical styling, then enforce Notion's length and count limits. */
function finalizeRichText(items: RichTextItem[]): RichTextItem[] {
    const merged: RichTextItem[] = [];
    for (const item of items) {
        if (!item.text.content) continue;
        const last = merged[merged.length - 1];
        if (last && sameStyle(last, item)) {
            last.text.content += item.text.content;
        } else {
            merged.push({ ...item, text: { ...item.text }, annotations: { ...item.annotations } });
        }
    }

    const split = merged.flatMap((item) =>
        splitText(item.text.content).map((content) => ({
            ...item,
            text: { ...item.text, content },
        })),
    );

    if (split.length <= MAX_RICH_TEXT_ITEMS) return split;
    // Extremely fragmented text: keep the first items styled, the rest as plain text
    const head = split.slice(0, MAX_RICH_TEXT_ITEMS - 1);
    const rest = split
        .slice(MAX_RICH_TEXT_ITEMS - 1)
        .map((i) => i.text.content)
        .join('');
    return [...head, ...plainRichText(rest)].slice(0, MAX_RICH_TEXT_ITEMS);
}

/** Convert markdown-it inline tokens (an `inline` token's children) to Notion rich text. */
function inlineToRichText(children: Token[] | null | undefined): RichTextItem[] {
    const items: RichTextItem[] = [];
    const style = defaultAnnotations();
    const links: Array<string | null> = [];

    const push = (content: string, extra: Partial<RichTextAnnotation> = {}): void => {
        const link = links[links.length - 1] ?? null;
        items.push({
            type: 'text',
            text: { content, link: link ? { url: link } : null },
            annotations: { ...style, ...extra },
        });
    };

    for (const token of children ?? []) {
        switch (token.type) {
            case 'text':
                push(token.content);
                break;
            case 'html_inline':
                // <br> is a line break; any other inline HTML is kept as literal text
                push(BR_TAG.test(token.content.trim()) ? '\n' : token.content);
                break;
            case 'code_inline':
                push(token.content, { code: true });
                break;
            case 'softbreak':
            case 'hardbreak':
                push('\n');
                break;
            case 'strong_open':
                style.bold = true;
                break;
            case 'strong_close':
                style.bold = false;
                break;
            case 'em_open':
                style.italic = true;
                break;
            case 'em_close':
                style.italic = false;
                break;
            case 's_open':
                style.strikethrough = true;
                break;
            case 's_close':
                style.strikethrough = false;
                break;
            case 'link_open': {
                const href = attr(token, 'href');
                links.push(isSafeLink(href) ? href : null);
                break;
            }
            case 'link_close':
                links.pop();
                break;
            case 'image': {
                // Inline images can't live inside text in Notion; keep them as a link
                const src = attr(token, 'src');
                const alt = token.content || src;
                links.push(isSafeLink(src) ? src : null);
                push(alt);
                links.pop();
                break;
            }
            default:
                if (token.content) push(token.content);
        }
    }

    return finalizeRichText(items);
}

/** Parse inline Markdown (no block syntax) into Notion rich text. */
export function parseInlineFormatting(text: string): RichTextItem[] {
    const [inline] = md.parseInline(text, {});
    const items = inlineToRichText(inline?.children);
    return items.length > 0 ? items : plainRichText(text);
}

export function plainRichText(text: string): RichTextItem[] {
    return splitText(text).map((content) => ({
        type: 'text',
        text: { content, link: null },
        annotations: defaultAnnotations(),
    }));
}

export function detectLanguage(lang: string): string {
    const normalized = (lang.trim().split(/\s+/)[0] ?? '').toLowerCase();
    const mapped = LANGUAGE_ALIASES[normalized] ?? normalized;
    return NOTION_CODE_LANGUAGES.has(mapped) ? mapped : 'plain text';
}

// ─── Block-level conversion ────────────────────────────────────────────────────

function textBlock(
    type: string,
    richText: RichTextItem[],
    extra: Record<string, unknown> = {},
): NotionBlock {
    return { object: 'block', type, [type]: { rich_text: richText, ...extra } };
}

function withChildren(block: NotionBlock, children: NotionBlock[]): NotionBlock {
    if (children.length === 0) return block;
    const body = block[block.type] as Record<string, unknown>;
    return { ...block, [block.type]: { ...body, children } };
}

/** Index of the token that closes the one opened at `start` (same nesting level). */
function findClose(tokens: Token[], start: number): number {
    let depth = 0;
    for (let i = start; i < tokens.length; i++) {
        depth += tokens[i]!.nesting;
        if (depth === 0) return i;
    }
    return tokens.length - 1;
}

const TASK_PATTERN = /^\[([ xX])\]\s+/;

/** Strip a leading "[ ] " / "[x] " task marker from the first text token, returning checked state. */
function takeTaskMarker(inline: Token | undefined): boolean | null {
    const first = inline?.children?.[0];
    if (!first || first.type !== 'text') return null;
    const match = TASK_PATTERN.exec(first.content);
    if (!match) return null;
    first.content = first.content.slice(match[0].length);
    return match[1] !== ' ';
}

/**
 * Nest children under a block, respecting Notion's request limit of two nesting levels:
 * past that depth the children are placed after the block as siblings instead of being dropped.
 */
function nest(block: NotionBlock, children: NotionBlock[], depth: number): NotionBlock[] {
    if (children.length === 0) return [block];
    return depth < MAX_NESTING_DEPTH ? [withChildren(block, children)] : [block, ...children];
}

function convertListItem(
    tokens: Token[],
    listType: 'bulleted' | 'numbered',
    depth: number,
): NotionBlock[] {
    // tokens: content between list_item_open and list_item_close
    let richText: RichTextItem[] = [];
    let checked: boolean | null = null;
    let rest = tokens;

    // The item's own text is its first paragraph
    if (tokens[0]?.type === 'paragraph_open') {
        const close = findClose(tokens, 0);
        const inline = tokens.slice(1, close).find((t) => t.type === 'inline');
        checked = takeTaskMarker(inline);
        richText = inlineToRichText(inline?.children);
        rest = tokens.slice(close + 1);
    }

    const block =
        checked !== null
            ? textBlock('to_do', richText, { checked })
            : textBlock(
                  listType === 'bulleted' ? 'bulleted_list_item' : 'numbered_list_item',
                  richText,
              );
    return nest(block, convertTokens(rest, depth + 1), depth);
}

function convertTable(tokens: Token[]): NotionBlock | null {
    const rows: RichTextItem[][][] = [];
    let current: RichTextItem[][] | null = null;
    for (const token of tokens) {
        if (token.type === 'tr_open') current = [];
        else if (token.type === 'tr_close' && current) {
            rows.push(current);
            current = null;
        } else if (token.type === 'inline' && current) {
            current.push(inlineToRichText(token.children));
        }
    }
    const width = Math.max(0, ...rows.map((r) => r.length));
    if (width === 0) return null;

    return {
        object: 'block',
        type: 'table',
        table: {
            table_width: width,
            has_column_header: true,
            has_row_header: false,
            children: rows.slice(0, 100).map((cells) => ({
                object: 'block',
                type: 'table_row',
                table_row: {
                    // Every row must have exactly table_width cells
                    cells: Array.from({ length: width }, (_, i) => cells[i] ?? []),
                },
            })),
        },
    };
}

/** Convert a run of block-level tokens into Notion blocks. */
function convertTokens(tokens: Token[], depth: number): NotionBlock[] {
    const blocks: NotionBlock[] = [];
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i]!;

        switch (token.type) {
            case 'heading_open': {
                const close = findClose(tokens, i);
                const level = Math.min(Number(token.tag.slice(1)) || 1, 3);
                const inline = tokens.slice(i + 1, close).find((t) => t.type === 'inline');
                blocks.push(textBlock(`heading_${level}`, inlineToRichText(inline?.children)));
                i = close + 1;
                continue;
            }

            case 'paragraph_open': {
                const close = findClose(tokens, i);
                const inline = tokens.slice(i + 1, close).find((t) => t.type === 'inline');
                const kids = inline?.children ?? [];
                const image = kids.length === 1 && kids[0]!.type === 'image' ? kids[0]! : null;
                const src = image ? attr(image, 'src') : '';
                if (image && /^https?:\/\//i.test(src)) {
                    // A paragraph that is just an image becomes a Notion image block
                    blocks.push({
                        object: 'block',
                        type: 'image',
                        image: { type: 'external', external: { url: src } },
                    });
                } else {
                    const richText = inlineToRichText(kids);
                    if (richText.length > 0) blocks.push(textBlock('paragraph', richText));
                }
                i = close + 1;
                continue;
            }

            case 'bullet_list_open':
            case 'ordered_list_open': {
                const close = findClose(tokens, i);
                const listType = token.type === 'bullet_list_open' ? 'bulleted' : 'numbered';
                let j = i + 1;
                while (j < close) {
                    if (tokens[j]!.type === 'list_item_open') {
                        const itemClose = findClose(tokens, j);
                        blocks.push(
                            ...convertListItem(tokens.slice(j + 1, itemClose), listType, depth),
                        );
                        j = itemClose + 1;
                    } else {
                        j++;
                    }
                }
                i = close + 1;
                continue;
            }

            case 'blockquote_open': {
                const close = findClose(tokens, i);
                const inner = convertTokens(tokens.slice(i + 1, close), depth + 1);
                const [first, ...others] = inner;
                const firstText =
                    first && first.type === 'paragraph'
                        ? ((first['paragraph'] as { rich_text: RichTextItem[] }).rich_text ?? [])
                        : [];
                const kids = first && first.type === 'paragraph' ? others : inner;
                blocks.push(...nest(textBlock('quote', firstText), kids, depth));
                i = close + 1;
                continue;
            }

            case 'fence':
            case 'code_block':
                blocks.push({
                    object: 'block',
                    type: 'code',
                    code: {
                        rich_text: plainRichText(token.content.replace(/\n$/, '')),
                        language: detectLanguage(token.info ?? ''),
                    },
                });
                break;

            case 'hr':
                blocks.push({ object: 'block', type: 'divider', divider: {} });
                break;

            case 'table_open': {
                const close = findClose(tokens, i);
                const table = convertTable(tokens.slice(i + 1, close));
                if (table) blocks.push(table);
                i = close + 1;
                continue;
            }

            case 'html_block': {
                const html = token.content.trim();
                if (BR_TAG.test(html)) {
                    // An intentionally empty line in the editor
                    blocks.push(textBlock('paragraph', []));
                } else if (html) {
                    blocks.push(textBlock('paragraph', plainRichText(html)));
                }
                break;
            }

            default:
                break;
        }
        i++;
    }

    return blocks;
}

export function markdownToBlocks(markdown: string): NotionBlock[] {
    const normalized = markdown.replace(/\r\n?/g, '\n');
    if (!normalized.trim()) return [];
    return convertTokens(md.parse(normalized, {}), 0);
}
