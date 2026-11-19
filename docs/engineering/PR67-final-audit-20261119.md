# PR #67: auditoría final independiente

TASK_ID: CUEVA-006D-ACCEPTANCE. Fecha: 2026-11-19.
BASE_SHA: `0832c9ef17a04289528148f76ac2057703db3746`.
HEAD_SHA: `f1de91cb4c601c3fd9bdf094605dc8da922c9340`.
Decisión: **CHANGES_REQUIRED**. El nuevo main de #63 es
`508cb62ba64609293d1ea6057cf84f9bec373bb5`; la actualización remota de #67
respondió 422 por conflicto de `package.json`. El ejecutor recibió el handoff.

## Standards

Un hallazgo P2 de integridad del contrato, sin bypass de permisos identificado.

En `20261116120000_cueva_routine_text_mentions.sql`, líneas 227–242 del HEAD,
el validador usa `->>` para comprobar `mention.text` sin exigir el tipo JSON
string. Puede convertir `text:123` a `"123"` para compararlo y persistir el número
original. Con un UUID activo y rango coincidente, el dato viola
`RoutineMention.text: string`; el lector descarta después la referencia.

Exigir `jsonb_typeof(v_mention->'text') = 'string'`. Probar rechazo de número,
booleano y objeto y ausencia de escritura parcial. Actualizar los hashes de la
migración pendiente y su documentación. No modificar migraciones aplicadas.

RLS, autorización administrativa, search_path vacío, revocaciones, lock común,
CAS, snapshots y replay no presentaron otro hallazgo accionable en esta revisión.
Las modificaciones de fixtures conservan aserciones y tiempos. Cero hallazgos
adicionales de las heurísticas de mantenimiento.

## Spec

Un hallazgo P2 contra el requisito de tolerar consultas rápidas e ignorar
resultados obsoletos de CUEVA-006D.

`src/components/routines/text-routine-editor.tsx` conserva resultados al cambiar
la consulta. Enter y los botones siguen insertándolos mientras `pending=true`.
Secuencia: buscar `@press`, cambiar a `@sent` y pulsar Enter antes de responder
la segunda petición; el resultado anterior se inserta en el rango nuevo.

Limpiar o vincular resultados a consulta/rango y bloquear la selección obsoleta.
Retener la segunda respuesta en una prueba: ni teclado ni toque pueden insertar
la opción anterior; al responder, la opción nueva se puede seleccionar.

No se confirmó otro incumplimiento en separación de documentos, Unicode,
referencias históricas, CAS/replay, publicación atómica, lecturas mezcladas,
escritor anterior o privacidad del alumno.

## Verificación y siguiente paso

CHECKS_EXECUTED: lectura independiente del diff y contratos en dos ejes;
comprobación de nueve checks SUCCESS del HEAD en GitHub; comparación del delta
de fixtures contra `a9bc7c72b4d16ec97d65636717e746e683d5018a`.
NOT_EXECUTED: no se repitieron laboratorios ni se ejecutaron escrituras alojadas.
Los hallazgos son de revisión estática; el ejecutor debe aportar regresiones.

Resultado por eje: Standards 1; Spec 1. Ambos requieren corrección antes de
aceptar el nuevo candidato. Tras resolver el conflicto y los hallazgos,
revalidar el HEAD, los hashes, las pruebas afectadas y CI. La autorización de
las dos migraciones pendientes persiste dentro de su alcance; comprobar el SQL
corregido y el respaldo antes de aplicarlas. Ninguna de esas dos se aplicó aún.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-acceptance-audit`,
`cueva-supabase-security`, `code-review`. SKILL_SOURCES:
`.agents/skills/<nombre>/SKILL.md` y guía host `code-review/SKILL.md`.
