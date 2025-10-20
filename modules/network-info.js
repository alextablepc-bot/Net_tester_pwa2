// modules/network-info.js
export async function fetchNetworkInfo() {
  try {
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