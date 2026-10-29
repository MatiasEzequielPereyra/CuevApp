# CUEVA-002B-LOCAL — Prueba local del cambio obligatorio

Actuá como CODEX EXECUTOR. TASK_ID: CUEVA-002B-LOCAL. Estado: READY tras integración
de la auditoría CUEVA-002A. Es una prueba local desechable, no adopción de D007.

MODEL_RECOMMENDATION:
- MODEL: gpt-6-astra
- REASONING_EFFORT: high
- ALTERNATIVE: gpt-6.1-sol / high
- REASON: probar una frontera de autenticación con evidencia real y negativa.
- COMPLEXITY: alta
- SECURITY_RISK: acotado a fixtures locales; conclusiones sensibles para el producto.
- EXPECTED_EFFICIENCY: resolver primero E3 evita operar un proveedor inviable.

## Base y autorización

Leer AGENTS, checkpoint y README en orden. Base documental auditada:
b7b98e3cf79089c6fcbc1edf69e4811f6194f027, sobre main
2423b14a4835b08ec8d3e487b03d606ef36f1f5e. Antes de empezar obtener origin/main y
registrar el BASE_SHA real que incorpora la auditoría y este encargo. Comprobar
ruta física, limpieza y cambios posteriores; no sobrescribir trabajo ajeno.
Crear rama codex/cueva-002b-local en checkout aislado cuando corresponda.

Este encargo autoriza únicamente un laboratorio local con el runtime de
contenedores ya instalado, imagen oficial Keycloak fijada por versión y digest,
red privada y puertos enlazados a loopback. Comprobar recursos antes de arrancar;
no instalar motores, modificar firewall/virtualización, publicar túneles ni tocar
contenedores/volúmenes ajenos. Si no existe runtime utilizable, entregar BLOCKED
con el requisito mínimo; no cambiar de mecanismo o instalar infraestructura.
Detener los procesos propios al terminar y documentar limpieza/reproducción.

Sin Supabase alojado, Vercel, servicios pagos, datos reales, emails ni secretos
reales. No usar el correo o contraseña de Nico como fixture. No alterar aplicación,
lockfile principal ni configuración de despliegue. Guardar harness reproducible
fuera de src, en experiments/cueva-002b-local, y documentación/evidencia redactada.
No habilitar un proveedor remoto ni crear cuentas del gimnasio.

## Objetivo y prueba

Demostrar con Keycloak real si el login username/contraseña sin correo obliga al
cambio antes de emitir código/tokens, y qué evidencia confiable puede observar
un consumidor servidor. Versionar configuraciones no secretas y usar credenciales
sintéticas aleatorias efímeras, nunca persistidas en Git, trazas o capturas.

1. Crear realm/cliente y usuario sintéticos sin email/teléfono, autorregistro
   cerrado, contraseña temporal, políticas de no reutilización y flujos mínimos.
   Verificar documentación actual e imagen oficial; no fabricar soporte inexistente.
2. Ejercitar Authorization Code con PKCE/nonce, con consumidor OIDC local real
   de biblioteca madura. Antes del cambio no debe emitirse una sesión utilizable
   por ese consumidor. No simular PASS con mocks ni un booleano de interfaz.
3. Probar cambio por usuario, rechazo de reutilización, login con nueva contraseña,
   rechazo de la antigua y segundo login sin repetir el cambio inicial.
4. Observar y correlacionar subject, cliente, operación de reset y sesión con un
   mecanismo server-side existente. Identificar límites de eventos/acciones/tiempos.
   No afirmar que acciones vacías o una fecha suelta demuestran quién cambió la clave.
5. Casos negativos: abandonar cambio, SSO previo, refresh anterior, reset concurrente,
   evento viejo/duplicado, grant directo deshabilitado y eliminación administrativa
   de la acción requerida. Distinguir capacidades de administrador de producto,
   operador del IdP y atacante: no prometer defensa frente a un operador raíz que
   controla claves/tokens. Registrar cualquier bypass con sus precondiciones exactas.
6. Evaluar reset y revocación del proveedor local. No extrapolar a sesiones Supabase:
   la revocación cruzada, RLS, linking y email opcional federado siguen NOT_RUN aquí.

No escribir criptografía, verificación propia de hashes ni un plugin permanente
para hacer pasar la prueba. Si hace falta extender el IdP o no existe señal suficiente,
entregar el bloqueo y la mínima alternativa verificable para revisión.

## Entrega y aceptación

Entregar informe con versión/digest, pasos reproducibles, pruebas ejecutadas,
resultados positivos y negativos, evidencia redactada y límites. Comparar la
complejidad operativa observada con el tamaño del MVP sin inventar costo mensual.
Dictamen: E3 demostrado SOLO dentro del laboratorio o E3 todavía BLOCKED; nunca
Auth de CUEVA aceptada. D007 sigue PROPOSED. E1–E6 integrados siguen pendientes.

Correr checks documentales, fuentes, seguridad y diff --check; los tests propios
del laboratorio deben observar el IdP real. Ejecutar build/lint de app solo si un
cambio autorizado lo hace relevante; no cambiar src para justificarlo.

Commit local, estado REVIEW, sin push/PR/merge. Handoff
CODEX_TO_ORCHESTRATOR_HANDOFF_V1 con TASK_ID, BASE_SHA, HEAD_SHA, BRANCH,
PR_URL=NOT_CREATED_LOCAL_ONLY, FILES_CHANGED, IMPLEMENTATION_SUMMARY,
TEST_RESULTS, SECURITY_RESULTS, KNOWN_LIMITATIONS, EVIDENCE, WORKTREE_STATUS,
DEPLOYMENT_STATUS=NOT_RUN y RISKS. Explicar limpieza y cualquier requisito humano.

Esta prueba estrecha no sustituye la decisión pendiente sobre proveedor/operador,
presupuesto y entrega/recuperación real que condiciona CUEVA-002B integrada.
