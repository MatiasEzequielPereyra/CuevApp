# CUEVA-006A — implementación y verificación local

Estado: REVIEW local, 2026-11-06. Base efectiva
`fb801dd557a8cb45b25d12cffc0170bd7e1ff79c`, igual a origin/main al comenzar.
Rama `codex/cueva-006a-rutinas`. El HEAD candidato se identifica en el handoff
final para evitar un SHA autorreferencial. Revisión independiente pendiente.

## Implementación

[Encargo íntegro](CUEVA-006A-task.md) y [modelo técnico](../architecture/routines.md).
Navegación administrativa Rutinas y acceso desde ficha; búsqueda de alumnos,
una nota principal, autoguardado confirmado y comparación explícita de conflictos.
Publicación consistente e idempotente con historial inmutable. Plantillas de
texto copiadas, con confirmación al reemplazar. Mi rutina y navegación del alumno
con última publicación/fecha o estado vacío. Conserva logo/temas/panel y cuatro
tarjetas de resumen; añade el acceso a rutinas en el espacio de trabajo y menú.

Se añade únicamente la migración
`20261106142345_cueva_routines.sql`, creada con CLI instalada. No se modifican
migraciones históricas, lockfile, dependencias, Auth, SMTP ni cuentas alojadas.
La eliminación de fichas vacías comprueba rutinas y conserva todas sus FK.

## Reproducción acotada

Requisitos: Docker ya funcionando, Node/npm del proyecto y Chromium de Playwright.
No requiere credenciales ni archivos .env. Desde la raíz:

```powershell
Set-Location experiments/cueva-alumnos-local
$env:CUEVA_ROUTINES_ONLY = '1'
node lab.mjs
Remove-Item Env:CUEVA_ROUTINES_ONLY
Set-Location ../..
npm run lint
npm run typecheck
npm run build
npm run test:docs
npm run verify:sources
npm run verify:security
git diff --check
```

El modo nuevo reutiliza solo el arranque del laboratorio existente y el helper
de lanzamiento Next. Aplica en una base desechable las migraciones necesarias de
acceso/fichas/pagos/invitaciones/eliminación y la nueva de rutinas. No ejecuta los
recorridos históricos de alumnos, pagos, identidad, transporte o SMTP.
Roles, usuarios y credenciales sintéticos y efímeros; claves solo en memoria/env
de procesos hijos, no en argumentos, logs, capturas ni artefactos versionados.
Las capturas muestran exclusivamente nombres/correos sintéticos example.com.

Los recursos tienen prefijo exclusivo `cueva-rutinas-`, sufijo aleatorio,
puertos dinámicos ligados a 127.0.0.1 y límites 512 MB/1 CPU por contenedor.
En finally se cierran navegador y Next, contenedores exactos creados y su red.
No se reinicia Docker ni se toca Vendify. Ante interrupción forzosa, listar
`docker ps -a --filter name=cueva-rutinas-` y las redes de ese prefijo, comprobar
el sufijo de la ejecución y eliminar únicamente esos nombres propios. Nunca
usar prune ni filtros de proyectos ajenos. No hay volúmenes persistentes.

## Evidencia y alcance de comprobación

Ejecución final `2026-11-06T14:49:56.277Z`: **104/104 PASS**, incluidos 98
controles funcionales/seguridad/UI, una comprobación del aislamiento del rol de
base y cinco de limpieza. [Evidencia JSON con hashes de fuentes y capturas](../../experiments/cueva-routines-local/evidence.json).

| Verificación | Resultado nuevo |
| --- | --- |
| Laboratorio acotado real | 104/104 PASS |
| Lint y tipos | PASS |
| Build de producción Next 16.4.3 | PASS; las rutas privadas son dinámicas |
| Documentos / originales / escaneo de secretos / diff | PASS |
| axe WCAG A/AA en editor y consulta | Cero violaciones |
| 390 y 1440 px, claro/oscuro, tema sistema y teclado | PASS, sin overflow |
| npm audit umbral crítico | PASS; 8 moderadas preexistentes, 0 altas/críticas |
| Recursos propios al finalizar | Ningún contenedor/red/Next dev restante |
| Operaciones alojadas / push / PR / merge / deploy | NOT_RUN |

Capturas seleccionadas, inspeccionadas visualmente:
[editor móvil oscuro](../../evidence/CUEVA-006A/admin-390-dark.png),
[editor móvil claro](../../evidence/CUEVA-006A/admin-390-light.png),
[editor computadora oscuro](../../evidence/CUEVA-006A/admin-1440-dark.png),
[editor computadora claro](../../evidence/CUEVA-006A/admin-1440-light.png),
[alumno móvil oscuro](../../evidence/CUEVA-006A/pupil-390-dark.png),
[alumno móvil claro](../../evidence/CUEVA-006A/pupil-390-light.png),
[alumno computadora oscuro](../../evidence/CUEVA-006A/pupil-1440-dark.png),
[alumno computadora claro](../../evidence/CUEVA-006A/pupil-1440-light.png).
Son capturas full-page del laboratorio dev; el indicador Next es exclusivamente
local. Se conserva el SVG, acento, temas y composición aprobados.

Se verificó además el caso de revertir texto durante un guardado en vuelo:
advierte antes de navegar y persiste la última intención después de confirmar
la petición anterior. Prueba de deuda: un período realmente vencido y sin pagos
no impide consultar la publicación. Publicar produce cero mensajes en Mailpit.

El laboratorio comprueba UI → API de sesión → PostgREST/RPC → PostgreSQL real,
y consulta del alumno con sesión de Auth real. Pruebas de fallas del editor
inyectan un HTTP 503, demoran una respuesta confirmada y cortan una respuesta
después del commit; conflictos/privilegios/publicaciones se verifican contra
la base real. No se presentan mocks como prueba de permisos.

Durante el desarrollo se corrigieron etiquetas de controles cuyo texto accesible
incluía contenido/opciones, sincronización de la simulación de respuesta demorada
y aserciones del harness (40001 directo de PostgREST frente al 409 de nuestra API;
espera del cambio de tema por evento). Un fallo inicial no controlado del test
de demora dejó contenedores propios: se identificaron por su sufijo exacto y se
eliminaron, sin procesos Next ni recursos ajenos intervenidos. No se reutilizan
resultados de entregas previas ni se ocultan estos intentos como PASS finales.

## Operación y rollback conservador

La aplicación del esquema alojado, integración y publicación corresponden al
Orchestrator después de la auditoría. Primero la migración nueva sobre el esquema
existente (incluida eliminación), después el código. No aplicar SQL manual para
sortear permisos ni editar migraciones anteriores. Si falta la migración, las
páginas muestran indisponibilidad y no afirman un guardado exitoso.

Para retirar la interfaz, volver al código anterior sin eliminar tablas,
publicaciones, borradores, vínculos ni la protección de eliminación. No hay
rollback destructivo automático. La restauración del código no elimina el
contenido; cualquier retención/borrado requiere un encargo independiente.

## Límites y riesgos

- Implementación local; migración/uso alojados NOT_RUN / NOT_VERIFIED.
- Un cierre forzoso puede perder texto que aún no recibió confirmación: no hay
  offline, persistencia local de datos privados ni sincronización entre dispositivos.
- Ante conflicto, el administrador compara y elige explícitamente; no hay merge
  automático de textos ni historial de cada pulsación del borrador.
- Serialización breve compartida con pagos/eliminación, adecuada a la escala
  prevista; no se midió carga concurrente de producción.
- Límite de 40.000 caracteres por nota; 100 resultados de alumnos y 200 plantillas
  por listado (mensaje para refinar/advertencia). Sin pantalla de historial.
- Chromium y axe locales no certifican Safari ni dispositivos físicos o lector
  de pantalla. No se repiten matrices visuales de módulos no modificados.
- Biblioteca, videos, ejercicios estructurados, resultados, avisos, comprobantes
  y offline permanecen fuera de alcance. No hay bloqueos por deuda.
- D008 PROPOSED; no sustituye auditoría independiente ni aceptación de producto.
- `npm audit --audit-level=critical`: sin altas/críticas, ocho moderadas en la
  cadena de desarrollo existente (minimatch/typescript-eslint/eslint-config-next).
  Manifest y lockfile idénticos a la base. No se ejecutó audit fix ni se amplió
  este incremento para actualizar la cadena; mantenimiento pendiente.

Sin push, PR, merge, deploy, migraciones remotas ni comunicaciones reales.

## Archivos cambiados (34)

```text
README.md
docs/architecture/decisions.md
docs/architecture/routines.md
docs/engineering/CUEVA-006A-review.md
docs/engineering/CUEVA-006A-task.md
docs/engineering/backlog.md
docs/engineering/checkpoint.md
evidence/CUEVA-006A/admin-1440-dark.png
evidence/CUEVA-006A/admin-1440-light.png
evidence/CUEVA-006A/admin-390-dark.png
evidence/CUEVA-006A/admin-390-light.png
evidence/CUEVA-006A/pupil-1440-dark.png
evidence/CUEVA-006A/pupil-1440-light.png
evidence/CUEVA-006A/pupil-390-dark.png
evidence/CUEVA-006A/pupil-390-light.png
experiments/cueva-alumnos-local/lab.mjs
experiments/cueva-routines-local/.gitignore
experiments/cueva-routines-local/browser-test.mjs
experiments/cueva-routines-local/evidence.json
src/app/alumnos/page.tsx
src/app/api/rutinas/route.ts
src/app/cuenta/page.tsx
src/app/globals.css
src/app/mi-rutina/page.tsx
src/app/rutinas/page.tsx
src/app/rutinas/plantillas/page.tsx
src/components/dashboard/admin-dashboard.tsx
src/components/routines/note-editor.tsx
src/components/routines/routine-shell.tsx
src/components/routines/student-shell.tsx
src/components/students/delete-student-action.tsx
src/lib/routines/types.ts
src/proxy.ts
supabase/migrations/20261106142345_cueva_routines.sql
```
