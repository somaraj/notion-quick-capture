<template>
  <div ref="controlRef" class="control-group" :class="{ 'dropdown-open': isOpen }">
    <label :for="controlId" class="control-label">
      {{ label }}
      <span v-if="required" class="required-dot">*</span>
    </label>
    <div class="select-wrapper">
      <input
        :id="controlId"
        type="text"
        class="select-input"
        :value="searchQuery"
        :placeholder="modelValue || 'Select option...'"
        @input="onSearchInput"
        @focus="isOpen = true"
        @keydown="onKeydown"
      />
      <button v-if="modelValue" class="select-clear" @click="clear">×</button>
    </div>
    <div v-if="isOpen && filteredOptions.length > 0" class="select-dropdown" @mousedown.prevent>
      <div
        v-for="(option, index) in filteredOptions"
        :key="option.id"
        class="select-option"
        :class="{ highlighted: index === highlightedIndex }"
        @click="selectOption(option.name)"
        @mouseenter="highlightedIndex = index"
      >
        <span class="option-dot" :style="{ backgroundColor: getColor(option.color) }" />
        {{ option.name }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { SelectOption } from '../../../shared/types';

const props = defineProps<{
  label: string;
  modelValue: string | null;
  options: SelectOption[];
  required?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const controlRef = ref<HTMLElement | null>(null);
const controlId = computed(() => `select-${props.label.toLowerCase().replace(/\s+/g, '-')}`);
const searchQuery = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(0);

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options;
  const query = searchQuery.value.toLowerCase();
  return props.options.filter((o) => o.name.toLowerCase().includes(query));
});

const colorMap: Record<string, string> = {
  default: '#505050',
  gray: '#787774',
  brown: '#9F6B53',
  orange: '#D9730D',
  yellow: '#CB912F',
  green: '#448361',
  blue: '#337EA9',
  purple: '#9065B0',
  pink: '#C14C8A',
  red: '#D44C47',
};

function getColor(color: string): string {
  return colorMap[color] ?? colorMap['default'] ?? '#505050';
}

function onSearchInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  searchQuery.value = target.value;
  highlightedIndex.value = 0;
  isOpen.value = true;
}

function selectOption(name: string): void {
  emit('update:modelValue', name);
  searchQuery.value = '';
  isOpen.value = false;
}

function clear(): void {
  emit('update:modelValue', null);
  searchQuery.value = '';
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const option = filteredOptions.value[highlightedIndex.value];
    if (option) selectOption(option.name);
  } else if (event.key === 'Escape') {
    isOpen.value = false;
  }
}

function onClickOutside(event: MouseEvent): void {
  if (controlRef.value && !controlRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside);
});
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

.required-dot {
  color: var(--color-error);
  margin-left: 2px;
}

.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-input {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 8px 12px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.select-input:focus {
  border-color: var(--color-accent);
}

.select-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
}

.select-clear:hover {
  color: var(--color-text);
}

.select-dropdown {
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

.select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
  transition: background-color 0.1s ease;
}

.select-option.highlighted {
  background: var(--color-accent);
  color: white;
}

.option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
