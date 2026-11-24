# CUEVA-007 — Registro e historial de entrenamiento

Estado: implementación funcional y validaciones automatizadas revisadas en `feature/cueva-007-workout-tracking`; PR #88 continúa en Draft hasta aprobación.
Base verificada: `main` en `425e23aa3e5d28a1d2ba08c41084e5bba021f297` (PR #87 integrado).
Este encargo no autoriza merge, despliegue ni aplicación de migraciones a Supabase alojado.

## Objetivo

Permitir que cada alumno registre lo que realmente realizó, separado de los objetivos planificados por el administrador, y consulte su historial. La identidad del ejercicio es siempre su UUID de `cueva_exercises`; el nombre es solo una etiqueta visible.

## Alcance funcional confirmado

1. **Registro desde la rutina publicada:** disponible para ejercicios en rutinas estructuradas (días/bloques) y para menciones vinculadas en rutinas de texto libre.
2. **Registro rápido:** ingresar el peso utilizado y guardarlo con una acción breve. Sugerir el último peso registrado por ese mismo alumno para ese UUID de ejercicio; no usar el nombre para buscar coincidencias.
3. **Detalle por series:** alternativa para registrar varias series con repeticiones y pesos distintos. El registro rápido equivale a una sesión con un único dato de peso, sin inventar repeticiones.
4. **Historial:** consultar registros previos por alumno + UUID de ejercicio, ordenados por fecha; conservarlos aunque el ejercicio cambie de nombre, se desactive o deje de aparecer en la rutina.
5. **Ejercicios por tiempo:** no mostrar campos de kg para ejercicios cuyo modo planificado sea tiempo/duración.
6. **Separación de datos:** los pesos/repeticiones objetivo del administrador no se modifican al guardar resultados reales del alumno.

## Editor de texto y menciones

- El autocompletado administrativo aparece exclusivamente cuando el usuario escribe `@`; nunca por click, foco, hover, movimiento del cursor o proximidad.
- El selector se ancla al cursor, queda superpuesto sin desplazar el documento, colisiona arriba/abajo según el espacio disponible, tiene altura limitada y scroll interno, y admite flechas, Enter y Escape.
- La selección libre de texto en escritorio debe seguir funcionando con arrastre, incluso sobre menciones y varias líneas. Las capas visuales no deben capturar puntero ni arrastre.
- La preview de una mención ya vinculada es distinta del autocompletado. El acceso a video/link abre directamente el reproductor, sin abrir antes otra ventana flotante.
- El reproductor se cierra con botón, Escape o click/tap fuera. Al cerrarlo no se abre automáticamente la preview de otra mención; se requiere una nueva acción explícita.
- Al escribir un ejercicio inexistente, un administrador puede crearlo desde el selector flotante. La creación debe usar el mismo contrato, permisos, validaciones y control de duplicados del catálogo; ante éxito vincula la mención al UUID recién creado. No dejar altas parciales.

## Seguridad y persistencia

- El alumno solo puede leer/escribir sus propios registros mediante la sesión y el vínculo UUID existentes; no aceptar `student_id` como autoridad del cliente.
- El servidor valida UUID, modo, pesos, repeticiones, series, límites y pertenencia del ejercicio a una rutina publicada propia al iniciar un registro.
- Historial y última sugerencia se filtran por identidad autenticada + UUID de ejercicio.
- RLS habilitada en toda tabla expuesta; permisos mínimos; escrituras atómicas e idempotentes donde corresponda.
- No usar service role en el navegador ni alterar Auth, invitaciones, pagos, vencimientos o notificaciones.
- No modificar migraciones históricas. La migración nueva debe generarse con Supabase CLI, probarse en fresh/upgrade/hosted-compatible local y auditarse antes de cualquier aplicación alojada.

## Criterios de aceptación

- Alumno A no puede leer ni escribir registros del alumno B, incluso con IDs ajenos manipulados.
- El último peso sugerido coincide con el UUID exacto, no con nombres iguales o renombrados.
- Un mismo ejercicio con varias apariciones en bloques comparte historial por UUID, pero cada sesión conserva sus series y valores.
- El registro rápido y el detallado persisten y aparecen en el historial después de recargar.
- Los objetivos publicados permanecen intactos.
- Una referencia a ejercicio por tiempo no ofrece entrada de kg.
- Texto libre: autocompletado solo con `@`, creación inline sin duplicados, selección por arrastre y asociaciones UUID preservadas al editar/copiar/pegar.
- Video: apertura directa desde la acción elegida; cierre exterior/Escape/botón sin reabrir previews adyacentes.
- Lint, typecheck, build, pruebas de API/UI, pgTAP y workflows de migraciones PASS en el HEAD exacto.

## Límites de entrega

La rama de trabajo es exclusiva de CUEVA-007. CUEVA-003B Vencimientos, CUEVA-005 Notificaciones y CUEVA-006E permanecen como baselines cerrados. La entrega queda en REVIEW hasta auditoría independiente. No mergear ni desplegar sin autorización explícita.


## Implementación en curso (2026-11-21)

La rama ya contiene una primera implementación de los siguientes componentes:

- Migración nueva `20261121120000_cueva_workout_tracking.sql`: tablas separadas de entradas y series; escrituras transaccionales; UUID de operación idempotente; verificación del alumno autenticado, publicación vigente, UUID del ejercicio y modalidad peso/tiempo; historial paginado por alumno + UUID.
- API autenticada `/api/entrenamientos`: no acepta identidad de alumno desde el cliente; limita y valida entradas antes de invocar RPC.
- Interfaz `StudentWorkoutLogger`: registro rápido, repetición de último peso, series con pesos/repeticiones diferentes e historial con carga de registros anteriores.
- Integración en rutinas estructuradas y menciones de texto. En bloques manda el modo del objetivo; en texto, la mención hereda `tracking_mode` del catálogo (`weight`/`time`), editable desde Ejercicios y también elegible al crear inline. Las modalidades por tiempo no muestran ni aceptan kg.
- Editor: autocompletado solo tras escribir `@`; panel y preview flotantes en portal, anclados al cursor/mención y limitados al viewport; creación de ejercicios inexistentes mediante el endpoint de catálogo ya existente; cierre explícito sin reapertura por hover/foco; selección nativa por arrastre y copia/corte/pegado que conserva UUID de menciones completas mediante metadatos de portapapeles con fallback HTML.
- Reproductor: cierre por botón, Escape y click fuera. La preview de menciones no se abre por hover/foco y no se reactiva al restaurar el foco tras cerrar el reproductor.
- Pruebas pgTAP y Playwright ampliadas para permisos, aislamiento, idempotencia, modo tiempo, paginación, selección de texto y registro desde menciones.

**Estado de validación:** los workflows del HEAD `f7548239e8ba8bee8288de5df28b4de01f8160ce` terminaron en PASS en las ejecuciones revisadas. La revisión integral posterior identificó mejoras pendientes de rendimiento, accesibilidad del panel y cobertura táctil específica para menciones de texto. La aceptación requiere validar nuevamente el HEAD que incorpore esas mejoras; no se aplicó ninguna migración alojada y no se hizo merge.


## Requisitos adicionales incorporados — 2026-11-21

### Colores de menciones en el perfil del alumno

- La rutina publicada debe conservar los mismos colores de fondo asignados a cada mención en la vista del administrador. No se permite aplicar un único color genérico a todas las menciones del alumno.
- La asignación visual debe ser estable para una misma publicación y respetar la identidad UUID de la mención; no recalcular colores de forma divergente entre la vista de administración y la vista del alumno.
- La validación debe cubrir texto libre, menciones repetidas y los casos en que dos ejercicios tengan nombres similares. Los colores son presentación, no autoridad ni identificador.

### Experiencia contextual «Ejercicios Mencionados»

- No mantener una sección independiente que repita el catálogo o la lista de menciones sin aportar acciones.
- Reemplazarla por acciones contextuales en cada ejercicio/mención dentro de la propia rutina: registro rápido de peso, detalle por series, sugerencia del último peso y acceso al historial del mismo UUID.
- En menciones de texto libre, el panel contextual debe mostrar también la descripción y el acceso al video/link, sin obligar a desplazarse a otra sección. En ejercicios por bloques, las mismas acciones deben estar disponibles junto al ejercicio.
- El historial detallado puede abrirse desde ese panel contextual; no debe duplicar una segunda lista general de «Ejercicios Mencionados».
- Si se conserva algún resumen de ejercicios mencionados, debe ser opcional y aportar una función concreta (por ejemplo, un índice navegable), no ser el lugar principal para registrar resultados.

### Persistencia de la ventana de video/preview

- La ventana emergente no debe cerrarse al mover el puntero desde el nombre del ejercicio hacia el panel de descripción/video. El área interactiva debe incluir tanto el disparador como el panel, sin huecos de hover que disparen el cierre.
- En desktop, el panel debe permanecer abierto mientras el puntero esté sobre el disparador o el propio panel; en móvil/tablet, debe abrirse por toque y permanecer hasta una acción explícita de cierre, selección de otra acción o toque fuera.
- El cierre por toque/click fuera y Escape debe seguir funcionando. Al pasar el puntero al panel no se considera una salida; al cerrar el reproductor no debe reaparecer automáticamente la preview.
- El acceso «Ver video» debe abrir directamente el reproductor, sin un ciclo intermedio de apertura/cierre de preview ni reactivación por foco.


### Resultados visibles directamente en la rutina

- Después de guardar un registro, el resultado real debe quedar visible junto al ejercicio en la propia rutina, sin exigir abrir nuevamente el panel contextual.
- El resumen debe ser discreto y compacto, y permanecer visible al cerrar el panel, recargar la página y volver a abrir la rutina.
- Para peso, mostrar el peso registrado y, cuando corresponda, un resumen de series/repeticiones. Para ejercicios por tiempo, mostrar la duración registrada (por ejemplo, planchas) y el detalle de duraciones por serie cuando existan.
- Los resultados reales deben tener una presentación visual diferenciada de los objetivos planificados por el administrador. Nunca reemplazar ni ocultar el objetivo original.
- El panel contextual sigue disponible para cargar/editar registros y consultar el historial; la rutina muestra un resumen sin obligar a entrar al panel.
- Los ejercicios por tiempo no deben mostrar ni aceptar campos de kilogramos. La persistencia debe almacenar duración en segundos con validación de límites y mostrar una unidad legible.

### Criterios de aceptación adicionales

- Una misma publicación muestra idénticos colores de mención en Admin y Alumno.
- Mover el cursor del nombre al panel emergente permite usar todos sus controles sin que desaparezca; en táctil, el panel no depende de hover.
- Se puede registrar peso/series e inspeccionar historial desde el propio ejercicio en ambos formatos de rutina, sin una sección redundante.
- Pruebas E2E deben verificar el trayecto del puntero hacia el panel, el toque en móvil, el click exterior, Escape y que el reproductor no reabra el panel al cerrarse.


## Revisión integral — 2026-11-23

### Validaciones verificadas en el HEAD `01641c8c9f9fd1394b9eed2538524e84229d7424`

- Migraciones Supabase: escenarios fresh, upgrade y hosted-compatible completados correctamente en CI.
- Verify foundation: existe una ejecución exitosa para este SHA, incluyendo `npm run verify`, `npm run verify:security`, auditorías de dependencias y controles de vulnerabilidades. Una ejecución PR separada fue cancelada durante la instalación/preparación y no se toma como PASS.
- SQL de membresías, unit tests de menciones, E2E autenticado de menciones y checks aislados CUEVA-006E: completados correctamente.
- E2E táctil: el flujo de menciones en viewport móvil verifica apertura de preview, acceso al reproductor y cierre por toque exterior.
- Colores: E2E compara el valor CSS `--mention-hue` de la misma publicación entre Admin y Alumno.
- Batching: E2E comprueba una única solicitud HTTP de resumen inicial y el conjunto de UUID únicos de la rutina.
- El panel contextual recibe foco al abrirse y conserva el cierre por Escape y por interacción exterior.

### Optimizaciones y límites pendientes

- El batching reduce solicitudes HTTP, pero el endpoint todavía ejecuta una llamada `cueva_workout_history` por UUID. Una RPC agregada set-based queda como optimización posterior; no bloquea la funcionalidad validada.
- No se ha realizado un benchmark cuantitativo de rutinas extensas. La cobertura actual verifica el agrupamiento de solicitudes, no un objetivo de latencia o carga.
- La validación descrita corresponde a los workflows y ejecuciones inspeccionados; no sustituye una revisión manual en dispositivos físicos ni autoriza integración.

### Estado de entrega

- PR #88 continúa abierta en Draft; no se ha mergeado ni desplegado.
- No se aplicaron migraciones a Supabase hosted.
- CUEVA-003B, CUEVA-005, CUEVA-006D y CUEVA-006E permanecen fuera del alcance y como baselines cerrados.

## Revalidación del HEAD documental — 2026-11-23

HEAD validado: `d5c803212f9eb629d08078eba755bde0bad7293b`.

Los cinco workflows asociados a este SHA finalizaron con conclusión `success`:

- Verify foundation — run `45304481523`.
- Supabase local migrations — run `45304481478`; jobs fresh, upgrade y hosted-compatible: success.
- Membership SQL — run `45304481479`.
- CUEVA-006E isolated checks — run `45304481556`.
- CUEVA-006E routine mentions E2E — run `45304481538`.

Los jobs relevantes inspeccionados finalizaron correctamente. Esta evidencia actualiza la validación previa del HEAD funcional `01641c8c9f9fd1394b9eed2538524e84229d7424` y confirma que el commit documental también pasó los workflows PR-triggered revisados.

La RPC agregada set-based y el benchmark cuantitativo continúan como optimizaciones no bloqueantes. PR #88 permanece abierta en Draft; no se hizo merge, deploy ni aplicación de migraciones a Supabase hosted.


## Correcciones de auditoría — 2026-11-24 — REVIEW

Base main: `425e23aa3e5d28a1d2ba08c41084e5bba021f297`, ya incluida en el
candidato recibido `368709119d14e7bc01aeb1a0e8a53fed45f7f81b`. No hay conflicto
ni necesidad de reescribir los commits anteriores de #88.

- GET retenido reproducido en el componente real: escribir 80 y liberar una
  respuesta con último valor 50 dejaba el campo en 50. Peso y duración ahora
  distinguen sugerencias de campos editados: las respuestas solo inicializan
  valores intactos. Escribir, vaciar, usar una sugerencia o editar historial
  conserva el control del borrador incluso tras guardar.
- Las lecturas llevan una versión. Una consulta completa más reciente, una
  escritura o el cambio de identidad de ejercicio/publicación invalida las
  respuestas anteriores. Un resumen previo al guardado no sustituye al resultado
  actualizado ni escribe sobre sus campos. Los errores obsoletos también se ignoran.
- El batch conserva deduplicación por UUID y divide las solicitudes en grupos
  de hasta 100. El endpoint conserva su validación de máximo 100; una rutina con
  300 UUIDs genera tres solicitudes. El fallo de un grupo no rechaza los otros.
  No se agrega una RPC ni se altera API, permisos o datos.

Pruebas nuevas: `tests/e2e/workout-logger.spec.ts` usa Next y el componente real
con respuestas sintéticas retenidas en Chromium. Ocho escenarios: resumen e
historial tardíos, resumen anterior liberado después de guardar, y edición
mientras el historial posterior al guardado sigue pendiente, para peso y tiempo.
Se demostró RED 80→50 antes del arreglo y GREEN 8/8 después.
`tests/workout-summary-batch.test.mjs` ejecuta el batch y el cuerpo real del GET
con Auth/RPC sintéticos: 100/101/300, error de un grupo/reintento y rechazo directo
de más de 100 en API. Antes 3 fallos; después 5/5. Se integra en
`test:routines:api`. No se atribuye este ensayo sintético a Auth/RLS alojados.

Verificación local nueva: navegador 8/8, batch 5/5, API rutinas 3/3, menciones
12/12; lint, tipos y build aprobados. Documentos, fuentes, manifiesto, seguridad
y diff se verifican antes de la entrega. La CI del HEAD final queda registrada
en #88. Los resultados históricos de este documento corresponden solo a sus
SHAs; el rerun receipt-storage del candidato previo fue informado SUCCESS por
el Orchestrator y no se reutiliza como prueba del nuevo HEAD.

### Secuencia de publicación pendiente (no ejecutada)

1. Auditar y aprobar el HEAD exacto. Confirmar main y que el esquema previo
   coincide con sus migraciones, incluidas dependencias de 006E; no deducirlo
   únicamente del número de entradas del historial. El Orchestrator reportó
   33 migraciones alojadas, sin tablas de entrenamiento ni RPC de registro personal.
2. Con autorización operativa separada, preflight/backup y aplicación controlada
   de `20261121120000_cueva_workout_tracking.sql`, SHA256 de bytes Git:
   `c1e5b00f4309fac22f06f5741429d596af37b282e758f6584124920f4148aa3d`.
   Verificar `tracking_mode`, tablas, RPC, RLS/grants y ausencia de cambios en
   objetivos publicados. Esta corrección no modifica esa migración ni ninguna
   histórica. No aplicar migraciones del #83 como dependencia del #88.
3. Publicar la aplicación solo después de verificar el esquema requerido.
   Comprobar registro/historial con alumnos sintéticos autorizados y aislamiento.
   La matriz CI fresh/upgrade/hosted-compatible es evidencia local, no aplicación
   alojada ni autorización de escritura.
4. Rollback conservador: retirar el código de la funcionalidad si falla la prueba;
   conservar entradas/historial y el esquema aditivo. No borrar datos ni revertir
   SQL destructivamente. Registrar cualquier operación posterior por separado.

Sin merge, deploy, SQL, flags ni envíos alojados. No se reinició Docker ni se
intervino en contenedores de otros proyectos. La fixture retira solo su proceso
y directorio temporal; la entrega no deja un servidor de laboratorio activo.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`vercel:react-best-practices` (actualizaciones funcionales, efectos y respuestas
obsoletas; revisión del diff React). SKILL_SOURCES:
`.agents/skills/cueva-feature-development/SKILL.md` y guía React del host.

## Revalidación posterior a correcciones de video — 2026-11-24

HEAD funcional validado: `368709119d14e7bc01aeb1a0e8a53fed45f7f81b`.

Correcciones cubiertas por este candidato:

- La validación SQL de rutas de video acepta MP4, MOV y WebM, con UUID canónico y extensión permitida.
- La validación SQL de YouTube queda alineada con TypeScript: admite `youtube.com` con o sin `www`, además de `youtu.be`, y rechaza parámetros adicionales o fragmentos.
- Se agregaron casos SQL y unitarios para formatos/extensiones y variantes de URL válidas e inválidas.

### GitHub Actions del HEAD exacto

Los jobs pertinentes consultados finalizaron con `success`:

- Verify foundation — run `45388302691`, job `verify`.
- Supabase local migrations — run `45388302825`: fresh, upgrade y hosted-compatible.
- CUEVA-006E isolated checks — run `45388302680`, job Routine mentions unit tests.
- CUEVA-006E routine mentions E2E — run `45388302679`, job Authenticated routine mentions E2E.
- Membership SQL — run `45388302735`, job específico `membership-sql`.

**Salvedad:** el workflow agregado Membership SQL reportó conclusión `failure`, aunque el job `membership-sql` inspeccionado terminó `success`. No se inspeccionó `receipt-storage`, que permanece fuera del alcance; por tanto no se atribuye el fallo agregado a CUEVA-007 ni se afirma que el workflow completo haya pasado.

Esta evidencia confirma los jobs relevantes del SHA indicado; no se extrapola a otros commits ni reemplaza pruebas en dispositivos físicos o validaciones alojadas.

### Estado de entrega actualizado

- Las correcciones de validación de video/YouTube y sus jobs pertinentes están aprobados por CI en el HEAD indicado.
- La limpieza automática de videos huérfanos continúa como mejora pendiente; no se incorpora borrado automático sin política de retención y protección frente a asociaciones concurrentes.
- PR #88 permanece abierta en Draft. No se hizo merge, deploy ni aplicación de migraciones a Supabase hosted.
- CUEVA-003B, CUEVA-005, CUEVA-006D y CUEVA-006E continúan como baselines cerrados y fuera del alcance de cambios.
