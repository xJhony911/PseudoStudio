export const themes = [
  { id: 'obsidian', name: 'Obsidiana', base: 'vs-dark', ui: { bg: '#14151c', surface: '#191a23', sidebar: '#14151c', editor: '#1b1c26', border: '#292b38', text: '#dddfe9', muted: '#85899f', accent: '#b9a3ff', green: '#b5e59c', red: '#f08c9b' }, syntax: { keyword: 'c4a7e7', string: 'b5e59c', number: 'f3c78b', comment: '646b82', type: '89dceb', operator: 'ee99b6' } },
  { id: 'monokai', name: 'Monokai', base: 'vs-dark', ui: { bg: '#20211c', surface: '#272822', sidebar: '#22231e', editor: '#272822', border: '#3b3d32', text: '#f8f8f2', muted: '#999b88', accent: '#f92672', green: '#a6e22e', red: '#f92672' }, syntax: { keyword: 'f92672', string: 'e6db74', number: 'ae81ff', comment: '75715e', type: '66d9ef', operator: 'f92672' } },
  { id: 'dracula', name: 'Drácula', base: 'vs-dark', ui: { bg: '#21222c', surface: '#282a36', sidebar: '#242530', editor: '#282a36', border: '#3e4054', text: '#f8f8f2', muted: '#9299bc', accent: '#bd93f9', green: '#50fa7b', red: '#ff5555' }, syntax: { keyword: 'ff79c6', string: 'f1fa8c', number: 'bd93f9', comment: '6272a4', type: '8be9fd', operator: 'ff79c6' } },
  { id: 'nord', name: 'Nord', base: 'vs-dark', ui: { bg: '#272e3b', surface: '#2e3440', sidebar: '#2a303d', editor: '#2e3440', border: '#414b5d', text: '#eceff4', muted: '#929eb1', accent: '#88c0d0', green: '#a3be8c', red: '#bf616a' }, syntax: { keyword: '81a1c1', string: 'a3be8c', number: 'b48ead', comment: '697b94', type: '8fbcbb', operator: '81a1c1' } },
  { id: 'paper', name: 'Papel', base: 'vs', ui: { bg: '#f1f0ec', surface: '#faf9f5', sidebar: '#f5f4f0', editor: '#faf9f5', border: '#deded7', text: '#343b45', muted: '#747b83', accent: '#7161ad', green: '#80a870', red: '#c05364' }, syntax: { keyword: '8f46a1', string: '4e7e3c', number: 'b67821', comment: '92988d', type: '237c89', operator: 'bd5471' } }
];
export const extensionThemeId = (id, theme) => `ext-${[...id].map(c => c.charCodeAt(0).toString(16)).join('')}-${theme}`;
export function registerThemes(monaco, extensions = []) {
  for (const t of themes) monaco.editor.defineTheme(t.id, {
    base: t.base, inherit: true,
    rules: Object.entries(t.syntax).map(([token, foreground]) => ({ token, foreground, ...(token === 'comment' ? { fontStyle: 'italic' } : {}) })),
    colors: { 'editor.background': t.ui.editor, 'editor.foreground': t.ui.text, 'editorLineNumber.foreground': t.ui.muted + '88', 'editorLineNumber.activeForeground': t.ui.accent, 'editor.selectionBackground': t.ui.accent + '30', 'editor.lineHighlightBackground': t.ui.accent + '08', 'editorCursor.foreground': t.ui.accent, 'editorIndentGuide.background1': t.ui.border, 'editorIndentGuide.activeBackground1': t.ui.muted, 'editorWidget.background': t.ui.surface, 'editorWidget.border': t.ui.border, 'editorSuggestWidget.background': t.ui.surface, 'editorSuggestWidget.border': t.ui.border, 'editorSuggestWidget.selectedBackground': t.ui.accent + '25', 'editorHoverWidget.background': t.ui.surface }
  });
  for (const ext of extensions.filter(e => e.enabled)) for (const theme of ext.themes) monaco.editor.defineTheme(extensionThemeId(ext.id, theme.id), { base: theme.base, inherit: true, rules: theme.rules || [], colors: theme.colors || {} });
}
export function allThemes(extensions) {
  return [...themes, ...extensions.filter(e => e.enabled).flatMap(ext => ext.themes.map(t => ({ id: extensionThemeId(ext.id, t.id), name: t.name, base: t.base, ui: { ...(t.base === 'vs' ? themes[4].ui : themes[0].ui), editor: t.colors?.['editor.background'] || (t.base === 'vs' ? themes[4].ui.editor : themes[0].ui.editor), accent: t.colors?.['editorCursor.foreground'] || themes[0].ui.accent } })))];
}
