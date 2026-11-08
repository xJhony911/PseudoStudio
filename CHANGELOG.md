# Cambios

## 1.0.0 — 2026-11-08 (Versión Oficial de Lanzamiento)

Primera versión oficial de producción de PseudoStudio para Windows x64. Concluye la fase preview/beta consolidando un entorno de pseudocódigo moderno, completo, ergonómico y fiel al motor original de PSeInt.

- **Fin de la fase Preview/Beta**: Eliminación de etiquetas provisionales, estabilidad comprobada con 44/44 pruebas unitarias e interfaz lista para estudiantes y docentes.
- **Barra de herramientas compacta y ergonómica**: Barra unificada de 40px sin recortes visuales ni botones redundantes, con acceso directo a nuevo, abrir, carpeta, guardar, diagrama, exportar, comandos, aula en vivo, vista, formatear, depurar y ejecutar F5.
- **Módulos de comandos arrastrables de PSeInt**: Panel lateral con los 9 comandos oficiales (Escribir, Leer, Asignar, Si-Entonces, Según, Mientras, Repetir, Para y Función) con vista previa gráfica de alta resolución, inserción por clic o arrastre (drag & drop) al editor y al flujograma.
- **Flujograma interactivo bidireccional**: Visualización en diagrama clásico o Nassi-Shneiderman, programación directa desde el diagrama mediante barra de comandos rápida, drag & drop de nodos con proximidad esmeralda, y navegación instantánea al código fuente con un clic.
- **Aula en Vivo (Live Share para clases)**: Transmisión en tiempo real a más de 50 estudiantes simultáneos mediante PeerJS seguro, código numérico de 6 dígitos o código QR, terminal sincronizada sin secuencias ANSI corruptas, cursor del profesor en vivo y opción de descarga local en la carpeta Documentos.
- **Tres experiencias visuales (Skins)**:
  - *Moderna Studio*: Inspirada en Visual Studio Code, oscura, fluida y con máxima área de edición.
  - *Clásica PSeInt Original*: Recreación fiel de la interfaz tradicional de PSeInt con paleta gris, biseles y botones 3D.
  - *Clásica Studio*: La estética original de versiones previas de PseudoStudio.
- **Sistema Multiventana Independiente (MDI)**: Posibilidad de desacoplar la terminal o el diagrama de flujo a ventanas flotantes arrastrables, redimensionables en 8 direcciones y minimizables a una barra de tareas integrada.
- **Atajos de teclado profesionales estilo VS Code**: Mover líneas o bloques (`Alt + ↑/↓`), duplicar líneas (`Shift + Alt + ↑/↓`), eliminar línea (`Ctrl + Shift + K`), multicursor (`Ctrl + D` y `Ctrl + Alt + ↑/↓`), ajuste de línea (`Alt + Z`), formateo (`Shift + Alt + F`), paleta de comandos (`Ctrl + Shift + P`) y zoom (`Ctrl + +/-`).
- **Catálogo de Extensiones**: Módulo de extensiones bajo demanda para temas, snippets y la integración oficial de **Discord Rich Presence**.
- **Inicio limpio y sin fricción**: Apertura directa en un algoritmo en blanco (`sin_titulo.psc`) junto a una guía de inicio interactiva (`Guia_PseudoStudio.psc`), sin modales intrusivos en el primer arranque.

## 0.4.0 — 2026-11-08

- Barra superior unificada y compacta (42px): eliminación de la doble barra redundante, buscador de comandos condensado en icono de lupa y barra de herramientas agrupada junto al logo para maximizar el área vertical de programación.
- Aula en Vivo para 50+ estudiantes: saneamiento total de secuencias ANSI (`\x1b[zl`/`\x1b[zk]`), sincronización de entradas interactivas `Leer`, throttling de cursor a 20 fps y recolección automática de conexiones inactivas para garantizar fluidez sin tirones.
- Aislamiento de código de clase: los algoritmos remotos del profesor no persisten en borradores locales del estudiante; opción de guardar copia directa en `Documentos` o cerrar limpiamente.
- Explorador limpio estilo VS Code: retirada de la lista duplicada de "Archivos Abiertos" del sidebar para centrar la vista en el proyecto y pestañas activas.
- Pestañas iniciales limpias: apertura predeterminada con algoritmo vacío `sin_titulo.psc` y guía interactiva `Guia_PseudoStudio.psc` sin algoritmos aleatorios residuales.
- Flujograma fluido y flexible estilo PSeInt: drag & drop de comandos sobre el diagrama con detección inteligente de proximidad vertical y resaltado esmeralda.
- Módulos de comandos arrastrables de PSeInt: panel lateral con los 9 comandos oficiales (Escribir, Leer, Asignar, Si-Entonces, Según, Mientras, Repetir, Para, Función) con diagramas representativos en alta resolución mediante data URIs base64, inserción rápida por clic, drag & drop al editor y variantes con Shift.
- Programación interactiva desde el diagrama de flujo: barra superior de inserción rápida para construir código directamente desde el flujograma, hover distintivo y navegación con clic desde bloques al código.
- Aula en Vivo (Live Share): modo espectador colaborativo para clases de programación con sincronización de código, cursor y ejecución; código numérico único de 6 dígitos, código QR escaneable y lista de estudiantes conectados.
- Catálogo de extensiones bajo demanda: extensiones declarativas disponibles para explorar e instalar desde la app sin sobrecargar la instalación inicial; primera extensión oficial para Discord Rich Presence.
- Atajos profesionales de teclado estilo Visual Studio Code: mover líneas o bloques con Alt + ↑/↓, duplicar con Shift + Alt + ↑/↓, eliminar con Ctrl + Shift + K, multicursor con Ctrl + D / Ctrl + Alt + ↑/↓, ajuste de línea con Alt + Z y zoom de fuente con Ctrl + +/-.
- Tres interfaces / skins intercambiables al instante: Moderna Studio ergonómica, Clásica PSeInt fiel al diseño original wxWidgets con colores y biseles 3D, y Clásica Studio para regresar a la apariencia anterior.
- Sistema de Ventanas Flotantes Multiventana (MDI): terminal y flujograma desacoplables, arrastre para sacar a ventana independiente (tear-off), redimensión en 8 direcciones, minimizar a barra de tareas integrada y apertura automática en modo clásico PSeInt.
- Suite de pruebas ampliada a 44 tests automatizados cubriendo comandos, extensiones, aula en vivo para 50+ alumnos, terminal limpia, atajos y gestor de ventanas.

## 0.3.0 — 2026-10-24

- Diagramas clásicos y Nassi–Shneiderman basados en la salida canónica de PSeInt.
- Algoritmos y subprocesos, navegación a líneas, zoom, desplazamiento, exportación SVG/PNG y seguimiento de depuración.
- Conversión a 12 lenguajes con el exportador original de PSeInt, vista previa y guardado.
- Logo P con símbolos de ejecución y flujo, en SVG, PNG e ICO.
- Pruebas del analizador de diagramas, exportador, vistas, imágenes y programa externo de estudiantes.

## 0.2.1 — 2026-10-24

- Distribución Windows en carpeta permanente: elimina la extracción temporal de cada arranque y mantiene el motor junto al ejecutable.
- Instancia única y comprobación explícita de los recursos del motor.
- Explorador con cargas versionadas: una respuesta antigua no reemplaza la selección más reciente; los archivos abiertos conservan sus cambios y no se duplican.
- Secciones independientes con desplazamiento y cabeceras contraíbles; se guardan las carpetas expandidas y las secciones cerradas.
- Corrección acotada en la compilación del resaltador de Monaco 0.52.2 para gestionar cancelaciones al cambiar de modelo sin ocultar errores reales.
- Menú Vista, bordes ajustables, paneles ocultables, explorador a izquierda/derecha, terminal abajo/derecha, ampliación de editor/terminal y recuperación de distribución.
- Pruebas de concurrencia, distribución, aperturas repetidas y recursos permanentes.

## 0.2.0 — 2026-10-23

- Abrir carpetas de proyecto (Ctrl Shift O), navegar archivos y subcarpetas, crear archivos/carpetas sin sobrescribir existentes y guardar en el proyecto.
- Recuperar la última carpeta al iniciar; actualizar el árbol y cerrar el proyecto manteniendo las pestañas abiertas.
- Entrada de consola siempre visible al solicitar datos; abrir la terminal también al pedir entrada durante depuración.
- Corregir Esperar Tecla: enviar una tecla sin dejar un salto de línea pendiente para el siguiente Leer.
- Evitar que la respuesta de una entrada borre o cambie el estado de la siguiente solicitud rápida.
- Orientación sobre el perfil Flexible cuando un ejercicio no cumple las reglas de Estricto.
- Pruebas de proyectos, rutas, nombres, archivos binarios y consola, además de validación interactiva con un ejercicio externo.

## 0.1.0 — 2026-10-23

Primera versión preview de Windows: motor PSeInt nativo, archivos y recuperación de borradores, editor Monaco, cinco temas, Comic Mono y fuentes importadas, extensiones declarativas, diagnósticos, terminal interactiva, depuración e IA opcional configurable.

Pendiente: diagramas, exportación de algoritmos, breakpoints y análisis semántico completo del editor.
