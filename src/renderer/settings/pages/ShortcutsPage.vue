<template>
  <div>
    <h1 class="page-title">Shortcuts</h1>

    <section class="settings-section">
      <h2 class="section-title">Global hotkey</h2>
      <p class="section-desc">Press this shortcut anywhere to open Quick Capture.</p>
      <HotkeyCapture />
    </section>

    <section class="settings-section">
      <h2 class="section-title">In the capture panel</h2>
      <div>
        <SettingRow v-for="s in panelShortcuts" :key="s.label" :label="s.label">
          <span class="keys">
            <kbd v-for="k in s.keys" :key="k">{{ k }}</kbd>
          </span>
        </SettingRow>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import HotkeyCapture from '../HotkeyCapture.vue';
import SettingRow from '../SettingRow.vue';

const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

const panelShortcuts = [
  { label: 'Save to Notion', keys: [mod, 'Enter'] },
  { label: 'Close panel', keys: ['Esc'] },
  { label: 'Indent in note', keys: ['Tab'] },
];
</script>

<style scoped>
.keys {
  display: flex;
  gap: 4px;
}

kbd {
  font-family: var(--font-sans);
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--color-border-strong);
  border-bottom-width: 2px;
  background: var(--color-surface);
  color: var(--color-text-muted);
}
</style>
