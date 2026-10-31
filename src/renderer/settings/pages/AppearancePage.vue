<template>
  <div>
    <h1 class="page-title">Appearance</h1>

    <!-- Live preview of the capture panel on a miniature screen -->
    <div class="preview-screen" :class="`pos-${settings.panelPosition}`" aria-hidden="true">
      <div class="preview-panel" :style="{ width: `${previewWidth}%` }">
        <div class="preview-bar">
          <span class="preview-chip" />
        </div>
        <div class="preview-title" :style="{ fontSize: `${settings.bodyFontSize + 2}px` }">
          Untitled
        </div>
        <div class="preview-text" :style="{ fontSize: `${settings.bodyFontSize}px` }">
          Capture a thought…
        </div>
      </div>
    </div>

    <section class="settings-section">
      <div>
        <SettingRow
          label="Theme"
          description="Light, dark, or follow your system"
          control-id="theme"
        >
          <select
            id="theme"
            class="settings-select"
            :value="settings.theme"
            @change="
              setSetting('theme', ($event.target as HTMLSelectElement).value as AppConfig['theme'])
            "
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Panel position"
          description="Where the capture window appears"
          control-id="panel-position"
        >
          <select
            id="panel-position"
            class="settings-select"
            :value="settings.panelPosition"
            @change="
              setSetting(
                'panelPosition',
                ($event.target as HTMLSelectElement).value as AppConfig['panelPosition'],
              )
            "
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </SettingRow>

        <SettingRow label="Panel width" control-id="panel-width">
          <button
            v-if="settings.panelWidth !== DEFAULTS.panelWidth"
            class="reset-link"
            @click="setSetting('panelWidth', DEFAULTS.panelWidth)"
          >
            Reset
          </button>
          <input
            id="panel-width"
            type="range"
            class="range-slider"
            :value="settings.panelWidth"
            min="420"
            max="800"
            step="20"
            @input="setSetting('panelWidth', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="range-value">{{ settings.panelWidth }}px</span>
        </SettingRow>

        <SettingRow label="Font size" control-id="font-size">
          <button
            v-if="settings.bodyFontSize !== DEFAULTS.bodyFontSize"
            class="reset-link"
            @click="setSetting('bodyFontSize', DEFAULTS.bodyFontSize)"
          >
            Reset
          </button>
          <input
            id="font-size"
            type="range"
            class="range-slider"
            :value="settings.bodyFontSize"
            min="12"
            max="18"
            step="1"
            @input="setSetting('bodyFontSize', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="range-value">{{ settings.bodyFontSize }}px</span>
        </SettingRow>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AppConfig } from '../../../shared/types';
import SettingRow from '../SettingRow.vue';
import { settings, setSetting, DEFAULTS } from '../useSettings';

// Panel width relative to a ~1280px-wide screen, so the slider visibly changes the preview
const previewWidth = computed(() => Math.round((settings.panelWidth / 1280) * 100));
</script>

<style scoped>
.preview-screen {
  height: 120px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background:
    radial-gradient(circle at 20% 20%, var(--color-accent-soft), transparent 60%),
    var(--color-surface);
  display: flex;
  justify-content: center;
  padding: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}

.pos-top {
  align-items: flex-start;
}
.pos-center {
  align-items: center;
}
.pos-bottom {
  align-items: flex-end;
}

.preview-panel {
  background: var(--color-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  padding: 6px 10px 8px;
  transition: width 0.15s ease;
  overflow: hidden;
}

.preview-bar {
  display: flex;
  margin-bottom: 4px;
}

.preview-chip {
  width: 44px;
  height: 6px;
  border-radius: 3px;
  background: var(--color-surface-2);
}

.preview-title {
  font-weight: 650;
  color: var(--color-text-muted);
  opacity: 0.7;
  line-height: 1.3;
}

.preview-text {
  color: var(--color-text-muted);
  line-height: 1.4;
  white-space: nowrap;
}
</style>
