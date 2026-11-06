# CUEVA-006C — entrega del EXECUTOR

Estado: implementación local para **REVIEW**; pendiente de revisión independiente.
Base verificada al inicio: `7663e51f7b60c269a9bb7f13f0f69d26358b609d`.
Rama `codex/cueva-006c-rutinas`, checkout Git real reutilizado:
`Z:\repos\Cuevapp\evidence\runs\cueva-006c-worktree`.
El HEAD final y el PR se identifican en el handoff; esta evidencia no declara
integración, migración alojada o despliegue.

## Alcance entregado

Catálogo de rutinas en `/rutinas`, edición de plantillas, copia independiente desde
la ficha, planificación v2 de días → bloques con vueltas → ejercicios con objetivo
de peso/repeticiones o tiempo. Selección múltiple, biblioteca visible desde el inicio
y paginación completa. Reordenamiento accesible por botones. Autoguardado CAS,
comparación de conflictos, publicación explícita y conservación de instantáneas.

Ampliación aprobada durante la sesión: videos desde galería, máximo 50 MB, solo
admin. Se preparó bucket privado, carga directa firmada, asociación CAS y lectura
con firma de 60 segundos limitada a ejercicios de la última publicación propia.
YouTube queda como alternativa opcional validada. No se subieron videos reales.
[Contrato, compatibilidad y recuperación](../architecture/routine-days.md).

v1 y texto anterior siguen legibles. Conversión administrativa explícita sin
pérdida: series 3,5,3 producen bloques separados con vueltas 3,5,3 y preservan
orden, nombres, observaciones y objetivos. No se toca la publicación previa.

## Skills reales

SKILLS_SELECTED: cueva-feature-development, cueva-architecture,
cueva-supabase-security, supabase:supabase, vercel:react-best-practices.

SKILLS_APPLIED:
- cueva-feature-development: checkout aislado existente, implementación acotada,
  verificaciones y handoff; sin integración/despliegue.
- cueva-architecture: JSON versionado compatible, límites, conversión explícita,
  contratos de copias/recursos y recuperación documentados.
- cueva-supabase-security: gate/sesión/propiedad conservados, RPCs con permisos
  explícitos, RLS real, pruebas negativas de acceso directo y sin service role.
- supabase:supabase: changelog y documentación oficial revisados; migraciones nuevas
  generadas con CLI instalada 2.121.0, pruebas con DB/PostgREST/Storage reales.
- vercel:react-best-practices: revisión de hooks/refs, claves estables, listas,
  carga independiente, estado local durante peticiones, controles etiquetados,
  teclado y axe. Sin nueva librería UI ni dependencias.

SKILL_SOURCES:
- `Z:\repos\Cuevapp\.agents\skills\cueva-feature-development\SKILL.md`
- `Z:\repos\Cuevapp\.agents\skills\cueva-architecture\SKILL.md`
- `Z:\repos\Cuevapp\.agents\skills\cueva-supabase-security\SKILL.md`
- `C:\Users\LA NAVE\.codex\plugins\cache\openai-curated-remote\supabase\1.0.0\skills\supabase\SKILL.md`
- `C:\Users\LA NAVE\.codex\plugins\cache\openai-curated-remote\vercel\0.54.1\skills\react-best-practices\SKILL.md`

## Aislamiento y entorno

Main remoto comprobado mediante `git ls-remote`; permaneció en la base indicada.
Sin PR abiertos al inicio (`gh pr list`). Facu avanzó en su rama remota
`feature/cueva-003b-vencimientos`: se observaron sus refs de solo lectura y no se
hizo checkout, fetch sobre su rama, modificación ni push a ella. No cambian pagos,
vencimientos, Auth, SMTP, roles existentes ni migraciones históricas.

Node 22.14.0/npm 10.9.2 mediante el script portátil proporcionado; Docker 29.9.2.
No se repitieron instalaciones de Node, npm, dependencias ni Chromium. Docker usó
imágenes descartables fijadas por digest; Storage se añadió al laboratorio por
el cambio de alcance aprobado. No hay nuevos paquetes en package-lock.

## Evidencia y reproducción

[Laboratorio y límites](../../experiments/cueva-006c-local/README.md),
[matriz de aceptación](../../experiments/cueva-006c-local/evidence.json),
[pruebas del modelo](../../experiments/cueva-006c-local/model.test.mjs).

Desde PowerShell, activar el script indicado por el usuario; desde
`experiments/cueva-006c-local`, ejecutar `node lab.mjs`. Usa cuentas sintéticas,
puertos loopback y recursos propios efímeros. No depende de credenciales alojadas.
El gateway de laboratorio reproduce prefijo y CORS del gateway Storage y no simula
los permisos, archivos o firmas del servicio. Los grants base de Storage se
preparan en el laboratorio, cuyo servicio arranca con DB_INSTALL_ROLES=false.

Desde la raíz: `npm run verify`, `npm run verify:sources`,
`npm run verify:security`, `npm audit --audit-level=high`, `git diff --check`.
La suite del modelo está incluida en `npm test` y, por tanto, en el CI existente.
El laboratorio Docker es una verificación local separada del CI general.

Se preservan nueve capturas nuevas en `evidence/CUEVA-006C/`: editor/alumno en
390 y 1440 píxeles, temas claro/oscuro, y biblioteca. Inspección visual local del
editor móvil y lectura del alumno, además de verificaciones de overflow y axe.

Durante el desarrollo se corrigieron comparaciones/locators del nuevo laboratorio
y su preparación de grants/CORS; las corridas parciales no se cuentan como PASS.
Dos observaciones de red en la corrida completa: una navegación abortada por
cambio de página y un error de consola correspondiente al 503 inyectado
para probar recuperación del borrador. No son fallos de permisos o cargas ocultos.

## Límites y pendientes de revisión

Migraciones alojadas, bucket alojado, configuración CORS/cuotas, backup y release:
NOT_RUN por este ejecutor. Requieren revisión independiente y operación posterior
del Orchestrator. La rama no integra ni publica producción. No se usa el servicio
alojado para pruebas. El cambio no completa todo el MVP.

La carga estándar no es reanudable. Se restringen tamaño/MIME, sin transcodificación
ni validación completa de codecs/archivo. MOV puede variar entre dispositivos.
Los objetos abandonados/reemplazados quedan privados; no hay limpieza destructiva
ni retención automática nueva. Revisar costos/cuotas antes de habilitar uploads.
Los enlaces firmados emitidos duran 60 segundos. Safari, móvil físico y reproducción
de todos los formatos: NOT_RUN. La prueba de carga usa WebM real generado localmente.

Ocho vulnerabilidades moderadas preexistentes en dependencias de desarrollo;
ninguna alta/crítica reportada. No se cambió ni forzó la cadena de dependencias.

## Resultados locales finales

- Laboratorio específico: **121/121 PASS**, dos observaciones de red esperadas,
  limpieza de cinco contenedores y red propia PASS. Incluye Storage real y comparación
  de bytes del WebM, tamaño/MIME por API directa, RLS, legado, vacío, inactivos,
  concurrentes, copias, publicación/reintento, errores, teclado, temas y axe.
- Modelo: **5/5 PASS**, incluido máximo legado de 300 apariciones con series mixtas.
- Controles generales: lint, typecheck, build, documentos 2/2, modelo 5/5 y navegador
  47/47 PASS; fuentes 4/4, seguridad (385 archivos, sin hallazgos) y diff check PASS.
- CI del HEAD: se registra después del push en el PR draft y el handoff.
  No se afirma CI remoto antes de consultar el resultado de esa corrida.
