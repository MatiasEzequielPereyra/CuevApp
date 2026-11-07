# CUEVA-004A — Comprobantes desde Mi Membresía

Entrega del ejecutor para revisión. Base `f6e382a765f10a61c3e2aad3eeee7a282944e3c3` de `codex/cueva-mem-001`.
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
- La comprobación de formato cubre segmentos y fin de JPEG, CRC y flujo zlib
  acotado de PNG, y encabezado, referencias y cierre de PDF. Tiene un límite de
  64 MiB de datos PNG decodificados. No renderiza todos los codecs ni ejecuta el
  contenido de los PDF.
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

## Verificación y entrega

- Ejecutadas localmente con Node 22.14.0 y npm 10.9.2. Lint, TypeScript directo,
  fuentes 4/4, documentos 2/2, archivos y rutas 4/4, y navegador de Mi Membresía
  a 360 px. Las pruebas HTTP usan servicios sintéticos.
- [Pruebas de archivo y rutas](../../tests/receipts-file.test.mjs),
  [formularios en navegador](../../tests/e2e/receipts.spec.ts) y
  [prueba SQL](../../supabase/tests/payment-receipts.sql).
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
