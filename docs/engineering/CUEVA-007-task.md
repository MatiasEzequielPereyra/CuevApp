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
