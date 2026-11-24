# Estado operativo y auditoría de ramas — 19 de noviembre de 2026

> **Fotografía verificable (GitHub, Supabase y Vercel); no es una orden de borrar ramas.**
> Foto histórica al 19/11. Para el estado posterior consultar la [reconciliación del 24/11](REPO-STATUS-2026-11-24.md); no aplicar esta foto como autoridad vigente.
> La ejecución de limpieza de refs está **PENDIENTE**: el conector GitHub de esta sesión no expone borrar ramas.

## Fuentes de verdad y release

- Repositorio: [CuevApp](https://github.com/MatiasEzequielPereyra/CuevApp/); `main` verificado: [`aa7cd36041412aa1b14a4d2b0f6145728084cb5d`](https://github.com/MatiasEzequielPereyra/CuevApp/commit/aa7cd36041412aa1b14a4d2b0f6145728084cb5d).
- GitHub: **0 PR abiertos**; último merge [#74](https://github.com/MatiasEzequielPereyra/CuevApp/pull/74), interfaz de comprobantes. [#73](https://github.com/MatiasEzequielPereyra/CuevApp/pull/73) separa Mi cuenta y recuperación de acceso; [#67](https://github.com/MatiasEzequielPereyra/CuevApp/pull/67) integra texto libre y menciones; [#63](https://github.com/MatiasEzequielPereyra/CuevApp/pull/63) sincroniza cambios de correo confirmados.
- CI de ese SHA: [Verify foundation PASS](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44559334583) y [Supabase local migrations PASS](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44559334276) en fresh, upgrade y hosted-compatible.
- Vercel: `cueva-gym.vercel.app` corresponde a despliegue de producción `dpl_EvNhhD3dS2GaSKA6VwQvGFgFzUe6`, estado **READY**, desde `aa7cd36041412aa1b14a4d2b0f6145728084cb5d`. READY no demuestra una prueba autenticada de todas las rutas.
- Supabase Hosted: proyecto `vbkzoojkdkcugxhneyzi` **ACTIVE_HEALTHY**, PostgreSQL **17.11**; consulta de solo lectura confirmó **33 migraciones**. Están registradas `cueva_student_email_sync`, `cueva_student_assigned_exercises` y `cueva_routine_text_mentions`. Existen `public.cueva_student_assigned_exercises()`, `cueva_private.my_routine_video_ids()` y `public.cueva_routine_text_publications`.
- En Hosted faltan las extensiones `pg_cron` y `pg_net`; no dar por activado el envío automático CUEVA-005. Ver [runbook](../operations/CUEVA-005-rollout-checklist.md) antes de cualquier operación real.
- El cambio SQL de **CUEVA-006E** `20261119130000_cueva_mention_video_availability.sql` solo está en una rama sin merge, **no** en el inventario de 33 migraciones alojadas.

## Producto implementado en main

Acceso con correo obligatorio, invitación administrativa y contraseña propia (DNI opcional solo en la ficha); administración de alumnos, cuotas y pagos parciales, vencimientos individuales, comprobantes privados, biblioteca y video de ejercicios, rutinas por días/bloques/vueltas/pesos, texto libre con menciones, lectura del alumno y bandeja interna de notificaciones.

**Aún pendiente de aceptación/operación:** registro e historial de entrenamientos realizados, rutina sin conexión, envío automático de recordatorios y entrega Push real observada en dispositivo. No confundir existencia de código con prueba en producción.

## Auditoría de referencias remotas

**Fecha de corte: 2026-11-19.** Ramas totales: **33** (incluida `main`). Candidatas a borrar: **25**. Conservar: **7** más `main`.
El criterio para «candidata a borrar» es estricto: PR **MERGED** y SHA HEAD del PR **idéntico** al SHA actual de la rama. Las fusiones squash pueden hacer aparecer una rama como diverged; eso **no** invalida el estado merged del PR. Para borrar, revalidar el SHA remoto inmediatamente antes, nunca borrar una rama que haya avanzado.

### Candidatas a borrar (integradas; borrado aún no ejecutado)

| Rama | PR integrado | SHA de rama comprobado |
| --- | --- | --- |
| `codex/cueva-005-notification-fixes` | [#65](https://github.com/MatiasEzequielPereyra/CuevApp/pull/65) | `7ade92558364a9fcd6d75c44c81d2446d5769355` |
| `codex/cueva-005-rollout-audit` | [#61](https://github.com/MatiasEzequielPereyra/CuevApp/pull/61) | `9d38f5ba7a2a03e7ae2d4a7492b357624df475c0` |
| `codex/cueva-admin-account-menu` | [#49](https://github.com/MatiasEzequielPereyra/CuevApp/pull/49) | `4e026793e23856d667f86092552ebc67d07415ce` |
| `codex/cueva-audit-picomatch-exception` | [#70](https://github.com/MatiasEzequielPereyra/CuevApp/pull/70) | `4ee06d5e948427c56ce9541a5a5e6d1ee6a1a533` |
| `codex/cueva-ejercicios-ux` | [#48](https://github.com/MatiasEzequielPereyra/CuevApp/pull/48) | `b28baaa8cb81088a30027161779f6ee25a809849` |
| `codex/cueva-pr58-checkpoint` | [#59](https://github.com/MatiasEzequielPereyra/CuevApp/pull/59) | `7b5a6a1cb30e931e54073b2d408922d697fe6266` |
| `codex/cueva-pwa-login` | [#57](https://github.com/MatiasEzequielPereyra/CuevApp/pull/57) | `19f6545540f53919f3d639757152a0819651684c` |
| `codex/cueva-test-fixture-isolation` | [#72](https://github.com/MatiasEzequielPereyra/CuevApp/pull/72) | `2a08a8b6905987a3705ca221ce573c416871b78e` |
| `codex/cueva-ux-alumnos` | [#52](https://github.com/MatiasEzequielPereyra/CuevApp/pull/52) | `37601aa4aa1fd59a1b16eb3cb429a53d74cc26ab` |
| `codex/cueva-ux-inicio` | [#50](https://github.com/MatiasEzequielPereyra/CuevApp/pull/50) | `3a325794d7203321ec026a8da2aa94910d6e8f98` |
| `codex/cueva-ux-mi-rutina` | [#55](https://github.com/MatiasEzequielPereyra/CuevApp/pull/55) | `00977d70c57c23fea999fe87e4ec7cc7d880ef0b` |
| `codex/cueva-ux-nav-movil` | [#51](https://github.com/MatiasEzequielPereyra/CuevApp/pull/51) | `b87af7eb26fdd49ef439665f20a8e7ae7639e583` |
| `codex/cueva-ux-nuevo-bloque` | [#58](https://github.com/MatiasEzequielPereyra/CuevApp/pull/58) | `c0322e3c7c1c2dc82880a314b350c10b878cbd8c` |
| `codex/cueva-ux-portal-alumno` | [#69](https://github.com/MatiasEzequielPereyra/CuevApp/pull/69) | `e38129d6479aa8becbcaddd4bf209a8773389ba1` |
| `codex/cueva-ux-rutinas-editor` | [#54](https://github.com/MatiasEzequielPereyra/CuevApp/pull/54) | `9baa9d5223fa82affd327b1329502fa360297c58` |
| `codex/next-16-4-6` | [#66](https://github.com/MatiasEzequielPereyra/CuevApp/pull/66) | `301de0dd0928ce7eb05e800e508380086d1c5063` |
| `docs/reconcile-current-state-2026-11-16` | [#60](https://github.com/MatiasEzequielPereyra/CuevApp/pull/60) | `1ece52752803e847f88b2d2cbe0f4cd97927b833` |
| `feature/account-password-management` | [#64](https://github.com/MatiasEzequielPereyra/CuevApp/pull/64) | `59ed005c690a9f0c8f3e04958edb15af39df1920` |
| `feature/cueva-admin-account-student-access-ux` | [#73](https://github.com/MatiasEzequielPereyra/CuevApp/pull/73) | `baf7ae61956f971063422b8b97fcbbdd89e3aba1` |
| `feature/cueva-exercise-prefix-search` | [#62](https://github.com/MatiasEzequielPereyra/CuevApp/pull/62) | `f6b3d89d0ffbc32b881b6afa6c40ab90c5f2c163` |
| `feature/cueva-ux-comprobantes-actions` | [#74](https://github.com/MatiasEzequielPereyra/CuevApp/pull/74) | `244f0e9e5b3ae25a5991cffdb35ed4cd093efe69` |
| `feature/routine-text-mentions` | [#67](https://github.com/MatiasEzequielPereyra/CuevApp/pull/67) | `65cfd36b3864d95c32fdcf9e36f19f58271fc4c2` |
| `feature/student-portal-experience` | [#53](https://github.com/MatiasEzequielPereyra/CuevApp/pull/53) | `a44d5a7c2c1c4e3e5b87dae9665ead9c081bd9b8` |
| `feature/student-portal-polish` | [#63](https://github.com/MatiasEzequielPereyra/CuevApp/pull/63) | `de2f3424b9b026d85e62da203bf75450b3a156fd` |
| `fix/notification-inbox-hydration` | [#68](https://github.com/MatiasEzequielPereyra/CuevApp/pull/68) | `e0bdd681fb11e9f9d31785608bc113328d7b456d` |

### Ramas conservadas (sin pruebas suficientes para borrado seguro)

| Rama | SHA | Motivo |
| --- | --- | --- |
| `codex/continuidad-20261119` | `d6c73542bedd16ea2973cdc562fc4699228064c6` | PR #71 cerrado sin merge; documentación no integrada |
| `codex/cueva-dashboard-002` | `6ddc6d2014f97e1e77720cb0239eddc8c853f314` | Sin PR de integración verificable; diferencias propias |
| `docs/cueva-004-requirements` | `0ac5e9a12aef5502bf3d64ce1a58b0541b27241f` | Sin PR de integración verificable; diferencias propias |
| `docs/cueva-work-plans` | `1d1dd47b3bb06f41faf7d39b26f948a1b694d3a4` | Sin PR de integración verificable; diferencias propias |
| `feature/cueva-005-notificaciones` | `96f7da8cf7468771ce776978425ef4d8c4e87bc9` | PR #56 cerrado sin merge; una prueba difiere de main |
| `feature/cueva-006e-exercise-mention-preview` | `10357aa7f9f54e228808834f40cbc99132abf568` | Trabajo funcional no integrado; CI fresh falla |
| `integration/student-portal-main` | `9d79aa4018550640969b49155ecb40006b7fea3b` | Sin PR de integración verificable; diferencias propias |

En particular:
- `feature/cueva-006e-exercise-mention-preview`, HEAD `10357aa7f9f5`: Verify foundation PASS; [Supabase local migrations FAIL](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44582755417) solo en fresh, durante `Run authenticated UI-to-Supabase integration`. La prueba `tests/e2e/mi-rutina.integration.mjs` línea 115 agotó 30 s esperando el botón «Cerrar aviso» de «Sentadilla». Upgrade y hosted-compatible PASS. Corregir sin debilitar pruebas; no mergear ni migrar Hosted aún.
- `codex/continuidad-20261119`: PR #71 cerrado **sin fusionar**. Sus documentos de continuidad deben analizarse antes de una eventual eliminación.
- `feature/cueva-005-notificaciones`: PR #56 cerrado **sin fusionar**, aunque PR #45 y #47 de esa misma rama sí fueron fusionados. No eliminar por el historial parcial.
- `docs/cueva-004-requirements` contiene diferencias en una fuente protegida histórica; no sustituir `docs/product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md` desde esa rama.
- `integration/student-portal-main`, `codex/cueva-dashboard-002` y `docs/cueva-work-plans` contienen diferencias propias sin PR asociado; revisar antes de resolverlas.

## Utilidad de limpieza segura (preparada, no ejecutada)

Se agregó [`scripts/prune-merged-branches.ps1`](../../scripts/prune-merged-branches.ps1) para Windows/PowerShell con GitHub CLI autenticado. Ejecutar `./scripts/prune-merged-branches.ps1` hace **dry-run**. Solo `./scripts/prune-merged-branches.ps1 -Apply` intenta borrar: por cada rama vuelve a consultar el ref SHA y el PR merged, y omite cualquier discrepancia. **No se ha ejecutado el borrado remoto desde esta sesión**.

La fotografía de 33 ramas fue tomada **antes de crear** la rama de documentación `docs/cueva-reconcile-20261119`, que no forma parte de las 25 candidatas. Su ciclo de PR/merge también deberá cerrarse en una limpieza posterior.

## Recomendaciones y procedimiento de limpieza

1. **No tocar `main` ni las siete ramas reservadas.** No borrar ramas únicamente porque figuren detrás de main o estén asociadas a un PR antiguo.
2. Cuando se disponga de una operación de borrado de refs autorizada (GitHub UI/CLI), validar para **cada** candidata que su HEAD remoto sigue siendo el SHA de esta tabla y que el PR sigue MERGED; si hay discrepancia, omitir y auditar.
3. Borrar solo las 25 candidatas validadas. Comprobar el listado remoto después de cada operación y registrar errores. No declarar limpieza completa sin evidencia de desaparición.
4. Tras resolver CUEVA-006E, crear PR, revisar diff, confirmar CI PASS en el HEAD final, auditar seguridad/SQL y recién entonces integrar. No aplicar SQL a Hosted desde esta auditoría documental.

## Fuentes y controles de continuidad

Leer `AGENTS.md` y `README.md`; respetar `.agents/skills/cueva-feature-development/SKILL.md`, `cueva-acceptance-audit`, `cueva-release` y las skills de finanzas/seguridad cuando correspondan. Las fuentes originales listadas en `docs/engineering/source-manifest.json` son inmutables. La documentación histórica por fecha debe conservarse y esta foto no reemplaza la validación de un nuevo despliegue.
