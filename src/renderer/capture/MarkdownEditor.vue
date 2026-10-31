<template>
  <div ref="rootRef" class="markdown-editor" />
</template>

<script setup lang="ts">
// WYSIWYG note editor built on Milkdown Crepe. It reads and writes Markdown, which the main
// process converts to Notion blocks (src/shared/markdownToBlocks.ts).
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { replaceAll } from '@milkdown/kit/utils';

import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/reset.css';
import '@milkdown/crepe/theme/common/block-edit.css';
import '@milkdown/crepe/theme/common/cursor.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';
import '@milkdown/crepe/theme/common/list-item.css';
import '@milkdown/crepe/theme/common/placeholder.css';
import '@milkdown/crepe/theme/common/toolbar.css';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const rootRef = ref<HTMLDivElement | null>(null);
let crepe: CrepeBuilder | null = null;
let ready = false;
/** Last Markdown emitted by the editor, to tell our own updates apart from external resets. */
let lastEmitted = '';

function build(root: HTMLElement): CrepeBuilder {
  const builder = new CrepeBuilder({ root, defaultValue: props.modelValue });
  builder
    .addFeature(placeholder, {
      text: 'Start writing — type / for blocks, or use Markdown like # or -',
      mode: 'doc',
    })
    .addFeature(listItem)
    .addFeature(cursor)
    .addFeature(linkTooltip)
    .addFeature(toolbar)
    .addFeature(blockEdit, {
      // Only blocks that map cleanly to Notion; no drag handles in a compact panel
      textGroup: { h4: null, h5: null, h6: null },
      advancedGroup: { image: null, table: null, math: null },
      blockHandle: { shouldShow: () => false },
    });

  builder.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      lastEmitted = markdown;
      emit('update:modelValue', markdown);
    });
  });
  return builder;
}

/** Replace the whole document, e.g. when the panel is reset for a new capture. */
function setMarkdown(markdown: string): void {
  if (!crepe || !ready) return;
  lastEmitted = markdown;
  crepe.editor.action(replaceAll(markdown, true));
}

function focus(): void {
  if (!crepe || !ready) return;
  crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
}

/** Focus with the caret at the end of the note. */
function focusEnd(): void {
  if (!crepe || !ready) return;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    view.focus();
  });
}

/** True while one of the editor's own popups (slash menu, toolbar, link editor) is open. */
function hasOpenPopup(): boolean {
  return !!rootRef.value?.querySelector(
    '.milkdown-slash-menu[data-show="true"], .milkdown-toolbar[data-show="true"], ' +
      '.milkdown-link-edit[data-show="true"], .milkdown-link-preview[data-show="true"]',
  );
}

/**
 * Escape closes the editor's popup before the panel's own Escape handler runs, so record —
 * in the capture phase, before the editor reacts — whether this Escape was meant for a popup.
 */
let escapeForPopup = false;
function onKeydownCapture(event: KeyboardEvent): void {
  if (event.key === 'Escape') escapeForPopup = hasOpenPopup();
}

/** Whether the last Escape press closed an editor popup (and so shouldn't close the panel). */
function consumeEscape(): boolean {
  const consumed = escapeForPopup;
  escapeForPopup = false;
  return consumed;
}

// External changes (form reset after saving) are pushed into the editor
watch(
  () => props.modelValue,
  (value) => {
    if (value !== lastEmitted) setMarkdown(value);
  },
);

onMounted(async () => {
  if (!rootRef.value) return;
  rootRef.value.addEventListener('keydown', onKeydownCapture, true);
  crepe = build(rootRef.value);
  const initial = props.modelValue;
  await crepe.create();
  ready = true;
  lastEmitted = initial;
  // A note restored while the editor was still starting up
  if (props.modelValue !== initial) setMarkdown(props.modelValue);
});

onBeforeUnmount(() => {
  rootRef.value?.removeEventListener('keydown', onKeydownCapture, true);
  ready = false;
  void crepe?.destroy();
  crepe = null;
});

defineExpose({ focus, focusEnd, consumeEscape });
</script>

<style scoped>
.markdown-editor {
  display: flex;
  flex: 1 0 auto;
  min-height: 160px;
}

/* ── Map Crepe's theme variables onto the app's design tokens (light + dark) ── */
.markdown-editor :deep(.milkdown) {
  --crepe-color-background: var(--color-bg);
  --crepe-color-on-background: var(--color-text);
  --crepe-color-surface: var(--color-bg);
  --crepe-color-surface-low: var(--color-surface);
  --crepe-color-on-surface: var(--color-text);
  --crepe-color-on-surface-variant: var(--color-text-muted);
  --crepe-color-outline: var(--color-text-muted);
  --crepe-color-primary: var(--color-accent);
  --crepe-color-secondary: var(--color-accent-soft);
  --crepe-color-on-secondary: var(--color-text);
  --crepe-color-inverse: var(--color-text);
  --crepe-color-on-inverse: var(--color-bg);
  --crepe-color-inline-code: #e5484d;
  --crepe-color-error: var(--color-error);
  --crepe-color-hover: var(--color-hover);
  --crepe-color-selected: var(--color-accent-soft);
  --crepe-color-inline-area: var(--color-surface-2);

  --crepe-base-font-size: var(--body-font-size);
  --crepe-font-title: var(--font-sans);
  --crepe-font-default: var(--font-sans);
  --crepe-font-code: var(--font-mono);

  --crepe-shadow-1: 0 1px 3px rgba(15, 15, 30, 0.12), 0 1px 2px rgba(15, 15, 30, 0.08);
  --crepe-shadow-2: 0 8px 24px rgba(15, 15, 30, 0.14), 0 2px 6px rgba(15, 15, 30, 0.08);

  flex: 1;
  display: flex;
  flex-direction: column;
  background: transparent;
  user-select: text;
}

.markdown-editor :deep(.milkdown .ProseMirror) {
  flex: 1;
  padding: 0;
  outline: none;
  font-size: var(--body-font-size);
  line-height: 1.65;
}

/* Crepe is designed for full-page documents; tighten its spacing for a compact panel */
.markdown-editor :deep(.milkdown .ProseMirror > *:first-child) {
  margin-top: 0;
}

.markdown-editor :deep(.milkdown .ProseMirror p) {
  margin: 2px 0;
  padding: 0;
}

.markdown-editor :deep(.milkdown .ProseMirror h1) {
  font-size: 1.6em;
  margin: 14px 0 4px;
  padding: 0;
}

.markdown-editor :deep(.milkdown .ProseMirror h2) {
  font-size: 1.35em;
  margin: 12px 0 4px;
  padding: 0;
}

.markdown-editor :deep(.milkdown .ProseMirror h3) {
  font-size: 1.15em;
  margin: 10px 0 4px;
  padding: 0;
}

/* ── Compact slash menu (Crepe's defaults are sized for full-page documents) ── */
.markdown-editor :deep(.milkdown .milkdown-slash-menu) {
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  box-shadow: var(--crepe-shadow-2);
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .tab-group) {
  padding: 6px 6px 0;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .tab-group ul) {
  padding: 4px;
  gap: 4px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .tab-group ul li) {
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 500;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-groups) {
  padding: 0 6px 6px;
  max-height: 260px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-groups .menu-group h6) {
  padding: 8px 8px 4px;
  font-size: 10.5px;
  letter-spacing: 0.6px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-groups .menu-group li) {
  min-width: 200px;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-groups .menu-group li svg) {
  width: 18px;
  height: 18px;
}

.markdown-editor :deep(.milkdown .milkdown-slash-menu .menu-groups .menu-group li > span) {
  font-size: 13px;
  font-weight: 500;
}

.markdown-editor :deep(.milkdown .ProseMirror :is(h1, h2, h3)) {
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.markdown-editor :deep(.milkdown .ProseMirror li) {
  margin: 0;
}

.markdown-editor :deep(.milkdown .ProseMirror pre code) {
  color: var(--color-text);
}

.markdown-editor :deep(.milkdown .ProseMirror blockquote) {
  margin: 6px 0;
}

.markdown-editor :deep(.milkdown .ProseMirror pre) {
  margin: 6px 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
</style>
