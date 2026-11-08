import { SnippetController2 } from 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2';
import { COMMAND_ICONS } from './command-icons.js';

export { COMMAND_ICONS };

export const COMMANDS_DATA = [
  {
    id: 'escribir',
    name: 'Escribir',
    icon: COMMAND_ICONS['escribir'] || './commands/escribir.png',
    badge: 'Salida',
    desc: 'Muestra información o texto en la pantalla o terminal.',
    template: 'Escribir ${1:/*expresiones*/};',
    altTemplate: 'Escribir ${1:/*expresiones*/} Sin Saltar;',
    plain: 'Escribir "Hola Mundo";',
    altPlain: 'Escribir "Texto" Sin Saltar;',
    help: 'Imprime expresiones o textos en la terminal. Con «Sin Saltar» no añade un salto de línea al final.'
  },
  {
    id: 'leer',
    name: 'Leer',
    icon: COMMAND_ICONS['leer'] || './commands/leer.png',
    badge: 'Entrada',
    desc: 'Recibe datos desde el usuario y los guarda en variables.',
    template: 'Leer ${1:variable};',
    altTemplate: 'Leer ${1:variable1}, ${2:variable2};',
    plain: 'Leer variable;',
    altPlain: 'Leer variable1, variable2;',
    help: 'Pausa la ejecución y espera que el usuario ingrese un dato para almacenarlo en una variable.'
  },
  {
    id: 'asignar',
    name: 'Asignar',
    icon: COMMAND_ICONS['asignar'] || './commands/asignar.png',
    badge: 'Cálculo',
    desc: 'Guarda el resultado de una expresión en una variable.',
    template: '${1:variable} <- ${2:expresion};',
    altTemplate: '${1:variable} := ${2:expresion};',
    plain: 'variable <- expresion;',
    altPlain: 'variable := expresion;',
    help: 'Calcula el valor de la expresión a la derecha y lo almacena en la variable indicada.'
  },
  {
    id: 'si',
    name: 'Si-Entonces',
    icon: COMMAND_ICONS['si'] || './commands/si.png',
    badge: 'Condición',
    desc: 'Bifurcación lógica condicional (Si / SiNo).',
    template: 'Si ${1:expresion_logica} Entonces\n\t${2:// acciones por verdadero}\nSiNo\n\t${3:// acciones por falso}\nFinSi',
    altTemplate: 'Si ${1:expresion_logica} Entonces\n\t${2:// acciones por verdadero}\nFinSi',
    plain: 'Si condicion Entonces\n\t// acciones por verdadero\nSiNo\n\t// acciones por falso\nFinSi',
    altPlain: 'Si condicion Entonces\n\t// acciones por verdadero\nFinSi',
    help: 'Evalúa una condición lógica. Si se cumple ejecuta las acciones de verdadero; de lo contrario, las de SiNo.'
  },
  {
    id: 'segun',
    name: 'Según',
    icon: COMMAND_ICONS['segun'] || './commands/segun.png',
    badge: 'Selección',
    desc: 'Estructura condicional múltiple (switch / case).',
    template: 'Segun ${1:variable_numerica} Hacer\n\t${2:1}:\n\t\t${3:// opcion 1}\n\t${4:2}:\n\t\t${5:// opcion 2}\n\t${6:3}:\n\t\t${7:// opcion 3}\n\tDe Otro Modo:\n\t\t${8:// secuencia por defecto}\nFinSegun',
    altTemplate: 'Segun ${1:variable_numerica} Hacer\n\t${2:1}:\n\t\t${3:// opcion 1}\n\tDe Otro Modo:\n\t\t${4:// secuencia por defecto}\nFinSegun',
    plain: 'Segun variable Hacer\n\t1:\n\t\t// opcion 1\n\tDe Otro Modo:\n\t\t// defecto\nFinSegun',
    altPlain: 'Segun variable Hacer\n\t1:\n\t\t// opcion 1\nFinSegun',
    help: 'Evalúa el contenido de una variable y ejecuta las instrucciones asociadas al valor coincidente.'
  },
  {
    id: 'mientras',
    name: 'Mientras',
    icon: COMMAND_ICONS['mientras'] || './commands/mientras.png',
    badge: 'Bucle',
    desc: 'Repite un bloque mientras la condición sea verdadera.',
    template: 'Mientras ${1:expresion_logica} Hacer\n\t${2:// secuencia de acciones}\nFinMientras',
    altTemplate: 'Mientras ${1:condicion} Hacer\n\t${2:// secuencia de acciones}\nFinMientras',
    plain: 'Mientras condicion Hacer\n\t// secuencia de acciones\nFinMientras',
    altPlain: 'Mientras condicion Hacer\n\t// acciones\nFinMientras',
    help: 'Bucle pre-test: evalúa la condición al inicio de cada iteración y se repite mientras sea verdadera.'
  },
  {
    id: 'repetir',
    name: 'Repetir',
    icon: COMMAND_ICONS['repetir'] || './commands/repetir.png',
    badge: 'Bucle',
    desc: 'Repite al menos una vez hasta que la condición sea cierta.',
    template: 'Repetir\n\t${1:// secuencia de acciones}\nHasta Que ${2:expresion_logica}',
    altTemplate: 'Repetir\n\t${1:// secuencia de acciones}\nMientras Que ${2:expresion_logica}',
    plain: 'Repetir\n\t// secuencia de acciones\nHasta Que condicion',
    altPlain: 'Repetir\n\t// secuencia de acciones\nMientras Que condicion',
    help: 'Bucle post-test: ejecuta las acciones al menos una vez y se detiene cuando la condición se vuelve verdadera.'
  },
  {
    id: 'para',
    name: 'Para',
    icon: COMMAND_ICONS['para'] || './commands/para.png',
    badge: 'Bucle',
    desc: 'Bucle con variable contadora (for).',
    template: 'Para ${1:variable_numerica} <- ${2:valor_inicial} Hasta ${3:valor_final} Con Paso ${4:paso} Hacer\n\t${5:// secuencia de acciones}\nFinPara',
    altTemplate: 'Para Cada ${1:elemento} De ${2:arreglo} Hacer\n\t${3:// secuencia de acciones}\nFinPara',
    plain: 'Para i <- 1 Hasta 10 Con Paso 1 Hacer\n\t// secuencia de acciones\nFinPara',
    altPlain: 'Para Cada elemento De arreglo Hacer\n\t// secuencia de acciones\nFinPara',
    help: 'Itera incrementando automáticamente una variable de control contadora entre un valor inicial y uno final.'
  },
  {
    id: 'funcion',
    name: 'Función',
    icon: COMMAND_ICONS['funcion'] || './commands/funcion.png',
    badge: 'Módulo',
    desc: 'Subproceso o función modular con parámetros.',
    template: 'Funcion ${1:variable_retorno} <- ${2:NombreFuncion} ( ${3:argumentos} )\n\t${4:// secuencia de acciones}\nFinFuncion\n',
    altTemplate: 'SubProceso ${1:NombreSubProceso} ( ${2:argumentos} )\n\t${3:// secuencia de acciones}\nFinSubProceso\n',
    plain: 'Funcion retorno <- NombreFuncion ( args )\n\t// acciones\nFinFuncion\n',
    altPlain: 'SubProceso NombreSubProceso ( args )\n\t// acciones\nFinSubProceso\n',
    help: 'Declara una función o subalgoritmo independiente. Puede retornar un valor o ejecutarse como procedimiento.'
  }
];

export function prepareInsertion(editor, position, snippetText) {
  const model = editor.getModel();
  if (!model) return { position, snippetText };

  const lineCount = model.getLineCount();
  const safeLine = Math.min(Math.max(1, position.lineNumber), lineCount);
  const lineContent = model.getLineContent(safeLine);
  const trimmed = lineContent.trim();

  // If the line has existing text, decide whether to insert on next line or at cursor
  if (trimmed.length > 0) {
    const isAtEnd = position.column >= lineContent.length;
    const isAtStart = position.column <= (lineContent.match(/^\s*/)[0].length + 1);

    if (isAtEnd) {
      return {
        position: { lineNumber: safeLine, column: lineContent.length + 1 },
        snippetText: '\n' + snippetText
      };
    } else if (isAtStart) {
      return {
        position: { lineNumber: safeLine, column: 1 },
        snippetText: snippetText + '\n'
      };
    }
  }

  return { position: { lineNumber: safeLine, column: position.column }, snippetText };
}

export function insertCommandSnippet(editor, snippetText, targetPosition = null) {
  if (!editor) return;
  editor.focus();

  let pos = targetPosition || editor.getPosition() || { lineNumber: 1, column: 1 };
  const prep = prepareInsertion(editor, pos, snippetText);
  if (prep.position) {
    editor.setPosition(prep.position);
  }

  try {
    const snippetCtrl = SnippetController2.get(editor);
    if (snippetCtrl && typeof snippetCtrl.insert === 'function') {
      snippetCtrl.insert(prep.snippetText);
      return;
    }
  } catch (err) {
    console.warn('SnippetController2 not available, falling back to executeEdits:', err);
  }

  // Fallback: strip ${1:placeholder} and insert plain text
  const plain = prep.snippetText.replace(/\$\{\d+(?::([^}]*))?\}/g, '$1').replace(/\$\d+/g, '');
  const sel = editor.getSelection();
  editor.executeEdits('pseint-commands', [{
    range: sel,
    text: plain,
    forceMoveMarkers: true
  }]);
}

export function createCommandsManager({ editor, getProfile, onInserted, toast }) {
  let altMode = false;
  let filterText = '';

  const container = document.getElementById('commands-list');
  const panel = document.getElementById('commands-panel');
  const searchInput = document.getElementById('commands-search');
  const altToggle = document.getElementById('commands-alt-toggle');
  const editorEl = document.getElementById('editor');

  function render() {
    if (!container) return;

    const term = filterText.toLowerCase().trim();
    const filtered = COMMANDS_DATA.filter(cmd =>
      cmd.name.toLowerCase().includes(term) ||
      cmd.desc.toLowerCase().includes(term) ||
      cmd.badge.toLowerCase().includes(term)
    );

    if (!filtered.length) {
      container.innerHTML = '<div class="commands-empty"><p>No se encontraron comandos coincidentes.</p></div>';
      return;
    }

    container.innerHTML = filtered.map(cmd => {
      const template = altMode ? cmd.altTemplate : cmd.template;
      const plain = altMode ? cmd.altPlain : cmd.plain;
      const badgeText = altMode ? `${cmd.badge} (Alt)` : cmd.badge;

      return `
        <div class="command-card"
             draggable="true"
             tabindex="0"
             role="button"
             data-command-id="${cmd.id}"
             title="${cmd.help} (Haz clic o arrastra al editor)">
          <div class="command-card-drag-hint">⋮⋮</div>
          <div class="command-icon-box">
            <img src="${cmd.icon}" alt="${cmd.name}" class="command-diagram-img" draggable="false" onerror="this.onerror=null; this.src='./commands/' + '${cmd.id}' + '.png'" />
          </div>
          <div class="command-card-details">
            <div class="command-card-title-row">
              <span class="command-card-name">${cmd.name}</span>
              <span class="command-card-badge">${badgeText}</span>
            </div>
            <span class="command-card-desc">${cmd.desc}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach drag & click events to newly rendered cards
    container.querySelectorAll('.command-card').forEach(card => {
      const id = card.dataset.commandId;
      const cmd = COMMANDS_DATA.find(c => c.id === id);
      if (!cmd) return;

      // Click to insert
      card.addEventListener('click', (e) => {
        const isAlt = altMode || e.shiftKey;
        const textToInsert = isAlt ? cmd.altTemplate : cmd.template;
        insertCommandSnippet(editor, textToInsert);
        if (onInserted) onInserted(cmd, isAlt);
      });

      // Keyboard Enter or Space to insert
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const isAlt = altMode || e.shiftKey;
          insertCommandSnippet(editor, isAlt ? cmd.altTemplate : cmd.template);
          if (onInserted) onInserted(cmd, isAlt);
        }
      });

      // Drag & Drop
      card.addEventListener('dragstart', (e) => {
        const isAlt = altMode || e.shiftKey;
        const template = isAlt ? cmd.altTemplate : cmd.template;
        const plain = isAlt ? cmd.altPlain : cmd.plain;

        e.dataTransfer.setData('text/plain', plain);
        e.dataTransfer.setData('application/x-pseudostudio-command', JSON.stringify({
          id: cmd.id,
          template,
          plain,
          isAlt
        }));
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('is-dragging');
        document.body.classList.add('command-drag-active');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        document.body.classList.remove('command-drag-active');
        if (editorEl) editorEl.classList.remove('editor-drag-target');
      });
    });
  }

  // Set up editor drop handling
  if (editorEl) {
    editorEl.addEventListener('dragenter', (e) => {
      if (e.dataTransfer.types.includes('application/x-pseudostudio-command') || e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
        editorEl.classList.add('editor-drag-target');
      }
    });

    editorEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      // Move editor cursor to hovered position
      const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
      if (target && target.position) {
        editor.setPosition(target.position);
        editor.revealPosition(target.position, 1 /* ScrollType.Immediate */);
      }
    });

    editorEl.addEventListener('dragleave', (e) => {
      if (!editorEl.contains(e.relatedTarget)) {
        editorEl.classList.remove('editor-drag-target');
      }
    });

    editorEl.addEventListener('drop', (e) => {
      e.preventDefault();
      editorEl.classList.remove('editor-drag-target');

      let snippetText = null;
      let cmdId = null;
      const raw = e.dataTransfer.getData('application/x-pseudostudio-command');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          snippetText = parsed.template;
          cmdId = parsed.id;
        } catch {}
      }
      if (!snippetText) {
        snippetText = e.dataTransfer.getData('text/plain');
      }
      if (!snippetText) return;

      const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
      const position = target?.position || editor.getPosition();
      insertCommandSnippet(editor, snippetText, position);

      if (cmdId && onInserted) {
        const cmd = COMMANDS_DATA.find(c => c.id === cmdId);
        if (cmd) onInserted(cmd, false);
      }
    });
  }

  // Filter input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterText = e.target.value;
      render();
    });
  }

  // Alt mode toggle
  if (altToggle) {
    altToggle.addEventListener('click', () => {
      altMode = !altMode;
      altToggle.classList.toggle('active', altMode);
      altToggle.setAttribute('aria-pressed', String(altMode));
      altToggle.title = altMode
        ? 'Modo alternativo activo (clic para volver al modo normal)'
        : 'Activar variantes alternativas (ej. Sin Saltar, Para Cada, etc.)';
      render();
    });
  }

  // Shift key detection for dynamic preview
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && !altMode) {
      panel?.classList.add('shift-pressed');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      panel?.classList.remove('shift-pressed');
    }
  });

  render();

  return {
    render,
    setAltMode(active) {
      altMode = active;
      if (altToggle) {
        altToggle.classList.toggle('active', altMode);
        altToggle.setAttribute('aria-pressed', String(altMode));
      }
      render();
    },
    insertCommand(id, isAlt = false) {
      const cmd = COMMANDS_DATA.find(c => c.id === id);
      if (cmd) {
        insertCommandSnippet(editor, isAlt ? cmd.altTemplate : cmd.template);
      }
    }
  };
}
