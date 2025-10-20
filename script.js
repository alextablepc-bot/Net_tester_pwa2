// script.js
import { ICONS } from './modules/icons.js';
import { setupNavigation } from './modules/navigation.js';
import { fetchNetworkInfo } from './modules/network-info.js';
import { setupApiTab } from './modules/api.js';
import { setupRadioTab } from './modules/radio.js';

document.addEventListener('DOMContentLoaded', () => {
  Object.entries(ICONS).forEach(([key, svg]) => {
    const el = document.getElementById(`icon-${key}`);
    if (el) el.innerHTML = svg;
  });

  setupNavigation();
  setupApiTab();
  setupRadioTab();

  fetchNetworkInfo();
  const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
  if (activeTab === 'sites' && !window.sitesInitialized) initSites(); // initSites теперь импортирована в navigation.js, но доступна глобально через window

  // Проверка обновления Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
});

// Совместимость
if (!AbortSignal.timeout) {
  AbortSignal.timeout = ms => {
    try {
      const c = new AbortController();
      setTimeout(() => c.abort(), ms);
      return c.signal;
    } catch {
      // Возврат пустого сигнала, если не поддерживается
      return new AbortController().signal;
    }
  };
}