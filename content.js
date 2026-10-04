(() => {
  const PANEL_CLASS = 'yt-precise-volume';
  let panel;
  let video;
  let syncTimer;
  let pollTimer;
  let apiVolume = null;
  let requestId = 0;
  let readPending = false;
  let volumeRevision = 0;
  let inputTimer;
  let volumeStep = 5;
  let playerElement;
  let keyBindings = { volumeUp: null, volumeDown: null };

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.channel !== 'yt-precise-volume-bridge') return;
    if (event.data.type === 'volume') {
      readPending = false;
      if (event.data.revision === volumeRevision) {
        apiVolume = clamp(event.data.value);
        syncInput();
      }
    } else if (event.data.type === 'set-result') {
      if (event.data.revision === volumeRevision) {
        apiVolume = clamp(event.data.value);
        syncInput();
      }
    }
  });

  const clamp = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  const volumePercent = () => apiVolume ?? 0;

  function requestVolume() {
    if (readPending) return;
    readPending = true;
    window.postMessage({ channel: 'yt-precise-volume-content', type: 'get-volume', id: ++requestId, revision: volumeRevision }, '*');
    setTimeout(() => { readPending = false; }, 500);
  }

  function setVolume(value) {
    if (!video) return;
    const percent = clamp(value);
    volumeRevision++;
    apiVolume = percent;
    window.postMessage({ channel: 'yt-precise-volume-content', type: 'set-volume', value: percent, revision: volumeRevision }, '*');
    syncInput();
  }

  function keyCombo(event) {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('CTRL');
    if (event.altKey) modifiers.push('ALT');
    if (event.shiftKey) modifiers.push('SHIFT');
    if (event.metaKey) modifiers.push('META');
    return [...modifiers, event.code.toUpperCase()].join('+');
  }

  function isEditable(target) {
    return target instanceof HTMLElement && (
      target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
    );
  }

  document.addEventListener('keydown', (event) => {
    if (isEditable(event.target)) return;
    const combo = keyCombo(event);
    if (keyBindings.volumeUp && combo === keyBindings.volumeUp) {
      event.preventDefault();
      setVolume(volumePercent() + volumeStep);
    } else if (keyBindings.volumeDown && combo === keyBindings.volumeDown) {
      event.preventDefault();
      setVolume(volumePercent() - volumeStep);
    }
  }, true);

  chrome.storage.sync.get({ volumeUp: null, volumeDown: null, volumeStep: 5 }, (settings) => {
    keyBindings = settings;
    volumeStep = clamp(settings.volumeStep || 5);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.volumeUp) keyBindings.volumeUp = changes.volumeUp.newValue;
    if (changes.volumeDown) keyBindings.volumeDown = changes.volumeDown.newValue;
    if (changes.volumeStep) volumeStep = clamp(changes.volumeStep.newValue || 5);
  });

  function syncInput() {
    if (!panel || !video) return;
    const input = panel.querySelector('input');
    if (document.activeElement !== input) input.value = String(volumePercent());
  }

  function createPanel(volumeArea) {
    panel = document.createElement('div');
    panel.className = PANEL_CLASS;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Precise volume control');
    panel.innerHTML = '<input type="number" min="0" max="100" step="1" inputmode="numeric" aria-label="Volume percentage"><span aria-hidden="true">%</span>';

    const input = panel.querySelector('input');
    input.addEventListener('input', () => {
      clearTimeout(inputTimer);
      if (input.value !== '') inputTimer = setTimeout(() => setVolume(input.value), 250);
    });
    input.addEventListener('change', () => {
      clearTimeout(inputTimer);
      if (input.value !== '') setVolume(input.value);
    });
    input.addEventListener('blur', () => {
      clearTimeout(inputTimer);
      if (input.value !== '') setVolume(input.value);
      syncInput();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        setVolume(input.value);
        input.blur();
      }
      event.stopPropagation();
    });
    input.addEventListener('focus', (event) => {
      event.stopPropagation();
      playerElement?.classList.add('ytpv-focus-lock');
    });
    input.addEventListener('blur', () => playerElement?.classList.remove('ytpv-focus-lock'));
    // The panel is absolutely positioned inside the pill; CSS expands the pill's
    // padding on hover to make room without shrinking the native slider track.
    volumeArea.append(panel);
    syncInput();
  }

  function attach() {
    const nextVideo = document.querySelector('video.html5-main-video');
    const nextPlayer = document.getElementById('movie_player');
    const volumeArea = nextPlayer?.querySelector('.ytp-volume-area');
    if (!nextVideo || !nextPlayer || !volumeArea) return;
    playerElement = nextPlayer;

    if (video !== nextVideo) {
      video?.removeEventListener('volumechange', syncInput);
      video = nextVideo;
      video.addEventListener('volumechange', syncInput);
    }
    if (!panel || !panel.isConnected || panel.parentElement !== volumeArea) {
      panel?.remove();
      createPanel(volumeArea);
    }
    syncInput();
    if (!pollTimer) pollTimer = setInterval(requestVolume, 120);
  }

  function scheduleAttach() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(attach, 100);
  }

  new MutationObserver(scheduleAttach).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', scheduleAttach);
  scheduleAttach();
})();
