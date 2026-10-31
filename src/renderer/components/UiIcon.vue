<template>
  <svg
    class="ui-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'page'">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </template>
    <template v-else-if="name === 'database'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6L6 18" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="M6 9l6 6 6-6" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </template>
    <template v-else-if="name === 'alert'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </template>
    <template v-else-if="name === 'palette'">
      <path
        d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"
      />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </template>
    <template v-else-if="name === 'keyboard'">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
    </template>
    <template v-else-if="name === 'sliders'">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </template>
    <template v-else-if="name === 'cloud-off'">
      <path d="M3 3l18 18" />
      <path d="M8.5 6.2A6 6 0 0 1 17.7 10H18a4 4 0 0 1 2.2 7.3M17 18H7a5 5 0 0 1-1.6-9.7" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </template>
  </svg>
</template>

<script setup lang="ts">
// Small inline icon set (stroke icons, inherit currentColor) so the UI doesn't depend on emoji rendering
withDefaults(
  defineProps<{
    name:
      | 'page'
      | 'database'
      | 'settings'
      | 'close'
      | 'chevron-down'
      | 'search'
      | 'check'
      | 'alert'
      | 'palette'
      | 'keyboard'
      | 'sliders'
      | 'cloud-off'
      | 'download';
    size?: number;
  }>(),
  { size: 16 },
);
</script>

<style scoped>
.ui-icon {
  flex-shrink: 0;
  display: block;
}
</style>
