CUEVA-ALUMNOS-001 — Gestión administrativa de alumnos

Actuá como CODEX EXECUTOR de CUEVA. Implementá este incremento y entregalo en REVIEW al Orchestrator.

BASE_SHA verificado:
fa87f778287434dbad016435b28b7d895a05f90e

BRANCH:
codex/cueva-alumnos-001

MODEL_RECOMMENDATION:
- Modelo: Sol.
- Razonamiento: Alto.
- Alternativa: Astra, Alto, si aparece un problema específico de permisos.
- Complejidad: media.
- Riesgo principal: autorización y aislamiento de datos.

1. CONTEXTO Y PREPARACIÓN

Leé AGENTS.md, checkpoint y el orden de README. Usá las habilidades pertinentes de Supabase y las guías de la versión instalada de Next.js antes de escribir código.

Verificá ruta, estado del checkout y origin/main. Reutilizá un checkout adecuado, conservando cualquier trabajo ajeno. Si main avanzó, revisá los cambios y declar á la base efectiva.

CUEVA-UI-001 está integrada mediante PR #21 y publicada. El usuario aprobó su apariencia: conservá ese estilo.

Referencias:
- docs/brand/panel-admin-mockup.png
- docs/engineering/CUEVA-UI-001-audit.md
- docs/product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md
- docs/architecture/decisions.md

Las instrucciones posteriores prevalecen:
- Correo obligatorio para todos.
- DNI opcional como dato administrativo; no sirve para iniciar sesión.
- Invitación y contraseña propia; sin registro público.
- Nico ya existe como administrador. No repetir bootstrap ni modificar su cuenta.
- Correo temporal solo propietario: invitaciones y recuperación de alumnos continúan bloqueadas.

2. OBJETIVO

Permitir que un administrador registre, busque, consulte y edite fichas de alumnos, con persistencia real y una interfaz coherente con el panel aprobado.

La ficha administrativa puede existir antes de que el alumno tenga acceso a la aplicación. Guardar una ficha no debe crear una cuenta Auth ni enviar un correo.

3. ALCANCE FUNCIONAL

Listado de alumnos:
- Acceso desde la navegación y el panel existente.
- Búsqueda por nombre, apellido, correo o DNI disponible.
- Estados de carga, vacío, error y búsqueda sin resultados.
- Acción «Nuevo alumno» y acceso a la ficha individual.
- Presentación adecuada para computadora y celular.

Alta y edición:
- Nombre y apellido.
- Correo obligatorio.
- DNI opcional.
- Fecha de alta.
- Estado administrativo activo/inactivo, claramente separado del estado de pago.
- Validaciones comprensibles, conservación de lo escrito ante errores y confirmación de guardado.
- Protección contra duplicados de correo y DNI cuando exista.
- Un doble envío no debe crear fichas duplicadas.

Ficha individual:
- Identidad y datos administrativos.
- Acción para editar y navegación de regreso.
- Pagos, rutina y comprobantes identificados como pendientes.
- No inventar saldos, vencimientos, historial ni estados «Al día» o «Vencido».

Integración:
- Reutilizar el diseño, navegación, logo, temas y controles existentes.
- Actualizar el resumen de alumnos con datos reales solo cuando exista una definición clara del indicador.
- No reemplazar el panel ni construir otra interfaz visual independiente.

4. PERSISTENCIA Y PERMISOS

Prepará la migración versionada y probala únicamente en un entorno local aislado.

- Identificador interno estable.
- Restricciones y normalización coherentes entre aplicación y base.
- Identidad administrativa diferenciada de la cuenta de acceso.
- Cualquier vínculo futuro con Auth debe ser único y verificable; no asociar cuentas automáticamente solo por coincidencia de correo.
- RLS y privilegios mínimos.
- Autorización basada en el perfil y los controles de sesión existentes, nunca en metadatos editables.
- Verificar permisos en servidor y base; ocultar botones no es suficiente.
- Evitar secretos en navegador, repositorio, capturas o registros.
- Manejar de forma controlada una migración todavía no aplicada.

Entregá instrucciones concretas para la aplicación posterior de la migración por el Orchestrator. No la ejecutes en Supabase alojado.

5. FUERA DE ALCANCE

Sin cambios en autenticación, SMTP, roles o cuentas reales.
Sin invitaciones ni correos.
Sin pagos, cuotas, comprobantes, rutinas o videos operativos.
Sin eliminación definitiva de alumnos.
Sin datos médicos, fotos obligatorias ni campos adicionales innecesarios.
Sin servicios pagos, actualizaciones generales de dependencias o refactorizaciones ajenas.
Sin push, PR, merge, despliegue ni escrituras remotas.

6. VERIFICACIÓN ACOTADA

Comprobá:
- Alta, consulta, búsqueda y edición con persistencia tras recargar.
- Duplicados, datos inválidos, doble envío y errores de guardado.
- Administrador autorizado frente a visitante y alumno sin permiso, incluyendo solicitudes directas y consulta por identificador.
- Permisos reales de la base local; los mocks no acreditan RLS.
- Conservación del acceso, cierre de sesión y restricciones de correo existentes.
- Celular y computadora, ambos temas y navegación por teclado.
- Controles habituales del repositorio y revisión de seguridad.

Usá datos sintéticos exclusivamente en pruebas. No repitas los laboratorios completos de identidad ni agregues infraestructura de pruebas si podés reutilizar la existente.

7. DOCUMENTACIÓN Y ENTREGA

Versioná este encargo, la decisión de modelo de datos, la migración, el informe y capturas. Actualizá backlog y checkpoint sin alterar las fuentes originales.

Entregá CODEX_TO_ORCHESTRATOR_HANDOFF_V1 con:
TASK_ID, BASE_SHA, HEAD_SHA, BRANCH, FILES_CHANGED, IMPLEMENTATION_SUMMARY, TEST_RESULTS, SECURITY_RESULTS, KNOWN_LIMITATIONS, EVIDENCE, WORKTREE_STATUS, DEPLOYMENT_STATUS y RISKS.

Distinguí implementación local, revisión, migración alojada y publicación.

Estado final esperado: REVIEW.
La integración, aplicación remota y publicación corresponden al Orchestrator.