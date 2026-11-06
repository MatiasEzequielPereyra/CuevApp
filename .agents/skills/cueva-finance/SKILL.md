---
name: cueva-finance
description: Usar al desarrollar o auditar cuotas, vencimientos, pagos parciales, anulaciones, comprobantes, recordatorios o la vista Mi Membresía de CUEVAPP.
---

# Contrato financiero de CUEVAPP

## Fuentes y alcance
1. Leer checkpoint, `docs/architecture/payments.md`, `docs/engineering/CUEVA-003A-review.md` y la migración `supabase/migrations/20261104093000_cueva_billing.sql`.
2. Usar la especificación de finanzas, comprobantes y notificaciones más reciente **integrada en main** y aprobada. Un PR abierto no constituye contrato implantado; registrar diferencias antes de programar.
3. Verificar `src/app/api/pagos/route.ts`, `src/lib/payments/money.ts` y las RPC reales, sin dar por integrada la UI del alumno por existir la página administrativa.

## Invariantes obligatorios
- Trabajar en centavos enteros (`bigint` / `BigInt`); no calcular saldos con números decimales JS.
- Historial de precios, períodos, pagos y anulaciones inmutable o trazable. El importe histórico no cambia por una nueva cuota general.
- Los pagos parciales no pueden superar el saldo; el mismo identificador de operación con el mismo payload debe ser idempotente y no crear movimientos duplicados.
- Una corrección se documenta/anula; no se borra un pago contabilizado silenciosamente.
- Mantener las comprobaciones del servidor, RPC y RLS. Los alumnos nunca confirman pagos ni el archivo adjunto acredita dinero por sí mismo.
- Distinguir `paid_on`, fecha de registro y `due_on`; utilizar `America/Argentina/Buenos_Aires` en las reglas locales de calendario.
- No generar cobros en línea ni recargos automáticos por iniciativa propia.

## Verificaciones
- Probar: dos pagos parciales, saldo completo, exceso, reintento idéntico, reintento distinto con misma clave, anulación y repetición, cambio de precio y conservación de historia.
- Para recurrencia: meses cortos y años bisiestos, días 29/30/31 sin deriva, cambios de vencimiento y períodos ya pagados.
- Para comprobantes: archivo privado, tipos/tamaño, acceso cruzado prohibido, estado pendiente, aprobación/rechazo administrativo e idempotencia.
- Para notificaciones: zona horaria, duplicados, pendiente parcial, pago total, reintento seguro y evidencia de envío versus entrega; no asumir reglas de recordatorio anteriores a la especificación vigente.
- Reportar pruebas reales, invariantes no verificadas y cualquier dependencia de migración/despliegue antes de aceptar.
