<template>
  <div class="control-group">
    <label class="control-label checkbox-label" @click="toggle">
      <div class="checkbox-track" :class="{ checked: modelValue }">
        <div class="checkbox-thumb" />
      </div>
      <span>{{ label }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function toggle(): void {
  emit('update:modelValue', !props.modelValue);
}
</script>

<style scoped>
.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
  user-select: none;
}

.checkbox-track {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  position: relative;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  flex-shrink: 0;
}

.checkbox-track.checked {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.checkbox-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  position: absolute;
  top: 1px;
  left: 1px;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.checkbox-track.checked .checkbox-thumb {
  transform: translateX(16px);
}
</style>
