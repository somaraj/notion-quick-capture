// src/renderer/about-main.ts — Vue app entry point (about panel)
import { createApp } from 'vue';
import AboutPanel from './about/AboutPanel.vue';
import './styles/globals.css';
import { initAppearance } from './lib/theme';

void initAppearance();
const app = createApp(AboutPanel);
app.mount('#app');
