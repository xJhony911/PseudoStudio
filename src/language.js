export const keywords = ['Algoritmo','FinAlgoritmo','Proceso','FinProceso','SubProceso','FinSubProceso','Funcion','FinFuncion','Definir','Como','Entero','Real','Logico','Caracter','Cadena','Dimension','Leer','Escribir','Sin Saltar','Si','Entonces','SiNo','FinSi','Segun','Hacer','De Otro Modo','FinSegun','Para','Hasta','Con Paso','FinPara','Mientras','FinMientras','Repetir','Hasta Que','Verdadero','Falso','Y','O','No','MOD','Por Referencia','Por Valor','Esperar','Tecla','Segundos','Limpiar Pantalla'];

export const docs = {
  escribir: ['Escribir expresión, ...', 'Muestra valores en la terminal. Usa «Escribir Sin Saltar» para continuar en la misma línea.'],
  leer: ['Leer variable', 'Espera un dato desde la terminal y lo guarda en la variable.'],
  definir: ['Definir nombre Como Entero', 'Declara variables. Tipos: Entero, Real, Logico y Caracter.'],
  dimension: ['Dimension arreglo[tamaño]', 'Reserva un arreglo. La base de índices depende del perfil de PSeInt.'],
  si: ['Si condición Entonces … SiNo … FinSi', 'Ejecuta una rama según el resultado lógico de una condición.'],
  para: ['Para i <- inicio Hasta fin Con Paso paso Hacer', 'Repite un bloque con un contador. Cierra con FinPara.'],
  mientras: ['Mientras condición Hacer … FinMientras', 'Repite mientras la condición sea verdadera.'],
  repetir: ['Repetir … Hasta Que condición', 'Ejecuta al menos una vez y termina cuando la condición es verdadera.'],
  segun: ['Segun variable Hacer … FinSegun', 'Selecciona una rama entre varios valores.'],
  azar: ['Azar(n)', 'Devuelve un entero aleatorio entre 0 y n−1.'],
  aleatorio: ['Aleatorio(inferior, superior)', 'Devuelve un entero aleatorio dentro del intervalo.'],
  longitud: ['Longitud(cadena)', 'Devuelve la cantidad de caracteres.'],
  subcadena: ['Subcadena(cadena, inicio, fin)', 'Extrae parte de una cadena. Los índices dependen del perfil.'],
  concatenar: ['Concatenar(a, b)', 'Une dos cadenas de caracteres.'],
  mayusculas: ['Mayusculas(cadena)', 'Convierte una cadena a mayúsculas.'],
  minusculas: ['Minusculas(cadena)', 'Convierte una cadena a minúsculas.'],
  rc: ['RC(n)', 'Calcula la raíz cuadrada.'],
  abs: ['ABS(n)', 'Calcula el valor absoluto.'],
  trunc: ['TRUNC(n)', 'Devuelve la parte entera.'],
  redon: ['REDON(n)', 'Redondea al entero más cercano.'],
  sen: ['SEN(ángulo)', 'Calcula el seno, con el ángulo en radianes.'],
  cos: ['COS(ángulo)', 'Calcula el coseno, con el ángulo en radianes.'],
  tan: ['TAN(ángulo)', 'Calcula la tangente, con el ángulo en radianes.'],
  convertiratexto: ['ConvertirATexto(n)', 'Convierte un número a cadena.'],
  convertiranumero: ['ConvertirANumero(texto)', 'Convierte una cadena numérica a número.']
};

export const standardSnippets = [
  { label: 'si', detail: 'Si-Entonces (condicional simple)', body: 'Si ${1:condicion} Entonces\n\t$0\nFinSi' },
  { label: 'sino', detail: 'Si-Entonces-SiNo (condicional doble)', body: 'Si ${1:condicion} Entonces\n\t${2:// verdadero}\nSiNo\n\t$0\nFinSi' },
  { label: 'mientras', detail: 'Mientras-Hacer (bucle)', body: 'Mientras ${1:condicion} Hacer\n\t$0\nFinMientras' },
  { label: 'para', detail: 'Para-Hasta-Con Paso (bucle)', body: 'Para ${1:i} <- ${2:1} Hasta ${3:10} Con Paso ${4:1} Hacer\n\t$0\nFinPara' },
  { label: 'paracada', detail: 'Para Cada elemento (recorrido)', body: 'Para Cada ${1:elemento} De ${2:arreglo} Hacer\n\t$0\nFinPara' },
  { label: 'repetir', detail: 'Repetir-Hasta Que (bucle)', body: 'Repetir\n\t$0\nHasta Que ${1:condicion}' },
  { label: 'segun', detail: 'Segun-Hacer (selección múltiple)', body: 'Segun ${1:variable} Hacer\n\t${2:1}:\n\t\t$0\n\tDe Otro Modo:\n\t\t\nFinSegun' },
  { label: 'funcion', detail: 'Funcion con retorno', body: 'Funcion ${1:retorno} <- ${2:Nombre} ( ${3:args} )\n\t$0\nFinFuncion' },
  { label: 'subproceso', detail: 'SubProceso / Procedimiento', body: 'SubProceso ${1:Nombre} ( ${2:args} )\n\t$0\nFinSubProceso' },
  { label: 'algoritmo', detail: 'Estructura Algoritmo', body: 'Algoritmo ${1:Nombre}\n\t$0\nFinAlgoritmo' },
  { label: 'escribir', detail: 'Escribir en terminal', body: 'Escribir ${1:/*expresiones*/};' },
  { label: 'leer', detail: 'Leer desde teclado', body: 'Leer ${1:variable};' },
  { label: 'definir', detail: 'Definir tipo de dato', body: 'Definir ${1:variable} Como ${2|Entero,Real,Logico,Caracter,Cadena|};' },
  { label: 'dimension', detail: 'Dimensionar arreglo', body: 'Dimension ${1:arreglo}[${2:10}];' }
];

export function symbols(code) {
  const result = [];
  code.split('\n').forEach((line, i) => {
    const clean = line.replace(/\/\/.*$/, '');
    const decl = clean.match(/^\s*Definir\s+(.+?)\s+Como\s+(\w+)/i);
    if (decl) for (const name of decl[1].split(',')) { const n = name.trim(); if (n) result.push({ name: n, type: decl[2], line: i + 1, kind: 'variable' }); }
    const fn = clean.match(/^\s*(?:SubProceso|Funcion|SubAlgoritmo)\s+(?:(\w+)\s*<-\s*)?([\wáéíóúñ]+)\s*(?:\((.*)\))?/i);
    if (fn) result.push({ name: fn[2], type: `(${fn[3] || ''})`, line: i + 1, kind: 'function' });
    const main = clean.match(/^\s*(?:Algoritmo|Proceso)\s+([\wáéíóúñ]+)/i);
    if (main) result.push({ name: main[1], type: 'Algoritmo', line: i + 1, kind: 'main' });
  });
  return result;
}

export function getCurrentSymbol(code, lineNumber) {
  const all = symbols(code);
  let active = null;
  for (const s of all) {
    if (s.kind === 'main' || s.kind === 'function') {
      if (s.line <= lineNumber) {
        if (!active || s.line > active.line) {
          active = s;
        }
      }
    }
  }
  return active;
}

export function formatCode(code, size = 4) {
  let indent = 0;
  return code.split(/\r?\n/).map(line => {
    const text = line.trim(); if (!text) return '';
    const closes = /^(Fin(?:Algoritmo|Proceso|SubProceso|Funcion|SubAlgoritmo|Si|Para|Mientras|Segun)|Hasta\s+Que|SiNo\b)/i.test(text);
    if (closes) indent = Math.max(0, indent - 1);
    const result = ' '.repeat(indent * size) + text;
    if (/^(Algoritmo|Proceso|SubProceso|Funcion|SubAlgoritmo|Si\b|SiNo\b|Para\b|Mientras\b|Repetir\b|Segun\b)/i.test(text)) indent++;
    return result;
  }).join('\n');
}

export function setupLanguage(monaco, getExtensions, getTabSize) {
  monaco.languages.register({ id: 'pseint', extensions: ['.psc'], aliases: ['PSeInt', 'pseudocódigo'] });
  monaco.languages.setLanguageConfiguration('pseint', {
    comments: { lineComment: '//' },
    brackets: [['(', ')'], ['[', ']']],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    indentationRules: {
      increaseIndentPattern: /^\s*(Algoritmo|Proceso|SubProceso|Funcion|SubAlgoritmo|Si\b|SiNo\b|Para\b|Mientras\b|Repetir\b|Segun\b)/i,
      decreaseIndentPattern: /^\s*(Fin\w+|SiNo\b|Hasta\s+Que)/i
    },
    folding: {
      markers: { start: /^\s*\/\/\s*region\b/, end: /^\s*\/\/\s*endregion\b/ }
    }
  });

  monaco.languages.setMonarchTokensProvider('pseint', {
    ignoreCase: true,
    keywords: keywords.flatMap(s => s.toLowerCase().split(' ')),
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [/\b(entero|real|logico|caracter|cadena)\b/i, 'type'],
        [/[a-zA-Z_áéíóúñÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/<-|<=|>=|<>|:=|[+\-*/^%=<>]/, 'operator'],
        [/[()[\]]/, '@brackets']
      ]
    }
  });

  monaco.languages.registerCompletionItemProvider('pseint', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = keywords.map(label => ({
        label,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: label,
        range
      }));

      // Built-in standard snippets for PSeInt
      for (const snip of standardSnippets) {
        suggestions.push({
          label: snip.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: snip.detail,
          insertText: snip.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: '00_' + snip.label
        });
      }

      for (const [key, [label, detail]] of Object.entries(docs)) {
        if (!keywords.some(k => k.toLowerCase() === key)) {
          suggestions.push({
            label: label.split('(')[0],
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: label.split('(')[0],
            detail,
            range
          });
        }
      }

      for (const s of symbols(model.getValue()).filter(s => s.kind !== 'main')) {
        suggestions.push({
          label: s.name,
          kind: s.kind === 'function' ? monaco.languages.CompletionItemKind.Function : monaco.languages.CompletionItemKind.Variable,
          detail: s.type,
          insertText: s.name,
          range,
          sortText: '01_' + s.name
        });
      }

      for (const ext of getExtensions().filter(e => e.enabled)) {
        for (const s of ext.snippets || []) {
          suggestions.push({
            label: s.prefix,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: s.description || ext.name,
            insertText: s.body,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: '02_' + s.prefix
          });
        }
      }

      return { suggestions };
    }
  });

  monaco.languages.registerHoverProvider('pseint', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)?.word;
      if (!word) return;
      const doc = docs[word.toLowerCase()];
      if (doc) return { contents: [{ value: '**' + doc[0] + '**' }, { value: doc[1] }] };
      const s = symbols(model.getValue()).find(s => s.name.toLowerCase() === word.toLowerCase());
      if (s) return { contents: [{ value: `**${s.name}** · ${s.type}` }, { value: `Declarado en la línea ${s.line}.` }] };
    }
  });

  monaco.languages.registerDefinitionProvider('pseint', {
    provideDefinition(model, position) {
      const word = model.getWordAtPosition(position)?.word;
      const s = symbols(model.getValue()).find(s => s.name.toLowerCase() === word?.toLowerCase());
      if (s) return { uri: model.uri, range: { startLineNumber: s.line, endLineNumber: s.line, startColumn: 1, endColumn: model.getLineMaxColumn(s.line) } };
    }
  });

  monaco.languages.registerDocumentSymbolProvider('pseint', {
    provideDocumentSymbols(model) {
      return symbols(model.getValue()).map(s => ({
        name: s.name,
        detail: s.type,
        kind: s.kind === 'variable' ? monaco.languages.SymbolKind.Variable : monaco.languages.SymbolKind.Function,
        tags: [],
        range: { startLineNumber: s.line, endLineNumber: s.line, startColumn: 1, endColumn: model.getLineMaxColumn(s.line) },
        selectionRange: { startLineNumber: s.line, endLineNumber: s.line, startColumn: 1, endColumn: model.getLineMaxColumn(s.line) }
      }));
    }
  });

  monaco.languages.registerDocumentFormattingEditProvider('pseint', {
    provideDocumentFormattingEdits(model) {
      return [{ range: model.getFullModelRange(), text: formatCode(model.getValue(), getTabSize()) }];
    }
  });
}
