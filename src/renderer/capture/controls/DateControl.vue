<template>
  <div class="control-group">
    <label :for="controlId" class="control-label">{{ label }}</label>
    <div class="date-inputs">
      <input
        :id="controlId"
        type="date"
        class="control-input date-input"
        :value="startDate"
        @input="onStartInput"
      />
      <label class="time-toggle">
        <input type="checkbox" :checked="includeTime" @change="onTimeToggle" />
        <span>Time</span>
      </label>
      <input
        v-if="includeTime"
        type="time"
        class="control-input time-input"
        :value="startTime"
        @input="onStartTimeInput"
      />
    </div>
    <div v-if="showEnd" class="date-inputs end-date">
      <span class="end-label">→</span>
      <input type="date" class="control-input date-input" :value="endDate" @input="onEndInput" />
      <input
        v-if="includeTime"
        type="time"
        class="control-input time-input"
        :value="endTime"
        @input="onEndTimeInput"
      />
    </div>
    <button class="toggle-end-btn" @click="showEnd = !showEnd">
      {{ showEnd ? 'Remove end date' : '+ Add end date' }}
    </button>
    <span v-if="error" class="control-error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  label: string;
  start: string;
  end?: string;
  includeTime: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  'update:start': [value: string];
  'update:end': [value: string | undefined];
  'update:includeTime': [value: boolean];
}>();

const controlId = computed(() => `date-${props.label.toLowerCase().replace(/\s+/g, '-')}`);
const showEnd = ref(!!props.end);

const startDate = computed(() => (props.start ? (props.start.split('T')[0] ?? '') : ''));
const startTime = computed(() =>
  props.start?.includes('T') ? (props.start.split('T')[1]?.slice(0, 5) ?? '') : '',
);
const endDate = computed(() => (props.end ? (props.end.split('T')[0] ?? '') : ''));
const endTime = computed(() =>
  props.end?.includes('T') ? (props.end.split('T')[1]?.slice(0, 5) ?? '') : '',
);

function buildDateTime(date: string, time?: string): string {
  if (props.includeTime && time) {
    return `${date}T${time}:00`;
  }
  return date;
}

function onStartInput(event: Event): void {
  const date = (event.target as HTMLInputElement).value;
  emit('update:start', buildDateTime(date, startTime.value));
}

function onStartTimeInput(event: Event): void {
  const time = (event.target as HTMLInputElement).value;
  emit('update:start', buildDateTime(startDate.value, time));
}

function onEndInput(event: Event): void {
  const date = (event.target as HTMLInputElement).value;
  emit('update:end', buildDateTime(date, endTime.value));
}

function onEndTimeInput(event: Event): void {
  const time = (event.target as HTMLInputElement).value;
  emit('update:end', buildDateTime(endDate.value, time));
}

function onTimeToggle(): void {
  emit('update:includeTime', !props.includeTime);
}

watch(showEnd, (val) => {
  if (!val) emit('update:end', undefined);
});
</script>

<style scoped>
.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.control-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.date-input {
  flex: 1;
}
.time-input {
  width: 120px;
}

.control-input {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.control-input:focus {
  border-color: var(--color-accent);
}

.time-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.time-toggle input {
  cursor: pointer;
}

.end-date {
  margin-top: 4px;
}
.end-label {
  color: var(--color-text-muted);
  font-size: 14px;
}

.toggle-end-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;
}

.toggle-end-btn:hover {
  color: var(--color-accent-hover);
}
.control-error {
  font-size: 11px;
  color: var(--color-error);
}
</style>
