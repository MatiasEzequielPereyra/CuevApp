# CUEVA-002K — Ejecución privada del primer alta

Preparar script de operador para una ejecución puntual en Vercel, utilizando el
secreto de Production ya configurado. El dashboard de Supabase no permite enviar
el redirect completo y no se descargará su secreto ni se pedirá otro para esto.

- Ningún endpoint, hook automático, cambio de Next, dependencia ni migración.
- Dry-run sin red por defecto; --check solo inventario/verificación de servicio.
  --apply envía una sola invitación, solo tras proyecto/origen exactos, correo
  por entorno y estado vacío. Nonce aleatorio/generación/RPC preparado como I/J.
- No reintentar resultados ambiguos ni asumir atomicidad entre servicios.
  Exclusión de otros operadores es precondición, no una garantía contra raíz.
- Ejecutar exclusivamente mediante una orden puntual de deployment sobre SHA
  revisado; el build normal permanece npm run build y no envía correos.
- Probar con Auth/PostgREST/Mailpit reales locales: check sin envío, primera
  invitación, href literal y activación, duplicado rechazado sin reenviar.
- Promoción real posterior por operador/MCP en transacción exacta; no nuevo RPC.
  No descargar/exportar secretos de Vercel ni agregar conexión DB a la app.

Commit local REVIEW y evidencia redactada. Sin push, deployment, configuración
remota, cuentas o correos reales por el ejecutor. El Orchestrator revisa y solicita
la autorización de primer alta antes de cualquier envío. Modelo heredado;
razonamiento alto recomendado por el riesgo, sin cambio automático de modelo.
