// modules/sites.js
let sitesData = { critical: [], popular: [], rkn: [] };
let siteStatus = { critical: {}, popular: {}, rkn: {} };
window.sitesInitialized = false;

export function initSites() {
  if (window.sitesInitialized) return;
  window.sitesInitialized = true;
  loadSiteLists();
}

async function loadSiteLists() {
  const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
  try {
    if (!navigator.onLine) {
      console.warn('Нет интернета, используем заглушки');
      sitesData = { critical: [], popular: [], rkn: [] };
      renderSiteGroups();
      return;
    }
    const [critical, popular, rkn] = await Promise.all([
      fetch(BASE + 'sites-critical.json', { cache: 'no-store' }).then(r => r.json()),
      fetch(BASE + 'sites-popular.json', { cache: 'no-store' }).then(r => r.json()),
      fetch(BASE + 'sites-rkn-blocked.json', { cache: 'no-store' }).then(r => r.json())
    ]);
    sitesData = { critical, popular, rkn };
    renderSiteGroups();
  } catch (e) {
    console.error('Ошибка загрузки списков', e);
    document.getElementById('diagnosis').textContent = '❌ Ошибка загрузки списков';
  }
}

function renderSiteGroups() {
  const container = document.getElementById('sites-list');
  container.innerHTML = '';
  const names = { critical: 'Социально значимые', popular: 'Популярные', rkn: 'Заблокированные РКН' };
  ['critical', 'popular', 'rkn'].forEach(type => {
    const group = document.createElement('div');
    group.className = 'site-group';
    group.innerHTML = `
      <div class="group-header" data-type="${type}">
        <span>${names[type]}</span>
        <span class="status-box gray"></span>
      </div>
      <div class="icon-grid" id="grid-${type}"></div>
    `;
    container.appendChild(group);
    renderSiteIcons(type, false);
    group.querySelector('.group-header').addEventListener('click', () => {
      const grid = group.querySelector('.icon-grid');
      grid.classList.toggle('expanded', !grid.classList.contains('expanded'));
      renderSiteIcons(type, grid.classList.contains('expanded'));
    });
  });
}

function renderSiteIcons(type, expanded = false) {
  const grid = document.getElementById(`grid-${type}`);
  if (!grid) return;
  grid.innerHTML = '';
  const count = sitesData[type].length || (type === 'critical' ? 44 : type === 'popular' ? 32 : 8);
  for (let i = 0; i < count; i++) {
    const site = sitesData[type][i] || { name: 'Загрузка...', url: '#' };
    const status = siteStatus[type][site.url] || 'gray';
    const div = document.createElement('div');
    div.className = 'site-item';
    div.innerHTML = `
      <div class="site-item-frame">
        <div class="status-box ${status}"></div>
        <a href="${site.url}" target="_blank" rel="noopener" class="site-name">${site.name}</a>
      </div>
    `;
    grid.appendChild(div);
  }
}

// === Проверка сайтов ===
let currentCheckAbort = null;
document.getElementById('start-sites-btn')?.addEventListener('click', runSiteChecks);

async function runSiteChecks() {
  if (currentCheckAbort) currentCheckAbort();
  if (!navigator.onLine) {
    handleOfflineState();
    return;
  }

  let abort = false;
  currentCheckAbort = () => { abort = true; };

  if (!window.sitesInitialized) await initSites();
  siteStatus = { critical: {}, popular: {}, rkn: {} };
  ['critical', 'popular', 'rkn'].forEach(type => {
    document.querySelector(`.group-header[data-type="${type}"] .status-box`).className = 'status-box gray';
    renderSiteIcons(type, false);
  });

  let totals = { critical: 0, popular: 0, rkn: 0 };
  let available = { critical: 0, popular: 0, rkn: 0 };

  const checks = ['critical', 'popular', 'rkn'].map(async (type) => {
    if (abort) return;
    for (const site of sitesData[type]) {
      if (abort) break;
      const isUp = await checkSiteMulti(site.url);
      const status = isUp ? 'green' : 'red';
      siteStatus[type][site.url] = status;
      if (isUp) available[type]++;
      totals[type]++;
      renderSiteIcons(type, false);
    }
  });

  await Promise.all(checks);

  currentCheckAbort = null;

  ['critical', 'popular', 'rkn'].forEach(type => {
    const perc = totals[type] ? available[type] / totals[type] : 0;
    let cls = 'gray';
    if (perc >= 0.7) cls = 'green';
    else if (perc >= 0.3) cls = 'yellow';
    else cls = 'red';
    document.querySelector(`.group-header[data-type="${type}"] .status-box`).className = `status-box ${cls}`;
  });

  updateDiagnosis(available, totals);
}

function handleOfflineState() {
  document.getElementById('diagnosis').textContent = '❌ Нет интернета';
  ['critical', 'popular', 'rkn'].forEach(type => {
    sitesData[type].forEach(site => {
      siteStatus[type][site.url] = 'red';
    });
    renderSiteIcons(type, false);
    document.querySelector(`.group-header[data-type="${type}"] .status-box`).className = 'status-box red';
  });
}

// === НАДЁЖНАЯ ПРОВЕРКА БЕЗ КЭША (с оговорками) ===
function checkSiteMulti(url) {
  const TIMEOUT = 4000;
  const probes = [
    '/robots.txt',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/favicon.png'
  ];

  return new Promise(resolve => {
    let resolved = false;

    const tryProbe = async (path) => {
      if (resolved) return;
      const cacheBuster = Date.now() + Math.random().toString(36).slice(2, 10);
      const fullPath = `${url}${path}?_=${cacheBuster}`;

      const withTimeout = (promise) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT))
        ]);
      };

      try {
        if (path.endsWith('.txt')) {
          await withTimeout(fetch(fullPath, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store'
          }));
          if (!resolved) { resolved = true; resolve(true); }
        } else {
          const response = await withTimeout(fetch(fullPath, {
            mode: 'no-cors',
            cache: 'no-store'
          }));
          const blob = await response.blob();
          if (blob.size > 100 && !resolved) {
            resolved = true;
            resolve(true);
          }
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    };

    Promise.allSettled(probes.map(p => tryProbe(p))).then(() => {
      if (!resolved) resolve(false);
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, TIMEOUT + 500);
  });
}

function updateDiagnosis(avail, totals) {
  const critPerc = totals.critical ? avail.critical / totals.critical : 0;
  const popPerc = totals.popular ? avail.popular / totals.popular : 0;
  const rknPerc = totals.rkn ? avail.rkn / totals.rkn : 0;
  let msg = '✅ Диагностика завершена';
  if (critPerc < 0.3 && popPerc < 0.3 && rknPerc < 0.3) msg = '❌ Проблемы со связью';
  else if (critPerc >= 0.7 && popPerc < 0.3 && rknPerc < 0.3) msg = '🚧 Только социально значимые ресурсы';
  else if (critPerc >= 0.7 && popPerc >= 0.7 && rknPerc < 0.3) msg = '🌐 Интернет с цензурой';
  else if (critPerc >= 0.7 && popPerc >= 0.7 && rknPerc >= 0.7) msg = '🌍 Глобальный интернет';
  else msg = '✅ Частичная доступность';
  document.getElementById('diagnosis').textContent = msg;
}