<template>
  <div>
    <h1 class="page-title">Updates</h1>

    <section class="settings-section">
      <div class="update-card" :class="tone">
        <div class="update-main">
          <div class="update-text">
            <span class="update-headline">{{ headline }}</span>
            <span class="update-detail" aria-live="polite">{{ detail }}</span>
          </div>
          <button
            v-if="action"
            class="btn"
            :class="action.primary ? 'btn-primary' : 'btn-ghost'"
            :disabled="action.disabled"
            @click="action.run()"
          >
            {{ action.label }}
          </button>
        </div>

        <div
          v-if="state.status === 'downloading'"
          class="progress"
          role="progressbar"
          aria-label="Download progress"
          :aria-valuenow="state.percent ?? 0"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="progress-bar" :style="{ width: `${state.percent ?? 0}%` }" />
        </div>
      </div>

      <div v-if="state.version && state.releaseNotes" class="notes">
        <div class="notes-header">
          <span class="notes-title">What's new in v{{ state.version }}</span>
          <button class="link-btn" @click="bridge.openReleasePage()">View on GitHub</button>
        </div>
        <pre class="notes-body">{{ state.releaseNotes }}</pre>
      </div>
    </section>

    <section v-if="state.mode !== 'disabled'" class="settings-section">
      <h2 class="section-title">Preferences</h2>
      <div>
        <SettingRow
          v-if="state.mode === 'auto'"
          label="Download updates automatically"
          description="Updates download in the background and install the next time the app quits"
        >
          <button
            class="toggle"
            role="switch"
            :aria-checked="settings.autoDownloadUpdates"
            aria-label="Download updates automatically"
            :class="{ active: settings.autoDownloadUpdates }"
            @click="setSetting('autoDownloadUpdates', !settings.autoDownloadUpdates)"
          >
            <span class="toggle-thumb" />
          </button>
        </SettingRow>
        <SettingRow
          label="Update channel"
          description="Beta gets new features earlier, but may be less stable"
          control-id="update-channel"
        >
          <select
            id="update-channel"
            class="settings-select"
            :value="settings.updateChannel"
            @change="
              setSetting(
                'updateChannel',
                ($event.target as HTMLSelectElement).value as 'stable' | 'beta',
              )
            "
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
          </select>
        </SettingRow>
      </div>
      <p v-if="state.mode === 'notify'" class="section-desc">
        This build can't install updates by itself
        {{ isMac ? '(macOS requires a signed app)' : '(installed from a .deb package)' }}. You'll be
        notified when a new version is out, with a link to download it.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SettingRow from '../SettingRow.vue';
import { settings, setSetting } from '../useSettings';
import type { UpdateState } from '../../../shared/types';

const bridge = window.notionBridge.updates;
const isMac = navigator.userAgent.includes('Mac');

const state = ref<UpdateState>({
  mode: 'disabled',
  status: 'idle',
  currentVersion: __APP_VERSION__,
});

onMounted(async () => {
  window.notionBridge.on.updateState((next) => (state.value = next));
  state.value = await bridge.getState();
});

function timeAgo(epoch?: number): string {
  if (!epoch) return '';
  const minutes = Math.round((Date.now() - epoch) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(epoch).toLocaleDateString();
}

const headline = computed(() => {
  const s = state.value;
  switch (s.status) {
    case 'available':
      return `Version ${s.version} is available`;
    case 'downloading':
      return `Downloading version ${s.version}…`;
    case 'ready':
      return `Version ${s.version} is ready to install`;
    default:
      return `Notion Quick Capture ${s.currentVersion}`;
  }
});

const detail = computed(() => {
  const s = state.value;
  if (s.mode === 'disabled') return 'Updates are turned off in development builds.';
  switch (s.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'up-to-date':
      return `You're up to date · checked ${timeAgo(s.lastChecked)}`;
    case 'available':
      if (s.error) return `Download failed: ${s.error}`;
      return s.mode === 'auto'
        ? `You have ${s.currentVersion}.`
        : `You have ${s.currentVersion}. Download the new version from GitHub.`;
    case 'downloading':
      return `${s.percent ?? 0}%`;
    case 'ready':
      return 'It installs automatically when you quit, or restart now.';
    case 'error':
      return `Couldn't check for updates: ${s.error}`;
    default:
      return 'Updates are checked automatically every few hours.';
  }
});

const tone = computed(() => {
  const { status } = state.value;
  if (status === 'error') return 'tone-error';
  if (status === 'available' || status === 'ready') return 'tone-accent';
  return '';
});

interface Action {
  label: string;
  run: () => void;
  primary?: boolean;
  disabled?: boolean;
}

const action = computed<Action | null>(() => {
  const s = state.value;
  if (s.mode === 'disabled') return null;
  switch (s.status) {
    case 'ready':
      return { label: 'Restart & install', run: () => bridge.install(), primary: true };
    case 'available':
      return s.mode === 'auto'
        ? { label: 'Download', run: () => bridge.download(), primary: true }
        : { label: 'Download from GitHub', run: () => bridge.openReleasePage(), primary: true };
    case 'downloading':
      return null;
    case 'checking':
      return { label: 'Checking…', run: () => undefined, disabled: true };
    default:
      return { label: 'Check for updates', run: () => bridge.check() };
  }
});
</script>

<style scoped>
.update-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface);
}

.update-card.tone-accent {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.update-card.tone-error .update-detail {
  color: var(--color-error);
}

.update-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.update-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.update-headline {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.update-detail {
  font-size: 12px;
  color: var(--color-text-muted);
}

.progress {
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.notes-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.notes-body {
  margin: 0;
  max-height: 180px;
  overflow-y: auto;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-accent);
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.btn {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

.btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
  border: 1px solid var(--color-accent);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-strong);
}

.btn-ghost:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-hover);
}
</style>
