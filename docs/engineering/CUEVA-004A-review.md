# CUEVA-004A — Comprobantes desde Mi Membresía

Entrega original del ejecutor para revisión. Base `f6e382a765f10a61c3e2aad3eeee7a282944e3c3` de `codex/cueva-mem-001`.
Main verificado `2670171d8e825f0ad956fb315e156666bcaf677a`.
Rama separada `codex/cueva-004a-comprobantes`.

## Revisión independiente del PR #36

Dictamen **PASS para construir encima**. Se revisaron el diff completo de nueve
archivos, los permisos de las funciones, el vínculo de la invitación y las
pruebas. La RPC no recibe una ficha elegida por el cliente. El gate valida el
usuario y la sesión vigente, y la relación única de la cuenta con la ficha
determina los períodos. La consulta agrega centavos en PostgreSQL, excluye las
anulaciones tanto del total como de la lista y devuelve los montos como texto.

CI observado en ese HEAD. [Verificación general](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/42337965432)
y [prueba SQL de aislamiento y ledger](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/42337965377)
completadas correctamente. El auditor verificó el código y consultó CI. El
laboratorio SQL del #36 no se repitió localmente.

## Flujo y decisiones de implementación

- El alumno elige un período de su historial con saldo. El servidor verifica
  autorización y emite un permiso de carga para una ruta inmutable. La subida
  va directamente a un bucket privado de 10 MB para respetar el límite de cuerpo
  de las funciones. La ruta de finalización descarga ese mismo objeto, verifica
  tamaño, MIME, extensión declarada, hash e integridad estructural.
- La comprobación de formato decodifica los JPEG con Sharp 0.35.5, la versión
  ya presente en el lockfile, declarada como dependencia directa. Verifica CRC y
  flujo zlib de PNG, y encabezado, referencias y cierre de PDF. Aplica límites
  de 50 megapíxeles en JPEG y 64 MiB de datos PNG decodificados. PDF se comprueba
  a nivel estructural.
- La capacidad de finalizar está restringida a la credencial de servidor. La
  sesión verificada, ficha, período y saldo se comprueban otra vez al escribir.
  El índice parcial y el lock del ledger impiden dos pendientes concurrentes.
  Un reintento idéntico conserva el mismo identificador y objeto.
- El alumno y los administradores autorizados consultan archivos asociados con
  enlaces firmados de 60 segundos. RLS niega lecturas cruzadas y de objetos sin
  asociación. La tabla guarda presentación, revisión, actores, motivo y el ID
  independiente de pago para aplicar después la retención.
- Aprobar registra el pago con `cueva_billing_write` y vincula la resolución en
  la misma transacción. El motor valida el saldo. Los medios de débito/crédito se
  agregan a la restricción del ledger y el detalle de «Otro» queda en la auditoría
  de la revisión. El rechazo conserva el motivo visible. Un pago ordinario que
  salda el período cambia el pendiente a «Sin efecto: período ya saldado».
- Una carga interrumpida o inválida puede dejar un objeto privado sin asociar.
  El alumno puede reintentar con el mismo archivo o seleccionar otro. La
  retención y limpieza de objetos sin asociación quedan pendientes.

[Especificación aprobada](../product/CUEVA-FINANZAS-COMPROBANTES-NOTIFICACIONES-V1.md),
[Storage privado](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[semántica de carga firmada](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl)
y [límites de funciones](https://vercel.com/docs/functions/limitations).

## Verificación de la entrega original

- Ejecutadas localmente con Node 22.14.0 y npm 10.9.2. Lint, TypeScript directo,
  fuentes 4/4, documentos 2/2, archivos y rutas 4/4, y navegador de Mi Membresía
  a 360 px y formularios 3/3. Las pruebas HTTP usan servicios sintéticos.
- [Pruebas de archivo y rutas](../../tests/receipts-file.test.mjs),
  [formularios en navegador](../../tests/e2e/receipts.spec.ts) y
  [prueba SQL](../../supabase/standalone-tests/payment-receipts.sql).
  El flujo SQL ejecuta PostgreSQL real con roles y metadatos Storage de
  laboratorio. Incluye dos conexiones concurrentes y la transacción de pagos.
- La sesión local carece del motor Docker accesible. La verificación general
  y SQL se consultan en CI del HEAD que identifica el handoff y el PR. La
  integración HTTP contra Storage real y la validación alojada quedan pendientes.
- Archivos modificados sobre una instantánea aislada. Los hashes de los archivos
  base afectados coincidieron con GitHub. El commit se publica mediante el
  conector de GitHub, con padre exacto y sin modificar el checkout original.

El Orchestrator tiene a cargo la integración, migración alojada y publicación.
La nueva migración depende de los contratos de Mi Membresía y del ledger revisado.
Para contener una incidencia, se puede retirar la capacidad de presentar/revisar
con revocaciones de sus RPCs y mantener archivos, historial y ledger. El
despliegue y la reversión se planifican junto con la revisión independiente.
Los resultados no certifican acceso al proyecto alojado.

## Instrucciones aplicadas

```
SKILLS_SELECTED: cueva-acceptance-audit, cueva-feature-development, cueva-architecture, cueva-finance, cueva-supabase-security, supabase:supabase, supabase:supabase-postgres-best-practices, vercel:react-best-practices
SKILLS_APPLIED: auditoría independiente del #36 y CI del SHA, base aislada y comparada, ledger transaccional en centavos, RLS y privilegios mínimos, bucket privado, índices e idempotencia, carga y revisión etiquetadas con estados locales, consultas independientes en paralelo y guías Next instaladas.
SKILL_SOURCES: .agents/skills/cueva-acceptance-audit/SKILL.md, .agents/skills/cueva-feature-development/SKILL.md, .agents/skills/cueva-architecture/SKILL.md, .agents/skills/cueva-finance/SKILL.md, .agents/skills/cueva-supabase-security/SKILL.md, c0/supabase, c0/supabase-postgres-best-practices, e0/skills/react-best-practices
```

## Correcciones de la auditoría del PR #37

- Base verificada en `main` a partir de
  `41c1ed77119793e28eaadeec7f4969a2d9cac7fa`, con el mismo árbol que el HEAD
  revisado del #36. Se conserva la historia del HEAD auditado del #37.
- El servidor reserva el período con la sesión y ficha verificadas antes de
  firmar. Los reintentos exactos mantienen el identificador y la ruta. La
  finalización vuelve a comprobar reserva y saldo bajo el lock del ledger.
- La reserva vence a las 2 h 15 min desde la última preparación de la misma
  operación. Incluye las 2 h documentadas del permiso Storage y margen de
  transferencia. Un archivo inválido bloquea la firma de esa reserva hasta su
  vencimiento. La limpieza usa Storage y libera la reserva después de borrar.
  El siguiente intento puede limpiar la reserva vencida de su período. El
  barrido diario cubre cargas abandonadas y requiere `CRON_SECRET`
  configurado por el Orchestrator. Procesa hasta 100 reservas por ejecución.
- PDF comprueba el índice, el catálogo apuntado por el tráiler y el árbol de
  páginas con pdf-lib. Se probaron PDF clásicos y con streams, el XRef falso de
  128 bytes y referencias a objetos ausentes. La inspección es estructural.
- [Laboratorio de Storage](../../experiments/cueva-004a-local/flow.mjs) con
  servicios y cuentas sintéticas. El flujo fuerza el vencimiento en la base
  desechable para probar la limpieza. El log y el artefacto
  `cueva-004a-storage-evidence` quedan en el CI del PR.

La retención de comprobantes presentados y la validación alojada quedan fuera
de esta corrección.

```
SKILLS_SELECTED: cueva-feature-development, cueva-finance, cueva-supabase-security, supabase:supabase, vercel:vercel-functions, pdf:pdf
SKILLS_APPLIED: base aislada, reglas financieras, RPC de servicio con sesión verificada, RLS y Storage privado, límites de carga, regresiones de formato y evidencia reproducible.
SKILL_SOURCES: .agents/skills/cueva-feature-development/SKILL.md, .agents/skills/cueva-finance/SKILL.md, .agents/skills/cueva-supabase-security/SKILL.md, c0/supabase, c20/vercel-functions, e5/skills/pdf
```

## Segunda corrección de auditoría del PR #37

Base de la corrección `fb76efc41ac3a43cf866492bd5d210f3a58be927`.
El validador comprueba referencias únicas en el árbol de páginas, límites
de 32 niveles y 100 páginas, y los conteos de cada subárbol. El análisis
acota los objetos a 10.000, los valores sintácticos a 100.000 y la expansión
de streams estructurales a 16 MiB acumulados. Admite tablas clásicas y
streams de referencias u objetos sin filtro o con Flate. La regresión
incluye un PDF de 1.756 bytes con 15 niveles de referencias repetidas, además
de ciclos y casos que exceden los límites.

La preparación puede recuperar una reserva vigente con la misma cuenta,
período, tipo, tamaño y SHA-256. El servidor devuelve la operación y la
ruta originales. La finalización usa ese identificador; si el comprobante
ya está pendiente con la misma huella, la preparación confirma su
presentación. La prueba de navegador cubre recargar o volver a seleccionar
el archivo. El laboratorio de Storage cubre la recuperación con otro ID
de solicitud, la finalización concurrente y el rechazo de otra cuenta u
otro archivo.

```
SKILLS_SELECTED: cueva-feature-development, cueva-finance, cueva-supabase-security, supabase:supabase
SKILLS_APPLIED: cambio acotado desde el HEAD auditado, recuperación con identidad y huella verificadas, idempotencia, regresiones de PDF y verificación en navegador, SQL y Storage aislado.
SKILL_SOURCES: .agents/skills/cueva-feature-development/SKILL.md, .agents/skills/cueva-finance/SKILL.md, .agents/skills/cueva-supabase-security/SKILL.md, c0/supabase
```

## Tercera corrección de auditoría del PR #37

Base `72f07daf384d82ff0c90df04693d59d4ec02e906`. La reproducción local
aceptó cinco catálogos clásicos con claves distintas de 128 KiB y
retuvo 20,7 MiB de heap tras GC. El parser comprueba los tokens antes
de delegar en pdf-lib, tanto en objetos clásicos como comprimidos.
Los límites son 1.024 bytes para nombres, 32 para números y 256 KiB
para cadenas literales o hexadecimales. Los presupuestos de objetos,
profundidad, páginas y descompresión siguen vigentes.

Cada validación evalúa el bundle de pdf-lib en un contexto propio.
Solo se reutiliza el código compilado. Los cachés de nombres y
referencias y los objetos que contienen quedan disponibles para GC
al finalizar. La regresión fuerza GC entre lotes de archivos válidos
con nombres y referencias distintos y verifica el límite de heap
retenido. El build incluye el bundle en la traza de la ruta de
comprobantes.

```
SKILLS_SELECTED: cueva-feature-development
SKILLS_APPLIED: reproducción sobre el HEAD auditado, límites previos al parser, contexto por documento, pruebas de regresión y verificación de CI
SKILL_SOURCES: .agents/skills/cueva-feature-development/SKILL.md
```
