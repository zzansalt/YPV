(() => {
  const controls = {
    volumeUp: document.getElementById('up'),
    volumeDown: document.getElementById('down')
  };
  const stepInput = document.getElementById('step');
  let capturing = null;

  function labelFor(combo) {
    if (!combo) return '설정 안 됨';
    return combo.split('+').map((part) => {
      const names = {
      CTRL: 'Ctrl', ALT: 'Alt', SHIFT: 'Shift', META: 'Meta',
      ARROWUP: '↑', ARROWDOWN: '↓', ARROWLEFT: '←', ARROWRIGHT: '→',
      SPACE: 'Space'
      };
      return names[part] || part.replace(/^KEY/, '');
    }).join(' + ');
  }

  function comboFor(event) {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('CTRL');
    if (event.altKey) modifiers.push('ALT');
    if (event.shiftKey) modifiers.push('SHIFT');
    if (event.metaKey) modifiers.push('META');
    return [...modifiers, event.code.toUpperCase()].join('+');
  }

  function refresh() {
    chrome.storage.sync.get({ volumeUp: null, volumeDown: null, volumeStep: 5 }, (settings) => {
      controls.volumeUp.textContent = labelFor(settings.volumeUp);
      controls.volumeDown.textContent = labelFor(settings.volumeDown);
      stepInput.value = settings.volumeStep;
    });
  }

  Object.entries(controls).forEach(([name, button]) => {
    button.addEventListener('click', () => {
      capturing = name;
      button.classList.add('listening');
      button.textContent = '키를 누르세요… (Esc 취소)';
      document.getElementById('status').textContent = '';
    });
  });

  document.addEventListener('keydown', (event) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      capturing = null;
      Object.values(controls).forEach((button) => button.classList.remove('listening'));
      refresh();
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;

    const combo = comboFor(event);
    const other = capturing === 'volumeUp' ? 'volumeDown' : 'volumeUp';
    chrome.storage.sync.get({ volumeUp: null, volumeDown: null }, (settings) => {
      if (settings[other] === combo) {
        document.getElementById('status').textContent = '같은 키 조합은 두 기능에 함께 지정할 수 없습니다.';
        return;
      }
      chrome.storage.sync.set({ [capturing]: combo }, () => {
        document.getElementById('status').textContent = '단축키를 저장했습니다.';
        capturing = null;
        Object.values(controls).forEach((button) => button.classList.remove('listening'));
        refresh();
      });
    });
  }, true);

  document.querySelectorAll('[data-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      chrome.storage.sync.set({ [button.dataset.clear]: null }, () => {
        document.getElementById('status').textContent = '단축키를 지웠습니다.';
        refresh();
      });
    });
  });

  function saveStep() {
    const value = Math.min(100, Math.max(1, Math.round(Number(stepInput.value) || 5)));
    stepInput.value = value;
    chrome.storage.sync.set({ volumeStep: value }, () => {
      document.getElementById('status').textContent = `변경 폭을 ${value}%로 저장했습니다.`;
    });
  }

  stepInput.addEventListener('change', saveStep);
  stepInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      saveStep();
      stepInput.blur();
    }
  });

  refresh();
})();
