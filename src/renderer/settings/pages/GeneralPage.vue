<template>
  <div>
    <h1 class="page-title">General</h1>

    <WorkspaceManager />
    <DefaultDestination />

    <section class="settings-section">
      <h2 class="section-title">Behavior</h2>
      <div>
        <SettingRow label="Launch at login" description="Start automatically when you sign in">
          <button
            class="toggle"
            role="switch"
            :aria-checked="settings.launchAtLogin"
            aria-label="Launch at login"
            :class="{ active: settings.launchAtLogin }"
            @click="setSetting('launchAtLogin', !settings.launchAtLogin)"
          >
            <span class="toggle-thumb" />
          </button>
        </SettingRow>
        <SettingRow
          label="Hide when clicking elsewhere"
          description="Close the capture panel when you switch to another window. Your note is kept either way."
        >
          <button
            class="toggle"
            role="switch"
            :aria-checked="!settings.confirmOnClose"
            aria-label="Hide when clicking elsewhere"
            :class="{ active: !settings.confirmOnClose }"
            @click="setSetting('confirmOnClose', !settings.confirmOnClose)"
          >
            <span class="toggle-thumb" />
          </button>
        </SettingRow>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import WorkspaceManager from '../WorkspaceManager.vue';
import DefaultDestination from '../DefaultDestination.vue';
import SettingRow from '../SettingRow.vue';
import { settings, setSetting } from '../useSettings';
</script>
