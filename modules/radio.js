// modules/radio.js
const radioAudio = document.getElementById('radio-audio');
const nowPlayingEl = document.getElementById('now-playing');
let currentStationDiv = null;

export function setupRadioTab() {
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
}