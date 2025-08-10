const ws = new WebSocket('ws://localhost:3000');
let characters = { killers: [], survivors: [] };
let overlayData = { settings: {}, streaks: [] };

const streakList = document.getElementById('streak-list');
const addBtn = document.getElementById('add-streak');
const updateBtn = document.getElementById('update-overlay');
const fontFaceSel = document.getElementById('font-face');
const fontSizeInput = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');

const fonts = ['Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald'];
fonts.forEach(f => {
  const opt = document.createElement('option');
  opt.value = f;
  opt.textContent = f;
  fontFaceSel.appendChild(opt);
});

fetch('characters.json').then(r => r.json()).then(data => {
  characters = data;
  loadFromLocal();
});

function defaultOverlay() {
  return {
    settings: { fontFace: 'Roboto', fontSize: 18, fontColor: '#ffffff' },
    streaks: []
  };
}

function loadFromLocal() {
  const raw = localStorage.getItem('overlayData');
  overlayData = raw ? JSON.parse(raw) : defaultOverlay();
  fontFaceSel.value = overlayData.settings.fontFace;
  fontSizeInput.value = overlayData.settings.fontSize;
  fontColorInput.value = overlayData.settings.fontColor;
  overlayData.streaks.forEach(s => addStreak(s));
}

function saveToLocal() {
  overlayData = {
    settings: {
      fontFace: fontFaceSel.value,
      fontSize: Number(fontSizeInput.value) || 18,
      fontColor: fontColorInput.value || '#ffffff'
    },
    streaks: Array.from(streakList.children).map(row => {
      const selected = row.querySelector('.character-type').value;
      const type = selected === 'Survivor' ? 'Survivor' : selected === 'Other' ? 'Other' : 'Killer';
      const survivorSel = row.querySelector('.survivor-select');
      const otherInput = row.querySelector('.other-input');
      return {
        type,
        killer: type === 'Killer' ? selected : '',
        survivor: survivorSel ? survivorSel.value : '',
        other: otherInput ? otherInput.value : '',
        count: Number(row.querySelector('.count-input').value) || 0,
        record: row.querySelector('.record-input').value ? Number(row.querySelector('.record-input').value) : null,
        recordLabel: row.querySelector('.record-label').value
      };
    })
  };
  localStorage.setItem('overlayData', JSON.stringify(overlayData));
}

function addStreak(data = {}) {
  const row = document.createElement('div');
  row.className = 'streak';
  row.draggable = true;

  const charSel = document.createElement('select');
  charSel.className = 'character-type';
  characters.killers.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    charSel.appendChild(opt);
  });
  const survOpt = document.createElement('option');
  survOpt.value = 'Survivor';
  survOpt.textContent = 'Survivor';
  charSel.appendChild(survOpt);
  const otherOpt = document.createElement('option');
  otherOpt.value = 'Other';
  otherOpt.textContent = 'Other';
  charSel.appendChild(otherOpt);
  row.appendChild(charSel);

  const survivorSel = document.createElement('select');
  survivorSel.className = 'survivor-select';
  characters.survivors.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    survivorSel.appendChild(opt);
  });
  survivorSel.style.display = 'none';
  row.appendChild(survivorSel);

  const otherInput = document.createElement('input');
  otherInput.className = 'other-input';
  otherInput.placeholder = 'Label';
  otherInput.style.display = 'none';
  row.appendChild(otherInput);

  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'count-input';
  countInput.value = data.count || 0;
  row.appendChild(countInput);

  const incBtn = document.createElement('button');
  incBtn.textContent = '+';
  incBtn.addEventListener('click', () => {
    countInput.value = Number(countInput.value) + 1;
    saveToLocal();
  });
  row.appendChild(incBtn);

  const recordInput = document.createElement('input');
  recordInput.type = 'number';
  recordInput.className = 'record-input';
  recordInput.placeholder = 'Record/Target';
  row.appendChild(recordInput);

  const recordLabel = document.createElement('input');
  recordLabel.type = 'text';
  recordLabel.className = 'record-label';
  recordLabel.placeholder = 'Label';
  row.appendChild(recordLabel);

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Delete';
  delBtn.className = 'delete';
  delBtn.addEventListener('click', () => {
    row.remove();
    saveToLocal();
  });
  row.appendChild(delBtn);

  // Drag events
  row.addEventListener('dragstart', e => {
    row.classList.add('dragging');
    e.dataTransfer.setData('text/plain', '');
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
  });

  // Apply data
  if (data.type === 'Survivor') {
    charSel.value = 'Survivor';
    survivorSel.style.display = '';
    survivorSel.value = data.survivor || '';
  } else if (data.type === 'Other') {
    charSel.value = 'Other';
    otherInput.style.display = '';
    otherInput.value = data.other || '';
  } else if (data.killer) {
    charSel.value = data.killer;
  }
  countInput.value = data.count || 0;
  recordInput.value = data.record ?? '';
  recordLabel.value = data.recordLabel || '';

  charSel.addEventListener('change', () => {
    if (charSel.value === 'Survivor') {
      survivorSel.style.display = '';
      otherInput.style.display = 'none';
    } else if (charSel.value === 'Other') {
      survivorSel.style.display = 'none';
      otherInput.style.display = '';
    } else {
      survivorSel.style.display = 'none';
      otherInput.style.display = 'none';
    }
    saveToLocal();
  });

  [survivorSel, otherInput, countInput, recordInput, recordLabel].forEach(el => {
    el.addEventListener('input', saveToLocal);
  });

  streakList.appendChild(row);
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.streak:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

addBtn.addEventListener('click', () => {
  addStreak();
  saveToLocal();
});

updateBtn.addEventListener('click', () => {
  saveToLocal();
  ws.send(JSON.stringify({ type: 'update', data: overlayData }));
});

fontFaceSel.addEventListener('change', saveToLocal);
fontSizeInput.addEventListener('input', saveToLocal);
fontColorInput.addEventListener('input', saveToLocal);

streakList.addEventListener('dragover', e => {
  e.preventDefault();
  const dragging = document.querySelector('.streak.dragging');
  const after = getDragAfterElement(streakList, e.clientY);
  if (dragging) {
    if (after == null) {
      streakList.appendChild(dragging);
    } else {
      streakList.insertBefore(dragging, after);
    }
  }
});
streakList.addEventListener('drop', () => {
  saveToLocal();
});

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'reload') {
    location.reload();
  }
});
