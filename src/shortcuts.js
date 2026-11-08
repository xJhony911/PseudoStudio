// Visual Studio Code editing shortcuts and line operations for Monaco Editor

/**
 * Operaciones puras sobre arrays de líneas para pruebas y fallback
 */
export function moveLinesArray(lines, startLine, endLine, direction) {
  const result = [...lines];
  if (direction < 0) {
    if (startLine <= 1) return { lines: result, startLine, endLine };
    // Move up: swap with line at (startLine - 2)
    const movingChunk = result.slice(startLine - 1, endLine);
    result.splice(startLine - 1, movingChunk.length);
    result.splice(startLine - 2, 0, ...movingChunk);
    return { lines: result, startLine: startLine - 1, endLine: endLine - 1 };
  } else {
    if (endLine >= result.length) return { lines: result, startLine, endLine };
    // Move down: swap with line at endLine
    const movingChunk = result.slice(startLine - 1, endLine);
    result.splice(startLine - 1, movingChunk.length);
    result.splice(startLine, 0, ...movingChunk);
    return { lines: result, startLine: startLine + 1, endLine: endLine + 1 };
  }
}

export function copyLinesArray(lines, startLine, endLine, direction) {
  const result = [...lines];
  const chunk = result.slice(startLine - 1, endLine);
  if (direction < 0) {
    // Copy up: insert copy above startLine
    result.splice(startLine - 1, 0, ...chunk);
    return { lines: result, startLine: startLine + chunk.length, endLine: endLine + chunk.length };
  } else {
    // Copy down: insert copy below endLine
    result.splice(endLine, 0, ...chunk);
    return { lines: result, startLine: startLine + chunk.length, endLine: endLine + chunk.length };
  }
}

export function deleteLinesArray(lines, startLine, endLine) {
  const result = [...lines];
  result.splice(startLine - 1, endLine - startLine + 1);
  if (result.length === 0) result.push('');
  const newCursorLine = Math.min(startLine, result.length);
  return { lines: result, newCursorLine };
}

/**
 * Operaciones directas sobre el editor Monaco
 */
export function moveLineUp(editor, monaco) {
  const action = editor.getAction('editor.action.moveLinesUpAction');
  if (action) {
    try {
      action.run();
      return true;
    } catch {}
  }
  return fallbackMoveLines(editor, monaco, -1);
}

export function moveLineDown(editor, monaco) {
  const action = editor.getAction('editor.action.moveLinesDownAction');
  if (action) {
    try {
      action.run();
      return true;
    } catch {}
  }
  return fallbackMoveLines(editor, monaco, 1);
}

export function copyLineUp(editor, monaco) {
  const action = editor.getAction('editor.action.copyLinesUpAction');
  if (action) {
    try {
      action.run();
      return true;
    } catch {}
  }
  return fallbackCopyLines(editor, monaco, -1);
}

export function copyLineDown(editor, monaco) {
  const action = editor.getAction('editor.action.copyLinesDownAction');
  if (action) {
    try {
      action.run();
      return true;
    } catch {}
  }
  return fallbackCopyLines(editor, monaco, 1);
}

export function deleteLine(editor, monaco) {
  const action = editor.getAction('editor.action.deleteLines');
  if (action) {
    try {
      action.run();
      return true;
    } catch {}
  }
  return fallbackDeleteLines(editor, monaco);
}

export function fallbackMoveLines(editor, monaco, direction) {
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (!model || !selection) return false;

  const startLine = selection.startLineNumber;
  const endLine = selection.endLineNumber;
  const lineCount = model.getLineCount();

  if (direction < 0 && startLine <= 1) return false;
  if (direction > 0 && endLine >= lineCount) return false;

  if (direction < 0) {
    const prevLineText = model.getLineContent(startLine - 1);
    const selectedText = model.getValueInRange(
      new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine))
    );
    const replaceRange = new monaco.Range(
      startLine - 1,
      1,
      endLine,
      model.getLineMaxColumn(endLine)
    );
    const newText = selectedText + '\n' + prevLineText;

    editor.pushUndoStop();
    editor.executeEdits('moveLinesUp', [
      {
        range: replaceRange,
        text: newText,
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();

    const diff = -1;
    editor.setSelection(
      new monaco.Selection(
        selection.selectionStartLineNumber + diff,
        selection.selectionStartColumn,
        selection.positionLineNumber + diff,
        selection.positionColumn
      )
    );
    return true;
  } else {
    const nextLineText = model.getLineContent(endLine + 1);
    const selectedText = model.getValueInRange(
      new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine))
    );
    const replaceRange = new monaco.Range(
      startLine,
      1,
      endLine + 1,
      model.getLineMaxColumn(endLine + 1)
    );
    const newText = nextLineText + '\n' + selectedText;

    editor.pushUndoStop();
    editor.executeEdits('moveLinesDown', [
      {
        range: replaceRange,
        text: newText,
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();

    const diff = 1;
    editor.setSelection(
      new monaco.Selection(
        selection.selectionStartLineNumber + diff,
        selection.selectionStartColumn,
        selection.positionLineNumber + diff,
        selection.positionColumn
      )
    );
    return true;
  }
}

export function fallbackCopyLines(editor, monaco, direction) {
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (!model || !selection) return false;

  const startLine = selection.startLineNumber;
  const endLine = selection.endLineNumber;
  const selectedText = model.getValueInRange(
    new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine))
  );

  editor.pushUndoStop();
  if (direction < 0) {
    editor.executeEdits('copyLinesUp', [
      {
        range: new monaco.Range(startLine, 1, startLine, 1),
        text: selectedText + '\n',
        forceMoveMarkers: false
      }
    ]);
    editor.pushUndoStop();
    const count = endLine - startLine + 1;
    editor.setSelection(
      new monaco.Selection(
        selection.selectionStartLineNumber + count,
        selection.selectionStartColumn,
        selection.positionLineNumber + count,
        selection.positionColumn
      )
    );
  } else {
    const maxCol = model.getLineMaxColumn(endLine);
    editor.executeEdits('copyLinesDown', [
      {
        range: new monaco.Range(endLine, maxCol, endLine, maxCol),
        text: '\n' + selectedText,
        forceMoveMarkers: true
      }
    ]);
    editor.pushUndoStop();
    const count = endLine - startLine + 1;
    editor.setSelection(
      new monaco.Selection(
        selection.selectionStartLineNumber + count,
        selection.selectionStartColumn,
        selection.positionLineNumber + count,
        selection.positionColumn
      )
    );
  }
  return true;
}

export function fallbackDeleteLines(editor, monaco) {
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (!model || !selection) return false;

  const startLine = selection.startLineNumber;
  const endLine = selection.endLineNumber;
  const lineCount = model.getLineCount();

  let deleteRange;
  if (endLine < lineCount) {
    deleteRange = new monaco.Range(startLine, 1, endLine + 1, 1);
  } else if (startLine > 1) {
    const prevMaxCol = model.getLineMaxColumn(startLine - 1);
    deleteRange = new monaco.Range(startLine - 1, prevMaxCol, endLine, model.getLineMaxColumn(endLine));
  } else {
    deleteRange = new monaco.Range(1, 1, 1, model.getLineMaxColumn(1));
  }

  editor.pushUndoStop();
  editor.executeEdits('deleteLines', [
    {
      range: deleteRange,
      text: '',
      forceMoveMarkers: true
    }
  ]);
  editor.pushUndoStop();
  return true;
}

/**
 * Registra atajos nativos en Monaco Editor para compatibilidad total con Visual Studio Code
 */
export function registerVSCodeShortcuts(editor, monaco, extraActions = {}) {
  // Alt + Up: Mover línea arriba
  editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
    moveLineUp(editor, monaco);
  });

  // Alt + Down: Mover línea abajo
  editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
    moveLineDown(editor, monaco);
  });

  // Shift + Alt + Up: Duplicar línea arriba
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
    copyLineUp(editor, monaco);
  });

  // Shift + Alt + Down: Duplicar línea abajo
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
    copyLineDown(editor, monaco);
  });

  // Ctrl + Shift + K: Eliminar línea
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
    deleteLine(editor, monaco);
  });

  // Ctrl + Enter: Insertar línea abajo
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    editor.getAction('editor.action.insertLineAfter')?.run();
  });

  // Ctrl + Shift + Enter: Insertar línea arriba
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
    editor.getAction('editor.action.insertLineBefore')?.run();
  });

  // Ctrl + D: Seleccionar siguiente coincidencia (multicursor)
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
    editor.getAction('editor.action.addSelectionToNextFindMatch')?.run();
  });

  // Alt + Z: Alternar ajuste de línea (Word Wrap)
  editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
    if (extraActions.toggleWordWrap) extraActions.toggleWordWrap();
    else editor.getAction('editor.action.toggleWordWrap')?.run();
  });

  // Shift + Alt + F: Formatear documento
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
    editor.getAction('editor.action.formatDocument')?.run();
  });

  // Ctrl + /: Comentar / descomentar línea
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
    editor.getAction('editor.action.commentLine')?.run();
  });

  // Ctrl + Alt + Up: Multicursor arriba
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
    editor.getAction('editor.action.insertCursorAbove')?.run();
  });

  // Ctrl + Alt + Down: Multicursor abajo
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
    editor.getAction('editor.action.insertCursorBelow')?.run();
  });

  // Ctrl + L: Seleccionar toda la línea actual
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
    editor.getAction('expandLineSelection')?.run();
  });
}
