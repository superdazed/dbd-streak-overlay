import charactersJson from './characters.json';

const ws = new WebSocket(`ws://${window.location.host}`);
const display = document.getElementById('display');

// Eagerly import character images so Vite copies them to dist and gives us URLs
const killerAssets = import.meta.glob('./assets/characters/killers/*.webp', { eager: true, as: 'url' });
const survivorAssets = import.meta.glob('./assets/characters/survivors/*.webp', { eager: true, as: 'url' });

function buildAssetMap(assets) {
  const map = {};
  Object.entries(assets).forEach(([path, url]) => {
    const file = path.split('/').pop();
    const base = file.replace(/\.webp$/i, '');
    map[base] = url;
  });
  return map;
}

const killerAssetUrlByBase = buildAssetMap(killerAssets);
const survivorAssetUrlByBase = buildAssetMap(survivorAssets);

function slugify(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCharacterData(raw) {
  const toObjects = (list, type) => Array.isArray(list)
    ? list.map(item => {
        if (typeof item === 'string') {
          return { name: item, image: slugify(item), type };
        }
        const name = item && (item.name || item.label || item.title || '');
        const image = (item && item.image) ? item.image : slugify(name);
        return { name, image, type };
      }).filter(c => c.name)
    : [];
  return {
    killers: toObjects(raw.killers || raw.killer || raw.Killers || raw.Killer, 'killer'),
    survivors: toObjects(raw.survivors || raw.survivor || raw.Survivors || raw.Survivor, 'survivor')
  };
}

const normalizedCharacters = normalizeCharacterData(charactersJson || {});
const killerNameToBase = Object.fromEntries(normalizedCharacters.killers.map(c => [c.name, c.image]));
const survivorNameToBase = Object.fromEntries(normalizedCharacters.survivors.map(c => [c.name, c.image]));

function createImageUrl(type, name) {
  const safeName = typeof name === 'string' ? name : '';
  const base = type === 'killer' ? killerNameToBase[safeName] : survivorNameToBase[safeName];
  if (base) {
    const url = type === 'killer' ? killerAssetUrlByBase[base] : survivorAssetUrlByBase[base];
    if (url) return url;
  }
  // Fallback to dummy image with initials
  const initials = safeName
    ? safeName.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const text = encodeURIComponent(initials || '?');
  return `https://dummyimage.com/40x40/000/fff&text=${text}`;
}

function inverseColor(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r = 255 - parseInt(hex.substr(0,2),16);
  const g = 255 - parseInt(hex.substr(2,2),16);
  const b = 255 - parseInt(hex.substr(4,2),16);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function loadFont(font) {
  const id = 'google-font';
  let link = document.getElementById(id);
  if (link) link.remove();
  link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  if (font.includes('Roboto')) {
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}:ital,wght@0,100..900;1,100..900&display=swap`;
  } else {
    link.href = `https://fonts.googleapis.com/css2?family=${font}&display=swap`;
  }
  document.head.appendChild(link);
}

ws.addEventListener('message', ev => {
  const data = JSON.parse(ev.data);
  if (data.type === 'reload') {
    location.reload();
    return;
  }
  if (data.type === 'update') {
    render(data.data);
  }
});

function render(overlay) {
  if (!overlay) return;
  display.innerHTML = '';
  loadFont(overlay.settings.fontFace || 'Roboto');
  const inv = inverseColor(overlay.settings.fontColor || '#ffffff');
  display.style.fontFamily = overlay.settings.fontFace || 'Roboto';
  display.style.fontSize = `${overlay.settings.fontSize || 28}px`;
  display.style.color = overlay.settings.fontColor || '#ffffff';
  display.style.textShadow = `2px 2px 4px ${inv}`;
  const streaks = Array.isArray(overlay.streaks) ? overlay.streaks.filter(s => s.show !== false) : [];
  const hasAnyAvatar = streaks.some(s => s.showImage === true && ((s.type === 'Killer' && s.killer) || (s.type === 'Survivor' && s.survivor)));

  // Compute label alignment width using the same font as display
  const measure = document.createElement('span');
  measure.style.visibility = 'hidden';
  measure.style.position = 'absolute';
  measure.style.whiteSpace = 'pre';
  measure.style.fontFamily = display.style.fontFamily || 'Roboto';
  measure.style.fontSize = display.style.fontSize || '28px';
  display.appendChild(measure);
  let maxLabelWidth = 0;
  const avatarWidth = hasAnyAvatar ? (120 + 10) : 0; // image width + gap only if any avatar shown
  const nameToValueGap = 14; // same as CSS .count-area margin-left
  streaks.forEach(s => {
    const label = s.type === 'Killer'
      ? s.killer
      : s.type === 'Survivor'
        ? ((s.displayLabel && String(s.displayLabel).trim()) || 'Survivor')
        : s.other || '';
    measure.textContent = label;
    maxLabelWidth = Math.max(maxLabelWidth, measure.getBoundingClientRect().width);
  });
  display.removeChild(measure);
  const alignedLabelWidth = Math.ceil(maxLabelWidth);
  display.style.setProperty('--labelWidth', `${alignedLabelWidth}px`);
  const countColumnStart = avatarWidth + alignedLabelWidth + nameToValueGap;
  display.style.setProperty('--countColumnWidth', `${countColumnStart}px`);

  streaks.forEach(s => {
    const row = document.createElement('div');
    row.className = 'streak-row';

    // Column 1: avatar when any row has an avatar; otherwise omit the avatar column entirely
    const hasAvatar = s.showImage === true && ((s.type === 'Killer' && s.killer) || (s.type === 'Survivor' && s.survivor));
    if (hasAvatar) {
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      const img = document.createElement('img');
      img.src = createImageUrl(s.type === 'Killer' ? 'killer' : 'survivor', s.type === 'Killer' ? s.killer : s.survivor);
      avatar.appendChild(img);
      row.appendChild(avatar);
    }

    // Column 2: label
    const labelText = document.createElement('span');
    labelText.style.alignSelf = 'center';
    const label = s.type === 'Killer'
      ? s.killer
      : s.type === 'Survivor'
        ? ((s.displayLabel && String(s.displayLabel).trim()) || 'Survivor')
        : s.other || '';
    labelText.textContent = label;
    labelText.className = 'label';
    if (hasAnyAvatar && !hasAvatar) {
      row.classList.add('no-avatar');
      row.style.setProperty('--nameOffset', `${avatarWidth}px`);
    }
    row.appendChild(labelText);

    // Column 3: count + optional badge
    const countArea = document.createElement('span');
    countArea.className = 'count-area';
    countArea.style.alignSelf = 'center';
    const countText = document.createElement('span');
    countText.className = 'count';
    countText.textContent = String(s.count || 0);
    countArea.appendChild(countText);
    if (s.record && s.recordLabel) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.innerHTML = `<b style="margin-right: 6px;">${s.recordLabel}</b> ${s.record}`;
      countArea.appendChild(badge);
    }
    row.appendChild(countArea);

    display.appendChild(row);
  });
}
