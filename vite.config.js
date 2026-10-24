import { defineConfig } from 'vite';
export default defineConfig({ base: './', plugins: [{
  name: 'monaco-highlight-cancellation',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/wordHighlighter/browser/wordHighlighter.js')) return;
    // Monaco 0.52.2 cancels these delayed jobs when a model is replaced.
    // Handle cancellation at its source; preserve reporting of actual errors.
    return code.replace('this.runDelayer.trigger(() => { this._onPositionChanged(e); });', 'this.runDelayer.trigger(() => { this._onPositionChanged(e); }).catch(onUnexpectedError);')
      .replace('this.runDelayer.trigger(() => { this._run(); });', 'this.runDelayer.trigger(() => { this._run(); }).catch(onUnexpectedError);');
  }
}], build: { outDir: 'dist', chunkSizeWarningLimit: 3500 }, server: { host: '127.0.0.1' } });
