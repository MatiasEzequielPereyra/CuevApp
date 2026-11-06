Actuá como CODEX EXECUTOR de CUEVA.

TASK_ID: CUEVA-006A
OBJETIVO: implementar la sección Rutinas, con editor libre tipo Google Keep, borrador autoguardado, publicación explícita, plantillas y consulta del alumno.

RAMA: codex/cueva-006a-rutinas
BASE DE REFERENCIA: fb801dd557a8cb45b25d12cffc0170bd7e1ff79c
Verificá origin/main antes de comenzar y declarará la base efectiva si avanzó.

Leé AGENTS.md y seguí el orden del README. Para este incremento, priorizá el cierre vigente del checkpoint y las secciones 11–12 del contexto maestro. Conservá el diseño aprobado del panel, logo SVG, temas y navegación móvil. Consultá las guías instaladas de Next.js y la documentación vigente de Supabase que corresponda.

## 1. Administración de rutinas

- Habilitar la sección Rutinas y el acceso desde la ficha del alumno.
- Buscar/seleccionar alumnos existentes.
- Una única nota principal por alumno, con toda su rutina.
- Editor de texto libre que conserve saltos de línea y permita organizar por días o secuencias.
- No imponer formularios por ejercicio ni interpretar automáticamente el texto.
- Mantener la rutina vigente hasta una nueva publicación.

El editor debe mostrar claramente:
- Sin cambios.
- Guardando.
- Borrador guardado.
- Error de guardado, con recuperación sin perder lo escrito.
- Existencia de cambios todavía sin publicar.

El autoguardado debe persistir en la base. No mostrar “guardado” antes de recibir confirmación ni permitir que respuestas antiguas sobrescriban cambios nuevos. Resolver conflictos entre pestañas o administradores sin pérdida silenciosa.

## 2. Publicación

- Acción explícita “Publicar rutina”.
- El alumno ve únicamente la última versión publicada.
- Editar un borrador no modifica lo que ve el alumno.
- Publicar debe guardar una versión consistente del contenido elegido y registrar autor y fecha desde el servidor.
- Conservar versiones publicadas anteriores; no hace falta construir una pantalla de historial en esta entrega.
- No publicar silenciosamente una versión anterior si hay cambios pendientes de guardar.
- Reintentos o doble clic no deben duplicar publicaciones.
- Publicar no envía emails ni notificaciones.

## 3. Plantillas

- Crear, listar y editar plantillas de texto.
- Aplicar una plantilla genera una copia independiente en el borrador del alumno.
- Confirmar antes de reemplazar un borrador con contenido.
- Aplicar una plantilla no publica automáticamente.
- Editar la plantilla o la rutina de otro alumno no altera copias existentes.

## 4. Consulta del alumno

- Habilitar “Mi rutina” desde su cuenta y navegación.
- Mostrar la última rutina publicada y su fecha.
- Sin rutina publicada: estado vacío comprensible.
- El alumno no puede editar planificación, acceder a borradores, plantillas ni rutinas ajenas.
- Reutilizar el vínculo ficha–Auth confiable existente; no asociar identidades únicamente por coincidencia de email.
- Conservar los controles actuales de sesión y primer acceso.
- No bloquear rutinas automáticamente por deuda.

## 5. Seguridad e integración

- Autorización en servidor y base, con RLS y privilegios mínimos.
- No confiar en alumno, rol o autor enviados por el navegador.
- No usar service role para eludir permisos.
- Renderizar el texto de manera segura, sin HTML arbitrario.
- No introducir caché compartida que exponga rutinas privadas.
- Migración nueva y versionada; no editar migraciones históricas.
- Verificar que eliminar una ficha no borre silenciosamente rutinas o publicaciones: mantener la eliminación limitada a fichas realmente vacías.
- Conservar acceso, alumnos, pagos e invitaciones existentes.
- Sin cambios de SMTP, proveedores, cuentas reales ni configuración alojada.

## 6. Fuera de alcance

Biblioteca de ejercicios, videos, ejercicios estructurados, registro de entrenamientos, recordatorios, comprobantes y lectura offline.

Estos elementos siguen pendientes del MVP; no simularlos ni marcarlos implementados.

## 7. Verificación acotada

Reutilizar el laboratorio existente con aplicación, Auth y base locales reales.

Comprobar:
- Autoguardado y persistencia al recargar.
- Borrador privado y publicación visible para el alumno correcto.
- Nueva edición conserva la publicación anterior hasta publicar.
- Plantillas independientes.
- Errores de guardado, conflictos, doble envío y publicación con cambios pendientes.
- Denegación por solicitudes directas para visitante, alumno ajeno y sesión no habilitada.
- Contenido tratado como texto seguro.
- Eliminación de fichas sin pérdida de rutinas.
- Recorrido principal en móvil y computadora, temas y teclado.

Ejecutar lint, tipos, build y verificaciones documentales/seguridad pertinentes. No repetir laboratorios completos de identidad, transporte o SMTP ni matrices ajenas al cambio.

## 8. Entrega

Versionar este encargo, modelo, migración, pruebas e informe con capturas.

Entregar CODEX_TO_ORCHESTRATOR_HANDOFF_V1 con:
TASK_ID, BASE_SHA, HEAD_SHA, BRANCH, FILES_CHANGED, IMPLEMENTATION_SUMMARY, TEST_RESULTS, SECURITY_RESULTS, KNOWN_LIMITATIONS, EVIDENCE, WORKTREE_STATUS, DEPLOYMENT_STATUS y RISKS.

Estado esperado: REVIEW.
Distinguir evidencia local de funcionamiento alojado.

Sin push, PR, merge, deploy ni escrituras remotas. El Orchestrator auditará e integrará; las correcciones de implementación vuelven al ejecutor.