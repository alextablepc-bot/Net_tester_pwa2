// modules/api.js
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

export function setupApiTab() {
  const apiTab = document.querySelector('[data-tab="api"]');
  if (apiTab) {
    apiTab.addEventListener('click', () => {
      if (!apiCardsRendered) {
        renderEmptyApiCards();
        apiCardsRendered = true;
      }
    });
  }
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