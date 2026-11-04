# CUEVA-INVITACION-RECUPERACION-001 — entrega local

Estado **REVIEW**, 2026-11-04. Auditoría independiente, integración, aplicación y
operación alojadas pendientes. Base verificada
`a0dabf081a82867eb93d9f177f42e3c3cceb1a41`, igual a origin/main al comenzar;
rama `codex/cueva-invitacion-recuperacion-001`. Checkout limpio, trabajo previo
conservado. El HEAD final se identifica en el handoff, sin SHA autorreferencial.

[Encargo](CUEVA-INVITACION-RECUPERACION-001-task.md) y
[procedimiento de aplicación, operación y rollback](CUEVA-INVITACION-RECUPERACION-001-operations.md).
Se leyó el registro remoto actualizado de PR25: entrega anterior integrada/publicada,
migración aplicada y rechazo alojado535; la credencial posterior sigue sin probar.
No se hicieron nuevos accesos a Supabase alojado, SMTP real o Vercel.

## Resultado implementado

Una herramienta privada de operador y una migración nueva, sin pantalla/ruta/RPC
ni ampliación de permisos API. Exige fiche/trabajo/UUID/generación/estado/correo
exactos y expediente privado de rechazo 535, ligado por hash y contenido. Comprueba
cuenta sin confirmar/login/sesión y perfil alumno/gate cerrado antes de mutar.
Reserva única durable, nonce y generación nuevos, marcador de operación exclusivo.
Conserva identidad, perfil y ficha. Solo la respuesta de invitación con el UUID
capturado y postcondiciones seguras libera el marcador; ready continúa false hasta
que el alumno acepte el enlace y elija contraseña mediante el flujo existente.

El laboratorio demostró que inviteUserByEmail admite esa identidad preparada bajo
estas precondiciones. No hizo falta una alternativa ni cambiar a recuperación.
El SDK no comunica el 535 como una señal confiable de rechazo: GoTrue devuelve500.
Por eso cualquier nuevo error se clasifica uncertain y trabajo review; el marcador
del gate se conserva. No se infiere aceptación o rechazo por estado o tiempo.

## Evidencia nueva

[Resultados 66/66 PASS y hashes de las fuentes ejecutadas](../../experiments/cueva-invitations-local/reconciliation-evidence.json).
La ejecución final es nueva, posterior a los cambios; no reutiliza la evidencia 42/42
de PR25. Incluye seis comprobaciones de limpieza de recursos propios. Las pruebas
negativas exigen el código de detención esperado, no aceptan cualquier excepción.

| Caso afectado | Resultado observado |
| --- | --- |
| SMTP inicial535 | Servidor sintético rechaza realmente AUTH con 535 BadCredentials; API 500; review sin mensaje. |
| Reparación y concurrencia | Relay reparado hacia Mailpit; tres comandos concurrentes, una llamada de invitación y un mensaje aceptado. |
| Aceptación y contraseña | Href extraído de plantilla versionada real, generación2; contraseña propia habilita el gate y nueva sesión del mismo UUID. |
| Conservación | Sin nuevas cuentas en la reconciliación; mismo perfil alumno, UUID vinculado y ficha. |
| Enlace anterior | Capacidad Auth sintética generada sin envío previo; su generación/nonce viejo falla en aplicación con 409 y cero cookies. El nonce anterior ya falla antes de SMTP. |
| Replay | accepted devuelve NO_SEND sin cambios/envíos, también después de confirmar/elegir contraseña. Otro attemptId no elude el ledger. |
| Preconditions | Ficha, lease, UUID, generación, correo, perfil admin, cuenta confirmada, login previo, sesión existente, gate listo/vinculado, operación o trabajo pendiente y sent: detención sin reserva/envío. |
| Evidencia | Rechazo ausente, aceptación no excluida, solicitud aún pendiente, falta de quiescencia, archivo ausente/adulterado o identificadores distintos: detención. |
| Operaciones concurrentes | Reset no adquiere el gate; finish ordinario no libera la reserva; prepare_recovery no sustituye el nonce. |
| Otro535 | review/uncertain, sin reintento automático y sin otro mensaje aceptado. |
| Respuesta perdida después de SMTP | Se acepta un correo real local y se pierde deliberadamente la respuesta: review/uncertain; replay no reenvía; ese enlace nuevo falla 409 sin sesión de aplicación. |
| Interrupciones antes/después de SMTP | Hooks locales lanzan excepción exactamente tras commit de reserva o tras SMTP. reserved/dispatching conservados, gate cerrado y replay NO_SEND. No se afirma haber matado el proceso del SO. |
| UUID de respuesta distinto | Respuesta de transporte adulterada solo en prueba tras SMTP: uncertain, sin habilitar acceso. |
| Permisos | Ledger privado sin SELECT/INSERT/UPDATE/DELETE para anon/authenticated/service_role; fuera de Data API. Alumno real y visitante no pueden leerlo ni ejecutar reconciliación. |

La invalidación probada corresponde a la capacidad de incorporación de CUEVA
(nonce/generación/preflight), no a una promesa de revocación global de toda sesión
Auth. Se rechazan cuentas con cualquier sesión existente antes de reservar.
El correo real del gimnasio, Gmail, límites alojados y entrega en bandeja NO se
validan con este SMTP local. Simulador y respuestas adulteradas no entran a runtime.

## Reproducción y limpieza

Desde experiments/cueva-invitations-local en PowerShell, con dependencias,
Chromium, Docker existente y las imágenes fijadas disponibles:

```powershell
$env:CUEVA_INVITATION_RECONCILIATION_ONLY='1'
node lab.mjs
Remove-Item Env:CUEVA_INVITATION_RECONCILIATION_ONLY
```

Reutiliza la pila de invitaciones, selecciona solo la matriz afectada y sirve la
plantilla original. Para ejecutar AUTH sintético sin TLS, Auth comparte exclusivamente
el namespace de red del servidor de plantilla/relay propio y usa localhost; Mailpit
permite la autenticación efímera solo en esa red. Puertos publicados dinámicos
únicamente 127.0.0.1, contenedores con memoria/CPU limitadas y nombres exclusivos
cueva-invites. Sin instalar nuevas imágenes ni dependencias para esta entrega.

finally cierra Chromium/Next, detiene/elimina solo contenedores registrados en
esta ejecución y borra su red exacta. Fallos anteriores de preparación también
limpiaron sus recursos. El simulador descarta credenciales/DATA, no registra correo
en disco de host. resultados persistidos contienen solo etiquetas/estados/hashes.
Comprobación posterior: sin procesos Next de este checkout ni contenedores/red
cueva-invites restantes. No se reinició Docker ni tocaron contenedores de Vendify.

## Verificaciones y límites

- Laboratorio 66/66 PASS, incluidas limpieza y SMTP contado.
- `npm run lint`, `npm run typecheck`, `npm run build`: PASS.
- `npm run test:docs`:2/2 PASS; `npm run verify:sources`:4/4 PASS.
- `npm run verify:security`: PASS más revisión manual de permisos, concurrencia,
  secuencia de reserva/envío/finalización, ausencia de creación/adopción/activación.
- `npm audit --audit-level=critical`: exit0, cero críticas; ocho avisos moderados de
  la cadena ESLint/minimatch existente. No cambian dependencias ni lockfile.
- Diff check y límites revisados: sin cambios en src/, logo, estilos, plantilla,
  autenticación existente, migraciones históricas, permisos API, SMTP o flags.
- Sin nuevas matrices visuales ni laboratorios históricos; el caso de navegador
  se limita al enlace/contraseña/sesión afectado.

La evidencia de rechazo y quiescencia depende de la revisión explícita del operador;
SQL y un hash no autentican un log SMTP externo. La herramienta exige PostgreSQL
administrativo directo con TLS verificado, sin asumir conectividad alojada probada.
La reserva no vence y solo permite un intento de reconciliación por ficha: otro
rechazo, reserva huérfana o incertidumbre requieren nueva decisión, no takeover.
Una interrupción dura puede dejar processing; no se transforma su ausencia de
respuesta en permiso para reenviar. No se promete exactamente una vez en SMTP.

Con ownerOnly vigente, la aplicación sigue cerrando el callback general de alumnos;
esta herramienta no modifica esa configuración. El Orchestrator debe coordinar la
habilitación bajo la autorización correspondiente para probar primer acceso real.
Migración alojada/envío real: NOT_RUN por el ejecutor. Credencial nueva, entrega y
primer acceso alojados: NOT_VERIFIED. Sin push, PR, merge ni deploy.
