<template>
  <div ref="controlRef" class="control-group" :class="{ 'dropdown-open': isOpen }">
    <label class="control-label">{{ label }}</label>
    <div class="select-wrapper">
      <button class="select-trigger" @click="isOpen = !isOpen">
        <span v-if="modelValue" class="selected-status" :style="getSelectedStyle()">
          {{ modelValue }}
        </span>
        <span v-else class="placeholder">Select status...</span>
        <span class="chevron">▾</span>
      </button>
    </div>
    <div v-if="isOpen" class="status-dropdown" @mousedown.prevent>
      <template v-if="groups.length > 0">
        <div v-for="group in groups" :key="group.id" class="dropdown-group">
          <div class="group-label">{{ group.name }}</div>
          <div
            v-for="option in getGroupOptions(group)"
            :key="option.id"
            class="dropdown-item"
            :class="{ active: modelValue === option.name }"
            @click="selectOption(option.name)"
          >
            <span class="option-dot" :style="{ backgroundColor: getColor(option.color) }" />
            {{ option.name }}
          </div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="option in options"
          :key="option.id"
          class="dropdown-item"
          :class="{ active: modelValue === option.name }"
          @click="selectOption(option.name)"
        >
          <span class="option-dot" :style="{ backgroundColor: getColor(option.color) }" />
          {{ option.name }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { SelectOption, StatusGroup } from '../../../shared/types';

const props = defineProps<{
  label: string;
  modelValue: string;
  options: SelectOption[];
  groups?: StatusGroup[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const controlRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const groups = props.groups ?? [];

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

function getGroupOptions(group: StatusGroup): SelectOption[] {
  const idSet = new Set(group.optionIds);
  return props.options.filter((o) => idSet.has(o.id));
}

function getSelectedStyle(): Record<string, string> {
  const option = props.options.find((o) => o.name === props.modelValue);
  const color = getColor(option?.color ?? 'default');
  return {
    backgroundColor: color + '18',
    color: color,
    borderColor: color + '44',
  };
}

function selectOption(name: string): void {
  emit('update:modelValue', name);
  isOpen.value = false;
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

.select-wrapper {
  position: relative;
}

.select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text);
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.select-trigger:hover {
  border-color: var(--color-accent);
}

.selected-status {
  padding: 1px 8px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 500;
}

.placeholder {
  color: var(--color-text-muted);
}
.chevron {
  font-size: 12px;
  color: var(--color-text-muted);
}

.status-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.dropdown-group {
  padding: 4px 0;
}
.dropdown-group + .dropdown-group {
  border-top: 1px solid var(--color-border);
}

.group-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 12px 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
  transition: background-color 0.1s ease;
}

.dropdown-item:hover {
  background: var(--color-surface-2);
}
.dropdown-item.active {
  background: var(--color-accent);
  color: white;
}
.dropdown-item.active .option-dot {
  border: 1px solid white;
}

.option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
