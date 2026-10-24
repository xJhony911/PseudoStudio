const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Engine, encodeSource, diagnostics } = require('../electron/engine.cjs');
const root = path.join(__dirname, '../engine');
function execute(code, opts = {}, input = []) {
  const engine = new Engine(root); let output = '', sent = 0;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { engine.dispose(); reject(new Error('Timeout: ' + output)); }, 15000);
    engine.on('output', chunk => { output += chunk; if (chunk.includes('\x1b[zl') && sent < input.length) engine.input(input[sent++]); });
    engine.on('exit', result => { clearTimeout(timer); resolve({ output, result }); });
    engine.run(code, opts).catch(err => { clearTimeout(timer); reject(err); });
  });
}
test('preserva acentos y rechaza conversiones con pérdida', () => { assert.equal(encodeSource('¡Hola, ñ!').toString('latin1'), '¡Hola, ñ!'); assert.throws(() => encodeSource('🙂'), /Latin-1/); });
test('extrae diagnósticos reales', () => { assert.deepEqual(diagnostics('Lin 3 (inst 1): ERROR 106: Falta instrucción.'), [{ line: 3, code: 106, message: 'Falta instrucción.' }]); });
test('verifica programas válidos y detecta sintaxis incorrecta', async () => {
  const engine = new Engine(root);
  assert.deepEqual(await engine.check('Algoritmo A\nEscribir "Hola"\nFinAlgoritmo', 'Flexible'), []);
  const errors = await engine.check('Algoritmo A\nSi Verdadero Entonces\nEscribir "Hola"\nFinAlgoritmo', 'Flexible');
  assert.ok(errors.length > 0); assert.ok(errors.every(e => e.line >= 1));
});
test('calcula con el motor de PSeInt y conserva texto español', async () => {
  const { output } = await execute('Algoritmo A\nDefinir x Como Real\nx <- (8.5+9+7.5)/3\nEscribir "¡Resultado! ", x\nFinAlgoritmo');
  assert.match(output, /¡Resultado! 8\.333/);
});
test('Lee recibe entrada interactiva', async () => {
  const { output } = await execute('Algoritmo A\nDefinir nombre Como Caracter\nLeer nombre\nEscribir "Hola, ", nombre\nFinAlgoritmo', {}, ['José']);
  assert.match(output, /Hola, José/);
});
test('ejecuta arreglos, bucles y subprocesos', async () => {
  const code = 'Funcion r <- Doble(n)\nDefinir r Como Real\nr <- n*2\nFinFuncion\nAlgoritmo Prueba\nDefinir a, i, suma Como Entero\nDimension a[3]\nsuma <- 0\nPara i <- 1 Hasta 3 Hacer\na[i] <- Doble(i)\nsuma <- suma+a[i]\nFinPara\nEscribir "SUMA=", suma\nFinAlgoritmo';
  const { output } = await execute(code); assert.match(output, /SUMA=12/);
});
test('perfil estricto exige declaraciones y punto y coma', async () => {
  const engine = new Engine(root); const errors = await engine.check('Algoritmo A\nx <- 1\nEscribir x\nFinAlgoritmo', 'Estricto'); assert.ok(errors.length > 0);
});
test('depuración real avanza y consulta variables', async () => {
  const engine = new Engine(root); const messages = []; let count = 0;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { engine.dispose(); reject(new Error(messages.join('\n'))); }, 15000);
    engine.on('debug', line => { messages.push(line); if (line === 'estado pausa') { count++; if (count > 40) { engine.stop(); return; } setTimeout(() => engine.command('paso'), 30); } });
    engine.on('exit', () => { clearTimeout(timeout); resolve(); });
    engine.run('Algoritmo A\nDefinir x Como Entero\nx <- 42\nEscribir x\nFinAlgoritmo', { debug: true, watches: ['x'] }).catch(reject);
  });
  assert.ok(messages.some(s => /^linea /.test(s))); assert.ok(messages.some(s => /autoevaluacion 1 42/.test(s)), messages.join('\n'));
});
test('detiene un bucle infinito sin colgar la interfaz', async () => {
  const engine = new Engine(root);
  await new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => { engine.dispose(); reject(new Error('No se detuvo el proceso.')); }, 10000);
    engine.on('exit', result => { clearTimeout(timeout); assert.equal(result.stopped, true); resolve(); });
    try { await engine.run('Algoritmo A\nMientras Verdadero Hacer\nFinMientras\nFinAlgoritmo'); setTimeout(() => engine.stop(), 200); } catch (e) { clearTimeout(timeout); reject(e); }
  });
});
test('todos los ejemplos incluidos son válidos para el perfil Flexible', async () => {
  const { pathToFileURL } = require('node:url');
  const { examples } = await import(pathToFileURL(path.join(__dirname, '../src/examples.js')).href);
  const engine = new Engine(root);
  for (const example of examples) assert.deepEqual(await engine.check(example.code, 'Flexible'), [], example.name);
});

test('Esperar Tecla no deja un Enter pendiente para el siguiente Leer', async () => {
  const engine = new Engine(root); let output = '', pending = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { engine.dispose(); reject(new Error(output)); }, 8000);
    engine.on('output', chunk => {
      output += chunk; pending += chunk;
      while (/\x1b\[z[kl]/.test(pending)) {
        const match = pending.match(/\x1b\[z([kl])/); pending = pending.slice(match.index + 4);
        if (match[1] === 'k') engine.input('x', 'key'); else engine.input('José');
      }
    });
    engine.on('exit', () => { clearTimeout(timer); resolve(); });
    engine.run('Algoritmo Teclado\nEsperar Tecla\nLeer nombre\nEscribir "NOMBRE=", nombre\nFinAlgoritmo').catch(reject);
  });
  assert.match(output, /NOMBRE=José/);
});
