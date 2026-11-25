# OS1 de secundaria · Encargos y expediente

## Cambios pedagógicos

Las dos estaciones conservan 10 niveles de tres encargos y un hacker de seis: 72 encargos en total. Los nombres de archivos usan minúsculas, guiones y extensión, sin espacios ni acentos. El nombre que deben escribir aparece solo en negrita, sin comillas, paréntesis ni adornos. El campo queda vacío desde el primer encargo: el alumno escribe el nombre y la extensión completos. Las primeras entregas usan rutas con varias carpetas; a partir del cuarto nivel deben crear las subcarpetas que falten. Conservación de versiones, movimientos y respaldos siguen exigiendo operaciones correctas.

## Guardado automático

Al entrar, cada alumno utiliza nombre, grupo y clave personal de seis números; el código de clase del profesor solo se pide la primera vez. El nombre identifica el expediente y la clave evita que otro alumno lo consulte escribiendo el mismo nombre. La clave no se conserva en el navegador.

No hay botón para enviar reportes. Las operaciones se guardan automáticamente, sin pausar el juego. La barra distingue guardando, guardado confirmado y pendiente de conexión. Si falla internet, conserva el reporte y reintenta; los reenvíos no duplican evidencias. Un envío pendiente solo puede recuperarse desde la misma computadora hasta que se sincronice. Antes de cambiar de equipo deben esperar la confirmación.

Las estaciones central y espacial comparten expediente, pero conservan puntos de continuación separados. Si otro equipo envió una versión más reciente, se ofrece recuperar ese avance y se conserva localmente el reporte en conflicto. Cerrar sesión es recomendable en equipos compartidos.

El registro anónimo anterior se conserva como bitácora local; no se atribuye automáticamente a un alumno. Los encargos reconfigurados usan una versión nueva para no validar misiones con los nombres anteriores. El guardado en la nube requiere activar el servicio y completar una prueba real; no confundir el modo invitado con una base de datos remota.

## Servicio propio

Proyecto independiente de Apps Script en DonProfesor4. Código completo en backend/Code.gs. Ejecutar S1_prepararRegistro una vez y publicar como aplicación web con ejecución como propietario. La hoja debe permanecer privada. Configurar únicamente la URL pública /exec en registro-config.js; no publicar códigos de clase, claves, expedientes ni credenciales. No modificar el servicio de OS5.

La hoja contiene Inicio con el código de clase, Sesiones, Evidencias, Resumen y Trimestres. Las fechas y encargos asignados son editables y orientativos; el profesor debe ajustarlos. Central: básicos 1–30, hacker 31–36; espacial: básicos 37–66, hacker 67–72. El promedio propuesto es 10 × encargos básicos asignados acreditados dentro del periodo / encargos asignados, contando cada encargo una sola vez. Hacker es informativo. No sustituye la revisión docente ni incluye automáticamente otros trabajos de la materia. Para actualizar el resumen después de editar asignaciones, ejecutar S1_actualizarResumen.

Pruebas locales: node tests/entregas.cjs, node tests/registro.cjs y node tests/registro-cliente.cjs.
