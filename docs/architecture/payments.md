# CUEVA-003A — Modelo económico administrativo

Estado de entrega: REVIEW. Moneda única ARS. Precio mensual general, sin planes.

## Invariantes

- `cueva_prices` conserva versiones por mes inicial de vigencia, con importe entero en centavos. Un precio por mes de vigencia; para corregir una configuración ya registrada se elige otro mes vigente posterior. El precio nuevo se permite desde el mes actual de Buenos Aires o uno futuro y se aplica solo a períodos todavía no creados cuyo mes corresponda a esa versión. Sin precio aplicable se detiene la creación. No hay carga retroactiva de precios en este incremento.
- `cueva_periods` es único por ficha administrativa/mes, conserva precio e importe elegidos al crearlo y un vencimiento que el administrador selecciona expresamente en cada renovación. No se renueva automáticamente ni se altera la deuda previa por un precio nuevo. Un alumno inactivo administrativamente puede tener pagos/deudas: no son el mismo estado.
- `cueva_payments` contiene movimientos positivos confirmados; actor y fecha de registro se obtienen de `auth.uid()` y del reloj de PostgreSQL. Fecha de pago es un dato administrativo validado. No hay sobrescritura ni eliminación por los roles API.
- `cueva_reversals` agrega una única anulación por movimiento, con motivo, actor y fecha del servidor. El original se conserva. Para corregir un importe se anula y se registra el pago correcto. El saldo resta solamente pagos no anulados.
- Escrituras exclusivamente mediante la RPC acotada. Una operación UUID identifica un payload JSONB y su actor; el reintento idéntico devuelve el mismo resultado sin otro movimiento. Cambiar datos o actor con esa clave es error. La interfaz conserva la clave y los datos ante fallos; Nueva operación exige revisar el historial. Perder la pestaña exige reconciliar el historial antes de cargar otro pago.
- Un lock transaccional común serializa las escrituras económicas, incluyendo lectura de saldo e idempotencia. Es una opción deliberada para el volumen inicial del gimnasio; no afirma capacidad para gran volumen. Cualquier error revierte la operación completa. Sobrepago/anticipo/saldo a favor se rechaza sin distribuir excedentes.
- Importes de entrada se convierten con BigInt, sin floats. La RPC de consulta suma en PostgreSQL y entrega centavos como texto; no depende de paginación/límite de filas REST para calcular saldos. La interfaz resta y muestra con BigInt. Importe por operación: 1 a 100000000000 centavos; fechas/meses entre 1900 y 2100. Formato de entrada sin miles y con hasta dos decimales.

## Autorización y superficie

Servidor reutiliza el perfil admin y getUser existentes. RLS exige ese perfil y el helper de sesión habilitada; ningún permiso económico depende de metadatos editables. Autenticados solo tienen SELECT en las cuatro tablas públicas, sujeto a RLS. No tienen INSERT/UPDATE/DELETE directos. Visitantes y service_role no reciben privilegios nuevos. El escritor privado SECURITY DEFINER es una capacidad acotada, con search_path vacío, sin SQL dinámico y comprobación explícita de actor/sesión antes de escribir; el wrapper público es invoker. No se usa service role en la aplicación para saltear permisos. El operador PostgreSQL sigue siendo una autoridad de confianza.

No se modifica Auth, correo ni cuentas. Se amplía únicamente el matcher del proxy a /pagos y /api/pagos para reutilizar su control de sesión. Acceso tiene otro chat: raíz, /ingresar y sus componentes/pruebas permanecen intactos.

## Aplicación posterior y recuperación

1. Orchestrator audita commit, hash y migración `20261104093000_cueva_billing.sql`, después de las migraciones existentes de acceso y alumnos. Revisar grants/funciones y ejecutar la migración íntegra una sola vez dentro de su transacción. No se aplicó alojada desde este checkout.
2. Comprobar catálogo, RLS, denegación alumno/visitante, actor de una operación y saldos exactos en el entorno correspondiente antes de publicar. Migración ausente muestra Pagos no disponibles o error controlado, sin fabricar importes.
3. Si una operación devuelve una respuesta ambigua, consultar historial e identificador antes de repetir. Reutilizar la misma clave/datos cuando se conserva; no asumir que falló ni generar un movimiento nuevo automáticamente.
4. Ante un defecto económico, suspender la capacidad de escritura revocando temporalmente EXECUTE del wrapper y escritor para authenticated, mediante operación autorizada del Orchestrator. Mantener tablas, lecturas, operaciones e historial; corregir con migración hacia adelante y/o anulaciones trazables. No borrar movimientos, truncar operaciones ni reescribir períodos para hacer coincidir saldos. La restauración de backup/recuperación ante desastre no fue probada aquí.

Fuentes consultadas: [RLS oficial](https://supabase.com/docs/guides/database/postgres/row-level-security) y changelog vigente (sin cambio de versión/CLI). Las reglas de negocio provienen del contexto maestro, secciones 8 y 9, y del encargo CUEVA-003A.
