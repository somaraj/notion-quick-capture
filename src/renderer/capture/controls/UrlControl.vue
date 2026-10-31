<template>
  <div class="control-group">
    <label :for="controlId" class="control-label">
      {{ label }}
      <span v-if="required" class="required-dot">*</span>
    </label>
    <input
      :id="controlId"
      :type="inputType"
      class="control-input"
      :class="{ error: !!validationError }"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
      @blur="validate"
    />
    <span v-if="validationError" class="control-error">{{ validationError }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { isValidUrl, isValidEmail } from '../../lib/validators';

const props = defineProps<{
  label: string;
  modelValue: string;
  variant?: 'url' | 'email';
  required?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const controlId = computed(() => `url-${props.label.toLowerCase().replace(/\s+/g, '-')}`);
const validationError = ref<string | null>(null);
const inputType = computed(() => (props.variant === 'email' ? 'email' : 'url'));

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value);
  if (validationError.value) validationError.value = null;
}

function validate(): void {
  if (!props.modelValue) {
    validationError.value = null;
    return;
  }

  if (props.variant === 'email') {
    validationError.value = isValidEmail(props.modelValue) ? null : 'Please enter a valid email';
  } else {
    validationError.value = isValidUrl(props.modelValue) ? null : 'Please enter a valid URL';
  }
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
.control-input.error {
  border-color: var(--color-error);
}
.control-error {
  font-size: 11px;
  color: var(--color-error);
}
</style>
