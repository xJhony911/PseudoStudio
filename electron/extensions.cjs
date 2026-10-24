const fs = require('node:fs/promises');
const path = require('node:path');
function validateExtension(data) {
  if (!data || typeof data !== 'object' || !/^[a-z0-9][a-z0-9.-]{2,63}$/.test(data.id || '')) throw new Error('La extensión necesita un id válido (3–64 letras, números, puntos o guiones).');
  if (typeof data.name !== 'string' || data.name.length > 80 || typeof data.version !== 'string') throw new Error('Faltan nombre o versión.');
  if (JSON.stringify(data).length > 250_000) throw new Error('Extensión demasiado grande.');
  const snippets = data.snippets || [];
  if (!Array.isArray(snippets) || snippets.length > 200) throw new Error('La extensión admite hasta 200 snippets.');
  for (const s of snippets) if (typeof s.prefix !== 'string' || typeof s.body !== 'string' || s.body.length > 20_000) throw new Error('Snippet no válido.');
  const themes = data.themes || [];
  if (!Array.isArray(themes) || themes.length > 20) throw new Error('La extensión admite hasta 20 temas.');
  for (const t of themes) {
    if (!/^[a-z0-9-]+$/.test(t.id || '') || typeof t.name !== 'string' || !['vs', 'vs-dark'].includes(t.base)) throw new Error('Tema no válido.');
    for (const v of Object.values(t.colors || {})) if (typeof v !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(v)) throw new Error('Los colores deben ser hexadecimales.');
    if (t.rules && (!Array.isArray(t.rules) || t.rules.length > 100)) throw new Error('Reglas de tema no válidas.');
    for (const r of t.rules || []) if (typeof r.token !== 'string' || (r.foreground && !/^[\da-f]{6}$/i.test(r.foreground)) || (r.fontStyle && !/^(italic|bold|underline|strikethrough| )*$/.test(r.fontStyle))) throw new Error('Regla de color no válida.');
  }
  return { id: data.id, name: data.name, version: data.version, description: String(data.description || '').slice(0, 400), author: String(data.author || '').slice(0, 80), snippets, themes };
}
async function readExtensions(dirs, disabled = []) {
  const result = new Map();
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
    for (const name of await fs.readdir(dir)) {
      if (!name.endsWith('.json')) continue;
      try { const data = validateExtension(JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'))); result.set(data.id, { ...data, enabled: !disabled.includes(data.id) }); } catch { /* ignore malformed local manifests */ }
    }
  }
  return [...result.values()];
}
module.exports = { validateExtension, readExtensions };
