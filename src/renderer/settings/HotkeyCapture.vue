<template>
  <div class="hotkey-capture">
    <div class="hotkey-display" :class="{ recording: isRecording }">
      <span v-if="!isRecording">{{ displayHotkey }}</span>
      <span v-else class="recording-text">Press your shortcut...</span>
    </div>
    <div class="hotkey-actions">
      <button class="btn btn-sm" @click="isRecording ? stopRecording() : startRecording()">
        {{ isRecording ? 'Cancel' : 'Change' }}
      </button>
      <button
        v-if="currentHotkey !== defaultHotkey"
        class="btn btn-sm btn-ghost"
        @click="resetToDefault"
      >
        Reset
      </button>
    </div>
    <p v-if="error" class="hotkey-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const defaultHotkey = 'CommandOrControl+Shift+N';
const currentHotkey = ref(defaultHotkey);
const isRecording = ref(false);
const error = ref<string | null>(null);

const displayHotkey = computed(() => {
  return currentHotkey.value
    .replace('CommandOrControl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
    .replace('Shift', navigator.platform.includes('Mac') ? '⇧' : 'Shift')
    .replace('Alt', navigator.platform.includes('Mac') ? '⌥' : 'Alt')
    .replace(/\+/g, navigator.platform.includes('Mac') ? '' : ' + ');
});

function startRecording(): void {
  isRecording.value = true;
  error.value = null;
  window.addEventListener('keydown', onKeydown);
}

function stopRecording(): void {
  isRecording.value = false;
  window.removeEventListener('keydown', onKeydown);
}

function onKeydown(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();

  // Ignore modifier-only presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  const key = toAcceleratorKey(event.code);
  if (!key) {
    error.value = 'That key cannot be used in a global shortcut';
    return;
  }
  parts.push(key);

  if (parts.length < 2) {
    error.value = 'Shortcut must include at least one modifier (Ctrl/Cmd, Shift, Alt)';
    return;
  }

  const accelerator = parts.join('+');
  applyHotkey(accelerator);
}

// Map a physical key (KeyboardEvent.code) to an Electron accelerator key name.
// Using `code` rather than `key` keeps Shift+1 as "1" instead of "!", independent of layout.
function toAcceleratorKey(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (digit) return digit[1]!;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  const named: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
  };
  return named[code] ?? null;
}

async function applyHotkey(accelerator: string): Promise<void> {
  stopRecording();
  const ok = await window.notionBridge.hotkey.update(accelerator);
  if (ok) {
    currentHotkey.value = accelerator;
    error.value = null;
  } else {
    error.value = 'Could not register that shortcut — it may be used by another app';
  }
}

async function resetToDefault(): Promise<void> {
  await applyHotkey(defaultHotkey);
}

onMounted(async () => {
  currentHotkey.value = await window.notionBridge.config.get('globalHotkey');
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.hotkey-capture {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hotkey-display {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 15px;
  color: var(--color-text);
  text-align: center;
  letter-spacing: 1px;
  transition: border-color 0.2s ease;
}

.hotkey-display.recording {
  border-color: var(--color-accent);
  background: var(--color-surface-2);
}
.recording-text {
  color: var(--color-accent);
  font-family: var(--font-sans);
  font-style: italic;
}

.hotkey-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn:hover {
  background: var(--color-surface);
}
.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}
.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--color-text-muted);
}
.btn-ghost:hover {
  color: var(--color-text);
}

.hotkey-error {
  font-size: 12px;
  color: var(--color-error);
  margin: 0;
}
</style>
