# CUEVA-006E — Preview y acceso a videos desde menciones

**Estado:** PR abierto; validación automatizada del PR aprobada. La reconciliación documental se registra en este commit; los workflows que correspondan a este nuevo HEAD deben volver a comprobarse antes de integrar.  
**Rama:** `feature/cueva-006e-exercise-mention-preview`  
**PR:** [#82 — preview y reproducción inline de videos](https://github.com/MatiasEzequielPereyra/CuevApp/pull/82)  
**HEAD validado por los checks del PR:** `9807876c0ccf1bbf9ad5c6bcbee5c60213b417a0`  
**Base:** `main` en `e9dffe16de5ae76eb01eb24b4de490dd3e33b806`.

## Alcance entregado

- Las menciones de texto libre se resuelven por UUID estable; no se infieren por nombre.
- Preview accesible por hover, foco y tap, con cierre por Escape y click exterior.
- Disponibilidad de video modelada como disponible, ausente o desconocida; los fallos de lookup no se presentan como ausencia.
- Reproducción dentro de un diálogo en la rutina, con validación de la fuente, timeout, cancelación, mensajes diferenciados y reintento.
- Sin recurso de video no se abre reproductor vacío. Se conservan los mensajes de ausencia definidos para menciones y rutinas por bloques.
- El endpoint y las RPC/migraciones mantienen el acceso limitado a ejercicios del plan estructurado o mencionados en la última publicación propia del alumno.

## Cambios de base de datos

- `20261119130000_cueva_mention_video_availability.sql`: amplía la consulta privada de IDs con video para ejercicios mencionados.
- `20261120150000_cueva_mentioned_exercise_video_access.sql`: extiende la autorización de acceso a videos para menciones publicadas, por UUID.
- Ambas migraciones se validaron en stacks Supabase locales aislados y en el workflow de migraciones del PR; **no se aplicaron a Supabase hosted**.

## Pruebas y CI del PR

Los cinco workflows asociados al PR #82 finalizaron en `success` sobre HEAD `9807876c0ccf1bbf9ad5c6bcbee5c60213b417a0`:

| Control | Run | Resultado |
|---|---:|---|
| Verify foundation | [#1313](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44807764119) | SUCCESS |
| CUEVA-006E routine mentions E2E | [#25](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44807764128) | SUCCESS |
| CUEVA-006E isolated checks | [#15](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44807764023) | SUCCESS |
| Supabase local migrations | [#679](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44807764238) | SUCCESS |
| Membership SQL | [#342](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44807764042) | SUCCESS |

Detalle de validación:
- E2E autenticado editor-alumno, preview, reproductor inline, error HTTP 503 y reintento.
- Pruebas unitarias de menciones y validación de fuentes de video.
- Verify foundation completo.
- Migraciones fresh, upgrade y hosted-compatible en bases locales desechables.
- Membership SQL y Receipt Storage.

Los resultados anteriores corresponden al SHA indicado; la actualización documental posterior cambia el HEAD y no se considera validada hasta que terminen las ejecuciones disparadas por ese nuevo commit.

## Sincronización con main

El merge commit `be9c2dda1bc5457cb54309f014fbdf60180e64ae` sincronizó la rama con el main `e9dffe16de5ae76eb01eb24b4de490dd3e33b806`. La comparación previa a la apertura del PR informó 71 commits ahead y 0 behind.

- PR #80 incorporó la instalación guiada PWA; se conserva íntegramente.
- PR #81 incorporó fixtures de notificaciones relativos a la fecha de Buenos Aires. Se conserva la versión dinámica de `supabase/tests/cueva_notifications.test.sql`.
- PR #82 permanece abierto, no Draft y mergeable en la última lectura; no está integrado.

## Límites

- No se realizó merge ni despliegue de producción.
- No se aplicaron migraciones en Supabase hosted.
- El Preview de Vercel del PR fue reportado como Ready; esto no equivale a producción.
- CUEVA-003B Vencimientos y CUEVA-006D permanecen cerradas.
- CUEVA-005 no se reabre; los ajustes heredados que forman parte del delta se mantienen como baseline validado.
