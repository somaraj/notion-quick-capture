<template>
  <div class="about-panel">
    <!-- App Info -->
    <div class="app-hero">
      <img class="app-icon" :src="appIcon" alt="" width="64" height="64" />
      <h1 class="app-name">Notion Quick Capture</h1>
      <span class="app-version">Version {{ appVersion }}</span>
      <p class="app-desc">
        A fast, global shortcut to capture notes and tasks directly to your Notion workspace.
      </p>
    </div>

    <div class="divider" />

    <!-- Developer -->
    <div class="dev-section">
      <span class="dev-label">Developed by</span>
      <span class="dev-name">Somaraj N</span>
    </div>

    <div class="divider" />

    <!-- Links -->
    <div class="links-grid">
      <a class="link-item" href="#" @click.prevent="openLink('mailto:support@somaraj.com')">
        <span class="link-icon">✉️</span>
        <div class="link-text">
          <span class="link-label">Email</span>
          <span class="link-value">support@somaraj.com</span>
        </div>
      </a>
      <a class="link-item" href="#" @click.prevent="openLink('https://somaraj.com')">
        <span class="link-icon">🌐</span>
        <div class="link-text">
          <span class="link-label">Website</span>
          <span class="link-value">somaraj.com</span>
        </div>
      </a>
      <a class="link-item" href="#" @click.prevent="openLink('https://github.com/somaraj')">
        <span class="link-icon">💻</span>
        <div class="link-text">
          <span class="link-label">GitHub</span>
          <span class="link-value">github.com/somaraj</span>
        </div>
      </a>
      <a class="link-item" href="#" @click.prevent="openLink('https://discord.gg/fnH6KuX8')">
        <span class="link-icon">💬</span>
        <div class="link-text">
          <span class="link-label">Discord</span>
          <span class="link-value">Join Community</span>
        </div>
      </a>
      <a class="link-item" href="#" @click.prevent="openLink('https://twitter.com/nsomaraj')">
        <span class="link-icon">𝕏</span>
        <div class="link-text">
          <span class="link-label">Twitter</span>
          <span class="link-value">@nsomaraj</span>
        </div>
      </a>
      <a class="link-item" href="#" @click.prevent="openLink('https://linkedin.com/in/nsomaraj')">
        <span class="link-icon">🔗</span>
        <div class="link-text">
          <span class="link-label">LinkedIn</span>
          <span class="link-value">nsomaraj</span>
        </div>
      </a>
    </div>

    <div class="divider" />

    <footer class="about-footer">
      <p>Made with ❤️ for productivity</p>
      <p class="copyright">© {{ currentYear }} Somaraj N. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import appIcon from '../../../build/icon.png';

const appVersion = __APP_VERSION__;
const currentYear = computed(() => new Date().getFullYear());

function openLink(url: string): void {
  window.notionBridge.window.openExternal(url);
}
</script>

<style scoped>
.about-panel {
  padding: 24px 20px;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  user-select: text;
}

/* ── Hero ── */
.app-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.app-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
}

.app-name {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.app-version {
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  background: var(--color-surface);
  padding: 2px 10px;
  border-radius: 20px;
  margin-top: 2px;
}

.app-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 6px 0 0;
  max-width: 300px;
}

/* ── Divider ── */
.divider {
  height: 1px;
  background: var(--color-border);
  margin: 16px 0;
}

/* ── Developer ── */
.dev-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dev-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.dev-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

/* ── Links Grid ── */
.links-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  overflow: hidden;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--color-text);
  transition: all 0.15s ease;
  cursor: pointer;
  border: 1px solid transparent;
}

.link-item:hover {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.link-icon {
  font-size: 18px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.link-text {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  overflow: hidden;
}

.link-label {
  font-size: 10px;
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.link-value {
  font-size: 12px;
  color: var(--color-accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Footer ── */
.about-footer {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.about-footer p {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.copyright {
  font-size: 10px !important;
  opacity: 0.6;
}
</style>
