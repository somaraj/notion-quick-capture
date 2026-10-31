<template>
  <div class="dest-search" @keydown="onKeydown">
    <div class="search-field">
      <UiIcon name="search" :size="15" class="search-icon" />
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="search-input"
        placeholder="Search pages and databases…"
        spellcheck="false"
        autocomplete="off"
        @input="onInput"
      />
      <span v-if="isLoading" class="spinner" aria-label="Searching" />
    </div>

    <ul v-if="items.length > 0" class="result-list" role="listbox">
      <template v-for="({ result, heading }, index) in items" :key="result.id">
        <li v-if="heading" class="section-label" role="presentation">{{ heading }}</li>
        <li
          class="result-item"
          :class="{ active: index === activeIndex, current: result.id === currentId }"
          role="option"
          :aria-selected="index === activeIndex"
          @mouseenter="activeIndex = index"
          @mousedown.prevent="select(result)"
        >
          <span class="result-icon">
            <template v-if="result.icon">{{ result.icon }}</template>
            <UiIcon v-else :name="result.type === 'database' ? 'database' : 'page'" :size="15" />
          </span>
          <span class="result-title">{{ result.title || 'Untitled' }}</span>
          <span class="result-type">{{ result.type === 'database' ? 'Database' : 'Page' }}</span>
          <UiIcon v-if="result.id === currentId" name="check" :size="14" class="result-check" />
        </li>
      </template>
    </ul>

    <div v-else-if="!isLoading && hasSearched" class="empty-state">
      <p class="empty-title">
        {{ query.trim() ? `No pages match “${query.trim()}”` : 'No pages shared yet' }}
      </p>
      <p class="empty-hint">
        Notion only shows pages connected to your integration. In Notion, open a page →
        <strong>⋯ → Connections</strong> → add your integration.
      </p>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import UiIcon from './UiIcon.vue';
import { getRecentDestinations } from '../lib/recentDestinations';
import type { DestinationRef, SearchResult } from '../../shared/types';

const props = defineProps<{
  currentId?: string | null;
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  select: [destination: DestinationRef];
  cancel: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const query = ref('');
const results = ref<SearchResult[]>([]);
const isLoading = ref(false);
const hasSearched = ref(false);
const errorMessage = ref<string | null>(null);
const activeIndex = ref(0);

const recents = ref<SearchResult[]>([]);

/**
 * Rows to show. With an empty query, recently used destinations come first (they may include
 * pages Notion's search would rank lower), followed by everything else that's shared.
 */
const items = computed<Array<{ result: SearchResult; heading: string | null }>>(() => {
  if (query.value.trim() || recents.value.length === 0) {
    return results.value.map((result) => ({ result, heading: null }));
  }
  const recentIds = new Set(recents.value.map((r) => r.id));
  const rest = results.value.filter((r) => !recentIds.has(r.id));
  return [
    ...recents.value.map((result, i) => ({ result, heading: i === 0 ? 'Recent' : null })),
    ...rest.map((result, i) => ({ result, heading: i === 0 ? 'All pages' : null })),
  ];
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

async function runSearch(text: string): Promise<void> {
  const id = ++requestId;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const found = await window.notionBridge.notion.search(text.trim());
    if (id !== requestId) return; // a newer search started meanwhile
    results.value = found;
    activeIndex.value = 0;
  } catch {
    if (id !== requestId) return;
    results.value = [];
    errorMessage.value = 'Search failed. Check your connection and try again.';
  } finally {
    if (id === requestId) {
      isLoading.value = false;
      hasSearched.value = true;
    }
  }
}

function onInput(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void runSearch(query.value), 250);
}

function select(result: SearchResult): void {
  emit('select', { id: result.id, type: result.type, title: result.title, icon: result.icon });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, items.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const item = items.value[activeIndex.value];
    if (item) select(item.result);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('cancel');
  }
}

onMounted(async () => {
  if (props.autofocus) inputRef.value?.focus();
  recents.value = await getRecentDestinations();
  // An empty query lists the pages shared with the integration, most recently edited first
  void runSearch('');
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
.dest-search {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 32px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.spinner {
  position: absolute;
  right: 10px;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-strong);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.result-list {
  list-style: none;
  max-height: 232px;
  overflow-y: auto;
  padding: 2px 0;
}

.section-label {
  padding: 8px 10px 3px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text);
}

.result-item.active {
  background: var(--color-hover);
}

.result-icon {
  width: 18px;
  display: flex;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 14px;
}

.result-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-type {
  font-size: 11px;
  color: var(--color-text-muted);
}

.result-check {
  color: var(--color-accent);
}

.empty-state {
  padding: 12px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.empty-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.error-text {
  font-size: 12px;
  color: var(--color-error);
}
</style>
