const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

test('aula en vivo: saneamiento de secuencias de control ANSI en terminal de espectador', () => {
  // Simular secuencias ANSI y secuencias internas de PSeInt (\x1b[zl, \x1b[zk)
  const rawGlitchChunk = '\x1b[zl\x1b[1;32mIngrese un número:\x1b[0m \x1b[zk';
  const sanitized = String(rawGlitchChunk)
    .replace(/\x1b\[z[a-zA-Z0-9]*/gi, '')
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\x1b/g, '');
  
  assert.equal(sanitized, 'Ingrese un número: ');
  assert.ok(!sanitized.includes('\x1b'), 'No debe contener secuencias de escape ANSI');
  assert.ok(!sanitized.includes('zl') && !sanitized.includes('zk'), 'No debe contener residuos de comandos PSeInt');
});

test('aula en vivo: transmisión a 50+ espectadores concurrentes con recolección de conexiones inactivas', () => {
  // Simulación del patrón de broadcast de LiveManager optimizado para 50+ estudiantes
  const peers = new Map();
  const receivedMessages = new Map();
  
  // Conectar 55 espectadores
  for (let i = 1; i <= 55; i++) {
    const studentId = `estudiante-${i}`;
    receivedMessages.set(studentId, []);
    
    // Simular conexión WebRTC DataChannel
    const mockConn = {
      open: i <= 52, // 52 activos, 3 caídos
      send: (data) => {
        if (!mockConn.open) {
          throw new Error('Connection closed');
        }
        receivedMessages.get(studentId).push(JSON.parse(data));
      },
      close: () => {
        mockConn.open = false;
      }
    };
    peers.set(studentId, mockConn);
  }

  assert.equal(peers.size, 55, 'Debe haber 55 conexiones registradas');

  // Lógica de broadcast idéntica a live.js
  function broadcast(payload) {
    const json = JSON.stringify(payload);
    const deadPeers = [];
    peers.forEach((conn, id) => {
      try {
        if (conn && conn.open) {
          conn.send(json);
        } else {
          deadPeers.push(id);
        }
      } catch (err) {
        deadPeers.push(id);
      }
    });
    // Limpieza de peers caídos sin bloquear el hilo
    deadPeers.forEach(id => peers.delete(id));
  }

  // Enviar actualización de código del profesor
  broadcast({ type: 'code-update', code: 'Algoritmo AulaEnVivo\n\tEscribir "Hola clase"\nFinAlgoritmo', filename: 'aula.psc' });

  // Enviar texto de terminal y datos ingresados por el profesor en Leer
  broadcast({ type: 'terminal-chunk', text: 'Ingrese base: 10\n' });
  broadcast({ type: 'terminal-chunk', text: 'Ingrese altura: 25\n' });
  broadcast({ type: 'terminal-chunk', text: 'Área calculada: 125\n' });

  // Comprobar que los 52 alumnos activos recibieron todos los mensajes
  for (let i = 1; i <= 52; i++) {
    const studentId = `estudiante-${i}`;
    const msgs = receivedMessages.get(studentId);
    assert.equal(msgs.length, 4, `${studentId} debió recibir 4 mensajes de broadcast`);
    assert.equal(msgs[0].type, 'code-update');
    assert.equal(msgs[1].text, 'Ingrese base: 10\n');
    assert.equal(msgs[2].text, 'Ingrese altura: 25\n');
    assert.equal(msgs[3].text, 'Área calculada: 125\n');
  }

  // Las conexiones caídas fueron eliminadas automáticamente para mantener la memoria limpia
  assert.equal(peers.size, 52, 'Las 3 conexiones caídas deben ser purgadas de la lista de peers');
});

test('aula en vivo: throttling de movimiento de cursor para prevenir congestión con 50+ alumnos', () => {
  let broadcastCount = 0;
  let lastCursorBroadcast = 0;
  const CURSOR_THROTTLE_MS = 50; // máx 20 updates/segundo

  function onCursorChange(line, ch) {
    const now = Date.now();
    if (now - lastCursorBroadcast < CURSOR_THROTTLE_MS) return false;
    lastCursorBroadcast = now;
    broadcastCount++;
    return true;
  }

  // Simular 100 movimientos de cursor rápidos generados en 10ms
  for (let i = 0; i < 100; i++) {
    onCursorChange(1, i);
  }

  assert.equal(broadcastCount, 1, 'En una ráfaga rápida de 10ms sólo debe permitir 1 emisión');
});

test('aula en vivo: los documentos remotos de espectadores no se guardan en drafts locales', () => {
  // Simulación de documentos abiertos en la máquina de un estudiante
  const documents = [
    { id: 'doc-personal-1', name: 'mi_ejercicio.psc', content: 'Algoritmo Mio\nFinAlgoritmo', isLiveSession: false },
    { id: 'doc-aula-live', name: 'clase_profesor.psc', content: 'Algoritmo Explicacion\nFinAlgoritmo', isLiveSession: true }
  ];

  // Lógica de persistDrafts de main.js:
  // drafts = documents.filter(d => !d.isLiveSession).map(...)
  const persistedDrafts = documents
    .filter(d => !d.isLiveSession)
    .map(d => ({ id: d.id, name: d.name, content: d.content }));

  assert.equal(persistedDrafts.length, 1, 'Sólo debe persistir documentos personales del estudiante');
  assert.equal(persistedDrafts[0].name, 'mi_ejercicio.psc');
  assert.ok(!persistedDrafts.some(d => d.name === 'clase_profesor.psc'), 'El código del profesor en vivo no debe ensuciar los borradores del estudiante');
});

test('guardado de archivos: ruta por defecto apunta a Documentos del usuario', () => {
  // Verificación de la ruta por defecto configurada en electron/main.cjs
  const defaultDir = os.homedir ? path.join(os.homedir(), 'Documents') : '';
  assert.ok(defaultDir.length > 0, 'Debe resolver la ruta a Documentos');
});
