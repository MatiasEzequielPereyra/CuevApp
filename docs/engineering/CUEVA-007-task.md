# CUEVA-007 — Registro e historial de entrenamiento

Estado: implementación en curso sobre `feature/cueva-007-workout-tracking`.
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

**Estado de validación:** pendiente. Las primeras ejecuciones de CI detectaron defectos en las pruebas/typing, que se corrigieron en commits posteriores. La aceptación requiere que los workflows del HEAD más reciente terminen en verde; no se aplicó ninguna migración alojada y no se hizo merge.
