# CUEVA-006B — auditoría, integración y cierre alojado

2026-11-06. **ACCEPTED / DEPLOYED** por ORCHESTRATOR CUEVA.

## Identidad y alcance

- Base auditada: `2ca0d519bbf188bcf09b1982ec08f632b8b44b9b`.
- Implementación acumulada inicial: `012e2ff468bcdf17c4679dcd668df7bd2dc7fdb6`.
- HEAD corregido: `c66efb47994d48f3bbd98f63e75b7696fc817bd6`.
- [PR33](https://github.com/MatiasEzequielPereyra/CuevApp/pull/33) integrado por merge ordinario,
  sin bypass: `21116e8bd8bd3b5a8481f69509e07aca555b0743`.
- Árbol de implementación del merge idéntico al HEAD corregido.

Se acepta el conjunto de 006A y 006B: catálogo administrativo, constructor por
bloques, objetivos independientes, autoguardado/conflictos, plantillas copiadas,
publicación explícita y consulta privada del alumno. El cambio expreso del usuario
reemplaza la nota principal por ejercicios seleccionados; las notas quedan como
observaciones. Sin videos, archivos, resultados realizados ni offline.

## Standards

Revisión independiente acumulada: cero hallazgos P1/P2 de seguridad o integridad.
RLS y sesión habilitada, vínculo ficha-Auth por UUID, privilegios de funciones,
escrituras serializadas, snapshots y eliminación protegida inspeccionados.
Sin cambios a Auth, SMTP, pagos ni dependencias.

## Spec

Revisión independiente acumulada: cero hallazgos P1/P2 del producto.
El primer CI detectó una prueba móvil que todavía buscaba Comprobantes donde
ahora está Rutinas. Se devolvió al ejecutor; el Orchestrator no corrigió código.
El cambio final afecta solo `tests/e2e/admin-dashboard.spec.ts`: conserva foco,
Enter, destino `/rutinas` y estado activo del componente real con props sintéticas.

## Verificación observada

- Orchestrator reprodujo el laboratorio real de Rutinas: **92/92 PASS** en
  `012e2ff`; no se repitió tras el cambio exclusivo de prueba.
- 28 hashes de fuentes/capturas comprometidas verificados contra blobs del HEAD.
- Documentos 2/2, fuentes 4/4, escaneo de seguridad y diff: PASS.
- CI del HEAD corregido: [push 42245026749](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/42245026749)
  y [PR 42245038614](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/42245038614)
  SUCCESS, incluidos lint, tipos, build, documentos, navegador, seguridad y audit.
- Los fallos de `012e2ff` quedan como historia, no como resultado del HEAD final.
- Ocho avisos moderados dev preexistentes; ninguna vulnerabilidad alta/crítica.

## Migraciones y recuperación

Proyecto confirmado `vbkzoojkdkcugxhneyzi`, ACTIVE_HEALTHY. Preflight de solo
lectura: nuevas tablas ausentes, conteos de fichas/perfiles y definición previa
de eliminación respaldados localmente. Hash MD5 de esa definición:
`cd1de182137ff43018925eba6b21bca2`. Sin exportar datos personales ni secretos.

| Archivo revisado | Versión alojada | SHA256 de bytes aplicados |
| --- | --- | --- |
| `20261106142345_cueva_routines.sql` | `20261106154120` | `51917cee907fcaea3994ef48fd58b84d5dadf31b2ea01fc023c697436466a411` |
| `20261106145843_cueva_structured_routines.sql` | `20261106154126` | `8643120ef206bd20d40cfafd6a54727c7a8573d6f35a32e7c6660b7db5b6faea` |

Aplicadas una vez, en ese orden, antes del código. Esquema aditivo; no se borraron
datos existentes. Las cuatro tablas nuevas tienen RLS; writer viejo revocado y
nuevo habilitado. Advisors posteriores sin nuevos avisos respecto al preflight.

Recuperación conservadora: retirar interfaz/código nuevo manteniendo tablas,
publicaciones, catálogo, borradores y protección de eliminación. No hay down
destructivo ni se reactiva el writer antiguo. El frontend de 006A no es un
rollback de escritura compatible. No se probó restauración de desastre completa.

## Comprobaciones alojadas

Smoke SQL en transacción con ROLLBACK, usando claims construidos dentro de la
base desde sesiones existentes, sin exportar identificadores ni tokens:
escritura administrativa de catálogo/borrador/publicación, reintento deduplicado,
lectura del alumno propietario, catálogo/borradores/plantillas privados y rechazo
de escritura directa, writer antiguo, alumno y anónimo. **PASS_ROLLED_BACK**.
No se presenta esta prueba de roles SQL como un login HTTP.

Postflight: conteos existentes de fichas/perfiles conservados; catálogo,
borradores y publicaciones siguen en cero. Ningún fixture de entrenamiento
persistido, ni cuentas/pagos modificados, ni emails enviados por esta prueba.

Vercel creó automáticamente `dpl_FP5b7jV4DrEg5jxMSRiq925G6s4x`, Production READY,
desde `21116e8bd8bd3b5a8481f69509e07aca555b0743`; alias
[cueva-gym.vercel.app](https://cueva-gym.vercel.app/rutinas) confirmado.
Sin despliegue manual duplicado ni cambios de flags.

Con sesión administrativa real en el navegador se verificaron listado de alumnos,
editor de rutina vacío y búsqueda HTTP del catálogo vacío, sin errores de esquema.
**NOT_VERIFIED:** guardar/publicar por HTTP alojado y consulta en navegador de un
alumno tras publicación. Persistencia/publicación/permisos tienen prueba local
real y smoke SQL alojado; se conserva esta distinción.

## Skills y siguiente alcance

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-acceptance-audit`,
`cueva-supabase-security`, `cueva-release`, `code-review`, guía Supabase y guía
Vercel deployments-cicd de host. Fuentes de proyecto:
[auditoría](../../.agents/skills/cueva-acceptance-audit/SKILL.md),
[seguridad](../../.agents/skills/cueva-supabase-security/SKILL.md),
[release](../../.agents/skills/cueva-release/SKILL.md).

Siguiente incremento a delimitar con el usuario: instrucciones y videos de la
biblioteca. Registro de resultados, comprobantes, recordatorios y PWA/offline
siguen pendientes. No repetir laboratorios aprobados sin un cambio relevante.
