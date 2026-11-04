# CUEVA-ACCESO-001 — entrada y login visual

Estado: **REVIEW**. 2026-11-04, America/Buenos_Aires. Implementación y
autorrevisión locales; revisión independiente, integración y publicación pendientes.

## Identidad del candidato y fuentes

- BASE_SHA: `fa87f778287434dbad016435b28b7d895a05f90e`.
- IMPLEMENTATION_SHA: `dedd835ff03e9f97b4057225f4d95e70b3ef97bd`.
- BRANCH: `codex/cueva-acceso-001`.
- WORKTREE: `C:\Users\pereyram\.codex\worktrees\cueva-acceso-001\CuevApp`.
- Base remota main corroborada con `git ls-remote` al iniciar y al cerrar las
  pruebas: sin avances respecto de la base pedida. Checkout nuevo y limpio al
  iniciar; `.git` físico, padre de la base `a5bcf43862cf487b0f1dfc59f0203e36db29c0e7`.
  No se modificaron los checkouts de Alumnos o planificación.

Se leyeron AGENTS, checkpoint y orden de README en la base vigente, decisiones,
mockup `docs/brand/panel-admin-mockup.png`, componentes de marca/tema y el panel
aprobado. El roadmap se consultó en el checkout de planificación
`cueva-deployment-checkpoint`, HEAD `96b7ae34576c9be57a54f8e4466dc561df3bb78e`;
no se copió ni modificó. El encargo posterior prevalece sobre antecedentes de DNI
y contraseña temporal. Se consultaron las guías instaladas de Next 16.4.3 sobre
redirect, useRouter, componentes servidor/cliente, formularios, CSS Modules y caché.
Skill Supabase aplicada al límite de integración; consulta pública del changelog,
sin cambios de SDK, Auth ni acceso al proyecto alojado. Checklist React aplicado.

## Resultado

La raíz responde con 307 a `/ingresar`; la antigua presentación deja de ser el
destino principal. El login usa el SVG existente, tarjeta y paleta del panel,
temas claro/oscuro/sistema, etiquetas, autocomplete de identidad/contraseña,
salto al contenido y foco visible. CSS Module propio, sin tocar globals.css.

El servidor entrega al cliente únicamente un booleano de disponibilidad:
`VERCEL_ENV === "production"` y `productConfig()` válido. Fuera de Production o
sin configuración, aviso explícito y fieldset deshabilitado. No se habilitaron
banderas ni entornos. No hay splash, registro público o recuperación simulada;
la ayuda orienta a contactar al gimnasio y explica el límite del correo.

El formulario mantiene method POST y action `/api/acceso/ingresar`. Con JavaScript
envía FormData al mismo endpoint y conserva las cookies gestionadas por servidor.
Un ref sincrónico evita doble envío; estado pendiente, botón deshabilitado y
campos readonly mientras espera. Las respuestas 401 tienen un mensaje genérico;
otros estados, desconexión y timeout de 20 segundos ofrecen orientación sin
mostrar cuerpos internos. El error recibe foco. La contraseña se borra del
formulario y del FormData al finalizar, sin logs, URL ni almacenamiento.

Solo una redirección del servidor al mismo origen y `/cuenta` inicia navegación
con replace/refresh. Un 200 aislado no se interpreta como ingreso correcto.
No se agregó detección automática de sesión en el login. `/cuenta`, su proxy,
getUser, perfil, RLS, roles y gate quedan en el contrato existente.

Archivos de implementación: `src/app/page.tsx`, `src/app/ingresar/page.tsx`,
`src/components/access/sign-in-form.tsx`, `src/components/access/access.module.css`.
Pruebas: `tests/e2e/access-form.spec.ts`, `tests/e2e/access-preview.spec.ts`,
`tests/e2e/foundation.spec.ts`. La evidencia y este informe son propios de Acceso;
checkpoint/backlog quedan para el Orchestrator.

## Verificación y resultados

Node 22.14.0 / npm 10.9.2. Instalación desde lockfile con `npm ci --ignore-scripts`.

| Control | Resultado y alcance |
| --- | --- |
| Lint final | PASS, cero warnings |
| Typecheck final | PASS, después de todos los cambios de pruebas |
| Build de producción | PASS, código runtime idéntico al candidato entregado |
| Documentos y fuentes | 2/2 pruebas PASS; fuentes 4/4 íntegras |
| Suite preexistente adaptada | 35/35 PASS: entrada cerrada, marca, temas, reflow, teclado, axe y panel sin cambios |
| Formulario activo controlado | 12/12 PASS: UI/axe/teclado, validación, Preview cerrado con configuración, doble envío, 401/403/404/429/503, desconexión, 200 sin redirect, timeout y continuación |
| Seguridad | Escaneo sin hallazgos y revisión manual del diff; sin cambios fuera del alcance |
| Dependencias | `npm audit --audit-level=critical` termina 0; 16 avisos moderados existentes, sin cambios de package/lockfile |
| Sesión real CUEVA, Auth/RLS alojados y logout real | NOT_RUN |
| Push / PR / merge / deploy / escritura remota / mensajes | NOT_RUN |

La corrida [inicial completa](../../evidence/acceso-001/initial-verification.txt)
ejecutó lint, tipos, build y documentos correctamente. En navegador terminó con
37 PASS, 1 FAIL y 7 NOT_RUN: el selector global de alertas encontró también el
anunciador que incorpora Next. Se acotó al formulario; no se cambió runtime.
Después se añadieron casos de Preview y timeout y la
[suite específica final](../../evidence/acceso-001/final-form-tests.txt) pasó
12/12, con [resultado estructurado](../../evidence/acceso-001/final-form-results.json).
Se repitieron lint/tipos tras los cambios de pruebas. Son **47 casos únicos PASS
en conjunto**, no una corrida final única de `npm run verify`; no se repitió el
build ni las suites sin cambios. Los intentos preliminares de lint/build habían
detectado una navegación no recomendada y un tipo del fixture; ambos corregidos
antes de esta corrida completa.

La UI activa se ejecutó como build real local con configuración exclusivamente
sintética y respuestas del POST controladas por Playwright. La continuación usó
un 303 sintético y la ruta real `/cuenta` sin cookies: mostró “Ingresá para
continuar”, sin bucle y con no-store. Esto verifica navegación y cierre sin sesión,
**no** acredita autenticación. No había servicios locales CUEVA en ejecución;
los contenedores de otro proyecto no se utilizaron y no se repitieron laboratorios.
No se crearon cuentas ni se usaron credenciales reales. Traces/video/capturas
automáticas están apagados para los casos del formulario; capturas manuales
seleccionadas con campos vacíos. No se exportaron cookies o sesiones.

## Evidencia visual

[Galería](../../evidence/acceso-001/index.html), revisada visualmente en sus cuatro
variantes. Capturas de UI activa con configuración sintética, sin sesión ni datos
del gimnasio:

- [Celular claro, 390 px](../../evidence/acceso-001/mobile-light.png).
- [Celular oscuro, 390 px](../../evidence/acceso-001/mobile-dark.png).
- [Computadora clara, 1440 px](../../evidence/acceso-001/desktop-light.png).
- [Computadora oscura, 1440 px](../../evidence/acceso-001/desktop-dark.png).

Entrada cerrada comprobada en 360/390/768/1440 px y reflow a 320 px. Axe conserva
WCAG 2 A/AA y 2.1 AA sin reglas desactivadas. Temas persistentes, sistema dinámico,
sin almacenamiento y sin JavaScript se mantienen cubiertos por la suite adaptada.

## Límites y riesgos para revisión

No hay certificación de sesión real ni de disponibilidad alojada por esta tarea.
Safari/Firefox, celulares físicos y lector de pantalla manual: NOT_RUN. La UI se
habilita únicamente con la señal Production existente de Vercel y configuración
servidor válida; un build local normal muestra el estado cerrado.

El timeout cancela la espera del navegador, sin garantizar cancelación de una
operación que ya llegó al servidor. El mensaje no afirma que se haya autenticado
o rechazado la cuenta. La política de rate limiting, los controles de origen y
los errores del POST siguen siendo responsabilidad del mecanismo existente.
Sin JavaScript se conserva el POST nativo y sus respuestas genéricas actuales.

No se modificaron API de Auth, product-auth, proxy, dashboard, rutas Alumnos,
globals.css, migraciones, dependencias, secretos, correo ni configuración alojada.
El SVG aceptado sigue siendo la reconstrucción existente, sin modificaciones.
Revisión independiente, integración y publicación corresponden al Orchestrator.
El handoff final en el chat identifica el HEAD documental posterior a este candidato,
evitando un SHA autorreferencial dentro de este informe.
