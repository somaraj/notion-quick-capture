<template>
  <section class="settings-section">
    <h2 class="section-title">Workspace</h2>
    <div v-if="isAuthenticated" class="workspace-card">
      <span class="status-dot connected" />
      <div class="workspace-details">
        <span class="workspace-name">{{ workspaceName || 'Notion Workspace' }}</span>
        <span class="workspace-status">Connected</span>
      </div>
      <button class="btn btn-sm btn-danger" @click="logout">Disconnect</button>
    </div>
    <div v-else class="workspace-empty">
      <p>
        No workspace connected. Paste an
        <a href="#" @click.prevent="openIntegrations">internal integration</a>
        secret, then share your pages or databases with it via <strong>⋯ → Connections</strong>.
      </p>
      <form class="token-form" @submit.prevent="saveToken">
        <input
          v-model="tokenInput"
          type="password"
          class="token-input"
          placeholder="ntn_… or secret_…"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!tokenInput.trim() || isConnecting"
        >
          {{ isConnecting ? 'Connecting…' : 'Connect' }}
        </button>
      </form>
      <button
        v-if="oauthAvailable"
        class="btn btn-sm btn-ghost"
        :disabled="isConnecting"
        @click="connectOAuth"
      >
        Sign in with Notion instead
      </button>
      <p v-if="error" class="connect-error">{{ error }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isAuthenticated = ref(false);
const workspaceId = ref('');
const workspaceName = ref('');
const tokenInput = ref('');
const isConnecting = ref(false);
const oauthAvailable = ref(false);
const error = ref<string | null>(null);

async function loadAuth(): Promise<void> {
  const status = await window.notionBridge.auth.getAuthStatus();
  isAuthenticated.value = status.authenticated;
  if (status.workspace) {
    workspaceId.value = status.workspace.workspaceId;
    workspaceName.value = status.workspace.workspaceName;
  }
}

function openIntegrations(): void {
  window.notionBridge.window.openExternal('https://www.notion.so/profile/integrations');
}

async function saveToken(): Promise<void> {
  const token = tokenInput.value.trim();
  if (!token || isConnecting.value) return;
  isConnecting.value = true;
  error.value = null;
  try {
    if (await window.notionBridge.auth.saveToken(token)) {
      tokenInput.value = '';
      await loadAuth();
    } else {
      error.value =
        'Notion did not accept that token. Check it and your connection, then try again.';
    }
  } finally {
    isConnecting.value = false;
  }
}

async function connectOAuth(): Promise<void> {
  isConnecting.value = true;
  error.value = null;
  try {
    const result = await window.notionBridge.auth.startOAuth();
    if (!result.success && result.error) error.value = result.error;
    await loadAuth();
  } finally {
    isConnecting.value = false;
  }
}

async function logout(): Promise<void> {
  if (workspaceId.value) {
    await window.notionBridge.auth.logout(workspaceId.value);
    isAuthenticated.value = false;
    workspaceId.value = '';
    workspaceName.value = '';
  }
}

onMounted(async () => {
  await loadAuth();
  oauthAvailable.value = (await window.notionBridge.auth.getCapabilities()).oauthAvailable;
  window.notionBridge.on.authChanged(() => void loadAuth());
});
</script>

<style scoped>
.workspace-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 8px 8px 14px;
  min-height: 46px;
  box-sizing: border-box;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.connected {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

.workspace-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.workspace-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.workspace-status {
  font-size: 11px;
  color: var(--color-success);
}

.workspace-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}
.workspace-empty p {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
}
.workspace-empty a {
  color: var(--color-accent);
}
.token-form {
  display: flex;
  gap: 8px;
}
.token-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 12px;
}
.token-input:focus {
  outline: none;
  border-color: var(--color-accent);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  align-self: flex-start;
}
.btn-ghost:hover:not(:disabled) {
  color: var(--color-text);
}
.connect-error {
  color: var(--color-error) !important;
}

.btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
}
.btn-primary {
  background: var(--color-accent);
  color: white;
}
.btn-primary:hover {
  background: var(--color-accent-hover);
}
.btn-sm {
  padding: 4px 10px;
  font-size: 11px;
}
.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
