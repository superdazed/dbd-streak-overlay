const ws = new WebSocket('ws://localhost:3000');
const display = document.getElementById('display');

ws.addEventListener('message', ev => {
  const data = JSON.parse(ev.data);
  if (data.type === 'update') {
    display.textContent = data.text || '';
  }
});
