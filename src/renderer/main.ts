// src/renderer/main.ts — Vue app entry point (capture panel)
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CapturePanel from './capture/CapturePanel.vue';
import './styles/globals.css';

const app = createApp(CapturePanel);
app.use(createPinia());
app.mount('#app');
