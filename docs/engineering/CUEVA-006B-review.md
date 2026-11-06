# CUEVA-006B — implementación y verificación

Estado: REVIEW local, 2026-11-06. Sin aceptación independiente.

## Bases, alcance y skills

- Continuación entregada: `fd315ca0bd6a9db3131449b2cd58ae6eb43b8759` (006A REVIEW).
- Main verificado: `2ca0d519bbf188bcf09b1982ec08f632b8b44b9b`. Avance desde
  `fb801dd` limitado a instrucciones/skills del PR32; no integra 006A.
- Se reaplicó 006A con rebase en la rama nueva, sin cambiar la original:
  base incremental `8060032f4f299fc306a28baab213ee61737d1935`.
- Rama: `codex/cueva-006b-rutinas-estructuradas`. El diff acumulado para auditoría
  es main→HEAD, incluyendo 006A. El diff incremental es 8060032→HEAD.
- PR31 de documentación financiera estaba abierto al inspeccionar; no se modifica
  ni se incorpora en este incremento. PR de este trabajo: NOT_CREATED.
- SKILLS_SELECTED / SKILLS_APPLIED: cueva-feature-development,
  cueva-architecture, cueva-supabase-security; guía Supabase de host y revisión
  React instalada consultadas en la sesión. Sin skill de release ni auditoría
  independiente, que corresponden al Orchestrator.
- SKILL_SOURCES: [desarrollo](../../.agents/skills/cueva-feature-development/SKILL.md),
  [arquitectura](../../.agents/skills/cueva-architecture/SKILL.md),
  [seguridad](../../.agents/skills/cueva-supabase-security/SKILL.md).
  Host: `supabase/1.0.0/skills/supabase/SKILL.md` y
  `vercel/0.54.1/skills/react-best-practices/SKILL.md` bajo el cache de plugins.
  Revisión final también con `supabase-postgres-best-practices` de ese paquete
  Supabase: mínimos privilegios, RLS y transacciones breves sin llamadas externas.

[Encargo](CUEVA-006B-task.md), [modelo y contrato](../architecture/structured-routines.md),
D009 y backlog registran el cambio explícito del usuario. El maestro original
permanece intacto; la nota principal antigua ya no es el requisito vigente.

## Implementación

Catálogo administrativo `/ejercicios`, búsqueda, creación, edición con revisión,
nombres equivalentes únicos y desactivación. Alta/selección desde cada bloque
sin navegar ni perder cambios recientes mientras llega una respuesta.
Constructor con bloques y apariciones ordenadas, objetivos independientes,
controles de subir/bajar/quitar disponibles por teclado y móvil. No se depende
de drag and drop. Series, repeticiones/rango, peso nullable y observaciones.

Se adaptan los estados/serialización/recuperación/conflictos/publicación de 006A;
igualdad y CAS incluyen estructura y texto. Las plantillas copian todos los
objetivos con UUID nuevos y sin relación viva. El alumno solo ve la última
instantánea publicada, sus objetivos y notas, nunca resultados realizados.
Snapshots conservan nombre/objetivos sin consultar el catálogo mutable.

Sin dependencias nuevas ni cambios a Auth, SMTP, invitaciones o pagos. Videos,
imágenes, archivos, registro de resultados y offline siguen pendientes.

## Reproducción y evidencia nueva

Docker ya funcionando, Node/npm del proyecto y Chromium. Sin .env ni credenciales.
Desde la raíz:

```powershell
Set-Location experiments/cueva-alumnos-local
$env:CUEVA_STRUCTURED_ROUTINES_ONLY = '1'
node lab.mjs
Remove-Item Env:CUEVA_STRUCTURED_ROUTINES_ONLY
Set-Location ../..
npm run lint
npm run typecheck
npm run build
npm run test:docs
npm run verify:sources
npm run verify:security
git diff --check
```

El modo nuevo usa el arranque existente (app Next, Auth, PostgREST y PostgreSQL
reales). Antes de la migración nueva prepara una nota, publicación y plantilla
con el writer de 006A; luego aplica 006B y comprueba conservación y cierre de
escritura vieja. No repite 104/104 de 006A ni laboratorios de identidad/SMTP.
`npm test` global NOT_RUN por alcance: se ejecutan documentos y el recorrido
afectado nuevo, sin repetir matrices históricas o visuales de otras funciones.
Un 503 del editor y una respuesta de alta inline demorada se simulan en navegador;
permisos, conflictos, deduplicación, validaciones y esquema se prueban en base real.

Durante el desarrollo se corrigió una aserción del harness: agregar y quitar un
bloque antes del debounce vuelve correctamente a «Sin cambios»; para comprobar
borrado persistido, el test confirma primero el alta del bloque. Una invocación
con ruta relativa incorrecta no modificó archivos; no se considera evidencia.

La salida temporal es `structured-results.json`; no se versionan secretos, tokens,
UUID de usuarios ni logs. Usuarios, nombres y correos de capturas son sintéticos.
Ejecución nueva `2026-11-06T15:14:21.458Z`: **92/92 PASS**, incluidos 86
controles funcionales/seguridad/UI, uno de aislamiento del rol de base y cinco
de limpieza. [Evidencia JSON nueva](../../experiments/cueva-routines-local/structured-evidence.json)
con hashes del incremento ejecutable y nueve capturas. No se presenta el
104/104 anterior de 006A como una ejecución de este candidato.

| Comprobación nueva | Resultado |
| --- | --- |
| Laboratorio app/Auth/PostgREST/PostgreSQL | 92/92 PASS |
| Lint / tipos / build | PASS, rutas privadas dinámicas |
| Documentos / fuentes originales / secretos / diff | PASS |
| 390 y 1440 px claro/oscuro, orden por teclado | PASS; sin overflow |
| axe WCAG A/AA constructor y alumno | Cero violaciones |
| npm audit umbral crítico | 0 altas/críticas; 8 moderadas dev preexistentes |
| Recursos propios | Detenidos; red eliminada |
| Migración alojada / CI remoto / despliegue | NOT_RUN |

Capturas nuevas, con revisión visual representativa móvil/computadora y ambos
temas: [constructor móvil oscuro](../../evidence/CUEVA-006B/builder-390-dark.png),
[móvil claro](../../evidence/CUEVA-006B/builder-390-light.png),
[computadora oscuro](../../evidence/CUEVA-006B/builder-1440-dark.png),
[computadora claro](../../evidence/CUEVA-006B/builder-1440-light.png),
[alumno móvil claro](../../evidence/CUEVA-006B/pupil-390-light.png),
[móvil oscuro](../../evidence/CUEVA-006B/pupil-390-dark.png),
[computadora claro](../../evidence/CUEVA-006B/pupil-1440-light.png),
[computadora oscuro](../../evidence/CUEVA-006B/pupil-1440-dark.png) y
[catálogo](../../evidence/CUEVA-006B/catalog-desktop.png).
Capturas full-page sobre Next dev; indicador N exclusivamente local.
Manifest/lockfile y SVG idénticos a main. No se ejecutó audit fix ni se amplió
el alcance para actualizar la cadena de herramientas.

## Aplicación desde main y reversión conservadora

Main aún no incluye 006A. Para aplicar el candidato auditado, en ese orden:

1. Migración de 006A `20261106142345_cueva_routines.sql` sobre el esquema actual,
   incluida la eliminación protegida de fichas.
2. Migración nueva `20261106145843_cueva_structured_routines.sql`: catálogo vacío,
   columnas JSON nullable, validación, capacidades nuevas y revocación del writer
   viejo. No actualiza ni interpreta contenido anterior.
3. Código completo acumulado de la rama, después de aprobación independiente.

Estas instrucciones no autorizan su aplicación alojada; aquí ambas migraciones
solo se ejercitan en bases desechables. El Orchestrator debe auditar el diff
acumulado y las dos migraciones, no únicamente el incremento B.

Ante rollback, conservar tablas, snapshots, borradores, catálogo y protección
contra eliminación. Retirar/deshabilitar interfaz de edición conservando los
datos; no borrar columnas ni reactivar por SQL manual el writer antiguo. Volver
al frontend de 006A no restaura escrituras seguras: su RPC vieja queda cerrada.
Una compatibilidad de escritura hacia atrás requiere otro cambio revisado.
Lectura nueva admite el contenido anterior; no existe down destructivo automático.

## Limpieza y límites

Recursos exclusivos `cueva-estructuradas-<tipo>-<sufijo>`; puertos dinámicos
127.0.0.1 y 512 MB/1 CPU por contenedor. Finally cierra navegador/Next, contenedores
exactos y su red. Si se interrumpe forzosamente, listar por ese prefijo, comprobar
el sufijo de esa ejecución y retirar solo esos nombres. Sin prune ni reinicios
de Docker; Vendify y otros procesos quedan intactos. No hay volúmenes duraderos.

Catálogo: búsqueda explícita, hasta 100 resultados; límites de estructura en el
modelo. Copiar una plantilla con ejercicios inactivos nuevos se rechaza conservando
la edición; referencias ya asignadas siguen vigentes. Los nombres son snapshots
de planificación, no enlaces vivos ni un historial de cambios del catálogo.

No hay merge automático ante conflicto ni guardado offline. Un cierre forzoso
puede perder cambios sin confirmar. Chromium/axe locales no certifican móviles
físicos ni Safari. Advisors alojados, migración remota, sesiones reales de alumnos,
CI remoto y despliegue: NOT_RUN / NOT_VERIFIED. D009 técnica PROPOSED.

Sin push, PR, merge, deploy ni escrituras remotas.

## Archivos para auditoría

Incremento B: 35 archivos. Acumulado desde main: 55 archivos.
El listado acumulado incluye la migración y evidencia histórica de 006A, que no se atribuyen a la ejecución B.

```text
README.md
docs/architecture/decisions.md
docs/architecture/routines.md
docs/architecture/structured-routines.md
docs/engineering/CUEVA-006A-review.md
docs/engineering/CUEVA-006A-task.md
docs/engineering/CUEVA-006B-review.md
docs/engineering/CUEVA-006B-task.md
docs/engineering/backlog.md
docs/engineering/checkpoint.md
evidence/CUEVA-006A/admin-1440-dark.png
evidence/CUEVA-006A/admin-1440-light.png
evidence/CUEVA-006A/admin-390-dark.png
evidence/CUEVA-006A/admin-390-light.png
evidence/CUEVA-006A/pupil-1440-dark.png
evidence/CUEVA-006A/pupil-1440-light.png
evidence/CUEVA-006A/pupil-390-dark.png
evidence/CUEVA-006A/pupil-390-light.png
evidence/CUEVA-006B/builder-1440-dark.png
evidence/CUEVA-006B/builder-1440-light.png
evidence/CUEVA-006B/builder-390-dark.png
evidence/CUEVA-006B/builder-390-light.png
evidence/CUEVA-006B/catalog-desktop.png
evidence/CUEVA-006B/pupil-1440-dark.png
evidence/CUEVA-006B/pupil-1440-light.png
evidence/CUEVA-006B/pupil-390-dark.png
evidence/CUEVA-006B/pupil-390-light.png
experiments/cueva-alumnos-local/lab.mjs
experiments/cueva-routines-local/.gitignore
experiments/cueva-routines-local/browser-test.mjs
experiments/cueva-routines-local/evidence.json
experiments/cueva-routines-local/structured-evidence.json
experiments/cueva-routines-local/structured-test.mjs
src/app/alumnos/page.tsx
src/app/api/ejercicios/route.ts
src/app/api/rutinas/route.ts
src/app/cuenta/page.tsx
src/app/ejercicios/page.tsx
src/app/globals.css
src/app/mi-rutina/page.tsx
src/app/rutinas/page.tsx
src/app/rutinas/plantillas/page.tsx
src/components/dashboard/admin-dashboard.tsx
src/components/routines/exercise-catalog.tsx
src/components/routines/note-editor.tsx
src/components/routines/plan-builder.tsx
src/components/routines/plan-view.tsx
src/components/routines/routine-shell.tsx
src/components/routines/student-shell.tsx
src/components/students/delete-student-action.tsx
src/lib/routines/request.ts
src/lib/routines/types.ts
src/proxy.ts
supabase/migrations/20261106142345_cueva_routines.sql
supabase/migrations/20261106145843_cueva_structured_routines.sql
```
