import charactersJson from './characters.json';
const ws = new WebSocket(`ws://${window.location.host}`);
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
let isLoading = false; // Flag to prevent saving during load

const streakList = document.getElementById('streak-list');
const addBtn = document.getElementById('add-streak');
const updateBtn = document.getElementById('update-overlay');
const resetBtn = document.getElementById('reset-all');
const fontFaceSel = document.getElementById('font-face');
const fontSizeInput = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');
const overlayCornerSel = document.getElementById('overlay-corner');
const overlayPaddingInput = document.getElementById('overlay-padding');
const updateToastEl = document.getElementById('update-toast');
let updateToast;

const fonts = ['Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald', 'DynaPuff', 'Luckiest Guy', 'Syne Mono'];
fonts.forEach(f => {
  const opt = document.createElement('option');
  opt.value = f;
  opt.textContent = f;
  fontFaceSel.appendChild(opt);
});

// Load and normalize character data from bundled JSON (supports multiple shapes)
characters = normalizeCharacterData(charactersJson);

// Ensure DOM is ready before loading data
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadFromLocal);
} else {
  // DOM is already ready
  loadFromLocal();
}

function defaultOverlay() {
  return {
    settings: { fontFace: 'Roboto', fontSize: 28, fontColor: '#ffffff', overlayCorner: 'top-left', overlayPadding: 0 },
    streaks: [],
    scoreboard: {
      title: '',
      team1Name: '',
      team1Score: 0,
      team2Name: '',
      team2Score: 0,
      winCondition: '',
      show: true,
      oneVOneMode: false,
      timerState: 'idle',
      team1Timer: 0,
      team2Timer: 0,
      team1StartTime: null,
      team2StartTime: null,
      winningTimer: null,
      design: {
        primaryColor: '#000000',
        secondaryColor: '#4a5568',
        borderRadius: 4,
        iconImage: null
      }
    }
  };
}

function loadFromLocal() {
  isLoading = true;
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
      fontColor: (parsed && parsed.settings && parsed.settings.fontColor) || defaults.settings.fontColor,
      overlayCorner: (parsed && parsed.settings && parsed.settings.overlayCorner) || defaults.settings.overlayCorner,
      overlayPadding: (parsed && parsed.settings && parsed.settings.overlayPadding !== undefined) ? parsed.settings.overlayPadding : defaults.settings.overlayPadding
    },
    streaks: Array.isArray(parsed && parsed.streaks) ? parsed.streaks : defaults.streaks,
    scoreboard: parsed && parsed.scoreboard ? {
      title: parsed.scoreboard.title !== undefined ? parsed.scoreboard.title : defaults.scoreboard.title,
      team1Name: parsed.scoreboard.team1Name !== undefined ? parsed.scoreboard.team1Name : defaults.scoreboard.team1Name,
      team1Score: parsed.scoreboard.team1Score !== undefined ? parsed.scoreboard.team1Score : defaults.scoreboard.team1Score,
      team2Name: parsed.scoreboard.team2Name !== undefined ? parsed.scoreboard.team2Name : defaults.scoreboard.team2Name,
      team2Score: parsed.scoreboard.team2Score !== undefined ? parsed.scoreboard.team2Score : defaults.scoreboard.team2Score,
      winCondition: parsed.scoreboard.winCondition !== undefined ? parsed.scoreboard.winCondition : defaults.scoreboard.winCondition,
      show: parsed.scoreboard.show !== undefined ? parsed.scoreboard.show : defaults.scoreboard.show,
      oneVOneMode: parsed.scoreboard.oneVOneMode !== undefined ? parsed.scoreboard.oneVOneMode : defaults.scoreboard.oneVOneMode,
      timerState: parsed.scoreboard.timerState !== undefined ? parsed.scoreboard.timerState : defaults.scoreboard.timerState,
      team1Timer: parsed.scoreboard.team1Timer !== undefined ? parsed.scoreboard.team1Timer : defaults.scoreboard.team1Timer,
      team2Timer: parsed.scoreboard.team2Timer !== undefined ? parsed.scoreboard.team2Timer : defaults.scoreboard.team2Timer,
      team1StartTime: parsed.scoreboard.team1StartTime !== undefined ? parsed.scoreboard.team1StartTime : defaults.scoreboard.team1StartTime,
      team2StartTime: parsed.scoreboard.team2StartTime !== undefined ? parsed.scoreboard.team2StartTime : defaults.scoreboard.team2StartTime,
      winningTimer: parsed.scoreboard.winningTimer !== undefined ? parsed.scoreboard.winningTimer : defaults.scoreboard.winningTimer,
      design: parsed.scoreboard.design ? {
        primaryColor: parsed.scoreboard.design.primaryColor !== undefined ? parsed.scoreboard.design.primaryColor : defaults.scoreboard.design.primaryColor,
        secondaryColor: parsed.scoreboard.design.secondaryColor !== undefined ? parsed.scoreboard.design.secondaryColor : defaults.scoreboard.design.secondaryColor,
        borderRadius: parsed.scoreboard.design.borderRadius !== undefined ? parsed.scoreboard.design.borderRadius : defaults.scoreboard.design.borderRadius
      } : defaults.scoreboard.design
    } : defaults.scoreboard
  };
  fontFaceSel.value = overlayData.settings.fontFace;
  fontSizeInput.value = overlayData.settings.fontSize;
  fontColorInput.value = overlayData.settings.fontColor;
  if (overlayCornerSel) overlayCornerSel.value = overlayData.settings.overlayCorner || 'top-left';
  if (overlayPaddingInput) overlayPaddingInput.value = overlayData.settings.overlayPadding !== undefined ? overlayData.settings.overlayPadding : 0;
  (overlayData.streaks || []).forEach(s => addStreak(s));
  
  setTimeout(() => {
    updateFontPreview();
  }, 100);
  
  const scoreboardTitleInput = document.getElementById('scoreboard-title');
  const team1NameInput = document.getElementById('scoreboard-team1-name');
  const team1ScoreInput = document.getElementById('scoreboard-team1-score');
  const team2NameInput = document.getElementById('scoreboard-team2-name');
  const team2ScoreInput = document.getElementById('scoreboard-team2-score');
  const winConditionInput = document.getElementById('scoreboard-win-condition');
  const scoreboardShowInput = document.getElementById('scoreboard-show');
  const scoreboard1v1ModeInput = document.getElementById('scoreboard-1v1-mode');
  const scoreboardPrimaryColorInput = document.getElementById('scoreboard-primary-color');
  const scoreboardSecondaryColorInput = document.getElementById('scoreboard-secondary-color');
  const scoreboardBorderRadiusInput = document.getElementById('scoreboard-border-radius');
  const scoreboardIconUploadInput = document.getElementById('scoreboard-icon-upload');
  const scoreboardIconPreview = document.getElementById('scoreboard-icon-preview');
  const scoreboardIconPreviewImg = document.getElementById('scoreboard-icon-preview-img');
  const oneVOneModeInfo = document.getElementById('1v1-mode-info');
  
  if (scoreboardTitleInput) scoreboardTitleInput.value = overlayData.scoreboard.title || '';
  if (team1NameInput) team1NameInput.value = overlayData.scoreboard.team1Name || '';
  if (team1ScoreInput) team1ScoreInput.value = overlayData.scoreboard.team1Score || 0;
  if (team2NameInput) team2NameInput.value = overlayData.scoreboard.team2Name || '';
  if (team2ScoreInput) team2ScoreInput.value = overlayData.scoreboard.team2Score || 0;
  if (winConditionInput) winConditionInput.value = overlayData.scoreboard.winCondition || '';
  if (scoreboardShowInput) scoreboardShowInput.checked = overlayData.scoreboard.show !== false;
  if (scoreboard1v1ModeInput) {
    scoreboard1v1ModeInput.checked = overlayData.scoreboard.oneVOneMode === true;
    if (oneVOneModeInfo) {
      oneVOneModeInfo.style.display = overlayData.scoreboard.oneVOneMode === true ? 'block' : 'none';
    }
  }
  
  const design = overlayData.scoreboard.design || defaultOverlay().scoreboard.design;
  if (scoreboardPrimaryColorInput) scoreboardPrimaryColorInput.value = design.primaryColor || '#000000';
  if (scoreboardSecondaryColorInput) scoreboardSecondaryColorInput.value = design.secondaryColor || '#4a5568';
  if (scoreboardBorderRadiusInput) scoreboardBorderRadiusInput.value = design.borderRadius !== undefined ? design.borderRadius : 4;
  
  if (design.iconImage && scoreboardIconPreviewImg) {
    const iconSrc = design.iconImage;
    if (iconSrc && 
        iconSrc !== '' && 
        iconSrc !== window.location.href &&
        !iconSrc.endsWith('/dock') &&
        !iconSrc.endsWith('/dock.html') &&
        (iconSrc.startsWith('data:') || iconSrc.startsWith('http') || iconSrc.startsWith('/'))) {
      scoreboardIconPreviewImg.src = iconSrc;
      if (scoreboardIconPreview) scoreboardIconPreview.style.display = 'block';
    }
  }
  
  isLoading = false;
}


function saveToLocal() {
  if (isLoading) return;
  
  const scoreboardTitleInput = document.getElementById('scoreboard-title');
  const team1NameInput = document.getElementById('scoreboard-team1-name');
  const team1ScoreInput = document.getElementById('scoreboard-team1-score');
  const team2NameInput = document.getElementById('scoreboard-team2-name');
  const team2ScoreInput = document.getElementById('scoreboard-team2-score');
  const winConditionInput = document.getElementById('scoreboard-win-condition');
  const scoreboardShowInput = document.getElementById('scoreboard-show');
  const scoreboard1v1ModeInput = document.getElementById('scoreboard-1v1-mode');
  const scoreboardPrimaryColorInput = document.getElementById('scoreboard-primary-color');
  const scoreboardSecondaryColorInput = document.getElementById('scoreboard-secondary-color');
  const scoreboardBorderRadiusInput = document.getElementById('scoreboard-border-radius');
  const scoreboardIconPreviewImg = document.getElementById('scoreboard-icon-preview-img');
  
  let iconImage = null;
  if (scoreboardIconPreviewImg && scoreboardIconPreviewImg.src) {
    const src = scoreboardIconPreviewImg.src;
    if (src && 
        src !== '' && 
        src !== window.location.href &&
        !src.endsWith('/dock') &&
        !src.endsWith('/dock.html') &&
        (src.startsWith('data:') || (src.startsWith('http') && !src.includes(window.location.hostname)) || src.startsWith('/'))) {
      iconImage = src;
    }
  }
  
  const designSettings = {
    primaryColor: scoreboardPrimaryColorInput ? scoreboardPrimaryColorInput.value : '#000000',
    secondaryColor: scoreboardSecondaryColorInput ? scoreboardSecondaryColorInput.value : '#4a5568',
    borderRadius: scoreboardBorderRadiusInput ? Number(scoreboardBorderRadiusInput.value) || 4 : 4,
    iconImage: iconImage
  };
  
  const currentTimerState = overlayData.scoreboard ? overlayData.scoreboard.timerState : 'idle';
  const currentTeam1Timer = overlayData.scoreboard ? overlayData.scoreboard.team1Timer : 0;
  const currentTeam2Timer = overlayData.scoreboard ? overlayData.scoreboard.team2Timer : 0;
  const currentTeam1StartTime = overlayData.scoreboard ? overlayData.scoreboard.team1StartTime : null;
  const currentTeam2StartTime = overlayData.scoreboard ? overlayData.scoreboard.team2StartTime : null;
  const currentWinningTimer = overlayData.scoreboard ? overlayData.scoreboard.winningTimer : null;
  
  overlayData = {
    settings: {
      fontFace: fontFaceSel.value,
      fontSize: Number(fontSizeInput.value) || 28,
      fontColor: fontColorInput.value || '#ffffff',
      overlayCorner: overlayCornerSel ? overlayCornerSel.value : 'top-left',
      overlayPadding: overlayPaddingInput ? Number(overlayPaddingInput.value) || 0 : 0
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
    }),
    scoreboard: {
      title: scoreboardTitleInput ? scoreboardTitleInput.value : '',
      team1Name: team1NameInput ? team1NameInput.value : '',
      team1Score: team1ScoreInput ? Number(team1ScoreInput.value) || 0 : 0,
      team2Name: team2NameInput ? team2NameInput.value : '',
      team2Score: team2ScoreInput ? Number(team2ScoreInput.value) || 0 : 0,
      winCondition: winConditionInput ? winConditionInput.value : '',
      show: scoreboardShowInput ? scoreboardShowInput.checked : true,
      oneVOneMode: scoreboard1v1ModeInput ? scoreboard1v1ModeInput.checked : false,
      timerState: currentTimerState,
      team1Timer: currentTeam1Timer,
      team2Timer: currentTeam2Timer,
      team1StartTime: currentTeam1StartTime,
      team2StartTime: currentTeam2StartTime,
      winningTimer: currentWinningTimer,
      design: designSettings
    }
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
  if (overlayCornerSel) overlayCornerSel.value = defaults.settings.overlayCorner;
  if (overlayPaddingInput) overlayPaddingInput.value = defaults.settings.overlayPadding;
  const scoreboardTitleInput = document.getElementById('scoreboard-title');
  const team1NameInput = document.getElementById('scoreboard-team1-name');
  const team1ScoreInput = document.getElementById('scoreboard-team1-score');
  const team2NameInput = document.getElementById('scoreboard-team2-name');
  const team2ScoreInput = document.getElementById('scoreboard-team2-score');
  const winConditionInput = document.getElementById('scoreboard-win-condition');
  const scoreboardShowInput = document.getElementById('scoreboard-show');
  const scoreboard1v1ModeInput = document.getElementById('scoreboard-1v1-mode');
  const oneVOneModeInfo = document.getElementById('1v1-mode-info');
  
  if (scoreboardTitleInput) scoreboardTitleInput.value = defaults.scoreboard.title;
  if (team1NameInput) team1NameInput.value = defaults.scoreboard.team1Name;
  if (team1ScoreInput) team1ScoreInput.value = defaults.scoreboard.team1Score;
  if (team2NameInput) team2NameInput.value = defaults.scoreboard.team2Name;
  if (team2ScoreInput) team2ScoreInput.value = defaults.scoreboard.team2Score;
  if (winConditionInput) winConditionInput.value = defaults.scoreboard.winCondition;
  if (scoreboardShowInput) scoreboardShowInput.checked = defaults.scoreboard.show;
  if (scoreboard1v1ModeInput) {
    scoreboard1v1ModeInput.checked = defaults.scoreboard.oneVOneMode;
    if (oneVOneModeInfo) {
      oneVOneModeInfo.style.display = defaults.scoreboard.oneVOneMode ? 'block' : 'none';
    }
  }
  const scoreboardPrimaryColorInput = document.getElementById('scoreboard-primary-color');
  const scoreboardSecondaryColorInput = document.getElementById('scoreboard-secondary-color');
  const scoreboardBorderRadiusInput = document.getElementById('scoreboard-border-radius');
  const scoreboardIconUploadInput = document.getElementById('scoreboard-icon-upload');
  const scoreboardIconPreview = document.getElementById('scoreboard-icon-preview');
  const scoreboardIconPreviewImg = document.getElementById('scoreboard-icon-preview-img');
  if (scoreboardPrimaryColorInput) scoreboardPrimaryColorInput.value = defaults.scoreboard.design.primaryColor;
  if (scoreboardSecondaryColorInput) scoreboardSecondaryColorInput.value = defaults.scoreboard.design.secondaryColor;
  if (scoreboardBorderRadiusInput) scoreboardBorderRadiusInput.value = defaults.scoreboard.design.borderRadius;
  if (scoreboardIconUploadInput) scoreboardIconUploadInput.value = '';
  if (scoreboardIconPreviewImg) scoreboardIconPreviewImg.src = '';
  if (scoreboardIconPreview) scoreboardIconPreview.style.display = 'none';
  overlayData = defaults;
  saveToLocal();
  ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  try {
    updateToast = updateToast || new bootstrap.Toast(updateToastEl);
    updateToast.show();
  } catch {}
});

// Font preview function
function updateFontPreview() {
  const fontPreview = document.getElementById('font-preview');
  const fontSizeInput = document.getElementById('font-size');
  const fontColorInput = document.getElementById('font-color');
  
  if (!fontPreview || !fontFaceSel) return;
  
  const selectedFont = fontFaceSel.value;
  const fontSize = fontSizeInput ? fontSizeInput.value : 28;
  const fontColor = fontColorInput ? fontColorInput.value : '#ffffff';
  
  // Load the font
  loadFontForPreview(selectedFont);
  
  // Update preview styling
  fontPreview.style.fontFamily = selectedFont;
  fontPreview.style.fontSize = `${fontSize}px`;
  fontPreview.style.color = fontColor;
}

function loadFontForPreview(font) {
  if (!font) return;
  
  const id = 'google-font-preview';
  let link = document.getElementById(id);
  if (link) link.remove();
  
  link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  
  if (font.includes('Roboto')) {
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}:ital,wght@0,100..900;1,100..900&display=swap`;
  } else {
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}&display=swap`;
  }
  
  document.head.appendChild(link);
}

fontFaceSel.addEventListener('change', () => {
  updateFontPreview();
  saveToLocal();
});
fontSizeInput.addEventListener('input', () => {
  updateFontPreview();
  saveToLocal();
});
fontColorInput.addEventListener('input', () => {
  updateFontPreview();
  saveToLocal();
});
if (overlayCornerSel) {
  overlayCornerSel.addEventListener('change', () => {
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  });
}
if (overlayPaddingInput) {
  overlayPaddingInput.addEventListener('input', () => {
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  });
}

// Update preview when modal opens
const settingsModal = document.getElementById('settingsModal');
if (settingsModal) {
  settingsModal.addEventListener('shown.bs.modal', () => {
    updateFontPreview();
  });
}

// Scoreboard input listeners
const team1NameInput = document.getElementById('scoreboard-team1-name');
const team1ScoreInput = document.getElementById('scoreboard-team1-score');
const team2NameInput = document.getElementById('scoreboard-team2-name');
const team2ScoreInput = document.getElementById('scoreboard-team2-score');
const winConditionInput = document.getElementById('scoreboard-win-condition');
const scoreboardShowInput = document.getElementById('scoreboard-show');

if (team1NameInput) team1NameInput.addEventListener('input', saveToLocal);
if (team1ScoreInput) team1ScoreInput.addEventListener('input', saveToLocal);
if (team2NameInput) team2NameInput.addEventListener('input', saveToLocal);
if (team2ScoreInput) team2ScoreInput.addEventListener('input', saveToLocal);
if (winConditionInput) winConditionInput.addEventListener('input', saveToLocal);
if (scoreboardShowInput) scoreboardShowInput.addEventListener('change', saveToLocal);

// Scoreboard reset button
const scoreboardResetBtn = document.getElementById('scoreboard-reset');
if (scoreboardResetBtn) {
  scoreboardResetBtn.addEventListener('click', () => {
    const confirmed = window.confirm('Reset scoreboard? This will clear all scores, timers, and timer state. This cannot be undone.');
    if (!confirmed) return;
    
    const team1ScoreInput = document.getElementById('scoreboard-team1-score');
    const team2ScoreInput = document.getElementById('scoreboard-team2-score');
    
    if (team1ScoreInput) team1ScoreInput.value = 0;
    if (team2ScoreInput) team2ScoreInput.value = 0;
    
    if (overlayData.scoreboard) {
      overlayData.scoreboard.team1Score = 0;
      overlayData.scoreboard.team2Score = 0;
      overlayData.scoreboard.team1Timer = 0;
      overlayData.scoreboard.team2Timer = 0;
      overlayData.scoreboard.timerState = 'idle';
      overlayData.scoreboard.team1StartTime = null;
      overlayData.scoreboard.team2StartTime = null;
      overlayData.scoreboard.winningTimer = null;
    }
    
    if (timerUpdateInterval) {
      clearInterval(timerUpdateInterval);
      timerUpdateInterval = null;
    }
    
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
  });
}

const scoreboard1v1ModeInput = document.getElementById('scoreboard-1v1-mode');
const oneVOneModeInfo = document.getElementById('1v1-mode-info');
if (scoreboard1v1ModeInput) {
  scoreboard1v1ModeInput.addEventListener('change', () => {
    if (!scoreboard1v1ModeInput.checked) {
      if (overlayData.scoreboard) {
        overlayData.scoreboard.timerState = 'idle';
        overlayData.scoreboard.team1Timer = 0;
        overlayData.scoreboard.team2Timer = 0;
        overlayData.scoreboard.team1StartTime = null;
        overlayData.scoreboard.team2StartTime = null;
      }
    }
    if (oneVOneModeInfo) {
      oneVOneModeInfo.style.display = scoreboard1v1ModeInput.checked ? 'block' : 'none';
    }
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  });
}

let timerUpdateInterval = null;

function startTimerUpdate() {
  if (timerUpdateInterval) clearInterval(timerUpdateInterval);
  
  timerUpdateInterval = setInterval(() => {
    if (!overlayData.scoreboard || !overlayData.scoreboard.oneVOneMode) {
      if (timerUpdateInterval) {
        clearInterval(timerUpdateInterval);
        timerUpdateInterval = null;
      }
      return;
    }
    
    const timerState = overlayData.scoreboard.timerState;
    const now = Date.now();
    
    if (timerState === 'team1-running' && overlayData.scoreboard.team1StartTime) {
      overlayData.scoreboard.team1Timer = now - overlayData.scoreboard.team1StartTime;
    } else if (timerState === 'team2-running' && overlayData.scoreboard.team2StartTime) {
      overlayData.scoreboard.team2Timer = now - overlayData.scoreboard.team2StartTime;
    } else {
      if (timerUpdateInterval) {
        clearInterval(timerUpdateInterval);
        timerUpdateInterval = null;
      }
      return;
    }
    
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  }, 100);
}

function handleTimerToggle() {
  if (!overlayData.scoreboard || !overlayData.scoreboard.oneVOneMode) {
    return;
  }
  
  const timerState = overlayData.scoreboard.timerState || 'idle';
  const now = Date.now();
  const team1ScoreInput = document.getElementById('scoreboard-team1-score');
  const team2ScoreInput = document.getElementById('scoreboard-team2-score');
  
  if (timerState === 'idle') {
    const team1Timer = overlayData.scoreboard.team1Timer || 0;
    const team2Timer = overlayData.scoreboard.team2Timer || 0;
    
    if (team1Timer > 0 || team2Timer > 0) {
      overlayData.scoreboard.team1Timer = 0;
      overlayData.scoreboard.team2Timer = 0;
      overlayData.scoreboard.team1StartTime = null;
      overlayData.scoreboard.team2StartTime = null;
      overlayData.scoreboard.winningTimer = null;
    } else {
      overlayData.scoreboard.timerState = 'team1-running';
      overlayData.scoreboard.team1StartTime = now;
      overlayData.scoreboard.team1Timer = 0;
      overlayData.scoreboard.team2Timer = 0;
      overlayData.scoreboard.team2StartTime = null;
      overlayData.scoreboard.winningTimer = null;
    }
    
  } else if (timerState === 'team1-running') {
    overlayData.scoreboard.team1Timer = now - overlayData.scoreboard.team1StartTime;
    overlayData.scoreboard.timerState = 'team1-stopped';
    overlayData.scoreboard.team1StartTime = null;
    if (timerUpdateInterval) {
      clearInterval(timerUpdateInterval);
      timerUpdateInterval = null;
    }
    
  } else if (timerState === 'team1-stopped') {
    overlayData.scoreboard.timerState = 'team2-running';
    overlayData.scoreboard.team2StartTime = now;
    overlayData.scoreboard.team2Timer = 0;
    overlayData.scoreboard.team1StartTime = null;
    
  } else if (timerState === 'team2-running') {
    overlayData.scoreboard.team2Timer = now - overlayData.scoreboard.team2StartTime;
    overlayData.scoreboard.team2StartTime = null;
    
    const team1Time = overlayData.scoreboard.team1Timer;
    const team2Time = overlayData.scoreboard.team2Timer;
    
    if (team1Time < team2Time) {
      overlayData.scoreboard.team1Score = (overlayData.scoreboard.team1Score || 0) + 1;
      if (team1ScoreInput) team1ScoreInput.value = overlayData.scoreboard.team1Score;
      overlayData.scoreboard.winningTimer = 'team1';
    } else if (team2Time < team1Time) {
      overlayData.scoreboard.team2Score = (overlayData.scoreboard.team2Score || 0) + 1;
      if (team2ScoreInput) team2ScoreInput.value = overlayData.scoreboard.team2Score;
      overlayData.scoreboard.winningTimer = 'team2';
    } else {
      overlayData.scoreboard.winningTimer = null;
    }
    
    overlayData.scoreboard.timerState = 'idle';
    if (timerUpdateInterval) {
      clearInterval(timerUpdateInterval);
      timerUpdateInterval = null;
    }
  }
  
  saveToLocal();
  ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  
  if (overlayData.scoreboard.timerState === 'team1-running' || overlayData.scoreboard.timerState === 'team2-running') {
    startTimerUpdate();
  }
}

document.addEventListener('keydown', (e) => {
  if (overlayData.scoreboard && overlayData.scoreboard.oneVOneMode) {
    if (e.key === '`' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleTimerToggle();
    }
  }
});

if (overlayData.scoreboard && overlayData.scoreboard.oneVOneMode) {
  const timerState = overlayData.scoreboard.timerState;
  if (timerState === 'team1-running' || timerState === 'team2-running') {
    startTimerUpdate();
  }
}

// Scoreboard design settings listeners
const scoreboardPrimaryColorInput = document.getElementById('scoreboard-primary-color');
const scoreboardSecondaryColorInput = document.getElementById('scoreboard-secondary-color');
const scoreboardBorderRadiusInput = document.getElementById('scoreboard-border-radius');
const scoreboardIconUploadInput = document.getElementById('scoreboard-icon-upload');
const scoreboardIconPreview = document.getElementById('scoreboard-icon-preview');
const scoreboardIconPreviewImg = document.getElementById('scoreboard-icon-preview-img');
const scoreboardIconRemoveBtn = document.getElementById('scoreboard-icon-remove');

if (scoreboardPrimaryColorInput) scoreboardPrimaryColorInput.addEventListener('input', saveToLocal);
if (scoreboardSecondaryColorInput) scoreboardSecondaryColorInput.addEventListener('input', saveToLocal);
if (scoreboardBorderRadiusInput) scoreboardBorderRadiusInput.addEventListener('input', saveToLocal);

// Icon image upload handler
if (scoreboardIconUploadInput) {
  scoreboardIconUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (scoreboardIconPreviewImg) {
          scoreboardIconPreviewImg.src = event.target.result;
        }
        if (scoreboardIconPreview) {
          scoreboardIconPreview.style.display = 'block';
        }
        saveToLocal();
      };
      reader.readAsDataURL(file);
    }
  });
}

// Icon remove handler
if (scoreboardIconRemoveBtn) {
  scoreboardIconRemoveBtn.addEventListener('click', () => {
    if (scoreboardIconUploadInput) scoreboardIconUploadInput.value = '';
    if (scoreboardIconPreviewImg) {
      scoreboardIconPreviewImg.removeAttribute('src');
      scoreboardIconPreviewImg.src = '';
    }
    if (scoreboardIconPreview) scoreboardIconPreview.style.display = 'none';
    saveToLocal();
  });
}

// Save button handlers for modals
const saveGlobalSettingsBtn = document.getElementById('save-global-settings');
const saveScoreboardSettingsBtn = document.getElementById('save-scoreboard-settings');

if (saveGlobalSettingsBtn) {
  saveGlobalSettingsBtn.addEventListener('click', () => {
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
    if (modal) modal.hide();
  });
}

if (saveScoreboardSettingsBtn) {
  saveScoreboardSettingsBtn.addEventListener('click', () => {
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('scoreboardSettingsModal'));
    if (modal) modal.hide();
  });
}

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
  if (msg.type === 'timer-toggle') {
    handleTimerToggle();
  }
});
