# CUEVA-003A — Informe del ejecutor

Estado REVIEW. Base inicial `0751e2f8d95978cf88ee5587ac2242497347c021`. Durante el trabajo main incorporó Acceso en PR23; se revisó su delta y se rebasó sin conflictos. Base efectiva final: `28fec062d85ae306b1c94a3b234d5789fe264ee0`. No se modifican los archivos de Acceso. Rama `codex/cueva-003a-payments`.

Implementa precio general con vigencia explícita, creación mensual por alumno con vencimiento elegido, pagos parciales/completos, saldos exactos, historial y anulación con motivo. Reutiliza AdminShell y ficha administrativa. No habilita consultas económicas al alumno, cobros online ni correo. Ver [modelo e instrucciones de aplicación/recuperación](../architecture/payments.md) y [encargo](CUEVA-003A-task.md).

## Verificación

[Laboratorio local real](../../experiments/cueva-payments-local/evidence.json): reutiliza imágenes y lanzador de Alumnos/I con nombres/red exclusivos cueva-payments, sin repetir onboarding ni invitaciones. Next, Auth, PostgREST, PostgreSQL y Chromium reales; dos identidades sintéticas y una ficha administrativa. `node lab.mjs` desde experiments/cueva-payments-local tras instalar dependencias del repositorio. Docker existente requerido; no se instala ni reinicia motor. Credenciales aleatorias solo en memoria/entorno efímero. resultados locales ignorados; evidencia versionada redactada.

Casos PASS: precio/período por UI, parcial y recarga, precio futuro sin alterar histórico, período duplicado, reintentos concurrentes con igual clave, misma clave/datos distintos rechazados, pagos concurrentes que no exceden saldo, pago completo y saldo cero, anulación idempotente y exacta, anulación desde UI, importe/fecha/pertenencia inválidos, denegación de escritura directa/falso actor, RLS alumno sin filas, visitante/alumno rechazados por RPC, UI y HTTP; administrador no habilitado rechazado; error con datos de formulario conservados, teclado y ambos temas a 390/1440 px. Todas las comprobaciones y limpieza PASS. El laboratorio cierra navegador/Next y elimina exclusivamente sus contenedores/red, conservando imágenes compartidas.

Lint, typecheck y build PASS. Documentos 2/2, fuentes 4/4, escaneo de seguridad y diff check PASS. Suite visual del panel ejecutada por el cambio de navegación; no se repiten laboratorios/suites de acceso sin cambios.

- [Celular oscuro](../../evidence/screenshots/payments-390-dark.png) / [claro](../../evidence/screenshots/payments-390-light.png)
- [Computadora oscura](../../evidence/screenshots/payments-1440-dark.png) / [clara](../../evidence/screenshots/payments-1440-light.png)

Capturas de aplicación local con datos sintéticos, antes del último pago total del caso adicional. La evidencia JSON incluye ese pago y la anulación posterior. No representan cifras del gimnasio.

## Límites para revisión

Migración alojada, prueba con datos reales, integración y publicación NOT_RUN. No se cambian migraciones históricas ni cuentas reales. Precio vigente por mes sin edición de versiones existentes; histórico económico append-only y sin anticipos. Lista de selección muestra primeros 100 alumnos con búsqueda para refinar; snapshot económico agrega el historial completo del alumno seleccionado. No hay paginación visual de movimientos, rendimiento masivo ni recuperación de desastre probados. Actor se muestra por su UUID verificable; no se inventan nombres. El escaneo por patrones no demuestra ausencia absoluta de secretos. Fechas de registro se muestran en Buenos Aires; una fecha de pago ingresada no sustituye la fecha del registro servidor.

Cierre de verificación: panel 10/10 PASS (proceso finalizado con código 0 tras cerrar
únicamente su servidor local identificado por PID/ruta, porque el teardown quedó
esperando). Sin procesos Node de este checkout ni contenedores/red cueva-payments
remanentes al comprobar la limpieza. La migración final, incluida su transacción
única, se probó en la última ejecución local real.

Compatibilidad final: laboratorio económico repetido sobre la base de PR23,
39/39 comprobaciones PASS, incluidos limpieza y acceso por el formulario nuevo.
Lint/tipos/build nuevamente PASS. No se modifica ni se ejecuta la suite completa
de Acceso; se comprueba únicamente el ingreso necesario para el flujo económico.

Autoauditoría: revisión de privilegios, identidad del actor, permanencia de originales,
rollback de operación, clave reutilizada, saldo bajo concurrencia y snapshot sin
truncamiento REST. Prueba adicional `node --test tests/payments-money.test.mjs`
PASS para conversión exacta, límite monetario y formatos inválidos. Se corrigió
el límite de dígitos del cliente para admitir el mismo máximo que PostgreSQL;
no cambia la migración ni las operaciones ejercitadas por el laboratorio real.
