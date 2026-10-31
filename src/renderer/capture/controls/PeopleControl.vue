<template>
  <div ref="controlRef" class="control-group" :class="{ 'dropdown-open': isOpen }">
    <label class="control-label">{{ label }}</label>
    <div class="people-container">
      <div v-for="userId in modelValue" :key="userId" class="person-chip">
        <span class="person-avatar">{{ getInitials(userId) }}</span>
        <span class="person-name">{{ getUserName(userId) }}</span>
        <button class="person-remove" @click="removeUser(userId)">×</button>
      </div>
      <input
        type="text"
        class="people-input"
        :value="searchQuery"
        placeholder="Search people..."
        @input="onSearch"
        @focus="isOpen = true"
        @keydown="onKeydown"
      />
    </div>
    <div v-if="isOpen && filteredUsers.length > 0" class="dropdown" @mousedown.prevent>
      <div
        v-for="(user, index) in filteredUsers"
        :key="user.id"
        class="dropdown-item"
        :class="{ highlighted: index === highlightedIndex }"
        @click="addUser(user.id)"
        @mouseenter="highlightedIndex = index"
      >
        <span class="user-avatar">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="avatar-img" />
          <span v-else>{{ user.name.charAt(0) }}</span>
        </span>
        <span>{{ user.name }}</span>
        <span v-if="user.email" class="user-email">{{ user.email }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { NotionUser } from '../../../shared/types';

const props = defineProps<{
  label: string;
  modelValue: string[];
  users: NotionUser[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const controlRef = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(0);

const filteredUsers = computed(() => {
  const selected = new Set(props.modelValue);
  let users = props.users.filter((u) => !selected.has(u.id));
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query)),
    );
  }
  return users;
});

function getUserName(userId: string): string {
  return props.users.find((u) => u.id === userId)?.name ?? userId;
}

function getInitials(userId: string): string {
  const name = getUserName(userId);
  return name.charAt(0).toUpperCase();
}

function onSearch(event: Event): void {
  searchQuery.value = (event.target as HTMLInputElement).value;
  highlightedIndex.value = 0;
  isOpen.value = true;
}

function addUser(userId: string): void {
  if (!props.modelValue.includes(userId)) {
    emit('update:modelValue', [...props.modelValue, userId]);
  }
  searchQuery.value = '';
  isOpen.value = false;
}

function removeUser(userId: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((id) => id !== userId),
  );
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    const user = filteredUsers.value[highlightedIndex.value];
    if (user) addUser(user.id);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredUsers.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (event.key === 'Escape') {
    isOpen.value = false;
  }
}

function onClickOutside(event: MouseEvent): void {
  if (controlRef.value && !controlRef.value.contains(event.target as Node)) isOpen.value = false;
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<style scoped>
.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.control-group.dropdown-open {
  z-index: 50;
}
.control-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.people-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  min-height: 38px;
  transition: border-color 0.15s ease;
}

.people-container:focus-within {
  border-color: var(--color-accent);
}

.person-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-surface-2);
  font-size: 13px;
}

.person-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
}

.person-name {
  color: var(--color-text);
}

.person-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.people-input {
  background: none;
  border: none;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 4px;
  outline: none;
  flex: 1;
  min-width: 100px;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
}

.dropdown-item.highlighted {
  background: var(--color-accent);
  color: white;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.user-email {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: auto;
}
</style>
