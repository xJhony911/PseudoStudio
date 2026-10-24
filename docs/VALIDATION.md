# Verificación de la entrega 0.3.0

Las pruebas se ejecutaron en Windows x64 con Node.js 24.22.1, Electron 42.11.18 y el motor PSeInt compilado desde el commit documentado en PROVENANCE.md.

## Pruebas automatizadas de motor y extensiones

19 pruebas aprobadas mediante `npm test`:

- Codificación Latin-1 y rechazo de conversiones con pérdida.
- Extracción de diagnósticos de PSeInt.
- Programas válidos y errores de sintaxis.
- Aritmética y salida con caracteres españoles.
- Entrada interactiva mediante Leer.
- Arreglos, bucles y subprocesos.
- Reglas del perfil Estricto.
- Protocolo real de depuración y consulta de variables.
- Detención de un bucle infinito.
- Validez sintáctica de los seis ejemplos incluidos.
- Extensión válida de temas y snippets.
- Rechazo de IDs con rutas y colores inválidos.
- Ausencia de capacidades de scripts en los manifiestos.
- Esperar Tecla seguido de Leer sin salto de línea sobrante.
- Proyectos, subcarpetas, nombres con acentos, duplicados, archivos binarios y rechazo de rutas/enlaces fuera de la raíz.

## Integración de escritorio

12 recorridos aprobados mediante `npm run test:ui`:

1. Inicio y ejecución del ejemplo inicial.
2. Tema Monokai, tamaño de fuente y persistencia.
3. Entrada de teclado con José y salida acentuada.
4. Diagnósticos y marcadores de sintaxis.
5. Guardado y apertura de archivos .psc reales.
6. Autocompletado de snippets y palabras clave.
7. Importación de una fuente sin instalarla en Windows.
8. Instalación y desactivación de un tema desde JSON.
9. Avance de depuración y valores de variables.
10. IA con servidor simulado local de API compatible.
11. Paleta de comandos y cambio de vista.
12. Recuperación de pestañas y borradores tras recargar.

No se registraron errores JavaScript en estos recorridos. Las capturas en `docs/screenshots` fueron revisadas visualmente.

La IA se verificó con un servidor local simulado. No se ha validado una cuenta ni un modelo remoto concreto; su uso requiere la configuración del usuario.

## Proyectos y ejercicio externo

`npm run test:project` verifica apertura de carpeta, lectura del árbol, creación de subcarpeta y archivo, edición, guardado en disco, recuperación del proyecto tras recarga y ejecución del archivo guardado.

Se probó adicionalmente un ejercicio externo de gestión de estudiantes, sin alterar el original: un estudiante, nombres con acentos, notas 8/10/10, asistencia 100 y salida mediante la opción 3 del menú. Completó la ejecución en perfil Flexible. El programa privado no se distribuye. El usuario confirmó también que volvió a ejecutarse normalmente. No se atribuye el fallo inicial a una causa no reproducida.

## Explorador y distribución

`npm run test:explorer`: cambios rápidos entre pestañas y árbol, preservación de cambios sin guardar, ausencia de duplicados, respuestas de archivo/directorio demoradas artificialmente, secciones contraídas tras recarga y guardado directo de un archivo de proyecto recuperado. Sin errores de JavaScript.

`npm run test:layout`: arrastre de separadores de explorador, terminal e IA; Ctrl B/Ctrl J; posiciones derechas; ampliar/restaurar terminal y editor; persistencia al recargar; ejecución que revela una terminal oculta; restablecer distribución. Capturas revisadas visualmente.

## Diagramas y exportación

Cuatro pruebas adicionales verifican el formato canónico del motor, posiciones originales, subprocesos, decisiones, bucles y Según; ambas representaciones SVG; escape de texto; rechazo de sintaxis incompleta; generación de los 12 lenguajes; y todos los ejemplos incluidos.

La prueba de interfaz `test:diagrams` verifica flujograma clásico, Nassi–Shneiderman, zoom, guardado SVG/PNG, salto a la línea del bloque, vista previa/guardado Python y C++, resaltado de depuración y eliminación del diagrama anterior ante un error de sintaxis. El ejercicio externo de estudiantes se representa con su algoritmo principal y dos subprocesos.

Se ejecutó una sumatoria convertida a Python 3 y a C++ (compilada con GCC): ambas produjeron 6. La generación de los otros diez destinos fue comprobada; no se ejecutaron sus compiladores/intérpretes. El exportador original advierte que su salida puede requerir ajustes y esa advertencia aparece en la interfaz.

Los diagramas se editan a través del código: no se implementa edición bidireccional arrastrando bloques. Los textos largos se abrevian visualmente y conservan su contenido en el título del bloque. PNG aplica un límite de resolución; SVG conserva el vector.

## Distribución Windows

La entrega mantiene los recursos del intérprete y exportador junto al ejecutable en una carpeta permanente. Las pruebas del paquete validan tres arranques consecutivos, bloqueo de segunda instancia, ejecución y depuración. El ejecutable no tiene firma Authenticode comercial.

Validación final sobre la carpeta distribuida 0.3.0: tres aperturas de 26410, 887 y 873 ms. La primera apertura fue considerablemente más lenta; no se ha determinado su causa. Pasaron ejecución, depuración y bloqueo de segunda instancia. También pasaron sobre este ejecutable los recorridos de diagramas/exportación, representación del ejercicio externo y su ejecución interactiva completa, además de creación, guardado y recuperación de proyectos. GitHub Actions no se ejecutó: la publicación está pendiente de autenticación.

