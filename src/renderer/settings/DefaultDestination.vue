<template>
  <section class="settings-section">
    <h2 class="section-title">Default Destination</h2>

    <div v-if="defaultDest && !isChanging" class="default-dest">
      <div class="dest-card">
        <span class="dest-icon">
          <template v-if="defaultDest.icon">{{ defaultDest.icon }}</template>
          <UiIcon v-else :name="defaultDest.type === 'database' ? 'database' : 'page'" />
        </span>
        <span class="dest-title">{{ defaultDest.title || 'Untitled' }}</span>
      </div>
      <button class="btn btn-sm btn-ghost" @click="isChanging = true">Change</button>
    </div>

    <template v-else>
      <DestinationSearch
        :current-id="defaultDest?.id"
        :autofocus="isChanging"
        @select="setDefault"
        @cancel="isChanging = false"
      />
      <p v-if="!defaultDest" class="dest-required">
        Choose where new captures go. You can still switch per capture from the panel.
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import UiIcon from '../components/UiIcon.vue';
import DestinationSearch from '../components/DestinationSearch.vue';
import type { DestinationRef } from '../../shared/types';

const defaultDest = ref<DestinationRef | null>(null);
const isChanging = ref(false);

async function setDefault(dest: DestinationRef): Promise<void> {
  await window.notionBridge.config.set('defaultDestination', dest);
  defaultDest.value = dest;
  isChanging.value = false;
}

onMounted(async () => {
  defaultDest.value = await window.notionBridge.config.get('defaultDestination');
  // Reconnecting to another workspace invalidates the old destination
  window.notionBridge.on.configChanged((key, value) => {
    if (key === 'defaultDestination') defaultDest.value = value as DestinationRef | null;
  });
});
</script>

<style scoped>
.default-dest {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dest-card {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  min-height: 46px;
  box-sizing: border-box;
}

.dest-icon {
  display: flex;
  color: var(--color-text-muted);
  font-size: 15px;
}

.dest-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dest-required {
  font-size: 12px;
  color: var(--color-text-muted);
}

.btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-strong);
}

.btn-ghost:hover {
  color: var(--color-text);
  background: var(--color-hover);
}
</style>
