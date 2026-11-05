# CUEVA-INVITACION-RECHAZO-SMTP-002 — entrega local

Estado **REVIEW**, 2026-11-05. Base main verificada e igual al handoff:
`31fcd33c100422ec9a1657ff34bd246f03908920`. Rama
`codex/cueva-invitacion-rechazo-smtp-002`; HEAD final en el handoff.
Checkout del ejecutor limpio al comenzar; no se modificó el del Orchestrator.
[Encargo íntegro](CUEVA-INVITACION-RECHAZO-SMTP-002-task.md) y
[operación/aplicación/rollback](CUEVA-INVITACION-RECHAZO-SMTP-002-operations.md).

## Resultado

Una única ampliación de autorización para el caso gen2/pending/uncertain acreditado.
No se toma ese estado ni HTTP500 como prueba: exige rechazo534/535 documentado y
concluido sin aceptación/ambigüedad, relación exacta de ficha/UUID/lease/intento/hash,
perfil alumno/correo congelado/cuenta sin confirmar/login/sesión, gate cerrado y
marcador invite-resend exacto. Exige prueba de reparación SMTP ligada a la nueva
autorización y al rechazo. Se mantiene la confianza explícita en revisión/quiescencia
del operador; no se inventa una señal de correlación del proveedor.

En una transacción se archiva el ledger previo completo en JSONB append-only y se
actualiza la fila actual en sitio: vínculo previous_attempt_id, nueva autorización,
generación3, nonce nuevo, lease/marcador exclusivos. No se borran/recrean cuentas ni
ledger. El historial guarda todos los valores anteriores y hashes del nuevo
expediente/sucesor; trigger rechaza UPDATE/DELETE y no tiene permisos API.
Mismo pg.Client, advisory y locks existentes. No cambia el envío invite ni la
elección de contraseña: ready solo se habilita por el flujo de aceptación existente.

Herramienta de preflight aislada en tools/cueva-smtp, con versiones fijadas y lock
propio. Nodemailer.verify requiere STARTTLS, certificado/hostname y AUTH con
forceAuth:true; no hay sendMail en esa herramienta. Un servidor TLS que no permita
AUTH no genera prueba. Se fijó Brevo587 en CLI, sin tocar la configuración alojada.
Servidor SMTP de prueba usa smtp-server solo como devDependency; CA y clave TLS
sintéticas se generan temporalmente con OpenSSL y se eliminan al terminar.

## Evidencia nueva acotada

[Matriz51/51 PASS y hashes de fuentes](../../experiments/cueva-invitations-local/reauthorization-evidence.json),
incluidas siete comprobaciones de limpieza y el control previo del autenticador
del arnés. No es reutilización de66/66,48/13 ni de pruebas visuales.

| Caso afectado | Observación local |
| --- | --- |
| Estado inicial | Rechazo real de protocolo SMTP534/5.7.9 en el simulador, apply previo uncertain, gen2 y marcador exacto; cero mensajes. |
| Reparación | STARTTLS con CA sintética confiada, AUTH exitoso; contadores de MAIL/DATA sin aumentar. |
| Fallos de preflight | CA no confiada falla antes de AUTH; TLS sin AUTH y contraseña incorrecta no producen prueba. |
| Evidencia | Rechazo/reparación ausentes o adulterados, HTTP500, aceptación no excluida, solicitud sin concluir, no quiescente, otra identidad y prueba sintética usada como real: detención. |
| Estado previo | accepted/reserved/dispatching, hash de autorización distinto, finished_at nulo, cuenta confirmada y marcador desconocido: detención sin escritura/envío. |
| Nuevo intento | Tres comandos concurrentes: una reserva y una llamada invite, un correo en Mailpit y mismo UUID/perfil/ficha; gen3 no listo. |
| Historial | Snapshot completo igual al ledger previo, sucesor/hashes ligados; UPDATE/DELETE rechazados; sin permisos de tabla para anon/authenticated/service_role. |
| Replay | Autorización vieja rechazada; nueva devuelve NO_SEND; ID distinto no elude reserva incluso con nuevo AUTH preflight válido. Sin correo duplicado. |
| Incorporación | Nonce anterior invalidado; href real de plantilla con gen3; aceptar sigue sin ready hasta guardar contraseña propia. Mismo perfil alumno habilitado. |
| Nuevo rechazo/timeout | Nuevo535 y pérdida de respuesta después de correo aceptado dejan review/uncertain, gen3, marcador exacto y ready=false. Replay no envía. Historial conservado en ambos. |

Los logs/identificadores/credenciales de producción no se leyeron. El rechazo
histórico, configuración Brevo y comprobaciones alojadas previas son antecedentes
aportados por el Orchestrator, no pruebas repetidas por esta entrega. La prueba
positiva nueva reconstituye localmente534; no certifica un rechazo535 alojado.
El preflight no demuestra que Supabase tenga la misma clave oculta, autorización
del remitente, cuota o entrega: cotejo humano y aceptación posterior siguen separados.
Hash/binding no es firma del log ni reemplaza la acreditación externa autorizada.

## Reproducción

Dependencias raíz ya instaladas; instalar el paquete aislado desde tools/cueva-smtp
con `npm ci --ignore-scripts`. Docker existente, imágenes fijadas, Chromium para
el único recorrido afectado y OpenSSL (Git para Windows en este equipo).
Desde experiments/cueva-invitations-local:

```powershell
$env:CUEVA_SMTP_REAUTHORIZATION_ONLY='1'
node lab.mjs
Remove-Item Env:CUEVA_SMTP_REAUTHORIZATION_ONLY
```

Nombres/red propios, loopback y límites de recursos. No reiniciar Docker ni tocar
Vendify. Se cierra Next/Chromium y se eliminan solo contenedores/red registrados y
directorio temporal sintético validado. Se corrigió la limpieza del arnés para
registrar también un contenedor creado si Docker falla al iniciarlo; no hay limpieza
global. El fallo inicial de importación se resolvió usando los exports del paquete,
sin rutas internas obsoletas. No quedaron recursos de esa ejecución fallida.

## Checks y límites

Lint/tipos, documentos2/2, fuentes4/4, seguridad de patrones y diff PASS, con revisión
manual de autorización/archivo atómico/retención, rutas CLI y ausencia de logs con
secretos. Paquete SMTP aislado: npm ci reproducible, audit cero vulnerabilidades.
Root package.json/lockfile, src/, UI/configuración y migraciones históricas intactos.
Build **NOT_RUN**, porque la app/config/runtime no cambian. No se ejecutaron las
matrices históricas ni toda la app; el navegador cubre solo el nuevo enlace gen3.

Autenticación SMTP/DB remota, envío real y aplicación alojada: **NOT_RUN**.
Solo se creó una migración local nueva. No se descargó/exportó secreto de Vercel,
no se configuró proveedor, contraseña, flag o cuenta, ni se liberó ready por SQL.
Certificado público y fingerprint de PR28 se documentan para NODE_EXTRA_CA_CERTS
en procesos privados; sin confianza global ni degradación TLS.

Integración, migración nueva y única operación real corresponden al Orchestrator.
Ante nuevo error no existe una tercera autorización genérica ni takeover temporal;
conservar historial/estado y detener. No se promete entrega exactamente una vez.
Sin push, PR, merge ni deploy. Árbol limpio al entregar y recursos propios detenidos.
