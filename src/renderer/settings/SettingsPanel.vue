<template>
  <div class="settings-shell">
    <nav class="sidebar">
      <div
        class="nav-list"
        role="tablist"
        aria-orientation="vertical"
        aria-label="Settings sections"
        @keydown="onNavKeydown"
      >
        <button
          v-for="page in PAGES"
          :id="`tab-${page.id}`"
          :key="page.id"
          :ref="(el) => (tabRefs[page.id] = el as HTMLButtonElement)"
          class="nav-item"
          :class="{ active: activePage === page.id }"
          role="tab"
          :aria-selected="activePage === page.id"
          :aria-controls="`page-${page.id}`"
          :tabindex="activePage === page.id ? 0 : -1"
          @click="goTo(page.id)"
        >
          <UiIcon :name="page.icon" :size="15" />
          {{ page.label }}
        </button>
      </div>

      <div class="sidebar-footer">
        <span class="saved" :class="{ visible: showSaved }" aria-live="polite">
          <UiIcon name="check" :size="12" /> Saved
        </span>
        <button class="about-link" @click="openAbout">About · v{{ appVersion }}</button>
      </div>
    </nav>

    <main
      :id="`page-${activePage}`"
      class="page"
      role="tabpanel"
      :aria-labelledby="`tab-${activePage}`"
    >
      <component :is="current.component" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { SettingsPage } from '../../shared/types';
import UiIcon from '../components/UiIcon.vue';
import GeneralPage from './pages/GeneralPage.vue';
import AppearancePage from './pages/AppearancePage.vue';
import ShortcutsPage from './pages/ShortcutsPage.vue';
import UpdatesPage from './pages/UpdatesPage.vue';
import AdvancedPage from './pages/AdvancedPage.vue';
import { loadSettings, savedAt } from './useSettings';

const PAGES = [
  { id: 'general', label: 'General', icon: 'settings', component: GeneralPage },
  { id: 'appearance', label: 'Appearance', icon: 'palette', component: AppearancePage },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard', component: ShortcutsPage },
  { id: 'updates', label: 'Updates', icon: 'download', component: UpdatesPage },
  { id: 'advanced', label: 'Advanced', icon: 'sliders', component: AdvancedPage },
] as const satisfies ReadonlyArray<{
  id: SettingsPage;
  label: string;
  icon: string;
  component: unknown;
}>;

const LAST_PAGE_KEY = 'settings:lastPage';
const appVersion = __APP_VERSION__;

const activePage = ref<SettingsPage>(initialPage());
const tabRefs: Partial<Record<SettingsPage, HTMLButtonElement>> = {};
const current = computed(() => PAGES.find((p) => p.id === activePage.value) ?? PAGES[0]);

function isPage(value: string | null): value is SettingsPage {
  return PAGES.some((p) => p.id === value);
}

// A deep link (#shortcuts) wins over the last page the user had open
function initialPage(): SettingsPage {
  const fromHash = location.hash.slice(1);
  if (isPage(fromHash)) return fromHash;
  try {
    const last = localStorage.getItem(LAST_PAGE_KEY);
    if (isPage(last)) return last;
  } catch {
    // Storage unavailable — fall through to default
  }
  return 'general';
}

function goTo(page: SettingsPage, focus = false): void {
  activePage.value = page;
  if (focus) tabRefs[page]?.focus();
}

watch(activePage, (page) => {
  try {
    localStorage.setItem(LAST_PAGE_KEY, page);
  } catch {
    // Not critical
  }
});

function step(delta: number): void {
  const i = PAGES.findIndex((p) => p.id === activePage.value);
  goTo(PAGES[(i + delta + PAGES.length) % PAGES.length]!.id, true);
}

function onNavKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') step(1);
  else if (event.key === 'ArrowUp') step(-1);
  else if (event.key === 'Home') goTo(PAGES[0].id, true);
  else if (event.key === 'End') goTo(PAGES[PAGES.length - 1]!.id, true);
  else return;
  event.preventDefault();
}

// Ctrl+Tab / Ctrl+Shift+Tab cycles pages from anywhere in the window
function onWindowKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey && event.key === 'Tab') {
    event.preventDefault();
    step(event.shiftKey ? -1 : 1);
  }
}

function onHashChange(): void {
  const page = location.hash.slice(1);
  if (isPage(page)) activePage.value = page;
}

// Brief "Saved" confirmation after each change
const showSaved = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | undefined;
watch(savedAt, () => {
  showSaved.value = true;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (showSaved.value = false), 1500);
});

function openAbout(): void {
  window.notionBridge.window.openAbout();
}

onMounted(() => {
  void loadSettings();
  window.addEventListener('keydown', onWindowKeydown);
  window.addEventListener('hashchange', onHashChange);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown);
  window.removeEventListener('hashchange', onHashChange);
  clearTimeout(savedTimer);
});
</script>

<style scoped>
.settings-shell {
  display: flex;
  height: 100vh;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
}

/* ── Sidebar ── */
.sidebar {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 10px 12px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.nav-item:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.nav-item.active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 10px;
}

.saved {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-success);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.saved.visible {
  opacity: 1;
}

.about-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: left;
  cursor: pointer;
}

.about-link:hover {
  color: var(--color-accent);
}

/* ── Page ── */
.page {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 28px 28px;
}
</style>
