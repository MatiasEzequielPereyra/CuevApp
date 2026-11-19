# PR #67 — Correcciones P2 — 2026-11-19

Estado de entrega: REVIEW; sin merge, deploy ni SQL alojado. Base de integración
verificada `5a222ca0138dab4f3acd2c151a91b513d3197652`, con #63, #68 y #72 integrados.
Se conservó la rama remota de Menciones hasta
`f1de91cb4c601c3fd9bdf094605dc8da922c9340`, incluidos sus documentos.
El PR registra el HEAD definitivo y sus checks exactos.

## Integración y dependencia común

Se resolvió el conflicto de package.json preservando correo, contraseñas,
notificaciones, rutinas y ambos verificadores de dependencias. Cuenta, Mi perfil,
la API de acceso, el helper Auth y la migración Correo coinciden con main: esta
entrega no altera esos flujos ni repite sus laboratorios históricos.

El arreglo común de fixtures del [PR #72](https://github.com/MatiasEzequielPereyra/CuevApp/pull/72)
ya está integrado en esta base. Su candidato revisado fue
`2a08a8b6905987a3705ca221ce573c416871b78e`. Al incorporar main se resolvieron
package.json y checkpoint preservando todos los scripts, la evidencia y ambos
flujos. El código de fixtures coincide con main; no hay dependencia de otro merge
pendiente. [Reproducción y lifecycle](fixture-isolation-review.md).

## Sugerencias obsoletas

La prueba real retenía la respuesta para @sent después de mostrar Press militar.
Antes del arreglo, Enter insertaba Press militar. Ahora cambiar consulta/rango
invalida inmediatamente el identificador de petición, elimina resultados y
reinicia la opción activa. Insertar exige una respuesta elegible, sin carga/error
y una opción incluida en los resultados vigentes. Escape conserva el cierre;
Enter durante carga conserva su comportamiento de textarea, sin insertar una
mención anterior. Los botones pendientes no admiten selección.

Dos regresiones del componente real retienen esa segunda respuesta: teclado y
toque en la posición que ocupaba la opción anterior. Ambas exigen cero menciones
obsoletas, desaparición de la opción vieja, selección posterior de Sentadilla y
su UUID correcto en la revisión guardada. No se aumentan timeouts ni se elimina
cobertura previa.

## Tipo JSON y atomicidad

Se agrega `jsonb_typeof(v_mention->'text') is distinct from 'string'` al validador
SQL, antes de extraer texto o escribir. `->>` convertía un número JSON en una
cadena para comparar, pero persistía el número original. El [contrato de PostgreSQL](https://www.postgresql.org/docs/current/functions-json.html)
distingue extracción JSON y extracción textual.

Los negativos usan número, booleano y objeto, con el resto de la referencia válido.
Exigen 22023 y comparan el documento completo antes/después: fila base, documento
lateral e instantáneas publicadas. La prueba roja con número obtuvo «no exception»
y detectó mutación; no se atribuyen los fallos posteriores de esa corrida a pruebas
independientes de aceptación, porque la primera ya había cambiado la revisión.
Tras el arreglo, las 60 aserciones SQL pasan.

Reproducción local: `node experiments/cueva-006d-sql/verify.mjs`. Crea solamente un
PostgreSQL oficial fijado por digest, sin red ni puertos publicados, con límites
de memoria/CPU y contraseña efímera por entorno. Aplica una lista explícita de diez
migraciones reales necesarias y ejecuta el pgTAP afectado. Auth y Storage están
representados por tablas/claims sintéticos en el límite SQL: no constituye prueba
de los servicios Auth/Storage. La matriz CI usa sus esquemas nativos completos.
El script valida el label y detiene/elimina únicamente su contenedor y volúmenes
propios, también al fallar. No reinicia Docker ni toca Vendify.

## Migración y publicación

Solo se edita la migración de Menciones todavía pendiente:
`20261116120000_cueva_routine_text_mentions.sql`.

SHA256 de los bytes LF versionados: `205f8aeca59dc04b4f54c5f1b0439fd4ade49aa9e44b588e7af9eabbb720845a`.

Ninguna migración aplicada se modifica. Correo conserva exactamente sus bytes de
main; el Orchestrator informó su registro alojado con versión `20261118185514`.
También informó Ejercicios asignados en `20261119124720`, 32 migraciones y
huella de nueve publicaciones conservada. No se repiten esas migraciones ni se
atribuye verificación remota propia. Menciones sigue sin aplicación alojada. Antes de operar se mantienen backup,
contraste de esquema/historial, lista explícita de dependencias, hash, grants/RLS,
postflight y publicación posterior. No usar el timestamp de Git para deducir
estado alojado ni reejecutar Correo mediante un push indiscriminado de migraciones.

## Evidencia y límites

`evidence/reviews/pr67-p2-regression.json` resume los casos rojo/verde sin sesiones,
credenciales ni trazas de datos reales. Se ejecutan tipos, lint, build, pruebas
dirigidas de teclado/toque y foco, tipos de menciones, API/roles de Correo y
verificaciones documentales/fuentes/manifiesto/seguridad. El resultado final de CI
y las revisiones independientes se registran en el PR del HEAD exacto.

El Orchestrator informó fallos APT/mirrors Ubuntu en otros runs, antes de pruebas.
Si afectan esta entrega se registran como infraestructura, sin cambiar runner,
gates o tiempos. Se admite un único reintento de los jobs afectados tras observar
recuperación de red; un fallo de infraestructura no se declara PASS.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `cueva-acceptance-audit`, `supabase:supabase`,
`diagnosing-bugs`, `resolving-merge-conflicts`, `vercel:react-best-practices`,
`code-review`, `pr`. SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md`, guías del
host, Next instalado `page.md`/`testing/playwright.md` y documentación PostgreSQL.
