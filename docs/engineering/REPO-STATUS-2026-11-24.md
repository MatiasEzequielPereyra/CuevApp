# Reconciliación del repositorio — 24/11/2026 — REVIEW

Base main verificada por Git y GitHub:
`425e23aa3e5d28a1d2ba08c41084e5bba021f297`. Candidato #75 recibido:
`d9b333674555d749b08f003cc4ac3c39a2369f64`. Esta entrega incorpora main
sin reescribir commits ajenos; los conflictos de checkpoint/backlog conservan
las fotos del 19 y 20/11 como historia explícita. La foto del 19 no se borra.

## Integrado y pendiente

- #82 CUEVA-006E está integrado, al igual que #84–#87 (menciones, selección y
  alineación). El fallo fresh documentado el 19/11 corresponde a esa foto,
  no al estado actual. #67, Vencimientos y los demás baselines no se reabren.
- PR abiertos comprobados el 24/11: [#75](https://github.com/MatiasEzequielPereyra/CuevApp/pull/75)
  documentación/limpieza; [#83](https://github.com/MatiasEzequielPereyra/CuevApp/pull/83)
  registro personal (apagado por defecto); [#88](https://github.com/MatiasEzequielPereyra/CuevApp/pull/88)
  entrenamiento (Draft). Las correcciones de cada PR tienen HEAD y CI propios.
- El Orchestrator informó el 24/11 Production READY sobre esta base y 33
  migraciones alojadas, sin tablas de entrenamiento ni RPC de registro personal.
  No se repiten esas consultas aquí ni se certifican recorridos autenticados.
  Cualquier SQL/activación nueva requiere su operación separada.
- Cron, entrega Push y lectura offline no se declaran operativos.

## Limpieza de ramas: preparada, no ejecutada

El inventario explícito del script conserva las 25 candidatas de la foto del
19/11. No se amplía por antigüedad ni por similitud de nombres. Cada ejecución
revalida el SHA exacto, PR merged a main y repositorios de origen/destino y el destino de push efectivo. Rechaza cualquier
reescritura `insteadOf`/`pushInsteadOf` y un `pushurl` alternativo. Un
fork, un origen distinto, una rama avanzada o un PR distinto quedan excluidos.
Las referencias sin evidencia y cualquier checkout con trabajo siguen intactos.

El modo por defecto es solo lectura. `-Apply` utiliza un único refspec de
borrado y `--force-with-lease=refs/heads/<rama>:<SHA esperado>` contra la URL
HTTPS fija del repositorio. El servidor compara el SHA al modificar la ref:
si otro push la avanza después de la inspección, rechaza el borrado. No se usa
DELETE REST incondicional ni una lease basada en referencias de seguimiento.
Se deshabilitan hooks y recursión a submódulos para esa operación.

Reproducción sin red: `node --test tests/prune-merged-branches.test.mjs`
(requiere PowerShell 7 `pwsh`, también disponible en el runner Ubuntu).
El harness reemplaza gh por un mock estricto y redirige únicamente el transporte
Git a un bare temporal local. Crea sus propios dos commits sintéticos, sin depender de objetos de ramas
que serán borradas. La copia temporal del script sustituye solo el SHA del primer
candidato por el commit sintético. Prueba dry-run, SHA cambiado, fork, PR abierto,
HEAD incorrecto, origen ajeno, reescritura de push, pushurl de fork, carrera,
borrado autorizado y replay (11 escenarios). La carrera
avanza realmente la referencia local entre inspección y receive-pack: la lease
rechaza el borrado y conserva el nuevo SHA. No contacta GitHub ni borra ramas
del proyecto; solo retira la carpeta temporal que él mismo creó.

Rollback: no hay operación alojada ni refs borradas que revertir en esta entrega.
Ante evidencia insuficiente, conservar la rama; no usar borrado forzado manual.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`resolving-merge-conflicts`, `cueva-acceptance-audit` (inventario y comprobaciones).
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`,
`.agents/skills/cueva-acceptance-audit/SKILL.md` y guía del host para conflictos.
Resultados locales nuevos: 11 escenarios PASS en PowerShell 7 y Windows
PowerShell 5.1; documentos 3/3, lint, tipos, fuentes, manifiesto, seguridad y diff
contra main aprobados. Build no repetido: no cambia runtime/configuración de la
app; CI general ejecuta el build del HEAD final. Los resultados de CI se registran
en el PR. La revisión independiente adicional detectó la reescritura de push y la
dependencia accidental de un commit histórico en la fixture; ambas se corrigieron
y la nueva revisión se registra en el PR antes de entregar.
