<template>
  <div ref="controlRef" class="control-group" :class="{ 'dropdown-open': isOpen }">
    <label class="control-label">
      {{ label }}
      <span v-if="required" class="required-dot">*</span>
    </label>
    <div class="multi-select-container">
      <div class="selected-tags">
        <span
          v-for="tag in modelValue"
          :key="tag"
          class="tag-pill"
          :style="{ backgroundColor: getTagColor(tag) }"
        >
          {{ tag }}
          <button class="tag-remove" @click="removeTag(tag)">×</button>
        </span>
      </div>
      <input
        type="text"
        class="tag-input"
        :value="inputValue"
        placeholder="Add tag..."
        @input="onInput"
        @keydown="onKeydown"
        @focus="isOpen = true"
      />
    </div>
    <div v-if="isOpen && filteredOptions.length > 0" class="dropdown" @mousedown.prevent>
      <div
        v-for="(option, index) in filteredOptions"
        :key="option.id"
        class="dropdown-item"
        :class="{ highlighted: index === highlightedIndex }"
        @click="addTag(option.name)"
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
  modelValue: string[];
  options: SelectOption[];
  required?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const controlRef = ref<HTMLElement | null>(null);
const inputValue = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(0);

const filteredOptions = computed(() => {
  const selected = new Set(props.modelValue);
  let opts = props.options.filter((o) => !selected.has(o.name));
  if (inputValue.value) {
    const query = inputValue.value.toLowerCase();
    opts = opts.filter((o) => o.name.toLowerCase().includes(query));
  }
  return opts;
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
  return colorMap[color] ?? '#505050';
}

function getTagColor(name: string): string {
  const option = props.options.find((o) => o.name === name);
  const color = option?.color ?? 'default';
  return getColor(color) + '33'; // Semi-transparent
}

function onInput(event: Event): void {
  inputValue.value = (event.target as HTMLInputElement).value;
  highlightedIndex.value = 0;
  isOpen.value = true;
}

function addTag(name: string): void {
  if (!props.modelValue.includes(name)) {
    emit('update:modelValue', [...props.modelValue, name]);
  }
  inputValue.value = '';
  isOpen.value = false;
}

function removeTag(name: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== name),
  );
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    const option = filteredOptions.value[highlightedIndex.value];
    if (option) {
      addTag(option.name);
    } else if (inputValue.value.trim()) {
      // Create new tag
      addTag(inputValue.value.trim());
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (event.key === 'Backspace' && !inputValue.value && props.modelValue.length > 0) {
    removeTag(props.modelValue[props.modelValue.length - 1]!);
  } else if (event.key === 'Escape') {
    isOpen.value = false;
  }
}

function onClickOutside(event: MouseEvent): void {
  if (controlRef.value && !controlRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
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
.required-dot {
  color: var(--color-error);
  margin-left: 2px;
}

.multi-select-container {
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

.multi-select-container:focus-within {
  border-color: var(--color-accent);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text);
  font-weight: 500;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.tag-remove:hover {
  color: var(--color-text);
}

.tag-input {
  background: none;
  border: none;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 4px;
  outline: none;
  flex: 1;
  min-width: 80px;
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

.option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
