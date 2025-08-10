const ws = new WebSocket('ws://localhost:3000');
const display = document.getElementById('display');

function createImage(name) {
  const initials = name.match(/\b\w/g).join('').slice(0,2).toUpperCase();
  return `https://dummyimage.com/40x40/000/fff&text=${initials}`;
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
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}&display=swap`;
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
  display.style.fontSize = `${overlay.settings.fontSize || 18}px`;
  display.style.color = overlay.settings.fontColor || '#ffffff';
  display.style.textShadow = `1px 1px ${inv}`;
  overlay.streaks.forEach(s => {
    const row = document.createElement('div');
    row.className = 'streak-row';
    let label = '';
    if (s.type === 'Killer') {
      label = s.killer;
      const img = document.createElement('img');
      img.src = createImage(s.killer);
      row.appendChild(img);
    } else if (s.type === 'Survivor') {
      label = s.survivor;
      const img = document.createElement('img');
      img.src = createImage(s.survivor);
      row.appendChild(img);
    } else {
      label = s.other;
    }
    const text = document.createElement('span');
    text.textContent = `${label} ${s.count}`;
    row.appendChild(text);
    if (s.record && s.recordLabel) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `${s.record} ${s.recordLabel}`;
      row.appendChild(badge);
    }
    display.appendChild(row);
  });
}
