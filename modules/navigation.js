// modules/navigation.js
import { initSites } from './sites.js';

export function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Прокрутка к верху
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (tab === 'sites' && !window.sitesInitialized) initSites();
    });
  });
}