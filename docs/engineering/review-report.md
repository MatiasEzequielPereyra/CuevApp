# CUEVA-001A — Informe local para revisión independiente

Estado: **REVIEW**. Fecha: 2026-10-27, America/Buenos_Aires. Rol: CODEX EXECUTOR.
No constituye aceptación, integración ni autorización de publicación.

## Identidad de la entrega

- Repositorio: https://github.com/MatiasEzequielPereyra/CuevApp
- Directorio físico: `C:\Users\pereyram\Desktop\CuevApp`, sin enlace observado.
- BASE_SHA: NOT_APPLICABLE_EMPTY_REMOTE. Precheck: `git ls-remote --symref` con
  exit 0 y cero referencias; carpeta vacía y sin Git. Sin AGENTS en ancestros.
- BOOTSTRAP_SHA: `fe9db1792fbbf41d9ccdb071676781b64b203ed2`, conservado en main local.
- IMPLEMENTATION_SHA auditado localmente: `4df756fe8f25ddd21b0bab5c421e1512d77ccfb0`.
- Rama: `cueva-001a-foundation`. PR_URL: NOT_CREATED_EMPTY_REMOTE.
- HEAD final: el handoff externo lo identifica. Este informe se guarda en un
  commit posterior que contiene únicamente documentación y evidencia.
- Aceptación independiente / SHA de aceptación: NOT_RUN / NOT_VERIFIED.

## Contenido

Fuentes originales completas, imagen documental separada del asset, manifest de
SHA-256/longitudes y precedencia de instrucciones. Backlog CUEVA-001 a CUEVA-008
con QR, push y estadísticas avanzadas posteriores al MVP. Decisiones D001–D006
PROPOSED; README y checkpoint para continuidad.

Next.js App Router 16.4.3, React/React DOM 19.3.1 y TypeScript estricto 6.0.3,
fijados junto a las herramientas en package.json y lockfile. CSS nativo evaluado
frente a Tailwind 4.3.3; menor número de dependencias para esta pantalla. La
selección se contrastó con el registro npm y la documentación oficial/instalada
de Next.js. Ver [versiones y decisiones](verification.md).

Página inicial en español, paleta negro/blanco/grafito/grises, temas claro,
oscuro y sistema. Solo la preferencia de apariencia se persiste localmente.
La pantalla comunica el desarrollo pendiente, sin cifras ficticias ni accesos
simulados. El SVG usa contornos geométricos, no una fuente genérica. Se conserva
la referencia original fuera de public y se entrega comparación lado a lado.

## Verificación sobre el commit de implementación

Entorno: Windows x64, Node 22.14.0, npm 10.9.2, Playwright 1.64.1,
Chromium 156.0.8078.4. Corrida principal: 15:53:29–15:56:45, UTC−03:00.
Cada comando tiene exit 0 y timestamps en [verification-run.json](../../evidence/checks/verification-run.json).

| Operación | Resultado | Evidencia |
| --- | --- | --- |
| `npm ci --no-fund` | PASS, 360 paquetes instalados desde lockfile | [Instalación](../../evidence/logs/install.txt) |
| `npm run lint` | PASS, cero warnings de lint | [Lint](../../evidence/logs/lint.txt) |
| `npm run typecheck` | PASS, generación de rutas y TypeScript | [Tipos](../../evidence/logs/typecheck.txt) |
| `npm run build` | PASS, página prerenderizada y 404 | [Build](../../evidence/logs/build.txt) |
| `npm test` | PASS, 2 pruebas documentales y 16 de navegador; sin retries | [Log](../../evidence/logs/tests.txt), [JSON](../../evidence/checks/playwright-results.json) |
| `npm run verify:sources` | PASS, cuatro copias byte a byte | [Hashes](../../evidence/logs/sources.txt) |
| `npm run verify:security` | PASS, sin hallazgos de patrones | [Escaneo](../../evidence/logs/security.txt) |
| `npm audit --json --audit-level=critical` | PASS, cero vulnerabilidades en todas las severidades | [Audit](../../evidence/checks/npm-audit.json) |
| `git diff --check` | PASS, sin salida | [Registro](../../evidence/logs/diff.txt) |
| `npm run dev` y GET de inicio/SVG | PASS, ambos HTTP 200 sobre IMPLEMENTATION_SHA | [Smoke](../../evidence/checks/dev-smoke.json) |

La suite de navegador inicia `next start`, carga página, CSS, JS y SVG y verifica
ausencia de errores y de peticiones a terceros en el inicio. Los cuatro anchos
360/390/768/1440 pasan en ambos temas; scrollWidth = innerWidth. axe informa cero
violaciones y cero comprobaciones incompletas, incluida la regla color-contrast.
Ver [galería y detalle por combinación](../../evidence/index.html).

Se verificaron Tab, Enter y espacio, enlace de salto que mueve foco al main,
botones con aria-pressed y contorno visible de 3 px con separación de 5 px;
navegación al proyecto, persistencia tras recarga, sincronización entre pestañas,
cambio del tema del sistema, storage denegado/corrupto y contenido sin JavaScript.
También reflow a 320 px, ausencia de formulario y service worker, y 404 de /admin.
Este último comprueba alcance de rutas; no demuestra autorización ni protección.

## Autoauditoría y seguridad

Diff completo revisado (configuración, componentes, estilos, pruebas, scripts,
workflow, documentación y entradas del lockfile). Dependencias directas exactas,
resoluciones del registro npm con integrity, sin force/legacy-peer-deps.
La revisión React mantiene página/layout en servidor y solo apariencia en cliente,
suscripciones con limpieza, sin fetching ni estado personal. El script de tema
es una constante de aplicación sin interpolación de entradas del usuario.

No se incorporan `.env`, SDK de Supabase, tokens, credenciales, datos de alumnos,
APIs de escritura ni capturas de sesiones externas. Los valores ilustrativos del
maestro permanecen exclusivamente en la fuente documental íntegra. El escaneo de
patrones se complementó con revisión manual; no prueba ausencia universal de secretos.
CI tiene permisos contents:read, sin paso de despliegue ni configuración de secretos.

Preparación: se corrigió el tipado DOM de las pruebas, se separó el recorrido de
teclado que dependía del foco tras recarga, y se usó un selector CSS para comprobar
noscript (el buscador de texto lo excluye). Sin JavaScript se oculta el selector
inactivo. Se sustituyó la propiedad de imagen deprecada priority por loading=eager.
Un intento de filtrar pruebas mediante npm no encontró tests por el paso de
argumentos; la ejecución directa posterior pasó 3/3 y la corrida final pasó 16/16.

## Límites y riesgos para el Orchestrator

- SVG provisional: comparación visual fiel en silueta, geometría y espacios;
  no se afirma igualdad exacta ni disponibilidad del maestro vectorial.
- ESLint 9.39.5 está fuera de soporte según npm, elegido por los peers actuales
  de los plugins de Next. Cero vulnerabilidades reportadas no elimina ese riesgo
  de mantenimiento. Revisar D006 en la auditoría.
- CI remoto: NOT_RUN. Solo se preparó el workflow; no se publicó nada.
- Safari, Firefox y móviles físicos: NOT_RUN. Lector de pantalla manual: NOT_RUN.
  axe y teclado no constituyen certificación completa de accesibilidad.
- Supabase: NOT_VERIFIED (rechazo de acceso previo); sin nuevas tentativas,
  escrituras ni conexión desde esta entrega.
- Auth/RLS, datos reales, pagos, correos, comprobantes, editor funcional, videos,
  PWA instalable y offline: NOT_RUN, excluidos de CUEVA-001A.
- Integración, push, PR, merge, infraestructura y despliegue: NOT_RUN.

## Entrega y siguiente paso

El [inventario](../../evidence/files-changed.txt) incluye los archivos del bootstrap
y la implementación. Las salidas locales ignoradas están descritas en el
[checkpoint](checkpoint.md). El commit documental de evidencia no cambia runtime,
dependencias, configuraciones ni pruebas respecto del IMPLEMENTATION_SHA verificado.

El Orchestrator debe auditar bootstrap, diff, fuentes y evidencia; decidir sobre
las propuestas técnicas; registrar aceptación en otro commit; y solo después
establecer main remoto y habilitar PR. Esta entrega termina en REVIEW.
