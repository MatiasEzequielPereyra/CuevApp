# PR #67 — Revisión sobre el portal publicado

Estado: **CI VALIDADO; revisión final de alcance y operación pendiente; PR en draft**.
Base actual verificada: `0832c9ef17a04289528148f76ac2057703db3746`.
HEAD validado: `0c4e9c3d9da26dd1b0c886cec54283db186bfc0b`.
El PR permanece abierto, mergeable y sin commits detrás de `main`. La evidencia de
código y CI se refiere al HEAD indicado; los resultados anteriores conservan valor
histórico y no sustituyen esta ejecución.

## Resultado combinado y correcciones

Se conservan las dos subpestañas, documentos independientes, constructor por
bloques y formato publicado explícito. La navegación y estilos provienen del
portal publicado. Se preservan el gate temporal de dependencias de main y el
control adicional de grafo de esta rama; no se extiende su vencimiento.

La revisión independiente encontró y se corrigió:

- Editor/lector usan puntos de código, pero SQL esperaba UTF-16: una mención
  posterior a un emoji fallaba con 22023. SQL comparte ahora el contrato Unicode.
- El escritor público anterior actualizaba solo la base y dejaba una divergencia
  permanente. Un wrapper con autorización y el mismo advisory lock delega al
  escritor nuevo, preserva texto oculto y snapshots de replay. El escritor base
  privado ya no admite ejecución del cliente. El backfill adquiere ese mismo lock.
- Las cargas iniciales y de plantillas podían combinar revisiones distintas.
  Ahora rechazan ese resultado sin habilitar edición; el administrador reintenta.
- Un fallo del documento lateral podía presentar bloques anteriores como formato
  vigente. El alumno recibe un error explícito y puede reintentar.
- El ensayo con PostgreSQL real detectó que JSONB reordena claves. Comparar JSON
  serializado dejaba menciones guardadas como cambios pendientes e impedía
  publicar. La comparación canónica conserva orden y campos de cada ocurrencia.

## Verificación nueva

- Prueba roja reproducida: guardado SQL con offsets del editor después de emoji
  falla 22023 antes del arreglo. Ensayo real anterior dejó Publicar deshabilitado
  tras guardar; la comparación de claves explica la diferencia con los mocks.
- SQL: 54 aserciones de aislamiento, permisos, CAS, replay, publicación atómica,
  Unicode e inactivos. Incluye escritor viejo/nuevo sin salto de revisión,
  texto oculto, replay tras avance y publicación histórica backfilleada.
- Dos administradores reales conectados a PostgreSQL: publicación concurrente
  serializada, una única instantánea atómica.
- Navegador: 27 casos dirigidos PASS (22 Chromium con dependencia de proyecto y
  5 WebKit), incluyendo texto/UUID, plantilla, respuesta perdida, lecturas mixtas,
  error lateral y emoji. La corrida previa 39/40 coincidió con una edición local
  durante WebKit; se descartó y se repitieron los casos afectados con árbol estable.
- Modelo10/10, comparación de revisiones3/3, lint, tipos, build, documentos, fuentes,
  manifiesto y seguridad se ejecutan sobre el candidato. Resultados finales de CI
  y del ensayo Auth real en el PR, sin atribuirlos a servicios alojados.
- PASS local: `tests/e2e/routine-mentions.integration.mjs` cruza Auth real aislado, textarea,
  API, PostgreSQL y publicación al alumno. Se ejecuta en fresh con Next/Chromium
  preparados. No registra sesiones, credenciales ni enlaces de Auth.

## Dependencias y orden operativo

No asumir que las versiones del historial alojado coinciden con nombres de Git.
El operador debe contrastar contenido/esquema con una lista explícita, y registrar
qué dependencias ya están aplicadas. No repetir una migración por nombre distinto.

| Archivo de dependencia o cambio | SHA256 de bytes de Git |
| --- | --- |
| `20261114120000_cueva_student_assigned_exercises.sql` | `c2c391b8dfb72e9d10015fafff09ee6072cf40a56544fab20754bf03f533537c` |
| `20261115160000_cueva_my_routine_video_ids.sql` | `958e40ea96ef466434ffe821bf208245d5ce3651ca3c24a7ec2e6a3ddb1f4187` |
| `20261116120000_cueva_routine_text_mentions.sql` | `14f5990bb518dc910ea7bf013ba2c7ef2bb293a8efcaaebac246d2ef0918e2f8` |

La nueva migración depende de las tablas/RPC de acceso, alumnos, invitaciones,
rutinas, rutinas estructuradas, días y videos. La publicación usa además las RPC
`cueva_student_assigned_exercises` y `cueva_my_routine_video_ids` anteriores;
README todavía identifica aplicación alojada pendiente de la primera. No se
verificó el esquema alojado durante esta entrega.

1. Integrar #68 primero es recomendable: main conserva la carrera de foco del
   reproductor corregida allí. Después actualizar esta rama y revalidar cambios.
   #64 ya está integrado. #63 es independiente de Menciones; si se integra primero,
   incorporar su main y conservar ambos cambios de Mi perfil y su trigger.
2. Con autorización operativa separada: revisar historial y definiciones reales,
   backup recuperable, grants/RLS, últimas publicaciones y revisiones base. Verificar
   funciones `routine_admin`, `routine_owner`, `routine_latest` y `routine_write`.
   Comparar huellas/conteos antes/después, sin exportar datos personales al repo.
3. Si falta alguna RPC anterior, aplicar primero su archivo exacto aprobado.
   Aplicar la migración nueva completa como transacción con lock/statement timeout
   acotados. Si el lock está ocupado, abortar y coordinar; no desactivar locks.
   Es aditiva y reemplaza únicamente el endpoint viejo por wrapper compatible.
4. Postflight: cotejar revisiones/owner y filas laterales para cada borrador,
   plantilla y publicación; igualdad de conteos iniciales; cero escrituras en
   publicaciones históricas. Comprobar RLS, grants del endpoint nuevo/viejo y
   revocación del escritor privado base. Ensayo autorizado con ficha de prueba.
5. Solo tras postflight integrar código: Git dispara despliegue automático.
   Confirmar SHA publicado y comprobar bloques/texto/aislamiento con autorización.
   No usar `db push` indiscriminado: #63 tiene un timestamp posterior pero puede
   haberse aplicado antes; usar lista explícita y conciliar el ledger.

## Rollback conservador

Detener nuevas ediciones/publicaciones si falla postflight. No borrar sidecars,
publicaciones ni referencias. El wrapper permite clientes anteriores y conserva
texto libre oculto al editar bloques; un cliente viejo solo publica bloques.
Una publicación ya capturada conserva su formato durante replay. Revertir UI
sin migrar hacia atrás no garantiza que una UI antigua represente texto libre:
comprobarlo antes de reabrir el portal y conservar los datos mientras se corrige.
No restaurar el escritor base público ni sus grants para salir del bloqueo.

No se aplicó SQL alojado, no se integró #67 y no se enviaron correos reales.
La excepción Picomatch sigue siendo riesgo aceptado temporal, no vulnerabilidad
corregida. Autorizaciones remotas de otras tareas no se reutilizan aquí.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `cueva-acceptance-audit`, `supabase:supabase`,
`resolving-merge-conflicts`, `diagnosing-bugs`, `vercel:react-best-practices`,
`code-review`, `pr`. SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md`,
las guías correspondientes del host y Next instalado `page.md`.

## Actualización del verificador adicional — 2026-11-18

La suite CI del candidato anterior aprobó sus 149 pruebas y las tres variantes
SQL. El control adicional del grafo falló porque exigía 14 avisos, mientras npm
ya devolvía un reporte válido completamente limpio. La [fuente oficial de GitHub](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
retiró el advisory a las 15:38:56 UTC del 18 de noviembre. Esto describe el estado
del feed, no acredita un parche de las versiones instaladas.

El verificador adicional ahora acepta también reportes v2 con objeto vacío de
vulnerabilidades y todos los conteos numéricos exactamente cero. Conserva los
rechazos a reportes inválidos, avisos adicionales y cambios del grafo cuando
existen hallazgos. Se agregan tres regresiones; el verificador común de main,
su vencimiento, audit de producción y gate de critical permanecen intactos.
