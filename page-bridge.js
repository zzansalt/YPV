(() => {
  const CHANNEL = 'yt-precise-volume-bridge';

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.channel !== 'yt-precise-volume-content') return;
    const player = document.getElementById('movie_player');
    if (!player) return;
    if (event.data.type === 'get-volume' && typeof player.getVolume === 'function') {
      window.postMessage({ channel: CHANNEL, type: 'volume', id: event.data.id, revision: event.data.revision, value: player.getVolume() }, '*');
    } else if (event.data.type === 'set-volume' && typeof player.setVolume === 'function') {
      const value = Math.min(100, Math.max(0, Math.round(Number(event.data.value) || 0)));
      if (value > 0 && typeof player.isMuted === 'function' && player.isMuted() && typeof player.unMute === 'function') player.unMute();
      player.setVolume(value);
      requestAnimationFrame(() => {
        window.postMessage({ channel: CHANNEL, type: 'set-result', revision: event.data.revision, value: player.getVolume() }, '*');
      });
    }
  });
})();
