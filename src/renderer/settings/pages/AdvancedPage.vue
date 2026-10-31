<template>
  <div>
    <h1 class="page-title">Advanced</h1>

    <section class="settings-section">
      <div>
        <SettingRow
          label="Schema cache"
          description="How long database fields are cached before re-fetching from Notion"
          control-id="schema-cache"
        >
          <select
            id="schema-cache"
            class="settings-select"
            :value="settings.schemaCacheTtl"
            @change="
              setSetting('schemaCacheTtl', Number(($event.target as HTMLSelectElement).value))
            "
          >
            <option :value="60000">1 min</option>
            <option :value="300000">5 min</option>
            <option :value="600000">10 min</option>
            <option :value="1800000">30 min</option>
          </select>
        </SettingRow>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import SettingRow from '../SettingRow.vue';
import { settings, setSetting } from '../useSettings';
</script>
