const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { EventEmitter } = require('node:events');

function encodeSource(code) {
  if (typeof code !== 'string' || code.length > 2_000_000) throw new Error('El programa debe tener menos de 2 MB.');
  const normalized = code.replace(/^\uFEFF/, '').replace(/←/g, '<-').replace(/≠/g, '<>');
  const bad = [...normalized].find(c => c.codePointAt(0) > 255);
  if (bad) throw new Error(`El motor PSeInt usa Latin-1. El carácter «${bad}» no está disponible; reemplázalo para ejecutar.`);
  return Buffer.from(normalized, 'latin1');
}
function diagnostics(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const m = line.match(/Lin\s+(\d+)(?:\s*\(inst\s+\d+\))?:\s*ERROR\s+(\d+):\s*(.*)/i);
    return m ? [{ line: Math.max(1, Number(m[1])), code: Number(m[2]), message: m[3] }] : [];
  });
}
class Engine extends EventEmitter {
  constructor(root) { super(); this.root = root; this.active = null; this.checks = new Set(); }
  args(file, profile = 'Flexible') {
    if (!['Flexible', 'Estricto'].includes(profile)) throw new Error('Perfil no válido.');
    return [file, '--nouser', `--profile=${path.join(this.root, 'profiles', profile)}`];
  }
  async verifyRuntime() {
    for (const file of ['pseint.exe', 'profiles/Flexible', 'profiles/Estricto']) {
      try { await fs.access(path.join(this.root, file)); }
      catch { throw new Error('Faltan archivos del motor PSeInt. Abre PseudoStudio desde su carpeta completa; conserva la carpeta resources junto al ejecutable.'); }
    }
  }
  async prepare(code) {
    await this.verifyRuntime();
    const data = encodeSource(code);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudostudio-'));
    const file = path.join(dir, 'programa.psc');
    await fs.writeFile(file, data);
    return { dir, file };
  }
  async check(code, profile) {
    const tmp = await this.prepare(code);
    try {
      return await new Promise((resolve, reject) => {
        const child = spawn(path.join(this.root, 'pseint.exe'), [...this.args(tmp.file, profile), '--norun'], { windowsHide: true });
        this.checks.add(child);
        let output = '', done = false;
        const timer = setTimeout(() => { child.kill(); finish(new Error('La comprobación superó los 8 segundos.')); }, 8000);
        const finish = (err) => { if (done) return; done = true; clearTimeout(timer); this.checks.delete(child); err ? reject(err) : resolve(diagnostics(output)); };
        child.stdout.on('data', b => { output += b.toString('latin1'); if (output.length > 1_000_000) { child.kill(); finish(new Error('Demasiados diagnósticos.')); } });
        child.stderr.on('data', b => { output += b.toString('latin1'); });
        child.on('error', finish);
        child.on('close', code => finish(code !== 0 ? new Error(output || `El motor terminó con código ${code}.`) : null));
      });
    } finally { await fs.rm(tmp.dir, { recursive: true, force: true }); }
  }
  async collect(executable, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(this.root, executable), args, { windowsHide:true });
      this.checks.add(child); let output = '', done = false;
      const finish = error => { if (done) return; done = true; clearTimeout(timer); this.checks.delete(child); error ? reject(error) : resolve(output); };
      const timer = setTimeout(() => { child.kill(); finish(new Error('La generación superó los 15 segundos.')); },15000);
      const read = data => { output += data.toString('latin1'); if (output.length > 2_000_000) { child.kill(); finish(new Error('La salida del motor es demasiado grande.')); } };
      child.stdout.on('data',read); child.stderr.on('data',read);
      child.on('error',finish); child.on('close',code=>finish(code !== 0 ? new Error(output || `El motor terminó con código ${code}.`) : null));
    });
  }
  async diagram(code, profile = 'Flexible') {
    const tmp = await this.prepare(code);
    try {
      const file = path.join(tmp.dir,'diagram.psd');
      const output = await this.collect('pseint.exe',[...this.args(tmp.file,profile),'--draw',file,'--writepositions']);
      const errors = diagnostics(output);
      if (errors.length) return {errors, text:''};
      return {errors:[], text:(await fs.readFile(file)).toString('latin1')};
    } finally { await fs.rm(tmp.dir,{recursive:true,force:true}); }
  }
  async translate(code, profile = 'Flexible', language) {
    const formats = {c:'c',cpp:'cpp',cs:'cs',java:'java',js:'js',html:'html',py3:'py',pas:'pas',php:'php',m:'m',vb:'vb',bas:'bas'};
    if (!Object.hasOwn(formats,language)) throw new Error('Lenguaje de exportación no válido.');
    const tmp = await this.prepare(code);
    try {
      const parsed = path.join(tmp.dir,'program.drw'), result = path.join(tmp.dir,'program.'+formats[language]);
      const output = await this.collect('pseint.exe',[...this.args(tmp.file,profile),'--export',parsed]);
      const errors = diagnostics(output);
      if (errors.length) return {errors, text:'', extension:formats[language]};
      await this.collect('psexport.exe',[`--lang=${language}`,`--base_zero_arrays=${profile==='Estricto'?1:0}`,parsed,result]);
      if ((await fs.stat(result)).size > 4_000_000) throw new Error('La exportación supera 4 MB.');
      return {errors:[], text:(await fs.readFile(result)).toString('latin1'),extension:formats[language]};
    } finally { await fs.rm(tmp.dir,{recursive:true,force:true}); }
  }
  async run(code, { profile = 'Flexible', debug = false, watches = [] } = {}) {
    if (this.active) throw new Error('Ya hay un programa en ejecución. Deténlo antes de iniciar otro.');
    const run = { starting: true, socket: null, server: null, child: null, dir: null, stopped: false };
    this.active = run;
    try {
      const tmp = await this.prepare(code); run.dir = tmp.dir;
      const args = [...this.args(tmp.file, profile), '--forpseintterminal'];
      if (debug) {
        run.server = net.createServer(socket => {
          if (run.socket) { socket.destroy(); return; }
          run.socket = socket;
          let buf = '';
          socket.on('error', () => {});
          socket.on('data', chunk => {
            buf += chunk.toString('latin1');
            let pos;
            while ((pos = buf.indexOf('\n')) !== -1) {
              const line = buf.slice(0, pos).trim(); buf = buf.slice(pos + 1);
              if (line === 'estado inicializado') {
                socket.write('subprocesos 1\n');
                for (const name of watches.slice(0, 50)) if (/^[\wáéíóúñÁÉÍÓÚÑ]+$/.test(name)) socket.write(Buffer.from(`autoevaluar ${name}\n`, 'latin1'));
                socket.write('paso\n');
              }
              this.emit('debug', line);
            }
          });
        });
        await new Promise((resolve, reject) => { run.server.once('error', reject); run.server.listen(0, '127.0.0.1', resolve); });
        args.push(`--port=${run.server.address().port}`, '--delay=1');
      }
      if (run.stopped) throw new Error('Ejecución cancelada.');
      run.child = spawn(path.join(this.root, 'pseint.exe'), args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      run.starting = false;
      let finished = false, total = 0;
      const finish = async (code, error) => {
        if (finished) return; finished = true;
        clearTimeout(run.timer); run.socket?.destroy(); run.server?.close();
        if (this.active === run) this.active = null;
        if (error) this.emit('output', error + '\n');
        this.emit('exit', { code, stopped: run.stopped });
        await fs.rm(run.dir, { recursive: true, force: true }).catch(() => {});
      };
      run.child.stdin.on('error', () => {});
      run.child.stdout.on('data', data => {
        total += data.length;
        if (total > 4_000_000) { this.emit('output', '\nSe alcanzó el límite de salida (4 MB).\n'); this.stop(); return; }
        this.emit('output', data.toString('latin1'));
      });
      run.child.stderr.on('data', data => this.emit('output', data.toString('latin1')));
      run.child.on('error', err => finish(1, err.message));
      run.child.on('close', code => finish(code));
      run.timer = setTimeout(() => { this.emit('output', '\nEjecución detenida tras 30 minutos.\n'); this.stop(); }, 30 * 60 * 1000);
      return { started: true, debug };
    } catch (err) {
      run.socket?.destroy(); run.server?.close();
      if (run.dir) await fs.rm(run.dir, { recursive: true, force: true }).catch(() => {});
      if (this.active === run) this.active = null;
      throw err;
    }
  }
  input(value, kind = 'line') { if (!this.active?.child) throw new Error('No hay una ejecución activa.'); this.active.child.stdin.write(encodeSource(kind === 'key' ? (String(value).slice(0, 1) || '\n') : String(value) + '\n')); }
  command(command) { if (!['paso', 'continuar', 'pausar'].includes(command)) throw new Error('Comando no válido.'); if (!this.active?.socket) throw new Error('Inicia la depuración primero.'); this.active.socket.write(command + '\n'); }
  stop() { if (!this.active) return; this.active.stopped = true; this.active.child?.kill(); this.active.socket?.destroy(); this.active.server?.close(); }
  dispose() { this.stop(); for (const child of this.checks) child.kill(); }
}
module.exports = { Engine, encodeSource, diagnostics };
