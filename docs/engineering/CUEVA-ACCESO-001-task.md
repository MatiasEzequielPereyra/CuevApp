# CUEVA-ACCESO-001 — entrada principal y login visual

Estado: READY FOR EXECUTOR; implementación no iniciada por este documento.
Base verificada: `fa87f778287434dbad016435b28b7d895a05f90e`.
Rama: `codex/cueva-acceso-001`.
Modelo recomendado: Sol, razonamiento Medio; alternativa Sol Alto si surge una
interacción concreta de sesión. Complejidad media; riesgo acotado de regresión
de entrada. No se reemplaza el mecanismo de autenticación.

## Preparación

Leer AGENTS.md, checkpoint y el orden de README, además del
[roadmap paralelo](parallel-roadmap.md). Confirmar la base remota y usar un checkout
limpio distinto del ejecutor de Alumnos y de esta rama de planificación. Conservar
cambios ajenos. Consultar las guías de Next instaladas antes de implementar.
Si main avanzó, verificar compatibilidad y declarar la base efectiva.

Referencias: `docs/brand/panel-admin-mockup.png`, logo SVG existente, panel aprobado
por el usuario y `docs/architecture/decisions.md`. El acceso vigente es por correo
obligatorio y contraseña propia; DNI y contraseña temporal son antecedentes.

## Resultado esperado

- Al abrir `/`, dejar de mostrar la presentación «En construcción» y entrar al
  flujo real de ingreso. Preferir una redirección simple a `/ingresar`.
- Diseñar `/ingresar` según el mockup y el panel aprobado: SVG con protagonismo,
  tarjeta de acceso, correo, contraseña, botón y temas claro/oscuro/sistema.
- Reutilizar el POST existente `/api/acceso/ingresar`. El mecanismo, validaciones
  de servidor, cookies, gate de activación, roles y destinos no se reimplementan.
- Mensajes comprensibles de error, estado de envío y prevención de doble envío;
  no mostrar errores internos ni revelar si existe una cuenta. Contraseña solo en
  memoria/formulario; nunca URL, logs o almacenamiento del navegador.
- Continuar a `/cuenta` tras un ingreso correcto. Si se evita repetir el formulario
  para una sesión existente, comprobar su habilitación usando los controles de
  servidor actuales y evitar bucles de redirección o contenido privado cacheado.
- Sin enlace de registro público. Mientras el correo general no esté habilitado,
  recuperación se comunica honestamente con orientación para contactar al gimnasio;
  no presentar una acción que aparente enviar un correo.
- Fuera de Production o sin configuración válida, mostrar un estado controlado
  sin habilitar acceso ni prometer que el formulario funciona. Sin bucle `/`–login.
- Teclado, foco, etiquetas y autocomplete correctos; diseño sin desbordamientos en
  celular y computadora. No agregar splash obligatorio que demore el ingreso.

## Archivos y límites de concurrencia

Propios: `src/app/page.tsx`, `src/app/ingresar/page.tsx`, componentes bajo
`src/components/access/`, un CSS Module propio y pruebas de entrada necesarias.
Adaptar las pruebas de la antigua landing a la nueva entrada conservando la
cobertura útil de marca, temas y accesibilidad; no mantener requisitos obsoletos.

No modificar `globals.css`, dashboard/navegación de Alumnos, rutas de alumnos,
Auth API, `src/lib/product-auth`, proxy, migraciones, dependencias, secretos,
correo ni configuración alojada. Si aparece una necesidad real fuera de estos
límites, entregar el hallazgo acotado sin cambiar esos archivos por iniciativa propia.

## Pruebas y entrega

Verificar raíz → login, identidad y temas, teclado, errores y estado de envío con
respuestas controladas del endpoint existente. No confundir esa muestra con una
sesión real. Comprobar continuación y ausencia de bucles mediante el entorno
local existente cuando sea posible, sin repetir todos los laboratorios de identidad.
Si falta una sesión real, indicarlo NOT_RUN y conservar el resto de la entrega.

Ejecutar controles habituales pertinentes una vez sobre el candidato final;
repetir únicamente tras cambios o fallos relevantes. No guardar credenciales ni
artefactos de sesión. Usar datos ficticios solo en pruebas. Sin nuevas cuentas reales.

Entregar capturas de celular y computadora, informe, limitaciones y
CODEX_TO_ORCHESTRATOR_HANDOFF_V1 con TASK_ID, BASE_SHA, HEAD_SHA, BRANCH,
FILES_CHANGED, IMPLEMENTATION_SUMMARY, TEST_RESULTS, SECURITY_RESULTS,
KNOWN_LIMITATIONS, EVIDENCE, WORKTREE_STATUS, DEPLOYMENT_STATUS y RISKS.
Documentar en un informe propio; el Orchestrator concilia checkpoint/backlog para
evitar que dos ejecutores los editen simultáneamente.

Estado final REVIEW. Sin push, PR, merge, deploy, escritura remota ni envío de
mensajes. El Orchestrator realiza integración y publicación tras la revisión.
