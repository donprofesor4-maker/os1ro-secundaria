# Aula OS 1 - Primero de secundaria

Escritorio independiente de los OS de primaria y de segundo/tercero de secundaria.

## Aplicaciones

- **Central de entregas:** diez niveles de tres encargos, más seis entregas de reto hacker.
- **Estación espacial:** otro recorrido con la misma mecánica y contextos de ciencia, navegación e ingeniería.
- **Cuaderno:** crear, guardar y descargar textos propios.
- **Mis documentos:** abrir los textos del cuaderno conservados en este navegador.
- **Ruta de aprendizaje:** pasos para organizar y comprobar una entrega.

## Contenidos de primero de secundaria

PDF, DOCX, PPTX, XLSX, CSV, PNG, audio y video. Carpetas por materia, proyecto y tipo de evidencia. Nombres descriptivos y extensiones, conservación de versiones, corrección de ubicaciones, creación de rutas y respaldo sin borrar el original. Los archivos se simulan; no se evalúa el contenido de un documento real.

Se mantiene la mecánica visual de entregas: Guardar como empieza en Descargas, árbol de carpetas, ruta visible, nombre, Guardar/Mover/Copiar a, Cancelar y Siguiente encargo. No hay temporizador ni acreditación por presionar Continuar. Un destino o nombre incorrecto conserva el encargo pendiente. El botón Reto hacker abre el desafío opcional; no lo acredita.

## Evidencias y guardado

Cada estación ofrece Descargar bitácora (TXT). Registra fecha, nivel, encargo, nombre, destino, errores, intentos de guardado, carpetas y archivos resultantes. La autonomía no se mide y se indica explícitamente. La bitácora no equivale a una evaluación completa de comprensión ni a una certificación escolar.

Los progresos, documentos y evidencias se guardan localmente, con claves propias de primero de secundaria. En equipos compartidos, el navegador comparte el avance. Descargar la bitácora y los documentos para conservarlos fuera del equipo. No hay cuentas de alumnos, sincronización, anuncios, IA conectada ni envíos a servicios externos.

## Comprobación

`node tests/entregas.cjs`

Cubre los 72 encargos, acceso directo al hacker, errores sin avance, nombres, versiones, movimientos, respaldo que conserva el original, desbloqueos, bitácora y recarga. Todos los recursos están incluidos. Para revisión local: `python3 -m http.server 8766`.
