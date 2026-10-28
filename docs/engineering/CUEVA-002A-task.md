# CUEVA-002A — Viabilidad y diseño de identidad DNI/email

Actuá como CODEX EXECUTOR de CUEVA. Entregá una propuesta técnica verificable
para revisión del ORCHESTRATOR; esta tarea no implementa autenticación.

TASK_ID: CUEVA-002A. Estado de preparación: READY.

## Modelo recomendado

MODEL_RECOMMENDATION:
- MODEL: gpt-6-astra.
- REASONING_EFFORT: high.
- ALTERNATIVE: gpt-6.1-sol / high.
- REASON: decisión de arquitectura con identidad, recuperación y permisos sensibles.
- COMPLEXITY: alta.
- SECURITY_RISK: alto para la futura implementación; esta entrega es documental.
- EXPECTED_EFFICIENCY: resolver primero el mecanismo y sus límites evita implementar
  un flujo inseguro o incompatible con alumnos sin correo.

La recomendación no cambia automáticamente el modelo del chat. Si corresponde,
seleccionarlo manualmente antes de ejecutar.

## Base, lectura y límites

Repositorio: https://github.com/MatiasEzequielPereyra/CuevApp
Directorio: `C:\Users\pereyram\Desktop\CuevApp`.
BASE_SHA de fundación verificado: `064cbfaadc3c68145adb2411989584bbc32782c5`.

Antes de editar: comprobar ruta física, instrucciones AGENTS.md, limpieza, ramas
y remoto; leer [checkpoint](checkpoint.md) y el orden de [README](../../README.md).
Leer el maestro, protocolo, decisiones y auditoría. Obtener origin/main actual.
Este encargo se publica en un commit documental posterior a la base indicada:
usar como BASE_SHA de ejecución el main real verificado y registrar el delta.
Solo continuar si el delta desde la fundación es documentación/evidencia de
continuidad. Si cambió runtime, dependencias, pruebas o configuración, informar
la divergencia antes de adaptar el encargo. Nunca sustituir la base silenciosamente.

Crear rama `codex/cueva-002a-identity-design` desde esa base limpia. Preservar
trabajo ajeno. Leer skills pertinentes, especialmente Supabase y documentación
para agentes; consultar documentación oficial actual para afirmaciones técnicas.

El acceso al proyecto Supabase `vbkzoojkdkcugxhneyzi` permanece NOT_VERIFIED.
No reintentar conexiones al proyecto ni usar Mozilla. Sí se permite consultar
documentación pública oficial. No introducir credenciales, crear servicios,
contratar planes, instalar infraestructura ni ejecutar SQL remoto.

## Contrato de producto inalterable

- Alta exclusivamente administrativa, con DNI, email o ambos; al menos uno.
- Una misma cuenta y contraseña admite cualquiera de sus identificadores asociados.
- El alumno puede existir y acceder sin correo. No convertir email o teléfono en
  requisito obligatorio, ni inventar direcciones como atajo para cumplir una API.
- Contraseña temporal individual, cambio obligatorio antes de acceso funcional.
- El administrador puede iniciar/restablecer acceso; describir un procedimiento
  seguro también cuando no hay email. No inventar canales de entrega aceptados.
- Nico y su socio administran; Nico configura permisos del socio. Autorización
  efectiva en servidor y datos, no solo mediante controles ocultos en la interfaz.
- Conservar identidad estable e historial al agregar/cambiar identificadores.

## Trabajo y entregables

Crear `docs/architecture/identity-feasibility.md` y una propuesta D007 en el
[registro de decisiones](../architecture/decisions.md). D007 debe quedar PROPOSED.
Actualizar checkpoint/backlog con el avance de CUEVA-002A, preservando la aceptación
de CUEVA-001A y su integración. No modificar fuentes originales ni evidencia histórica.

1. Investigar las capacidades documentadas actuales de Supabase Auth para usuarios,
   identidades, contraseña, SSR/sesiones y APIs administrativas. Registrar URLs
   primarias, fecha de consulta, versiones relevantes y citas breves cuando ayuden.
   Separar soporte documentado, inferencia, prueba local y proyecto remoto no verificado.
2. Comparar opciones que preserven el contrato. No presuponer que un alias interno,
   una tabla de perfiles o un broker de login resuelve por sí solo el requisito.
   Analizar dónde vive la contraseña, quién la verifica y cómo se obtiene una sesión
   válida sin exponer poderes administrativos. No diseñar criptografía propia.
3. Recomendar una opción con razones, límites, costo y dependencias. Si no puede
   demostrarse una vía segura compatible, entregar el bloqueo preciso y la mínima
   decisión del propietario; no relajar requisitos ni marcar factibilidad PASS.
4. Diagramar el ciclo de alta, entrega inicial, primer cambio, login por cada
   identificador, asociación/cambio de email, recuperación y revocación. Distinguir
   email para acceso, email verificado y email habilitado para recordatorios.
5. Definir invariantes de normalización/unicidad, colisiones entre cuentas, carreras,
   DNI inválido, email ya ocupado y preservación de identidad/historial. Identificar
   decisiones de producto realmente pendientes sin convertir supuestos en requisitos.
6. Describir amenazas y controles: enumeración de DNI, fuerza bruta, rate limiting,
   logs sin identificadores/contraseñas, claves privilegiadas solo en servidor,
   sesiones y cookies, CSRF, privilegios, RLS y bloqueo del acceso hasta cambio inicial.
7. Entregar matriz de pruebas para alumno/Nico/socio con permisos distintos: permitir
   operaciones propias y denegar ajenas; cuenta sin email, ambos identificadores,
   contraseña temporal/reutilizada, reset/revocación, colisiones y fallos parciales.
   Diseñar pruebas futuras con sesiones genuinas y fixtures no vacíos. Documentación
   o mocks no prueban denegaciones reales ni RLS del proyecto alojado.
8. Proponer un único incremento de implementación posterior, acotado y con criterios
   verificables. Identificar qué requiere acceso remoto o decisión humana primero.

Se admite una comprobación local desechable de comportamiento puro si aporta
evidencia concreta, sin cambiar aplicación, dependencias o infraestructura. No
introducir una implementación de Auth bajo el nombre de prueba. Documentar NOT_RUN
cuando la comprobación dependa del servicio inaccesible.

## Verificación y aceptación de esta entrega

- Requisitos trazados a la propuesta o a un bloqueo explícito, sin email ficticio
  ni email obligatorio, almacenamiento casero de contraseñas o exposición de claves.
- Afirmaciones de capacidad apoyadas en fuentes primarias verificables; incertidumbre
  y supuestos visibles. Un diseño propuesto no equivale a autenticación aceptada.
- Cambios exclusivamente documentales y eventual evidencia local acotada.
- Ejecutar `npm run test:docs`, `npm run verify:sources`, `npm run verify:security`
  y `git diff --check`. No es necesario repetir navegador/build por documentos;
  informar las pruebas no repetidas y referenciar la evidencia previa correctamente.
- Revisar diff completo, integridad de originales, ausencia de secretos y enlaces.
- Crear commit local y entregar REVIEW; no push, PR, merge, despliegue, migraciones
  ni cambios de configuración remota en este encargo. El Orchestrator publica tras auditar.

## Handoff obligatorio

CODEX_TO_ORCHESTRATOR_HANDOFF_V1

TASK_ID, BASE_SHA real, HEAD_SHA final, BRANCH, PR_URL (NOT_CREATED_LOCAL_ONLY),
FILES_CHANGED, IMPLEMENTATION_SUMMARY (diseño, sin Auth implementada), TEST_RESULTS,
SECURITY_RESULTS, KNOWN_LIMITATIONS, EVIDENCE, WORKTREE_STATUS,
DEPLOYMENT_STATUS (NOT_RUN) y RISKS.

Indicar expresamente viabilidad documentada, evidencia aún faltante, estado de D007,
Supabase NOT_VERIFIED y cualquier decisión indispensable. No declarar MERGED,
DEPLOYED, autenticación segura probada o MVP completo.
