const { test } = require('node:test');
const assert = require('node:assert/strict');
const QRCode = require('qrcode');

// Test format helpers
function formatRoomCode(raw) {
  const clean = String(raw || '').replace(/\D/g, '').slice(0, 6);
  if (clean.length > 3) {
    return clean.slice(0, 3) + '-' + clean.slice(3);
  }
  return clean;
}

function cleanRoomCode(formatted) {
  return String(formatted || '').replace(/\D/g, '').slice(0, 6);
}

function generateRoomCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return formatRoomCode(String(num));
}

test('aula en vivo: formateo, generación y limpieza de códigos de 6 dígitos', () => {
  const code = generateRoomCode();
  assert.match(code, /^\d{3}-\d{3}$/, 'El código generado debe tener formato 000-000');
  
  const raw = cleanRoomCode(code);
  assert.equal(raw.length, 6, 'El código limpio debe tener 6 dígitos');
  assert.equal(formatRoomCode('123456'), '123-456', 'Debe formatear 123456 como 123-456');
  assert.equal(cleanRoomCode('123-456'), '123456', 'Debe limpiar 123-456 a 123456');
});

test('código QR para transmisión de aula en vivo', async () => {
  const qrUrl = await QRCode.toDataURL('pseudostudio://live/123456', { width: 200 });
  assert.ok(qrUrl.startsWith('data:image/png;base64,'), 'Debe generar un DataURL PNG válido');
});
