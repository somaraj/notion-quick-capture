<template>
  <div class="control-group">
    <label :for="controlId" class="control-label">
      {{ label }}
      <span v-if="required" class="required-dot">*</span>
    </label>
    <input
      :id="controlId"
      type="number"
      class="control-input"
      :value="modelValue"
      :step="step"
      :placeholder="placeholder"
      @input="onInput"
    />
    <span v-if="formatHint" class="format-hint">{{ formatHint }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  modelValue: number | null;
  numberFormat?: string;
  required?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
}>();

const controlId = computed(() => `number-${props.label.toLowerCase().replace(/\s+/g, '-')}`);

const step = computed(() => {
  if (props.numberFormat === 'percent') return 0.01;
  if (props.numberFormat === 'dollar' || props.numberFormat === 'euro') return 0.01;
  return 1;
});

const formatHint = computed(() => {
  const hints: Record<string, string> = {
    percent: 'Percentage',
    dollar: 'Dollar ($)',
    euro: 'Euro (€)',
    pound: 'Pound (£)',
    yen: 'Yen (¥)',
    number: 'Number',
    number_with_commas: 'Number with commas',
  };
  return props.numberFormat ? (hints[props.numberFormat] ?? '') : '';
});

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value ? Number(value) : null);
}
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
.required-dot {
  color: var(--color-error);
  margin-left: 2px;
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
  width: 100%;
  box-sizing: border-box;
}

.control-input:focus {
  border-color: var(--color-accent);
}

.format-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Hide number input spinners */
.control-input[type='number']::-webkit-inner-spin-button,
.control-input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
