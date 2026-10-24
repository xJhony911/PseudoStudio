# Procedencia y construcción

- Fecha de preparación: 2026-10-23.
- Fuente oficial PSeInt: `https://git.code.sf.net/p/pseint/code`.
- Commit: `5ee1dc260181191e1cfa83fe02726f6812f6481c`.
- Copia íntegra de los fuentes bajo `vendor/pseint`, excluyendo metadatos `.git`.
- No se modificó el código fuente de PSeInt.
- Se compila su componente `pseint`, sin la interfaz wxWidgets.
- GCC de w64devkit 2.10.1, Windows x64.
- Archivo de toolchain: `w64devkit-x64-2.10.1.7z.exe`.
- SHA-256 del toolchain: `add1edf984ce4d473cfeb7c52e0ab38db73a855bba6c7f564d5e16648eb2896a`.
- Flags y lista de fuentes: `scripts/build-engine.ps1`.
- Perfiles: `bin/perfiles/Flexible` y `bin/perfiles/Estricto` del mismo commit.
- Node.js utilizado: 24.22.1. Las versiones JS exactas están fijadas en `package-lock.json`.

Se estudió el código fuente disponible directamente. No fue necesario descompilar binarios ni instalar REA para construir esta versión.

## Interfaz con el motor

`--nouser` omite mensajes de estado del intérprete; `--norun` comprueba sintaxis; `--profile=...` selecciona el perfil. La ejecución usa `--forpseintterminal` para comunicar solicitudes de lectura mediante secuencias de control.

La depuración se habilita con `--delay=1` y un `--port` efímero abierto exclusivamente en `127.0.0.1`. Se implementan `paso`, `continuar`, `pausar` y `autoevaluar`. El puerto no se publica en la red local. El programa hijo se detiene al cerrar la aplicación.

Los temporales de cada ejecución se eliminan al terminar. No se construyen comandos de shell a partir del pseudocódigo ni del nombre de archivo.


En 0.3.0 se compila además `psexport.exe` desde el mismo árbol original, sin modificarlo, con `-D_FOR_PSEXPORT` y los archivos enumerados por `scripts/build-exporter.ps1`. La interfaz de diagramas es propia y consume `pseint --draw --writepositions`.
