<template>
  <div v-if="schema" class="property-form">
    <TransitionGroup name="field" tag="div" class="form-fields">
      <div
        v-for="(prop, index) in shownProperties"
        :key="prop.id"
        class="field-wrapper"
        :style="{ transitionDelay: index * 50 + 'ms' }"
      >
        <!-- Title -->
        <TextControl
          v-if="prop.type === 'title'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          :required="true"
          :is-title="true"
          placeholder="Title"
          @update:model-value="(v) => updateProp(prop.name, { type: 'title', value: v })"
        />

        <!-- Rich Text -->
        <TextControl
          v-else-if="prop.type === 'rich_text'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          :multiline="true"
          placeholder="Text..."
          @update:model-value="(v) => updateProp(prop.name, { type: 'rich_text', value: v })"
        />

        <!-- Number -->
        <NumberControl
          v-else-if="prop.type === 'number'"
          :label="prop.name"
          :model-value="getNumberValue(prop.name)"
          :number-format="prop.numberFormat"
          @update:model-value="(v) => updateProp(prop.name, { type: 'number', value: v })"
        />

        <!-- Select -->
        <SelectControl
          v-else-if="prop.type === 'select'"
          :label="prop.name"
          :model-value="getStringOrNullValue(prop.name)"
          :options="prop.options ?? []"
          @update:model-value="(v) => updateProp(prop.name, { type: 'select', value: v })"
        />

        <!-- Multi Select -->
        <MultiSelectControl
          v-else-if="prop.type === 'multi_select'"
          :label="prop.name"
          :model-value="getArrayValue(prop.name)"
          :options="prop.options ?? []"
          @update:model-value="(v) => updateProp(prop.name, { type: 'multi_select', value: v })"
        />

        <!-- Date -->
        <DateControl
          v-else-if="prop.type === 'date'"
          :label="prop.name"
          :start="getDateStart(prop.name)"
          :end="getDateEnd(prop.name)"
          :include-time="getDateIncludeTime(prop.name)"
          :error="store.validationErrors[prop.name]"
          @update:start="(v) => updateDateStart(prop.name, v)"
          @update:end="(v) => updateDateEnd(prop.name, v)"
          @update:include-time="(v) => updateDateTime(prop.name, v)"
        />

        <!-- Checkbox -->
        <CheckboxControl
          v-else-if="prop.type === 'checkbox'"
          :label="prop.name"
          :model-value="getBoolValue(prop.name)"
          @update:model-value="(v) => updateProp(prop.name, { type: 'checkbox', value: v })"
        />

        <!-- URL -->
        <UrlControl
          v-else-if="prop.type === 'url'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          variant="url"
          @update:model-value="(v) => updateProp(prop.name, { type: 'url', value: v })"
        />

        <!-- Email -->
        <UrlControl
          v-else-if="prop.type === 'email'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          variant="email"
          @update:model-value="(v) => updateProp(prop.name, { type: 'email', value: v })"
        />

        <!-- Phone -->
        <TextControl
          v-else-if="prop.type === 'phone_number'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          placeholder="Phone number"
          @update:model-value="(v) => updateProp(prop.name, { type: 'phone_number', value: v })"
        />

        <!-- People -->
        <PeopleControl
          v-else-if="prop.type === 'people'"
          :label="prop.name"
          :model-value="getUserIds(prop.name)"
          :users="users"
          @update:model-value="(v) => updateProp(prop.name, { type: 'people', userIds: v })"
        />

        <!-- Relation -->
        <RelationControl
          v-else-if="prop.type === 'relation'"
          :label="prop.name"
          :model-value="getPageIds(prop.name)"
          :database-id="prop.relationDatabaseId"
          @update:model-value="(v) => updateProp(prop.name, { type: 'relation', pageIds: v })"
        />

        <!-- Status -->
        <StatusControl
          v-else-if="prop.type === 'status'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          :options="prop.options ?? []"
          :groups="prop.statusGroups"
          @update:model-value="(v) => updateProp(prop.name, { type: 'status', value: v })"
        />

        <!-- Files -->
        <TextControl
          v-else-if="prop.type === 'files'"
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          placeholder="File URL"
          @update:model-value="(v) => updateProp(prop.name, { type: 'files', urls: v ? [v] : [] })"
        />

        <!-- Unknown (fallback text) -->
        <TextControl
          v-else
          :label="prop.name"
          :model-value="getStringValue(prop.name)"
          placeholder="Value..."
          @update:model-value="(v) => updateProp(prop.name, { type: 'rich_text', value: v })"
        />
      </div>
    </TransitionGroup>
    <button
      v-if="hiddenCount > 0 || (expanded && collapsible)"
      type="button"
      class="more-toggle"
      @click="toggleExpanded"
    >
      {{
        expanded
          ? 'Show fewer properties'
          : `+ ${hiddenCount} more propert${hiddenCount === 1 ? 'y' : 'ies'}`
      }}
    </button>
  </div>

  <!-- Skeleton loader while fetching schema -->
  <div v-else-if="isLoading" class="schema-skeleton">
    <div class="skeleton-line wide" />
    <div class="skeleton-line" />
    <div class="skeleton-line narrow" />
    <div class="skeleton-line" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useUiStore } from '../store/uiStore';
import { isFilled } from '../lib/propertyValues';
import type { DatabaseSchema, PropertyValue, NotionUser } from '../../shared/types';
import TextControl from './controls/TextControl.vue';
import NumberControl from './controls/NumberControl.vue';
import SelectControl from './controls/SelectControl.vue';
import MultiSelectControl from './controls/MultiSelectControl.vue';
import DateControl from './controls/DateControl.vue';
import CheckboxControl from './controls/CheckboxControl.vue';
import UrlControl from './controls/UrlControl.vue';
import PeopleControl from './controls/PeopleControl.vue';
import RelationControl from './controls/RelationControl.vue';
import StatusControl from './controls/StatusControl.vue';

const props = defineProps<{
  schema: DatabaseSchema | null;
  isLoading: boolean;
}>();

const store = useUiStore();
const users = ref<NotionUser[]>([]);

const editableTypes = new Set([
  'title',
  'rich_text',
  'number',
  'select',
  'multi_select',
  'date',
  'checkbox',
  'url',
  'email',
  'phone_number',
  'people',
  'relation',
  'status',
  'files',
]);

// The title is edited in the panel's large title field, and computed values
// (formula/rollup) can't be set, so neither is shown in the property list.
// Properties people most often set when capturing come first (then alphabetical, as Notion sorts)
const TYPE_PRIORITY: Record<string, number> = {
  status: 0,
  select: 1,
  multi_select: 2,
  date: 3,
  checkbox: 4,
  people: 5,
};

const visibleProperties = computed(() => {
  if (!props.schema) return [];
  return props.schema.properties
    .filter((p) => p.type !== 'title' && editableTypes.has(p.type))
    .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9));
});

// ── Collapsing ──
// Databases often have many columns; show a few (plus anything already filled in) so the
// note stays the focus. The expanded/collapsed choice is remembered per database.
const COLLAPSED_COUNT = 3;
const expanded = ref(false);

function expandedKey(databaseId: string): string {
  return `nqc.propertiesExpanded.${databaseId}`;
}

watch(
  () => props.schema?.id,
  (id) => {
    try {
      expanded.value = !!id && localStorage.getItem(expandedKey(id)) === '1';
    } catch {
      expanded.value = false;
    }
  },
  { immediate: true },
);

function toggleExpanded(): void {
  expanded.value = !expanded.value;
  const id = props.schema?.id;
  if (!id) return;
  try {
    if (expanded.value) localStorage.setItem(expandedKey(id), '1');
    else localStorage.removeItem(expandedKey(id));
  } catch {
    // ignore storage errors
  }
}

const collapsible = computed(() => visibleProperties.value.length > COLLAPSED_COUNT);

const shownProperties = computed(() => {
  if (expanded.value || !collapsible.value) return visibleProperties.value;
  return visibleProperties.value.filter(
    (p, i) => i < COLLAPSED_COUNT || isFilled(store.properties[p.name]),
  );
});

const hiddenCount = computed(() => visibleProperties.value.length - shownProperties.value.length);

// Typed accessors for property values
function getStringValue(name: string): string {
  const val = store.properties[name];
  if (val && 'value' in val && typeof val.value === 'string') return val.value;
  return '';
}

function getStringOrNullValue(name: string): string | null {
  const val = store.properties[name];
  if (val && val.type === 'select') return val.value;
  return null;
}

function getNumberValue(name: string): number | null {
  const val = store.properties[name];
  if (val && val.type === 'number') return val.value;
  return null;
}

function getArrayValue(name: string): string[] {
  const val = store.properties[name];
  if (val && val.type === 'multi_select') return val.value;
  return [];
}

function getBoolValue(name: string): boolean {
  const val = store.properties[name];
  if (val && val.type === 'checkbox') return val.value;
  return false;
}

function getUserIds(name: string): string[] {
  const val = store.properties[name];
  if (val && val.type === 'people') return val.userIds;
  return [];
}

function getPageIds(name: string): string[] {
  const val = store.properties[name];
  if (val && val.type === 'relation') return val.pageIds;
  return [];
}

function getDateStart(name: string): string {
  const val = store.properties[name];
  if (val && val.type === 'date') return val.start;
  return '';
}

function getDateEnd(name: string): string | undefined {
  const val = store.properties[name];
  if (val && val.type === 'date') return val.end;
  return undefined;
}

function getDateIncludeTime(name: string): boolean {
  const val = store.properties[name];
  if (val && val.type === 'date') return val.includeTime;
  return false;
}

function updateProp(name: string, value: PropertyValue): void {
  store.updateProperty(name, value);
}

function updateDateStart(name: string, start: string): void {
  const current = store.properties[name];
  if (current && current.type === 'date') {
    store.updateProperty(name, { ...current, start });
  } else {
    store.updateProperty(name, { type: 'date', start, includeTime: false });
  }
}

function updateDateEnd(name: string, end: string | undefined): void {
  const current = store.properties[name];
  if (current && current.type === 'date') {
    store.updateProperty(name, { ...current, end });
  }
}

function updateDateTime(name: string, includeTime: boolean): void {
  const current = store.properties[name];
  if (current && current.type === 'date') {
    store.updateProperty(name, { ...current, includeTime });
  }
}

onMounted(async () => {
  try {
    users.value = await window.notionBridge.notion.getUsers();
  } catch {
    users.value = [];
  }
});
</script>

<style scoped>
.property-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.more-toggle {
  align-self: flex-start;
  margin-top: 4px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.more-toggle:hover {
  color: var(--color-text);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── Compact, Notion-style property rows: name on the left, value on the right ──
   Applied here so each control keeps working standalone with its own default look. */
.form-fields :deep(.control-group) {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 4px;
  align-items: start;
}

.form-fields :deep(.control-group > :not(.control-label)) {
  grid-column: 2;
}

.form-fields :deep(.control-label) {
  grid-column: 1;
  padding-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-text-muted);
}

/* Fields are quiet until hovered or focused */
.form-fields :deep(.control-input),
.form-fields :deep(.control-textarea),
.form-fields :deep(.select-input),
.form-fields :deep(.select-trigger),
.form-fields :deep(.multi-select-container),
.form-fields :deep(.people-container),
.form-fields :deep(.relation-container) {
  min-height: 32px;
  padding-top: 5px;
  padding-bottom: 5px;
  border-color: transparent;
  background: transparent;
  font-size: 13px;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.form-fields :deep(.control-input:hover),
.form-fields :deep(.control-textarea:hover),
.form-fields :deep(.select-input:hover),
.form-fields :deep(.select-trigger:hover),
.form-fields :deep(.multi-select-container:hover),
.form-fields :deep(.people-container:hover),
.form-fields :deep(.relation-container:hover) {
  background: var(--color-hover);
}

.form-fields :deep(.control-input:focus),
.form-fields :deep(.control-textarea:focus),
.form-fields :deep(.select-input:focus),
.form-fields :deep(.multi-select-container:focus-within),
.form-fields :deep(.people-container:focus-within),
.form-fields :deep(.relation-container:focus-within) {
  background: var(--color-bg);
  border-color: var(--color-accent);
}

/* The checkbox control renders its own label beside the toggle */
.form-fields :deep(.control-group:has(.checkbox-label)) {
  display: flex;
  padding: 6px 0;
}

.field-wrapper {
  /* No animation here — animation creates a stacking context that traps z-index,
     preventing dropdowns from rendering above sibling fields.
     The TransitionGroup classes below handle the entrance animation. */
}

@keyframes field-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.field-enter-active {
  animation: field-enter 0.2s ease-out both;
}

.field-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* Skeleton loader */
.schema-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.skeleton-line {
  height: 38px;
  background: linear-gradient(
    90deg,
    var(--color-surface-2) 25%,
    var(--color-surface) 50%,
    var(--color-surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
  width: 100%;
}

.skeleton-line.wide {
  width: 100%;
  height: 48px;
}
.skeleton-line.narrow {
  width: 60%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
