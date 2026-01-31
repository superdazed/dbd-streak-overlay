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

// Scoreboard reset button (declared early so it can be used in loadFromLocal)
const scoreboardResetBtn = document.getElementById('scoreboard-reset');

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
        fontSize: 16,
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
        borderRadius: parsed.scoreboard.design.borderRadius !== undefined ? parsed.scoreboard.design.borderRadius : defaults.scoreboard.design.borderRadius,
        fontSize: parsed.scoreboard.design.fontSize !== undefined ? parsed.scoreboard.design.fontSize : defaults.scoreboard.design.fontSize
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
    if (scoreboardResetBtn) {
      scoreboardResetBtn.style.display = overlayData.scoreboard.oneVOneMode === true ? 'block' : 'none';
    }
    updateScoreboardLabels(overlayData.scoreboard.oneVOneMode === true);
  }
  
  const design = overlayData.scoreboard.design || defaultOverlay().scoreboard.design;
  const scoreboardFontSizeInput = document.getElementById('scoreboard-font-size');
  if (scoreboardPrimaryColorInput) scoreboardPrimaryColorInput.value = design.primaryColor || '#000000';
  if (scoreboardSecondaryColorInput) scoreboardSecondaryColorInput.value = design.secondaryColor || '#4a5568';
  if (scoreboardBorderRadiusInput) scoreboardBorderRadiusInput.value = design.borderRadius !== undefined ? design.borderRadius : 4;
  if (scoreboardFontSizeInput) scoreboardFontSizeInput.value = design.fontSize !== undefined ? design.fontSize : 16;
  
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
  const scoreboardFontSizeInput = document.getElementById('scoreboard-font-size');
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
    fontSize: scoreboardFontSizeInput ? Number(scoreboardFontSizeInput.value) || 16 : 16,
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
      const countMarginZeroCheckbox = row.querySelector('.count-margin-zero');
      const recordPairs = Array.from(row.querySelectorAll('.record-pair')).map(pairEl => {
        const label = (pairEl.querySelector('.record-label') && pairEl.querySelector('.record-label').value) || '';
        const val = pairEl.querySelector('.record-input') && pairEl.querySelector('.record-input').value;
        const value = val === '' || val === undefined ? null : Number(val);
        return { label, value };
      });
      return {
        type,
        killer: type === 'Killer' ? selected : '',
        survivor: survivorSel ? survivorSel.value : '',
        other: otherInput ? otherInput.value : '',
        displayLabel: type === 'Survivor' && otherInput ? otherInput.value : '',
        count: (row.querySelector('.count-input').value ?? '').trim(),
        recordPairs,
        show: !!(showCheckbox && showCheckbox.checked),
        showImage: !!(showImageCheckbox && showImageCheckbox.checked),
        countMarginZero: !!(countMarginZeroCheckbox && countMarginZeroCheckbox.checked)
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

  const streakIdentity = document.createElement('div');
  streakIdentity.className = 'streak-section streak-identity';
  streakIdentity.appendChild(charWrap);

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
  streakIdentity.appendChild(survivorWrap);

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
  streakIdentity.appendChild(otherWrap);

  // Show on stream: hidden checkbox, controlled by Show/Hide buttons in footer
  const showCheckbox = document.createElement('input');
  showCheckbox.type = 'checkbox';
  showCheckbox.className = 'show-checkbox form-check-input';
  showCheckbox.style.display = 'none';

  // Display options: toggles (secondary — styled smaller in CSS)
  const streakDisplayOptions = document.createElement('div');
  streakDisplayOptions.className = 'streak-options-row';
  streakDisplayOptions.appendChild(showCheckbox);

  const showImageWrap = document.createElement('label');
  showImageWrap.className = 'form-check form-switch my-0';
  const showImageCheckbox = document.createElement('input');
  showImageCheckbox.type = 'checkbox';
  showImageCheckbox.className = 'show-image-checkbox form-check-input';
  showImageWrap.appendChild(showImageCheckbox);
  const showImgLbl = document.createElement('span');
  showImgLbl.className = 'form-check-label ms-1';
  showImgLbl.textContent = 'Show image';
  showImageWrap.appendChild(showImgLbl);
  streakDisplayOptions.appendChild(showImageWrap);

  const countMarginWrap = document.createElement('label');
  countMarginWrap.className = 'form-check form-switch my-0';
  const countMarginCheckbox = document.createElement('input');
  countMarginCheckbox.type = 'checkbox';
  countMarginCheckbox.className = 'count-margin-zero form-check-input';
  countMarginWrap.appendChild(countMarginCheckbox);
  const countMarginLbl = document.createElement('span');
  countMarginLbl.className = 'form-check-label ms-1';
  countMarginLbl.textContent = 'No gap between streak name and count';
  countMarginWrap.appendChild(countMarginLbl);
  streakDisplayOptions.appendChild(countMarginWrap);

  // Returns true if the count value supports the +1 button (single integer or "x/n" format)
  function isIncrementableCount(val) {
    const s = String(val ?? '').trim();
    return /^\d+$/.test(s) || /^\d+\/\d+$/.test(s);
  }

  function updateIncrementButtonVisibility() {
    incWrap.style.display = isIncrementableCount(countInput.value) ? '' : 'none';
  }

  const countGroup = document.createElement('div');
  countGroup.className = 'input-group';
  const countInput = document.createElement('input');
  countInput.type = 'text';
  countInput.className = 'count-input form-control';
  countInput.placeholder = 'Count or e.g. 3/5';
  countInput.value = data.count !== undefined && data.count !== null ? String(data.count) : '';
  const incBtn = document.createElement('button');
  let incWrap; // declared so updateIncrementButtonVisibility can reference it
  incBtn.textContent = '+';
  incBtn.className = 'btn btn-success';
  incBtn.addEventListener('click', () => {
    const raw = String(countInput.value).trim();

    if (/^\d+$/.test(raw)) {
      const currentCount = Number(raw) || 0;
      countInput.value = currentCount + 1;
      row.querySelectorAll('.record-pair .record-input').forEach(recordInputEl => {
        const v = recordInputEl.value === '' ? null : Number(recordInputEl.value);
        if (v !== null && Number.isFinite(v) && v === currentCount) {
          recordInputEl.value = String(v + 1);
        }
      });
    } else {
      const m = raw.match(/^(\d+)\/(\d+)$/);
      if (m) {
        const x = parseInt(m[1], 10);
        countInput.value = `${x + 1}/${m[2]}`;
      }
    }
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
  });
  incWrap = document.createElement('span');
  incWrap.className = 'input-group-text p-0';
  incWrap.appendChild(incBtn);
  countGroup.appendChild(countInput);
  countGroup.appendChild(incWrap);
  updateIncrementButtonVisibility();

  const streakCountWrap = document.createElement('div');
  streakCountWrap.className = 'streak-count-wrap';
  streakCountWrap.appendChild(countGroup);

  const streakHeader = document.createElement('div');
  streakHeader.className = 'streak-section streak-header';
  streakHeader.appendChild(streakIdentity);
  streakHeader.appendChild(streakCountWrap);
  row.appendChild(streakHeader);

  const detailsDisplay = document.createElement('details');
  detailsDisplay.className = 'streak-details';
  const summaryDisplay = document.createElement('summary');
  summaryDisplay.textContent = 'Display options';
  detailsDisplay.appendChild(summaryDisplay);
  const bodyDisplay = document.createElement('div');
  bodyDisplay.className = 'streak-details-body';
  bodyDisplay.appendChild(streakDisplayOptions);
  detailsDisplay.appendChild(bodyDisplay);
  row.appendChild(detailsDisplay);

  const recordPairsContainer = document.createElement('div');
  recordPairsContainer.className = 'record-pairs streak-records-list';
  recordPairsContainer.style.display = 'flex';
  recordPairsContainer.style.flexWrap = 'wrap';
  recordPairsContainer.style.gap = '.5rem';
  recordPairsContainer.style.alignItems = 'flex-start';

  function addRecordPair(pairData = {}) {
    const pairRow = document.createElement('div');
    pairRow.className = 'record-pair input-group';
    pairRow.style.flexWrap = 'nowrap';
    const recordLabelWrap = document.createElement('div');
    recordLabelWrap.className = 'form-floating';
    const pairRecordLabel = document.createElement('input');
    pairRecordLabel.type = 'text';
    pairRecordLabel.className = 'record-label form-control';
    pairRecordLabel.placeholder = 'Record/Target Label';
    const recordLabelLbl = document.createElement('label');
    recordLabelLbl.textContent = 'Record/Target Label';
    recordLabelWrap.appendChild(pairRecordLabel);
    recordLabelWrap.appendChild(recordLabelLbl);
    const recordInputWrap = document.createElement('div');
    recordInputWrap.className = 'form-floating';
    const pairRecordInput = document.createElement('input');
    pairRecordInput.type = 'number';
    pairRecordInput.className = 'record-input form-control';
    pairRecordInput.placeholder = 'Record/Target Value';
    const recordInputLbl = document.createElement('label');
    recordInputLbl.textContent = 'Record/Target Value';
    recordInputWrap.appendChild(pairRecordInput);
    recordInputWrap.appendChild(recordInputLbl);
    const removePairBtn = document.createElement('button');
    removePairBtn.type = 'button';
    removePairBtn.className = 'btn btn-outline-secondary';
    removePairBtn.textContent = 'Remove';
    removePairBtn.addEventListener('click', () => {
      pairRow.remove();
      saveToLocal();
    });
    pairRow.appendChild(recordLabelWrap);
    pairRow.appendChild(recordInputWrap);
    pairRow.appendChild(removePairBtn);
    recordPairsContainer.appendChild(pairRow);
    pairRecordLabel.value = pairData.label ?? '';
    pairRecordInput.value = pairData.value !== undefined && pairData.value !== null ? String(pairData.value) : '';
    pairRecordLabel.addEventListener('input', saveToLocal);
    pairRecordInput.addEventListener('input', saveToLocal);
  }

  const addRecordPairBtn = document.createElement('button');
  addRecordPairBtn.type = 'button';
  addRecordPairBtn.className = 'btn btn-sm btn-outline-primary';
  addRecordPairBtn.textContent = 'Add record/target';
  addRecordPairBtn.addEventListener('click', () => {
    addRecordPair();
    saveToLocal();
  });

  const detailsRecords = document.createElement('details');
  detailsRecords.className = 'streak-details';
  const summaryRecords = document.createElement('summary');
  summaryRecords.textContent = 'Records';
  detailsRecords.appendChild(summaryRecords);
  const bodyRecords = document.createElement('div');
  bodyRecords.className = 'streak-details-body';
  bodyRecords.appendChild(recordPairsContainer);
  bodyRecords.appendChild(addRecordPairBtn);
  detailsRecords.appendChild(bodyRecords);
  row.appendChild(detailsRecords);

  const streakFooter = document.createElement('div');
  streakFooter.className = 'streak-footer';
  const showBtn = document.createElement('button');
  showBtn.type = 'button';
  showBtn.className = 'btn btn-sm btn-outline-success';
  showBtn.textContent = 'Show';
  showBtn.addEventListener('click', () => {
    showCheckbox.checked = true;
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
  });
  const hideBtn = document.createElement('button');
  hideBtn.type = 'button';
  hideBtn.className = 'btn btn-sm btn-outline-secondary';
  hideBtn.textContent = 'Hide';
  hideBtn.addEventListener('click', () => {
    showCheckbox.checked = false;
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
    try {
      updateToast = updateToast || new bootstrap.Toast(updateToastEl);
      updateToast.show();
    } catch {}
  });
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-sm btn-outline-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (!window.confirm('Delete this streak?')) return;
    row.remove();
    saveToLocal();
  });
  streakFooter.appendChild(showBtn);
  streakFooter.appendChild(hideBtn);
  streakFooter.appendChild(deleteBtn);
  row.appendChild(streakFooter);

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
  countInput.value = data.count !== undefined && data.count !== null ? String(data.count) : '';
  const pairs = Array.isArray(data.recordPairs) && data.recordPairs.length > 0
    ? data.recordPairs
    : (data.record !== undefined || data.recordLabel) ? [{ label: data.recordLabel || '', value: data.record ?? null }] : [{ label: '', value: null }];
  recordPairsContainer.querySelectorAll('.record-pair').forEach(el => el.remove());
  pairs.forEach(p => addRecordPair({ label: p.label, value: p.value }));
  if (pairs.length === 0) addRecordPair();
  showCheckbox.checked = data.show !== false;
  showImageCheckbox.checked = data.showImage === true;
  countMarginCheckbox.checked = data.countMarginZero === true;

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

  [survivorSel, otherInput, countInput].forEach(el => {
    el.addEventListener('input', () => {
      if (el === countInput) updateIncrementButtonVisibility();
      saveToLocal();
    });
  });
  showCheckbox.addEventListener('change', saveToLocal);
  showImageCheckbox.addEventListener('change', saveToLocal);
  countMarginCheckbox.addEventListener('change', saveToLocal);

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
if (scoreboardResetBtn) {
  scoreboardResetBtn.addEventListener('click', () => {
    const confirmed = window.confirm('Reset timers? This will clear all timers and timer state. Scores will not be affected.');
    if (!confirmed) return;
    
    if (overlayData.scoreboard) {
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
  
  // Initially hide the reset button
  scoreboardResetBtn.style.display = 'none';
}

function updateScoreboardLabels(is1v1Mode) {
  const team1NameLabel = document.getElementById('scoreboard-team1-name-label');
  const team1ScoreLabel = document.getElementById('scoreboard-team1-score-label');
  const team2NameLabel = document.getElementById('scoreboard-team2-name-label');
  const team2ScoreLabel = document.getElementById('scoreboard-team2-score-label');
  
  if (is1v1Mode) {
    if (team1NameLabel) team1NameLabel.textContent = 'Survivor Name';
    if (team1ScoreLabel) team1ScoreLabel.textContent = 'Survivor Score';
    if (team2NameLabel) team2NameLabel.textContent = 'Killer Name';
    if (team2ScoreLabel) team2ScoreLabel.textContent = 'Killer Score';
  } else {
    if (team1NameLabel) team1NameLabel.textContent = 'Team 1 Name';
    if (team1ScoreLabel) team1ScoreLabel.textContent = 'Team 1 Score';
    if (team2NameLabel) team2NameLabel.textContent = 'Team 2 Name';
    if (team2ScoreLabel) team2ScoreLabel.textContent = 'Team 2 Score';
  }
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
    if (scoreboardResetBtn) {
      scoreboardResetBtn.style.display = scoreboard1v1ModeInput.checked ? 'block' : 'none';
    }
    updateScoreboardLabels(scoreboard1v1ModeInput.checked);
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
    // Check if this is the first run (before swap) or second run (after swap)
    // If team2Timer > 0, we've already done the first run and swap, so this is the second run
    const hasCompletedFirstRun = (overlayData.scoreboard.team2Timer || 0) > 0;
    
    if (!hasCompletedFirstRun) {
      // First run: Stop timer, save to team2Timer (will become Player 1's time after swap)
      const firstPlayerTime = now - overlayData.scoreboard.team1StartTime;
      overlayData.scoreboard.timerState = 'team1-stopped';
      overlayData.scoreboard.team1StartTime = null;
      
      // Swap player positions: Player 1 becomes Player 2, Player 2 becomes Player 1
      const team1NameInput = document.getElementById('scoreboard-team1-name');
      const team1ScoreInput = document.getElementById('scoreboard-team1-score');
      const team2NameInput = document.getElementById('scoreboard-team2-name');
      const team2ScoreInput = document.getElementById('scoreboard-team2-score');
      
      const tempName = overlayData.scoreboard.team1Name;
      const tempScore = overlayData.scoreboard.team1Score;
      
      overlayData.scoreboard.team1Name = overlayData.scoreboard.team2Name;
      overlayData.scoreboard.team1Score = overlayData.scoreboard.team2Score;
      overlayData.scoreboard.team1Timer = 0; // Reset for second player's timer
      
      overlayData.scoreboard.team2Name = tempName;
      overlayData.scoreboard.team2Score = tempScore;
      overlayData.scoreboard.team2Timer = firstPlayerTime; // Save first player's time
      
      // Update input fields to reflect the swap
      if (team1NameInput) team1NameInput.value = overlayData.scoreboard.team1Name;
      if (team1ScoreInput) team1ScoreInput.value = overlayData.scoreboard.team1Score;
      if (team2NameInput) team2NameInput.value = overlayData.scoreboard.team2Name;
      if (team2ScoreInput) team2ScoreInput.value = overlayData.scoreboard.team2Score;
      
      if (timerUpdateInterval) {
        clearInterval(timerUpdateInterval);
        timerUpdateInterval = null;
      }
    } else {
      // Second run: Stop timer and determine winner
      overlayData.scoreboard.team1Timer = now - overlayData.scoreboard.team1StartTime;
      overlayData.scoreboard.team1StartTime = null;
      
      // After swap: team1Timer is Player 2's time (current), team2Timer is Player 1's time (from first run)
      const team1Time = overlayData.scoreboard.team1Timer;
      const team2Time = overlayData.scoreboard.team2Timer;
      
      if (team1Time > team2Time) {
        overlayData.scoreboard.team1Score = (overlayData.scoreboard.team1Score || 0) + 1;
        if (team1ScoreInput) team1ScoreInput.value = overlayData.scoreboard.team1Score;
        overlayData.scoreboard.winningTimer = 'team1';
      } else if (team2Time > team1Time) {
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
    
  } else if (timerState === 'team1-stopped') {
    // Start timing the player now in position 1 (survivor position) after swap
    overlayData.scoreboard.timerState = 'team1-running';
    overlayData.scoreboard.team1StartTime = now;
    overlayData.scoreboard.team1Timer = 0;
    overlayData.scoreboard.team2StartTime = null;
  }
  
  saveToLocal();
  ws.send(JSON.stringify({ type: 'update', data: overlayData }));
  
  if (overlayData.scoreboard.timerState === 'team1-running') {
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
  if (timerState === 'team1-running') {
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

// Add event listener for scoreboard font size input
const scoreboardFontSizeInput = document.getElementById('scoreboard-font-size');
if (scoreboardFontSizeInput) {
  scoreboardFontSizeInput.addEventListener('input', () => {
    saveToLocal();
    ws.send(JSON.stringify({ type: 'update', data: overlayData }));
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
