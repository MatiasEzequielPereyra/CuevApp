# CUEVA-INVITACION-RECUPERACION-TRANSPORTE-001 — entrega

Estado **REVIEW**, 2026-11-05. Base solicitada
`67d44e2d954bd09af0ea821b718a8151cd9af28a`; base efectiva main
`126e933de770f02b7060b095b8a77d0685f53c69`, comprobada al comenzar y que incluye
esa base y el candidato auditado `db0835bce40ad9604c0e1c45db0109c4b7846e9c`.
Rama `codex/cueva-invitacion-transporte-001`. El HEAD final se identifica en el
handoff. Solo se reutilizó el checkout limpio del ejecutor, sin alterar el del
Orchestrator. [Encargo](CUEVA-INVITACION-RECUPERACION-TRANSPORTE-001-task.md).

## Cambio acotado

Se extrae la construcción de opciones DB para admitir el tuple exacto de sesión:
aws-1-ca-central-1.pooler.supabase.com:5432, usuario
postgres.vbkzoojkdkcugxhneyzi, base postgres. Directo se conserva con usuario
postgres y puerto5432; si se omite ese puerto se normaliza antes del driver,
impidiendo que PGPORT lo cambie. Usuario/host/puerto/base distintos y toda opción
query/fragmento se rechazan antes de conectar, incluyendo sslmode y overrides.

pg.Client conserva `ssl:{rejectUnauthorized:true}` y timeout10000 remoto; la
excepción local solo admite127.0.0.1 y se usa únicamente en pruebas. La CLI sigue
forzando local=false. No se agrega pg.Pool ni negociación/proxy/CA alternativos.
Pruebas inspeccionan también la configuración efectiva interpretada por pg8.23.1,
no solo los booleanos del validador.

La comparación con el script base desde snapshot hasta el final de la CLI es
idéntica tras excluir las dos líneas de construcción/recepción de opciones DB.
Se conserva íntegra reserva, transacciones, advisory, nonce, generación, evidencia,
Auth, ledger, envío, manejo de errores y finally/end. No se tocó la migración PR26.

[Operación IPv4 y suministro privado de credenciales](CUEVA-INVITACION-RECUPERACION-001-operations.md).
No se agregó capturador: no hace falta para ejecutar pruebas locales sin secretos
reales. El operador aporta contraseña DB y clave de servicio existentes por su canal
privado; Gmail no sustituye ninguna. No hay extracción/exportación de Vercel.

## Evidencia nueva y reproducción

[Resultados acotados y hashes](../../experiments/cueva-invitations-local/transport-evidence.json).

- `node --test tests/reconciliation-transport.test.mjs`: **48/48 PASS**. Destinos
  directos/session, protocolo, usuario y puerto; rechazo de transaction6543, otras
  regiones/instancias/proyectos, hosts/IPs/comodines, bases y opciones TLS/destino.
  Configuración efectiva mantiene verificación TLS aun con PGSSLMODE=no-verify y
  evita que PGHOST/PGPORT/PGUSER/PGDATABASE reemplacen los valores aprobados.
- Laboratorio de transporte: **13/13 PASS**, incluidas seis limpiezas y el control
  previo del autenticador del arnés. Únicamente un `reconcile(...,'check')` sintético.
  Instrumentación de consultas del pg.Client real observa un cliente y un backend,
  advisory todavía adquirido después de rollback y liberado al cerrar la conexión.
  Review/generación/nonce/gate permanecen intactos, sin reserva ni llamada Auth/envío
  desde la operación. El arnés crea solo su fixture sintético local; su registro de
  rechazo es de prueba y no pretende acreditar un SMTP535 nuevo ni alojado.

Desde experiments/cueva-invitations-local:

```powershell
$env:CUEVA_INVITATION_TRANSPORT_ONLY='1'
node lab.mjs
Remove-Item Env:CUEVA_INVITATION_TRANSPORT_ONLY
```

Reutiliza imágenes fijadas y pila local existente, sin lanzar Next ni Chromium para
este caso. Puertos ligados a127.0.0.1, recursos acotados, nombres/red propios.
Contenedores y red eliminados al finalizar; sin reiniciar Docker ni tocar Vendify.
No se repitió66/66, matrices visuales, identidad histórica ni la app completa.

## Verificaciones y límites

Lint, tipos, documentos2/2, fuentes4/4, seguridad de patrones más revisión manual y
diff check PASS. Build **NOT_RUN**, porque no cambió configuración/runtime de la app,
src/, dependencias ni lockfile. Verificación local de configuración TLS, sin handshake
TLS nuevo. No se conectó al pooler remoto ni se midió TCP desde esta entrega.

TCP abierto es observación del Orchestrator, no prueba de autenticación, TLS,
afinidad real del pooler o aceptación/entrega SMTP. Todo eso sigue **NOT_RUN** aquí.
La selección exacta de endpoint/puerto no puede demostrar por sí sola la política
interna del proveedor: antes de operar debe conservarse SESSION en Connect.
Si falta una credencial, hay error de certificado o cambia la precondición del
proveedor, detener; no usar transaction pooling ni bajar TLS para continuar.

Sin push/PR/merge/deploy, migraciones remotas, cambios de credenciales/SMTP/flags,
conexión autenticada remota, envío real ni edición de cuentas. Integración y única
operación alojada autorizada corresponden al Orchestrator tras su auditoría.

Fuentes primarias: [SSL y parsing de URI en node-postgres](https://node-postgres.com/features/ssl)
y [conexiones de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
