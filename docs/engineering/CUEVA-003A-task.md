CUEVA-003A — Cuotas y pagos administrativos

Actuá como CODEX EXECUTOR de CUEVA. Implementá este incremento y entregalo en REVIEW al Orchestrator.

BASE_SHA verificado:
0751e2f8d95978cf88ee5587ac2242497347c021

RAMA:
codex/cueva-003a-payments

MODELO RECOMENDADO:
Sol, razonamiento Alto. Complejidad media/alta por consistencia económica y permisos.

1. PREPARACIÓN Y CONCURRENCIA

Leé AGENTS.md, checkpoint y el orden de README. Revisá especialmente las reglas confirmadas de cuotas y pagos del contexto maestro, el modelo de alumnos y el marco administrativo existente.

Verificá origin/main y declar á la base efectiva si avanzó. Trabajá en un checkout adecuado, conservando cambios ajenos.

Alumnos ya está integrado. Sus fichas tienen identidad independiente de Auth.

Acceso está en otro chat: no modificar raíz, /ingresar, componentes access ni sus pruebas. No cambiar Auth, correo, roles o cuentas.

2. OBJETIVO

Permitir que Nico gestione cuotas mensuales y registre pagos reales desde el panel, manteniendo historial, saldos exactos y permisos de administrador.

Primera entrega administrativa: no habilita todavía consultas económicas desde cuentas de alumnos.

3. FUNCIONALIDAD

Cuota general:
- Configurar el precio mensual general en pesos argentinos.
- Sin múltiples planes de membresía.
- Explicitar desde qué períodos posteriores se aplica un cambio.
- Conservar importes, pagos y deudas de períodos ya creados.

Períodos por alumno:
- Crear explícitamente un período mensual con importe y vencimiento individual.
- Impedir duplicados del mismo período.
- Relacionarlo con la ficha existente, sin crear cuentas Auth.
- Permitir que Nico decida conservar o cambiar el vencimiento al renovar.
- No imponer renovación automática, intereses, recargos o bloqueo por deuda.

Pagos:
- Registrar importe, fecha, medio y período correspondiente.
- Medios: efectivo, transferencia u otro.
- Admitir pagos completos, parciales y varios movimientos para el mismo período.
- Guardar estado y administrador que confirmó, determinados de forma confiable.
- Mostrar total, pagado y saldo pendiente, separados del estado activo/inactivo del alumno.

Historial y correcciones:
- Conservar movimientos originales.
- Corregir mediante anulación o reverso trazable, con motivo, fecha y administrador.
- No borrar ni sobrescribir silenciosamente movimientos confirmados.
- Recalcular correctamente el saldo después de una anulación.

Interfaz:
- Sección Pagos usando el mismo marco, temas y navegación aprobados.
- Buscar o seleccionar alumno, consultar períodos e historial y registrar pagos.
- Acceso desde la ficha del alumno y desde la navegación principal.
- Estados vacíos, carga, errores y confirmación comprensibles.
- Conservar datos del formulario ante errores.
- No publicar cifras ficticias.

Anticipos y saldos a favor quedan fuera de este incremento. No distribuir excedentes automáticamente ni inventar reglas: una operación no cubierta debe detenerse con explicación clara.

4. CONSISTENCIA Y SEGURIDAD

- Importes exactos; no usar aritmética binaria de coma flotante para saldos.
- Reintentos y doble envío no deben duplicar movimientos.
- Misma clave de operación con datos distintos debe rechazarse.
- Resolver escrituras concurrentes mediante operaciones atómicas y restricciones de base.
- Validar importes, fechas, identificadores y pertenencia del período al alumno.
- Fechas del gimnasio en America/Argentina/Buenos_Aires.
- Autorización en servidor y base mediante perfil admin y sesión habilitada existentes.
- No confiar en roles, actor o saldos enviados por el navegador.
- RLS y privilegios mínimos; sin acceso económico de visitantes o alumnos.
- No usar service role para sustituir controles de autorización.
- No introducir secretos en código, evidencias o registros.

Prepará migración versionada y probala en entorno local aislado. No modificar la migración histórica de Alumnos ni ejecutar SQL alojado.

Documentá el modelo, las invariantes, la aplicación posterior y una recuperación que preserve historiales.

5. FUERA DE ALCANCE

Sin cobros online, facturación fiscal, comprobantes adjuntos, Storage, recordatorios, SMTP, invitaciones, rutinas o cambios de autenticación.

Sin actualización general de dependencias, refactorizaciones ajenas, datos reales de prueba ni operaciones remotas.

6. VERIFICACIÓN ACOTADA

Comprobar con aplicación y base locales reales:
- Precio nuevo sin alterar períodos históricos.
- Creación de período y prevención de duplicados.
- Pagos completos y parciales, historial y saldos.
- Reintentos, doble envío y concurrencia.
- Anulación trazable y saldo resultante.
- Datos inválidos, errores y conservación del formulario.
- Administrador autorizado; alumno y visitante rechazados, también mediante solicitudes directas.
- Persistencia tras recargar.
- Celular/computadora, temas y teclado.

Reutilizá el entorno de pruebas existente y coordiná su compatibilidad con Acceso. No repetir laboratorios completos de identidad ni suites aprobadas sin cambios relevantes. Distinguir pruebas locales, mocks y comprobaciones alojadas.

7. ENTREGA

Versioná este encargo, modelo, migración, informe y capturas. Conservá las fuentes originales.

Entregá CODEX_TO_ORCHESTRATOR_HANDOFF_V1:
TASK_ID, BASE_SHA, HEAD_SHA, BRANCH, FILES_CHANGED, IMPLEMENTATION_SUMMARY, TEST_RESULTS, SECURITY_RESULTS, KNOWN_LIMITATIONS, EVIDENCE, WORKTREE_STATUS, DEPLOYMENT_STATUS y RISKS.

Estado final esperado: REVIEW.

Sin push, PR, merge, despliegue, escrituras remotas ni mensajes.

El Orchestrator audita. Si encuentra problemas, devolverá un handoff para que vos corrijas; no realizará las correcciones desde su chat.