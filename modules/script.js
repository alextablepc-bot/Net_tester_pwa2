// script.js
const ICONS = {
  sites: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
  api: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21C5,22.1 5.9,23 7,23H17C18.1,23 19,22.1 19,21V3C19,1.89 18.1,1 17,1Z"/></svg>`,
  radio: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
  Object.entries(ICONS).forEach(([key, svg]) => {
    const el = document.getElementById(`icon-${key}`);
    if (el) el.innerHTML = svg;
  });

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

  fetchNetworkInfo();
  const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
  if (activeTab === 'sites' && !window.sitesInitialized) initSites();

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

let sitesData = { critical: [], popular: [], rkn: [] };
let siteStatus = { critical: {}, popular: {}, rkn: {} };
window.sitesInitialized = false;

function initSites() {
  if (window.sitesInitialized) return;
  window.sitesInitialized = true;
  loadSiteLists();
}

async function loadSiteLists() {
  const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
  try {
    // Проверяем, есть ли интернет перед загрузкой
    if (!navigator.onLine) {
      console.warn('Нет интернета, используем заглушки');
      // Заглушки, если нет сети
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
    console.error('Ошибка загрузки списков', e); // Исправлено: e теперь в области видимости
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

  // Запускаем проверки для всех типов параллельно
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
            mode: 'no-cors', // Важно: no-cors не позволяет получить реальный статус
            cache: 'no-store'
          }));
          if (!resolved) { resolved = true; resolve(true); }
        } else {
          const response = await withTimeout(fetch(fullPath, {
            mode: 'no-cors',
            cache: 'no-store'
          }));
          // В режиме no-cors response.ok всегда true, проверка размера — слабая эвристика
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

// === Верхняя панель ===
async function fetchNetworkInfo() {
  try {
    // Исправлено: убраны пробелы в URL
    const ipRes = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      document.getElementById('location-info').textContent = `IP: ${ipData.ip}`;
    }
  } catch (e) {}

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    // Исправлено: убраны пробелы в URL
    const res = await fetch('https://worldtimeapi.org/api/ip', {
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (res.ok) {
      const d = await res.json();
      const dt = new Date(d.datetime);
      document.getElementById('time-info').textContent = dt.toLocaleTimeString('ru-RU');
      const loc = `${d.country_name || ''}${d.city ? `, ${d.city}` : ''}`.trim();
      if (loc) document.getElementById('location-info').textContent = loc;
    }
  } catch (e) {
    if (document.getElementById('location-info').textContent === '—') {
      document.getElementById('location-info').textContent = '—';
    }
  }

  try {
    const start = performance.now();
    // Исправлено: убраны пробелы в URL
    await fetch('https://httpbin.org/delay/0', {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });
    const ping = Math.round(performance.now() - start);
    document.getElementById('ping-info').textContent = `🏓 ${ping} мс`;
  } catch (e) {
    document.getElementById('ping-info').textContent = '🏓 —';
  }

  setTimeout(fetchNetworkInfo, 30000);
}

// === API ===
const API_TESTS = [
  { id: 'client', name: 'Информация о клиенте', category: 'client', url: 'https://ipinfo.io/json', method: 'GET', headers: {} },
  { id: 'dns_basic', name: 'Обычный DNS (Google)', category: 'dns', url: 'https://dns.google/resolve?name=google.com&type=A', method: 'GET', headers: {'accept': 'application/json'} },
  { id: 'dns_doh', name: 'DNS over HTTPS (Cloudflare)', category: 'dns', url: 'https://cloudflare-dns.com/dns-query?name=google.com&type=A', method: 'GET', headers: {'accept': 'application/dns-json'} },
  { id: 'warp', name: 'Cloudflare WARP', category: 'bypass', url: 'https://1.1.1.1/cdn-cgi/trace', method: 'GET', headers: {} },
  { id: 'tls', name: 'TLS-сертификаты (crt.sh)', category: 'security', url: 'https://crt.sh/?q=google.com&output=json', method: 'GET', headers: {} },
  { id: 'time', name: 'Синхронизация времени (NTP)', category: 'network', url: 'https://worldtimeapi.org/api/ip', method: 'GET', headers: {} },
  { id: 'ping', name: 'Задержка (Ping)', category: 'network', url: 'https://httpbin.org/delay/0', method: 'GET', headers: {} }
];

let apiCardsRendered = false;
const apiTab = document.querySelector('[data-tab="api"]');
if (apiTab) {
  apiTab.addEventListener('click', () => {
    if (!apiCardsRendered) {
      renderEmptyApiCards();
      apiCardsRendered = true;
    }
  });
}

function renderEmptyApiCards() {
  const container = document.getElementById('api-results');
  container.innerHTML = '';
  API_TESTS.forEach(test => {
    const card = document.createElement('div');
    card.className = 'api-item';
    card.dataset.category = test.category;
    card.innerHTML = `
      <div class="api-name">${test.name}</div>
      <div class="api-url">${test.url}</div>
      <div class="api-extra">—</div>
      <div class="api-details">
        <span class="api-status gray"></span>
        <span>Ожидает запуска</span>
      </div>
    `;
    container.appendChild(card);
  });
}

document.getElementById('start-api-btn')?.addEventListener('click', runApiChecks);

async function runApiChecks() {
  const container = document.getElementById('api-results');
  container.innerHTML = '<p>Выполняется проверка…</p>';

  const results = [];
  for (const test of API_TESTS) {
    const start = performance.now();
    let status = 'gray', time = 0, error = '', extraInfo = '';

    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      const opts = {
        method: test.method,
        headers: test.headers || {},
        signal: ctrl.signal,
        cache: 'no-store'
      };
      const res = await fetch(test.url, opts);
      time = Math.round(performance.now() - start);
      status = res.ok ? 'green' : 'yellow';
      if (!res.ok) error = `HTTP ${res.status}`;

      if (res.ok) {
        if (test.id === 'client') {
          const data = await res.json();
          extraInfo = `IP: ${data.ip}<br>ASN: ${data.org || '—'}<br>Город: ${data.city}, ${data.country}`;
        } else if (test.id === 'dns_basic') {
          const data = await res.json();
          const ip = data.Answer && data.Answer[0]?.data;
          extraInfo = `IPv4: ${ip || '—'}`;
        } else if (test.id === 'dns_doh') {
          const data = await res.json();
          const ip = data.Answer && data.Answer[0]?.data;
          extraInfo = `DoH IPv4: ${ip || '—'}`;
        } else if (test.id === 'warp') {
          const text = await res.text();
          const ipMatch = text.match(/ip=([^\n]+)/);
          const warpMatch = text.match(/warp=([^\n]+)/);
          const ip = ipMatch ? ipMatch[1] : '—';
          const warp = warpMatch ? warpMatch[1] : 'off';
          extraInfo = `IP: ${ip}<br>WARP: ${warp}`;
        } else if (test.id === 'tls') {
          const data = await res.json();
          extraInfo = Array.isArray(data) && data.length > 0
            ? `Найдено сертификатов: ${data.length}`
            : 'Сертификаты не найдены';
        } else if (test.id === 'time') {
          const data = await res.json();
          const dt = new Date(data.datetime);
          extraInfo = `Часовой пояс: ${data.timezone}<br>Время: ${dt.toLocaleTimeString('ru-RU')}`;
        } else if (test.id === 'ping') {
          extraInfo = `Задержка: ${time} мс`;
        }
      }
    } catch (e) {
      status = 'red';
      time = Math.round(performance.now() - start);
      error = e.name === 'AbortError' ? 'Таймаут' : 'Ошибка';
      extraInfo = '—';
    }

    results.push({ ...test, status, time, error, extraInfo });
  }

  // --- Анализ результатов ---
  const analysis = analyzeResults(results);

  // --- Вывод ---
  container.innerHTML = '';
  results.forEach(r => {
    const card = document.createElement('div');
    card.className = 'api-item';
    card.innerHTML = `
      <div class="api-name">${r.name}</div>
      <div class="api-url">${r.url}</div>
      <div class="api-extra">${r.extraInfo}</div>
      <div class="api-details">
        <span class="api-status ${r.status}"></span>
        ${r.time ? `<span>⏱️ ${r.time} мс</span>` : ''}
        ${r.error ? `<span class="api-error">⚠️ ${r.error}</span>` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  // Добавляем блок с анализом
  if (analysis.summary) {
    const analysisCard = document.createElement('div');
    analysisCard.className = 'api-item';
    analysisCard.style.border = '2px solid var(--link)';
    analysisCard.style.marginTop = '10px';
    analysisCard.innerHTML = `
      <div class="api-name">📊 Анализ соединения</div>
      <div class="api-extra">${analysis.summary}</div>
      <div class="api-details">
        <span class="api-status ${analysis.status}"></span>
        <span>Сводка</span>
      </div>
    `;
    container.appendChild(analysisCard);
  }
}

function analyzeResults(results) {
  let summary = [];
  let status = 'gray';

  const clientTest = results.find(r => r.id === 'client');
  const dnsBasic = results.find(r => r.id === 'dns_basic');
  const dnsDoh = results.find(r => r.id === 'dns_doh');
  const pingTest = results.find(r => r.id === 'ping');
  const warpTest = results.find(r => r.id === 'warp');

  if (clientTest && clientTest.status === 'green') {
    summary.push(`🌐 Вы подключены как: ${clientTest.extraInfo.split('<br>')[0]}`);
  }

  if (dnsBasic && dnsDoh && dnsBasic.status === 'green' && dnsDoh.status === 'green') {
    const basicIP = dnsBasic.extraInfo.match(/IPv4: ([\d.]+)/)?.[1];
    const dohIP = dnsDoh.extraInfo.match(/DoH IPv4: ([\d.]+)/)?.[1];
    if (basicIP && dohIP && basicIP !== dohIP) {
      summary.push('⚠️ DNS-подмена обнаружена (обычный DNS != DoH)');
      status = 'yellow';
    } else if (basicIP && dohIP) {
      summary.push('✅ DNS-трафик не подменяется (обычный DNS == DoH)');
      if (status !== 'red') status = 'green';
    }
  }

  if (pingTest && pingTest.time > 200) {
    summary.push(`🐌 Высокая задержка: ${pingTest.time} мс`);
    status = 'yellow';
  } else if (pingTest && pingTest.time <= 100) {
    summary.push(`⚡ Низкая задержка: ${pingTest.time} мс`);
    if (status !== 'red') status = 'green';
  }

  if (warpTest && warpTest.status === 'green') {
    const warpStatus = warpTest.extraInfo.match(/WARP: (on|off)/)?.[1];
    if (warpStatus === 'on') {
      summary.push('🔒 Используется Cloudflare WARP (обход)');
      if (status !== 'red') status = 'green';
    }
  }

  return {
    summary: summary.join('<br>'),
    status: status
  };
}

// === Радио ===
const radioAudio = document.getElementById('radio-audio');
const nowPlayingEl = document.getElementById('now-playing');
let currentStationDiv = null;

document.getElementById('tab-radio').addEventListener('click', (e) => {
  if (!e.target.classList.contains('radio-toggle-btn')) return;
  const stationDiv = e.target.closest('.station');
  const url = stationDiv.dataset.url;
  const stationName = stationDiv.querySelector('.station-name').textContent;

  if (radioAudio.src === url && !radioAudio.paused) {
    radioAudio.pause();
    e.target.textContent = '▶';
    nowPlayingEl.textContent = 'Воспроизведение остановлено';
    currentStationDiv = null;
  } else {
    // Убрана логика сброса старой кнопки при переключении вкладок
    radioAudio.src = url;
    radioAudio.play().then(() => {
      e.target.textContent = '⏸';
      nowPlayingEl.textContent = `Сейчас играет: ${stationName}`;
      currentStationDiv = stationDiv;
    }).catch(() => {
      nowPlayingEl.textContent = 'Ошибка воспроизведения';
      radioAudio.src = '';
      e.target.textContent = '▶';
      currentStationDiv = null;
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