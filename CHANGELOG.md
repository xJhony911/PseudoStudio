# Cambios

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
