<template>
  <div ref="controlRef" class="control-group" :class="{ 'dropdown-open': isOpen }">
    <label class="control-label">{{ label }}</label>
    <div class="relation-container">
      <div v-for="pageId in modelValue" :key="pageId" class="relation-chip">
        <span>📄 {{ getPageTitle(pageId) }}</span>
        <button class="chip-remove" @click="removePage(pageId)">×</button>
      </div>
      <input
        type="text"
        class="relation-input"
        :value="searchQuery"
        placeholder="Search pages..."
        @input="onSearch"
        @focus="isOpen = true"
        @keydown="onKeydown"
      />
    </div>
    <div v-if="isOpen && searchResults.length > 0" class="dropdown" @mousedown.prevent>
      <div
        v-for="(result, index) in searchResults"
        :key="result.id"
        class="dropdown-item"
        :class="{ highlighted: index === highlightedIndex }"
        @click="addPage(result)"
        @mouseenter="highlightedIndex = index"
      >
        <span>{{ result.icon ?? '📄' }}</span>
        <span>{{ result.title }}</span>
      </div>
    </div>
    <div v-if="isOpen && isSearching" class="dropdown">
      <div class="dropdown-loading">Searching...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { SearchResult } from '../../../shared/types';

const props = defineProps<{
  label: string;
  modelValue: string[];
  databaseId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const controlRef = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const searchResults = ref<SearchResult[]>([]);
const isOpen = ref(false);
const isSearching = ref(false);
const highlightedIndex = ref(0);
const pageTitles = ref<Map<string, string>>(new Map());
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function getPageTitle(pageId: string): string {
  return pageTitles.value.get(pageId) ?? pageId.slice(0, 8) + '...';
}

function onSearch(event: Event): void {
  const query = (event.target as HTMLInputElement).value;
  searchQuery.value = query;
  highlightedIndex.value = 0;

  if (debounceTimer) clearTimeout(debounceTimer);

  if (!query.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      // Search via the bridge
      const results = await window.notionBridge.notion.search(query);
      // Filter to only pages
      searchResults.value = results.filter(
        (r) => r.type === 'page' && !props.modelValue.includes(r.id),
      );
    } catch {
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  }, 300);
}

function addPage(result: SearchResult): void {
  if (!props.modelValue.includes(result.id)) {
    pageTitles.value.set(result.id, result.title);
    emit('update:modelValue', [...props.modelValue, result.id]);
  }
  searchQuery.value = '';
  searchResults.value = [];
  isOpen.value = false;
}

function removePage(pageId: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((id) => id !== pageId),
  );
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    const result = searchResults.value[highlightedIndex.value];
    if (result) addPage(result);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, searchResults.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (event.key === 'Escape') {
    isOpen.value = false;
  }
}

function onClickOutside(event: MouseEvent): void {
  if (controlRef.value && !controlRef.value.contains(event.target as Node)) isOpen.value = false;
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<style scoped>
.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.control-group.dropdown-open {
  z-index: 50;
}
.control-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.relation-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  min-height: 38px;
  transition: border-color 0.15s ease;
}

.relation-container:focus-within {
  border-color: var(--color-accent);
}

.relation-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-surface-2);
  font-size: 13px;
  color: var(--color-text);
}

.chip-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.relation-input {
  background: none;
  border: none;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 4px;
  outline: none;
  flex: 1;
  min-width: 100px;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
}

.dropdown-item.highlighted {
  background: var(--color-accent);
  color: white;
}

.dropdown-loading {
  padding: 12px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
