const ws = new WebSocket('ws://localhost:3000');
const input = document.getElementById('text-input');

ws.addEventListener('message', ev => {
  const data = JSON.parse(ev.data);
  if (data.type === 'update' && document.activeElement !== input) {
    input.value = data.text || '';
  }
});

input.addEventListener('input', () => {
  ws.send(JSON.stringify({ type: 'update', text: input.value }));
});
