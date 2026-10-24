const fs = require('node:fs/promises');
const path = require('node:path');
async function readText(file) {
  if ((await fs.stat(file)).size > 2_000_000) throw new Error('El archivo supera 2 MB.');
  const data = await fs.readFile(file);
  if (data.includes(0)) throw new Error('Este archivo es binario; abre un archivo de texto.');
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch { content = data.toString('latin1'); }
  return { path: file, name: path.basename(file), content };
}
class Workspace {
  constructor() { this.root = null; }
  async open(folder) {
    const root = await fs.realpath(folder);
    if (!(await fs.stat(root)).isDirectory()) throw new Error('Selecciona una carpeta.');
    this.root = root; return { path: root, name: path.basename(root) || root };
  }
  async resolve(relative = '') {
    if (!this.root || typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Ruta de proyecto no válida.');
    const file = await fs.realpath(path.resolve(this.root, relative));
    const rel = path.relative(this.root, file);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('La ruta sale del proyecto.');
    return file;
  }
  async list(relative = '') {
    const dir = await this.resolve(relative);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => !e.isSymbolicLink() && (e.isFile() || e.isDirectory())).sort((a,b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, 'es', { numeric: true })).map(e => ({ name: e.name, relative: path.relative(this.root, path.join(dir, e.name)), directory: e.isDirectory() }));
  }
  async read(relative) { return readText(await this.resolve(relative)); }
  async create(parent, name, directory = false) {
    if (typeof name !== 'string' || !name || name.length > 180 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) throw new Error('Nombre de archivo o carpeta no válido.');
    const file = path.join(await this.resolve(parent), name);
    if (directory) await fs.mkdir(file);
    else await fs.writeFile(file, name.toLowerCase().endsWith('.psc') ? 'Algoritmo MiAlgoritmo\n    \nFinAlgoritmo\n' : '', { flag: 'wx' });
    return { relative: path.relative(this.root, file), directory };
  }
}
module.exports = { Workspace, readText };
