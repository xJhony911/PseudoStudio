# Extensiones declarativas

PseudoStudio 0.1 admite archivos JSON de hasta 250 KB con temas y snippets. No admite VSIX ni scripts ejecutables. Instálalos en la vista Extensiones → Instalar archivo JSON. Cada extensión puede activarse/desactivarse sin reiniciar.

```json
{
  "id": "miusuario.miextension",
  "name": "Mis plantillas",
  "version": "1.0.0",
  "author": "Tu nombre",
  "description": "Plantillas para mis clases",
  "themes": [],
  "snippets": [
    {
      "prefix": "saludar",
      "body": "Escribir \"Hola, ${1:nombre}\"\n${0}",
      "description": "Saludo editable"
    }
  ]
}
```

Escribe el prefijo y selecciona el snippet en el autocompletado. Tab avanza entre los marcadores `${1:valor}`, `${2:valor}` y `${0}`. Los snippets se insertan por Monaco.

Los temas usan el esquema de colores de Monaco: `id`, `name`, `base` (`vs` o `vs-dark`), `colors` con colores hexadecimales y `rules` con tokens como `keyword`, `string`, `comment`, `number` y `operator`. Revisa `examples/extensions/ocean.json` para un ejemplo instalable.

Límites: 200 snippets, 20 temas, 100 reglas por tema. Los IDs se restringen a letras minúsculas, números, puntos y guiones. Instalar de nuevo el mismo ID reemplaza su versión local. Los colores del editor son configurables; el resto de la interfaz toma una base clara u oscura.
