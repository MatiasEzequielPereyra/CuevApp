# CUEVA-006C — laboratorio sintético

Desde este directorio, con el entorno portátil ya activado: `node lab.mjs`.
No reinstala Node, npm ni Chromium. Docker ejecuta únicamente contenedores
propios con nombres aleatorios y puertos loopback; usa imágenes fijadas por digest
en `lab.mjs`. Si faltan imágenes, Docker descarga esas imágenes de laboratorio.
No conecta con Supabase alojado, SMTP real ni cuentas existentes.

El laboratorio utiliza PostgreSQL, GoTrue, PostgREST, Mailpit y Storage API reales.
El gateway local retira el prefijo `/storage/v1` y habilita CORS exclusivamente
para el origen descartable del navegador, como el
API gateway alojado; no simula escrituras, permisos, firmas ni archivos. Con
`DB_INSTALL_ROLES=false` se instalan los grants base del esquema Storage que el
servicio alojado ya tiene; las policies de producto son las migraciones reales.

Crea dos admins, un alumno vinculado, uno ajeno y uno sin gate; claves y sesiones
efímeras. Las migraciones antiguas permiten generar fixtures v1 antes de aplicar
las nuevas y comparar conservación. Comprueba navegador, API/RPC y Storage directo.
Genera un WebM real en Chromium y compara bytes descargados. No usa videos reales.

Los resultados quedan en `results.json`; se conservan seleccionados en `evidence.json`
tras una corrida completa. Las capturas están en `evidence/CUEVA-006C/` desde la raíz.
Se limpian solo los contenedores/red creados por esta corrida, incluidos ante fallo.
No prueba Safari, iOS físico, cuotas alojadas ni todos los codecs de MOV.

Modelo puro (desde raíz):
`node --experimental-strip-types --test experiments/cueva-006c-local/model.test.mjs`.
Se usa el Node 22.14.0 existente, sin compilador o dependencia adicional.
