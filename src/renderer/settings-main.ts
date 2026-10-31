// src/renderer/settings-main.ts — Vue app entry point (settings panel)
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import SettingsPanel from './settings/SettingsPanel.vue';
import './styles/globals.css';
import './settings/settings.css';

const app = createApp(SettingsPanel);
app.use(createPinia());
app.mount('#app');
