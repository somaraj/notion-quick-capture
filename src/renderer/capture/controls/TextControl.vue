<template>
  <div class="control-group" :class="{ required: required }">
    <label :for="controlId" class="control-label">
      {{ label }}
      <span v-if="required" class="required-dot">*</span>
    </label>
    <input
      v-if="!multiline"
      :id="controlId"
      type="text"
      class="control-input"
      :class="{ 'title-input': isTitle, error: !!error }"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
    />
    <textarea
      v-else
      :id="controlId"
      class="control-textarea"
      :class="{ error: !!error }"
      :value="modelValue"
      :placeholder="placeholder"
      rows="3"
      @input="onInput"
    />
    <span v-if="error" class="control-error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  modelValue: string;
  required?: boolean;
  multiline?: boolean;
  isTitle?: boolean;
  placeholder?: string;
  error?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const controlId = computed(() => `text-${props.label.toLowerCase().replace(/\s+/g, '-')}`);

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit('update:modelValue', target.value);
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

.control-input,
.control-textarea {
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

.control-input:focus,
.control-textarea:focus {
  border-color: var(--color-accent);
}

.control-input.error,
.control-textarea.error {
  border-color: var(--color-error);
}

.title-input {
  font-size: 20px;
  font-weight: 600;
  padding: 10px 12px;
}

.control-textarea {
  resize: vertical;
  min-height: 60px;
}

.control-error {
  font-size: 11px;
  color: var(--color-error);
}
</style>
