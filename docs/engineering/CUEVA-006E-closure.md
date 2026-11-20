# CUEVA-006E — Preview y acceso a videos desde menciones

**Estado:** implementación completa; aceptación final condicionada a CI del HEAD documentado abajo.  
**Rama:** `feature/cueva-006e-exercise-mention-preview`  
**HEAD de trabajo:** `1d5727920d654da565c6f2ed7bc399e493ee9b39`  
**Base sincronizada:** `main` en `e9dffe16de5ae76eb01eb24b4de490dd3e33b806`.

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
- Ambas migraciones son aditivas y se validan en stacks locales aislados; no se aplicaron a Supabase hosted.

## Pruebas

- `tests/routine-mentions.test.mjs`: estados de disponibilidad y validación de menciones.
- `tests/routine-video-source.test.mjs`: política HTTPS/storage y hosts YouTube permitidos, rechazos de URL inválidas, credenciales y esquemas inseguros.
- El test de política de fuentes quedó incorporado a `npm test` y a los workflows focalizados de 006E.
- `tests/e2e/routine-mentions.integration.mjs`: flujo autenticado editor-alumno, preview, reproductor inline, fallo HTTP 503 y reintento.
- `tests/e2e/mi-rutina.integration.mjs`: regresión de la rutina del alumno.

## Sincronización con main

El merge commit `be9c2dda1bc5457cb54309f014fbdf60180e64ae` tiene como padres el HEAD previo de 006E y el main `e9dffe16de5ae76eb01eb24b4de490dd3e33b806`. La rama quedó sin commits por detrás de main.

- PR #80 incorporó la instalación guiada PWA; se conserva íntegramente.
- PR #81 incorporó fixtures de notificaciones relativos a la fecha de Buenos Aires. Se conserva la versión dinámica de `supabase/tests/cueva_notifications.test.sql`, que reemplaza el ajuste temporal anterior de 006E y mantiene las reglas del worker.
- No se modificó main ni se creó PR para 006E.

## Evidencia de CI

Los workflows de validación fueron iniciados sobre los siguientes commits:

| Control | Run | SHA |
|---|---:|---|
| Verify foundation | [44789586155](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44789586155) | `1d5727920d654da565c6f2ed7bc399e493ee9b39` |
| CUEVA-006E routine mentions E2E | [44789581834](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44789581834) | `1d5727920d654da565c6f2ed7bc399e493ee9b39` |
| CUEVA-006E isolated checks | [44789575161](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44789575161) | `034d35900df05aa29289a3731ebd1c51cb18366a` |
| Supabase local migrations (fresh / upgrade / hosted-compatible) | [44789562128](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44789562128) | `7aa65b35eb179a790eb11f4a63f330020c7d631e` |
| Membership SQL / Receipt Storage | [44789028155](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44789028155) | `be9c2dda1bc5457cb54309f014fbdf60180e64ae` |

No marcar los runs como aprobados hasta consultar sus conclusiones finales. Los cambios posteriores a cada SHA de validación son documentación o configuración de workflows; el código funcional y la suite de tests se mantienen iguales desde `7aa65b3`.

## Límites de cierre

- No se abrió PR, no se integró 006E a main ni se desplegó.
- No se aplicaron migraciones en Supabase hosted.
- CUEVA-003B Vencimientos permanece cerrada; CUEVA-005 no se reabrió.
- La aceptación final requiere todos los gates indicados en verde y revisión del diff final de la rama.
