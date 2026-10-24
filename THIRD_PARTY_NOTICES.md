# Avisos de terceros

PseudoStudio 0.3.0 es un proyecto independiente bajo GPL-2.0-only.

## PSeInt

Intérprete original de PSeInt, desarrollado por Pablo Novara y colaboradores.

- Proyecto: https://pseint.sourceforge.net/
- Repositorio: https://sourceforge.net/p/pseint/code/
- Commit de fuentes: `5ee1dc260181191e1cfa83fe02726f6812f6481c`.
- Licencia: GNU General Public License v2 (GPL-2.0-only).
- Fuentes originales sin modificaciones: `vendor/pseint/`.
- Licencia completa: `LICENSE`, `vendor/pseint/dist/license.txt`.

Se compilan el intérprete de consola y el exportador psexport. Los diagramas se dibujan con una implementación propia a partir de la salida canónica del intérprete. El archivo de fuentes conserva también los componentes no compilados y sus avisos. `hoewrap/hoedown` y `dtl` tienen sus propias licencias, preservadas dentro del árbol original. Los recursos de la interfaz original no se utilizan en la interfaz de PseudoStudio.

## Monaco Editor

Copyright Microsoft Corporation. MIT License. https://github.com/microsoft/monaco-editor

Texto completo en `licenses/Monaco-LICENSE.txt`.

## Electron

Copyright Electron contributors. MIT License. https://github.com/electron/electron

Texto completo en `licenses/Electron-LICENSE.txt`. El paquete de Electron también conserva sus avisos Chromium y otros componentes (`LICENSE.electron.txt`, `LICENSES.chromium.html`).

## Lucide / Feather

Copyright Lucide Contributors y Cole Bemis (porciones de Feather). ISC / MIT según el aviso incluido. https://lucide.dev/

Texto completo en `licenses/Lucide-LICENSE.txt`.

## Comic Mono

Copyright según el aviso original de dtinth y contribuyentes. MIT License. https://dtinth.github.io/comic-mono-font/

Texto completo en `licenses/ComicMono-LICENSE.txt` y `public/fonts/ComicMono-LICENSE.txt`.

## Toolchain

El compilador w64devkit no se incluye en el ejecutable ni en el ZIP de fuentes. El motor se enlaza estáticamente con los runtimes de GCC/MinGW, sujetos a sus licencias y excepciones de enlace. Los avisos se conservan en `licenses/w64devkit/`.
