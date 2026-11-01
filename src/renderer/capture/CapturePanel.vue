<template>
  <div class="capture-panel" :class="{ visible: isVisible }">
    <!-- ── Sign-in ─────────────────────────────────────────────── -->
    <div v-if="store.activeView === 'auth'" class="auth-screen">
      <div class="drag-bar">
        <button class="icon-btn" title="Close (Esc)" @click="closePanel">
          <UiIcon name="close" />
        </button>
      </div>
      <div class="auth-content">
        <img class="auth-icon" :src="appIcon" alt="" width="56" height="56" />
        <h2 class="auth-title">Connect to Notion</h2>
        <p class="auth-subtitle">Capture notes from anywhere with one shortcut.</p>

        <ol class="auth-steps">
          <li>
            Create an internal integration at
            <a href="#" @click.prevent="openIntegrations">notion.so/profile/integrations</a>
          </li>
          <li>
            In Notion, open a page or database → <strong>⋯ → Connections</strong> → add the
            integration
          </li>
          <li>Paste the integration secret below</li>
        </ol>
        <p class="auth-guide">
          First time?
          <a href="#" @click.prevent="openExternal(SETUP_GUIDE_URL)">
            Follow the step-by-step guide
          </a>
        </p>

        <form class="token-form" @submit.prevent="saveToken">
          <input
            v-model="tokenInput"
            type="password"
            class="text-input mono"
            placeholder="ntn_… or secret_…"
            autocomplete="off"
            spellcheck="false"
          />
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="!tokenInput.trim() || isConnecting"
          >
            {{ isConnecting ? 'Connecting…' : 'Connect' }}
          </button>
        </form>

        <template v-if="oauthAvailable">
          <div class="auth-divider"><span>or</span></div>
          <button class="btn btn-secondary" :disabled="isConnecting" @click="startOAuth">
            Sign in with Notion
          </button>
        </template>

        <p v-if="store.errorMessage" class="banner banner-error">
          <UiIcon name="alert" :size="15" />
          <span>
            {{ store.errorMessage }}
            <a href="#" @click.prevent="openExternal(SETUP_GUIDE_TROUBLESHOOTING_URL)">
              Troubleshooting
            </a>
          </span>
        </p>

        <p class="auth-note">
          Your token is encrypted with your OS keychain and is only ever sent to the Notion API.
        </p>
      </div>
    </div>

    <!-- ── Capture ─────────────────────────────────────────────── -->
    <div v-else class="capture-wrapper">
      <header class="panel-header">
        <div class="dest-anchor">
          <button
            class="dest-chip"
            :class="{ open: isPickerOpen, empty: !store.selectedDestination }"
            :title="store.selectedDestination ? 'Change destination for this note' : ''"
            @click="togglePicker"
          >
            <span class="dest-chip-icon">
              <template v-if="store.selectedDestination?.icon">{{
                store.selectedDestination.icon
              }}</template>
              <UiIcon v-else :name="store.isDatabase ? 'database' : 'page'" :size="15" />
            </span>
            <span class="dest-chip-title">
              {{ store.selectedDestination?.title || 'Choose a destination' }}
            </span>
            <UiIcon name="chevron-down" :size="14" class="dest-chip-chevron" />
          </button>

          <div v-if="isPickerOpen" class="dest-popover">
            <DestinationSearch
              :current-id="store.selectedDestination?.id"
              autofocus
              @select="chooseDestination"
              @cancel="isPickerOpen = false"
            />
          </div>
        </div>

        <div class="header-actions">
          <button class="icon-btn" title="Settings" @click="openSettings">
            <UiIcon name="settings" />
          </button>
          <button class="icon-btn" title="Close (Esc)" @click="closePanel">
            <UiIcon name="close" />
          </button>
        </div>
      </header>

      <div v-if="isPickerOpen" class="picker-scrim" @mousedown="isPickerOpen = false" />

      <main class="capture-body" @mousedown="onBodyMousedown">
        <div v-if="!store.selectedDestination" class="empty-dest">
          <p class="empty-dest-title">Where should notes go?</p>
          <p class="empty-dest-text">Pick a page or database. You can set a default in Settings.</p>
          <button class="btn btn-primary" @click="isPickerOpen = true">Choose destination</button>
        </div>

        <template v-else>
          <input
            ref="titleRef"
            v-model="titleModel"
            type="text"
            class="title-input"
            placeholder="Untitled"
            aria-label="Title"
            spellcheck="true"
            @keydown.enter.exact.prevent="focusEditor"
          />

          <PropertyForm
            v-if="store.isDatabase"
            class="property-form"
            :schema="store.currentSchema"
            :is-loading="store.isSchemaLoading"
          />

          <MarkdownEditor
            ref="editorRef"
            :model-value="store.body"
            @update:model-value="(v) => (store.body = v)"
          />
        </template>
      </main>

      <footer class="panel-footer" @mouseenter="cancelAutoClose">
        <Transition name="fade" mode="out-in">
          <p v-if="store.errorMessage" key="error" class="status status-error">
            <UiIcon name="alert" :size="15" />
            <span class="status-text">{{ store.errorMessage }}</span>
            <button class="link-btn" @click="store.clearError()">Dismiss</button>
          </p>
          <p v-else-if="notice?.kind === 'queued'" key="queued" class="status status-warn">
            <UiIcon name="cloud-off" :size="15" />
            <span class="status-text">Saved offline — it will sync automatically</span>
          </p>
          <p v-else-if="notice?.kind === 'saved'" key="saved" class="status status-success">
            <UiIcon name="check" :size="15" />
            <span class="status-text">Saved to {{ notice.title }}</span>
            <button v-if="notice.url" class="link-btn" @click="openSavedPage(notice.url)">
              Open in Notion
            </button>
          </p>
          <p v-else-if="notice?.kind === 'discarded'" key="discarded" class="status">
            <span class="status-text">Note discarded</span>
            <button class="link-btn" @click="undoDiscard">Undo</button>
          </p>
          <p v-else key="hints" class="status hints">
            <button
              v-if="pendingCount > 0"
              class="pending-chip"
              :title="`${pendingCount} capture${pendingCount === 1 ? '' : 's'} waiting to sync — click to retry now`"
              @click="syncPending"
            >
              <UiIcon name="cloud-off" :size="13" />
              {{ pendingCount }} pending
            </button>
            <span><kbd>Esc</kbd> close</span>
            <span><kbd>/</kbd> blocks</span>
            <span
              ><kbd>{{ modKey }} K</kbd> destination</span
            >
          </p>
        </Transition>

        <div class="footer-actions">
          <button
            v-if="noteHasContent && !store.isCapturing && !notice"
            class="btn btn-ghost"
            title="Clear this note"
            @click="discardNote"
          >
            Discard
          </button>
          <button
            class="btn btn-primary save-btn"
            :disabled="!store.canSubmit"
            @click="handleCapture"
          >
            <span v-if="store.isCapturing" class="spinner" aria-label="Saving" />
            <template v-else>
              Save
              <span class="save-kbd">{{ modKey }} ↵</span>
            </template>
          </button>
        </div>
      </footer>

      <div
        class="resize-grip"
        title="Drag to resize"
        @pointerdown="startResize"
        @pointermove="onResize"
        @pointerup="endResize"
        @pointercancel="endResize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue';
import { useUiStore } from '../store/uiStore';
import { useNotion } from '../composables/useNotion';
import { useSchema } from '../composables/useSchema';
import { useEditorHotkeys, useHotkey } from '../composables/useHotkey';
import {
  clearUnsavedNote,
  hasContent,
  loadUnsavedNote,
  saveUnsavedNote,
  type UnsavedNote,
} from '../lib/unsavedNote';
import { rememberDestination } from '../lib/recentDestinations';
import { initAppearance } from '../lib/theme';
import PropertyForm from './PropertyForm.vue';
import MarkdownEditor from './MarkdownEditor.vue';
import UiIcon from '../components/UiIcon.vue';
import DestinationSearch from '../components/DestinationSearch.vue';
import appIcon from '../../../build/icon.png';
import type { DestinationRef, PropertyValue } from '../../shared/types';
import {
  NOTION_INTEGRATIONS_URL,
  SETUP_GUIDE_TROUBLESHOOTING_URL,
  SETUP_GUIDE_URL,
} from '../../shared/links';

const store = useUiStore();
const { capture } = useNotion();
const { fetchSchema } = useSchema();
const modKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

// How long the "Saved" confirmation shows before the panel hides itself
// (hovering the footer keeps it open, e.g. to click "Open in Notion")
const CLOSE_AFTER_SAVE_MS = 1500;
const CLOSE_AFTER_QUEUE_MS = 2000;
const UNDO_DISCARD_MS = 6000;

type Notice =
  { kind: 'saved'; title: string; url: string | null } | { kind: 'queued' } | { kind: 'discarded' };

const isVisible = ref(false);
const isPickerOpen = ref(false);
const tokenInput = ref('');
const isConnecting = ref(false);
const oauthAvailable = ref(false);
const titleRef = ref<HTMLInputElement | null>(null);
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null);
const notice = ref<Notice | null>(null);
const pendingCount = ref(0);
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let discardedNote: UnsavedNote | null = null;
/** Set while the form is changed programmatically, so those changes aren't persisted. */
let restoring = false;

// Databases store the title in their title property; pages use the plain title
const titlePropName = computed(
  () => store.currentSchema?.properties.find((p) => p.type === 'title')?.name ?? null,
);

const titleModel = computed<string>({
  get() {
    if (store.isDatabase && titlePropName.value) {
      const value = store.properties[titlePropName.value];
      return value?.type === 'title' ? value.value : '';
    }
    return store.title;
  },
  set(value) {
    if (store.isDatabase && titlePropName.value) {
      store.updateProperty(titlePropName.value, { type: 'title', value });
    }
    store.title = value;
  },
});

useEditorHotkeys({
  onSubmit: handleCapture,
  onClose: () => {
    if (editorRef.value?.consumeEscape()) return; // Esc closed the slash menu / toolbar
    if (isPickerOpen.value) isPickerOpen.value = false;
    else closePanel();
  },
});

// Ctrl/Cmd+K → switch destination
useHotkey([
  {
    key: 'k',
    ctrl: true,
    handler: () => {
      if (store.activeView === 'capture') togglePicker();
    },
  },
]);

// ── Unsaved note: kept in memory while hidden and in localStorage across restarts ──

const noteHasContent = computed(() =>
  hasContent({ title: store.title, body: store.body, properties: store.properties }),
);

function currentNote(): UnsavedNote {
  return {
    destination: store.selectedDestination,
    title: store.title,
    body: store.body,
    properties: JSON.parse(JSON.stringify(store.properties)) as Record<string, PropertyValue>,
    updatedAt: Date.now(),
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  [() => store.title, () => store.body, () => store.properties, () => store.selectedDestination],
  () => {
    if (restoring) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => saveUnsavedNote(currentNote()), 300);
  },
  { deep: true },
);

/** Put a saved note back into the form (destination first, so database properties exist). */
async function restoreNote(note: UnsavedNote): Promise<void> {
  restoring = true;
  try {
    await selectDestination(note.destination);
    store.title = note.title;
    store.body = note.body;
    const schemaProps = store.currentSchema?.properties ?? [];
    for (const [name, value] of Object.entries(note.properties)) {
      // Skip properties that were renamed or changed type since the note was written
      if (schemaProps.some((p) => p.name === name && p.type === value.type)) {
        store.updateProperty(name, value);
      }
    }
  } finally {
    restoring = false;
  }
}

/** Empty form on the default destination. */
async function startFresh(): Promise<void> {
  restoring = true;
  try {
    store.resetCapture();
    clearUnsavedNote();
    await loadDefaultDestination();
  } finally {
    restoring = false;
  }
}

function discardNote(): void {
  discardedNote = currentNote();
  void startFresh();
  showNotice({ kind: 'discarded' }, UNDO_DISCARD_MS);
}

async function undoDiscard(): Promise<void> {
  const note = discardedNote;
  discardedNote = null;
  notice.value = null;
  if (note) {
    await restoreNote(note);
    saveUnsavedNote(note);
  }
}

function showNotice(value: Notice, durationMs: number): void {
  if (noticeTimer) clearTimeout(noticeTimer);
  notice.value = value;
  noticeTimer = setTimeout(() => {
    notice.value = null;
    if (value.kind === 'discarded') discardedNote = null;
  }, durationMs);
}

function cancelAutoClose(): void {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function openSavedPage(url: string): void {
  window.notionBridge.window.openExternal(url);
  closePanel();
}

async function refreshPendingCount(): Promise<void> {
  try {
    pendingCount.value = await window.notionBridge.drafts.count();
  } catch {
    pendingCount.value = 0;
  }
}

async function syncPending(): Promise<void> {
  await window.notionBridge.drafts.syncNow();
  await refreshPendingCount();
}

// ── Resize grip (transparent frameless windows can't be resized natively) ──

let resizeStart: { x: number; y: number; width: number; height: number } | null = null;
let resizeFrame = 0;
let lastSize = { width: 0, height: 0 };

function startResize(event: PointerEvent): void {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  resizeStart = {
    x: event.screenX,
    y: event.screenY,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  lastSize = { width: 0, height: 0 };
}

function onResize(event: PointerEvent): void {
  if (!resizeStart) return;
  lastSize = {
    width: resizeStart.width + event.screenX - resizeStart.x,
    height: resizeStart.height + event.screenY - resizeStart.y,
  };
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    void window.notionBridge.window.setCaptureSize(lastSize.width, lastSize.height, false);
  });
}

function endResize(): void {
  if (!resizeStart) return;
  resizeStart = null;
  if (lastSize.width > 0) {
    void window.notionBridge.window.setCaptureSize(lastSize.width, lastSize.height, true);
  }
}

function focusEditor(): void {
  editorRef.value?.focus();
}

/** Clicks on empty space in the body (below the note) put the caret at the end of the note. */
function onBodyMousedown(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!store.selectedDestination) return;
  if (target === event.currentTarget || target.classList.contains('markdown-editor')) {
    event.preventDefault();
    editorRef.value?.focusEnd();
  }
}

function togglePicker(): void {
  isPickerOpen.value = !isPickerOpen.value;
}

/** Switch destination for this note only; the default is used again for the next note. */
async function selectDestination(dest: DestinationRef | null): Promise<void> {
  store.setDestination(dest);
  if (dest?.type === 'database') {
    await fetchSchema(dest.id);
  } else {
    store.setSchema(null);
  }
}

async function chooseDestination(dest: DestinationRef): Promise<void> {
  isPickerOpen.value = false;
  await selectDestination(dest);
  await nextTick();
  titleRef.value?.focus();
}

async function handleCapture(): Promise<void> {
  if (!store.canSubmit || store.isCapturing) return;

  const destination = store.selectedDestination;

  const result = await capture();
  if (result.status === 'error') return; // the note stays in the panel; the error is shown

  // Saved (or safely queued): the note no longer needs to be kept locally
  clearUnsavedNote();
  if (destination) void rememberDestination(destination);

  const queued = result.status === 'queued';
  const delay = queued ? CLOSE_AFTER_QUEUE_MS : CLOSE_AFTER_SAVE_MS;
  showNotice(
    queued
      ? { kind: 'queued' }
      : { kind: 'saved', title: destination?.title ?? 'Notion', url: result.pageUrl ?? null },
    delay + 500,
  );
  if (queued) void refreshPendingCount();

  await startFresh();
  cancelAutoClose();
  closeTimer = setTimeout(() => {
    closeTimer = null;
    closePanel();
  }, delay);
}

function openIntegrations(): void {
  openExternal(NOTION_INTEGRATIONS_URL);
}

function openExternal(url: string): void {
  window.notionBridge.window.openExternal(url);
}

async function startOAuth(): Promise<void> {
  isConnecting.value = true;
  try {
    const result = await window.notionBridge.auth.startOAuth();
    if (result?.success) {
      await checkAuth();
    } else if (result?.error) {
      store.showError(result.error);
    }
  } finally {
    isConnecting.value = false;
  }
}

async function saveToken(): Promise<void> {
  const token = tokenInput.value.trim();
  if (!token || isConnecting.value) return;
  isConnecting.value = true;
  try {
    const success = await window.notionBridge.auth.saveToken(token);
    if (success) {
      tokenInput.value = '';
      store.clearError();
      await checkAuth();
    } else {
      store.showError(
        'Notion did not accept that token — check it and your internet connection, then try again.',
      );
    }
  } finally {
    isConnecting.value = false;
  }
}

async function checkAuth(): Promise<void> {
  store.isAuthLoading = true;
  try {
    const status = await window.notionBridge.auth.getAuthStatus();
    store.authStatus = status;
    store.activeView = status.authenticated ? 'capture' : 'auth';
  } catch {
    store.activeView = 'auth';
  } finally {
    store.isAuthLoading = false;
  }
}

function closePanel(): void {
  isPickerOpen.value = false;
  window.notionBridge.window.close();
}

function openSettings(): void {
  window.notionBridge.window.openSettings();
}

async function loadDefaultDestination(): Promise<void> {
  try {
    await selectDestination(await window.notionBridge.config.get('defaultDestination'));
  } catch {
    // Ignore config error
  }
}

/** Called each time the panel is shown: keep an unfinished note, otherwise start fresh. */
async function onPanelShown(): Promise<void> {
  isPickerOpen.value = false;
  cancelAutoClose();
  if (notice.value?.kind !== 'discarded') notice.value = null;
  void refreshPendingCount();
  if (!noteHasContent.value) {
    await loadDefaultDestination(); // picks up a default changed in Settings meanwhile
  }
  await nextTick();
  focusForWriting();
}

/** Title first for a new note; the end of the text when continuing one. */
function focusForWriting(): void {
  if (!titleModel.value.trim() && !store.body.trim()) titleRef.value?.focus();
  else editorRef.value?.focusEnd();
}

onMounted(async () => {
  await checkAuth();

  try {
    oauthAvailable.value = (await window.notionBridge.auth.getCapabilities()).oauthAvailable;
  } catch {
    oauthAvailable.value = false;
  }

  // Connected / disconnected from the settings window
  window.notionBridge.on.authChanged(() => {
    void checkAuth();
  });

  await initAppearance();

  // Continue an unfinished note from a previous session, otherwise start on the default destination
  const saved = loadUnsavedNote();
  if (saved && hasContent(saved)) {
    await restoreNote(saved);
  } else {
    await loadDefaultDestination();
  }

  void refreshPendingCount();
  window.notionBridge.on.draftCountChanged((count) => {
    pendingCount.value = count;
  });

  // Live config changes from the settings window
  window.notionBridge.on.configChanged((key, value) => {
    switch (key) {
      case 'defaultDestination':
        // Keep an unfinished note where it is; the new default applies to the next note
        if (!noteHasContent.value) void selectDestination(value as DestinationRef | null);
        break;
    }
  });

  // The main process sends this every time the panel is shown
  window.notionBridge.on.captureReset(() => void onPanelShown());

  await nextTick();
  isVisible.value = true;
  focusForWriting();
});
</script>

<style scoped>
/* The window is transparent and frameless; this element is the visible panel */
.capture-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: 12px;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-6px) scale(0.995);
  transition:
    opacity 0.14s ease-out,
    transform 0.14s ease-out;
}

.capture-panel.visible {
  opacity: 1;
  transform: none;
}

.capture-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}

/* ── Header ── */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 6px 14px;
  -webkit-app-region: drag;
  position: relative;
  z-index: 20;
}

.dest-anchor {
  position: relative;
  min-width: 0;
  -webkit-app-region: no-drag;
}

.dest-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.dest-chip:hover,
.dest-chip.open {
  background: var(--color-hover);
  color: var(--color-text);
}

.dest-chip.empty {
  color: var(--color-accent);
}

.dest-chip-icon {
  display: flex;
  font-size: 14px;
}

.dest-chip-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dest-chip-chevron {
  opacity: 0.7;
}

.dest-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 360px;
  padding: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  box-shadow:
    0 12px 32px rgba(15, 15, 30, 0.14),
    0 2px 6px rgba(15, 15, 30, 0.08);
  animation: pop-in 0.12s ease-out;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.picker-scrim {
  position: absolute;
  inset: 0;
  z-index: 10;
}

.header-actions {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.icon-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

/* ── Body ── */
.capture-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 6px 22px 16px;
  overflow-y: auto;
}

.title-input {
  width: 100%;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  outline: none;
  user-select: text;
}

.title-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.45;
}

.property-form {
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--color-border);
}

.empty-dest {
  margin: auto;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.empty-dest-title {
  font-size: 16px;
  font-weight: 600;
}

.empty-dest-text {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

/* ── Footer ── */
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 10px 18px;
  border-top: 1px solid var(--color-border);
}

.status {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-size: 12px;
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-error {
  color: var(--color-error);
}

.status-success {
  color: var(--color-success);
  font-weight: 500;
}

.status-warn {
  color: var(--color-warning);
}

.hints {
  gap: 14px;
  color: var(--color-text-muted);
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  margin-right: 3px;
  border: 1px solid var(--color-border-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--font-sans);
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.link-btn {
  flex-shrink: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 500;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-hover);
  color: var(--color-text);
}

.pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
}

.pending-chip:hover {
  background: rgba(245, 158, 11, 0.18);
}

/* Bottom-right resize grip */
.resize-grip {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  -webkit-app-region: no-drag;
  background: linear-gradient(
    135deg,
    transparent 0 55%,
    var(--color-border-strong) 55% 62%,
    transparent 62% 75%,
    var(--color-border-strong) 75% 82%,
    transparent 82%
  );
  opacity: 0.8;
}

.resize-grip:hover {
  opacity: 1;
}

.save-btn {
  flex-shrink: 0;
  min-width: 96px;
  gap: 8px;
}

.save-kbd {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.75;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Buttons & inputs ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 14px;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.12s ease,
    opacity 0.12s ease;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-hover);
}

.text-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
  outline: none;
  user-select: text;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.text-input.mono {
  font-family: var(--font-mono);
}

.text-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Sign-in ── */
.auth-screen {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.drag-bar {
  display: flex;
  justify-content: flex-end;
  padding: 10px 10px 0;
  -webkit-app-region: drag;
}

.drag-bar .icon-btn {
  -webkit-app-region: no-drag;
}

.auth-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 40px 32px;
  text-align: center;
  overflow-y: auto;
}

.auth-icon {
  width: 56px;
  height: 56px;
}

.auth-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.auth-subtitle {
  margin-top: -8px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.auth-steps {
  width: 100%;
  padding: 12px 14px 12px 32px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--color-text-muted);
}

.auth-steps a {
  color: var(--color-accent);
}

.auth-steps strong {
  color: var(--color-text);
  font-weight: 600;
}

.token-form {
  display: flex;
  gap: 8px;
  width: 100%;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  font-size: 12px;
  color: var(--color-text-muted);
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  text-align: left;
}

.banner-error {
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-error);
}

.banner-error a {
  color: inherit;
  font-weight: 600;
}

.auth-guide {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.auth-guide a {
  color: var(--color-accent);
}

.auth-note {
  font-size: 11.5px;
  color: var(--color-text-muted);
}
</style>
