import charactersJson from './characters.json';
const ws = new WebSocket('ws://localhost:3000');
let characters = { killers: [], survivors: [] };

function normalizeCharacterData(raw) {
  const result = { killers: [], survivors: [] };
  if (!raw || typeof raw !== 'object') return result;
  const killerSource = raw.killers || raw.killer || raw.Killers || raw.Killer || [];
  const survivorSource = raw.survivors || raw.survivor || raw.Survivors || raw.Survivor || [];
  const normalizeList = list => Array.isArray(list)
    ? list.map(item => typeof item === 'string' ? item : (item && (item.name || item.label || item.title)) || '')
        .filter(Boolean)
    : [];
  result.killers = normalizeList(killerSource);
  result.survivors = normalizeList(survivorSource);
  return result;
}
let overlayData = { settings: {}, streaks: [] };

const streakList = document.getElementById('streak-list');
const addBtn = document.getElementById('add-streak');
const updateBtn = document.getElementById('update-overlay');
const resetBtn = document.getElementById('reset-all');
const fontFaceSel = document.getElementById('font-face');
const fontSizeInput = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');
const updateToastEl = document.getElementById('update-toast');
let updateToast;

const fonts = ['Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald'];
fonts.forEach(f => {
  const opt = document.createElement('option');
  opt.value = f;
  opt.textContent = f;
  fontFaceSel.appendChild(opt);
});

// Load and normalize character data from bundled JSON (supports multiple shapes)
characters = normalizeCharacterData(charactersJson);
loadFromLocal();

function defaultOverlay() {
  return {
    settings: { fontFace: 'Roboto', fontSize: 28, fontColor: '#ffffff' },
    streaks: []
  };
}

function loadFromLocal() {
  const raw = localStorage.getItem('overlayData');
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (e) {
    parsed = null;
  }
  const defaults = defaultOverlay();
  overlayData = {
    settings: {
      fontFace: (parsed && parsed.settings && parsed.settings.fontFace) || defaults.settings.fontFace,
      fontSize: (parsed && parsed.settings && parsed.settings.fontSize) || defaults.settings.fontSize,
      fontColor: (parsed && parsed.settings && parsed.settings.fontColor) || defaults.settings.fontColor
    },
    streaks: Array.isArray(parsed && parsed.streaks) ? parsed.streaks : defaults.streaks
  };
  fontFaceSel.value = overlayData.settings.fontFace;
  fontSizeInput.value = overlayData.settings.fontSize;
  fontColorInput.value = overlayData.settings.fontColor;
  (overlayData.streaks || []).forEach(s => addStreak(s));
}

function saveToLocal() {
  overlayData = {
    settings: {
      fontFace: fontFaceSel.value,
      fontSize: Number(fontSizeInput.value) || 28,
      fontColor: fontColorInput.value || '#ffffff'
    },
    streaks: Array.from(streakList.children).map(row => {
      const selected = row.querySelector('.character-type').value;
      const type = selected === 'Survivor' ? 'Survivor' : selected === 'Other' ? 'Other' : 'Killer';
      const survivorSel = row.querySelector('.survivor-select');
      const otherInput = row.querySelector('.other-input');
      const showCheckbox = row.querySelector('.show-checkbox');
      const showImageCheckbox = row.querySelector('.show-image-checkbox');
      return {
        type,
        killer: type === 'Killer' ? selected : '',
        survivor: survivorSel ? survivorSel.value : '',
        other: otherInput ? otherInput.value : '',
        displayLabel: type === 'Survivor' && otherInput ? otherInput.value : '',
        count: Number(row.querySelector('.count-input').value) || 0,
        record: row.querySelector('.record-input').value ? Number(row.querySelector('.record-input').value) : null,
        recordLabel: row.querySelector('.record-label').value,
        show: !!(showCheckbox && showCheckbox.checked),
        showImage: !!(showImageCheckbox && showImageCheckbox.checked)
      };
    })
  };
  localStorage.setItem('overlayData', JSON.stringify(overlayData));
}

function addStreak(data = {}) {
  const row = document.createElement('div');
  row.className = 'streak card p-2 mb-2';
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.alignItems = 'center';
  row.style.gap = '.5rem';
  row.draggable = true;

  const charWrap = document.createElement('div');
  charWrap.className = 'form-floating';
  const charSel = document.createElement('select');
  charSel.className = 'character-type form-select';
  (characters.killers || []).forEach(k => {
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
  // placeholder for floating label
  const charPlaceholder = document.createElement('option');
  charPlaceholder.value = '';
  charPlaceholder.textContent = ' ';
  charPlaceholder.selected = true;
  charPlaceholder.disabled = true;
  charPlaceholder.hidden = true;
  charSel.insertBefore(charPlaceholder, charSel.firstChild);
  const charLbl = document.createElement('label');
  charLbl.textContent = 'Character / Type';
  charWrap.appendChild(charSel);
  charWrap.appendChild(charLbl);
  row.appendChild(charWrap);

  const survivorWrap = document.createElement('div');
  survivorWrap.className = 'form-floating';
  const survivorSel = document.createElement('select');
  survivorSel.className = 'survivor-select form-select';
  (characters.survivors || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    survivorSel.appendChild(opt);
  });
  // placeholder for floating label
  const survPlaceholder = document.createElement('option');
  survPlaceholder.value = '';
  survPlaceholder.textContent = ' ';
  survPlaceholder.selected = true;
  survPlaceholder.disabled = true;
  survPlaceholder.hidden = true;
  survivorSel.insertBefore(survPlaceholder, survivorSel.firstChild);
  const survivorLbl = document.createElement('label');
  survivorLbl.textContent = 'Survivor';
  survivorWrap.appendChild(survivorSel);
  survivorWrap.appendChild(survivorLbl);
  survivorWrap.style.display = 'none';
  row.appendChild(survivorWrap);

  const otherWrap = document.createElement('div');
  otherWrap.className = 'form-floating';
  const otherInput = document.createElement('input');
  otherInput.className = 'other-input form-control';
  otherInput.placeholder = 'Label';
  otherWrap.style.display = 'none';
  const otherLbl = document.createElement('label');
  otherLbl.textContent = 'Streak Name';
  otherWrap.appendChild(otherInput);
  otherWrap.appendChild(otherLbl);
  row.appendChild(otherWrap);

  // Show on stream checkbox
  const showWrap = document.createElement('label');
  showWrap.className = 'form-check form-switch w-100 my-0';
  const showCheckbox = document.createElement('input');
  showCheckbox.type = 'checkbox';
  showCheckbox.className = 'show-checkbox form-check-input';
  showWrap.appendChild(showCheckbox);
  const showLbl = document.createElement('span');
  showLbl.className = 'form-check-label ms-1';
  showLbl.textContent = 'Show on stream';
  showWrap.appendChild(showLbl);
  row.appendChild(showWrap);

  // Show image checkbox (visible for all selections)
  const showImageWrap = document.createElement('label');
  showImageWrap.className = 'form-check form-switch w-100 my-0';
  const showImageCheckbox = document.createElement('input');
  showImageCheckbox.type = 'checkbox';
  showImageCheckbox.className = 'show-image-checkbox form-check-input';
  showImageWrap.appendChild(showImageCheckbox);
  const showImgLbl = document.createElement('span');
  showImgLbl.className = 'form-check-label ms-1';
  showImgLbl.textContent = 'Show image';
  showImageWrap.appendChild(showImgLbl);
  row.appendChild(showImageWrap);

  const countGroup = document.createElement('div');
  countGroup.className = 'input-group';
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'count-input form-control';
  countInput.value = data.count || 0;
  const incBtn = document.createElement('button');
  incBtn.textContent = '+';
  incBtn.className = 'btn btn-success';
  incBtn.addEventListener('click', () => {
    const currentCount = Number(countInput.value) || 0;
    const recordRaw = recordInput.value;
    const recordNum = recordRaw === '' ? null : Number(recordRaw);
    const shouldBumpRecord = recordNum !== null && Number.isFinite(recordNum) && currentCount === recordNum;

    countInput.value = currentCount + 1;
    if (shouldBumpRecord) {
      recordInput.value = String(recordNum + 1);
    }
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
  });
  const incWrap = document.createElement('span');
  incWrap.className = 'input-group-text p-0';
  incWrap.appendChild(incBtn);
  countGroup.appendChild(countInput);
  countGroup.appendChild(incWrap);
  row.appendChild(countGroup);

  const recordGroup = document.createElement('div');
  recordGroup.className = 'input-group';
  const recordLabelWrap = document.createElement('div');
  recordLabelWrap.className = 'form-floating';
  const recordLabel = document.createElement('input');
  recordLabel.type = 'text';
  recordLabel.className = 'record-label form-control';
  recordLabel.placeholder = 'Record/Target Label';
  const recordLabelLbl = document.createElement('label');
  recordLabelLbl.textContent = 'Record/Target Label';
  recordLabelWrap.appendChild(recordLabel);
  recordLabelWrap.appendChild(recordLabelLbl);
  const recordInputWrap = document.createElement('div');
  recordInputWrap.className = 'form-floating';
  const recordInput = document.createElement('input');
  recordInput.type = 'number';
  recordInput.className = 'record-input form-control';
  recordInput.placeholder = 'Record/Target Value';
  const recordInputLbl = document.createElement('label');
  recordInputLbl.textContent = 'Record/Target Value';
  recordInputWrap.appendChild(recordInput);
  recordInputWrap.appendChild(recordInputLbl);
  recordGroup.appendChild(recordLabelWrap);
  recordGroup.appendChild(recordInputWrap);
  row.appendChild(recordGroup);

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Delete Streak';
  delBtn.className = 'delete btn btn-sm btn-outline-danger ms-auto';
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
    survivorWrap.style.display = '';
    otherWrap.style.display = '';
    survivorSel.value = data.survivor || '';
    otherInput.value = data.displayLabel || '';
  } else if (data.type === 'Other') {
    charSel.value = 'Other';
    otherWrap.style.display = '';
    otherInput.value = data.other || '';
  } else if (data.killer) {
    charSel.value = data.killer;
  }
  countInput.value = data.count || 0;
  recordInput.value = data.record ?? '';
  recordLabel.value = data.recordLabel || '';
  showCheckbox.checked = data.show !== false;
  showImageCheckbox.checked = data.showImage === true;

  charSel.addEventListener('change', () => {
    if (charSel.value === 'Survivor') {
      survivorWrap.style.display = '';
      otherWrap.style.display = '';
    } else if (charSel.value === 'Other') {
      survivorWrap.style.display = 'none';
      otherWrap.style.display = '';
    } else {
      survivorWrap.style.display = 'none';
      otherWrap.style.display = 'none';
    }
    saveToLocal();
  });

  [survivorSel, otherInput, countInput, recordInput, recordLabel].forEach(el => {
    el.addEventListener('input', saveToLocal);
  });
  showCheckbox.addEventListener('change', saveToLocal);
  showImageCheckbox.addEventListener('change', saveToLocal);

  streakList.appendChild(row);
  // Ensure initial visibility matches current selection
  charSel.dispatchEvent(new Event('change'));
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
  try {
    updateToast = updateToast || new bootstrap.Toast(updateToastEl);
    updateToast.show();
  } catch {}
});

resetBtn.addEventListener('click', () => {
  const confirmed = window.confirm('Reset all streaks and settings? This cannot be undone.');
  if (!confirmed) return;
  localStorage.removeItem('overlayData');
  // Clear UI
  while (streakList.firstChild) streakList.removeChild(streakList.firstChild);
  // Reset inputs to defaults
  const defaults = defaultOverlay();
  fontFaceSel.value = defaults.settings.fontFace;
  fontSizeInput.value = defaults.settings.fontSize;
  fontColorInput.value = defaults.settings.fontColor;
  overlayData = defaults;
  saveToLocal();
  ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  try {
    updateToast = updateToast || new bootstrap.Toast(updateToastEl);
    updateToast.show();
  } catch {}
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
