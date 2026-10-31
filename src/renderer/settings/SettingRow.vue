<template>
  <div class="setting-row" :class="{ stacked }">
    <div class="setting-label">
      <label :for="controlId">{{ label }}</label>
      <span v-if="description" class="label-desc">{{ description }}</span>
    </div>
    <div class="setting-control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// One settings line: label + description on the left, control on the right
withDefaults(
  defineProps<{
    label: string;
    description?: string;
    controlId?: string;
    /** Put the control under the label (for wide controls) */
    stacked?: boolean;
  }>(),
  { description: undefined, controlId: undefined, stacked: false },
);
</script>

<style scoped>
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--color-border);
}

.setting-row.stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.label-desc {
  font-size: 11.5px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.stacked .setting-control {
  display: block;
}
</style>
