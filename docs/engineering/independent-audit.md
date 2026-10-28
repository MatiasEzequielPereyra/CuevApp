# CUEVA-001A — Auditoría independiente

Fecha: 2026-10-28 (America/Buenos_Aires). Responsable: ORCHESTRATOR CUEVA.

## Identidad y dictamen previo a publicación

- Bootstrap documental revisado y aceptado: `fe9db1792fbbf41d9ccdb071676781b64b203ed2`.
- HEAD entregado y verificado: `18290f472398d72ec09a32a29861833e567f6dc0`.
- Implementación anterior: `4df756fe8f25ddd21b0bab5c421e1512d77ccfb0`.
- Ruta física: `C:\Users\pereyram\Desktop\CuevApp`, directorio sin enlace.
- Rama revisada: `cueva-001a-foundation`; árbol limpio antes y después de las pruebas.
- Dictamen local: PASS, sin hallazgos bloqueantes. CI remoto pendiente; merge todavía no autorizado por resultado de checks.

El diff desde el bootstrap fue inspeccionado. El delta entre implementación y
HEAD entregado contiene únicamente documentación/evidencia, sin cambios en
runtime, dependencias, pruebas o configuración. El bootstrap contiene solo
documentación, referencia visual y atributos/ignorados de Git.

## Standards

Revisión estática delegada independiente: 0 hallazgos accionables. La separación
servidor/cliente, limpieza de suscripciones, comportamiento ante fallos de storage,
script de tema constante y permisos mínimos de CI son adecuados al incremento.
La revisión principal corroboró código, configuración, pruebas y lockfile.

## Spec

Revisión principal completada: 0 incumplimientos bloqueantes de CUEVA-001A.
El subagente de requisitos entregó observaciones parciales y terminó por límite
de uso; su ejecución no se cuenta como una revisión delegada completada.

Las cuatro fuentes coinciden en longitud y SHA-256 con los archivos originales,
el árbol local y los blobs de Git. Los 35 archivos del manifest de evidencia
también coinciden localmente y en Git. Ninguna resolución del lockfile apunta
fuera del registro npm. El backlog conserva las exclusiones de QR/push/gráficos.

La comparación visual conserva la geometría y silueta de las letras, sin fuente
genérica ni controles sociales. El SVG es apto como reconstrucción de esta
fundación; no se declara archivo maestro original ni igualdad de píxeles.
Se inspeccionaron capturas móviles, tablet y escritorio en ambos temas.

Observación documental menor: los nombres `*.log` de la corrida histórica son
basenames del entorno del ejecutor, no enlaces a archivos versionados. Las copias
publicadas se encuentran en `evidence/logs/*.txt`; `audit.log` corresponde a
`evidence/checks/npm-audit.json`. El informe del ejecutor ya enlaza las rutas
correctas. Se preserva la evidencia histórica sin reescribir sus registros.

## Verificación independiente sobre HEAD entregado

- `npm ci --no-fund`: PASS, 360 paquetes instalados, cero vulnerabilidades reportadas.
- `npm run verify`: PASS (lint, typecheck, build, 2 tests documentales y 16 Playwright).
- `npm run verify:sources`: PASS, 4/4.
- `npm run verify:security`: PASS, 71 archivos, cero coincidencias; complementado con revisión estática.
- `npm audit --json --audit-level=critical`: PASS, cero vulnerabilidades reportadas en todas las severidades.
- `git diff --check`: PASS.

Logs independientes: [instalación](../../evidence/orchestrator/install.txt) y
[verificación](../../evidence/orchestrator/verify.txt). Windows, Node 22.14.0,
npm 10.9.2, Chromium local. La suite verifica HTTP 200, assets, temas, teclado,
storage, contraste y ausencia de overflow a 360/390/768/1440 px.

## Riesgos y decisiones

ESLint 9 está [fuera de soporte](https://eslint.org/version-support/). El lockfile
confirma que los plugins actuales declaran peers compatibles con ESLint 9 y no
con 10. Su uso como herramienta de desarrollo se admite para este incremento,
con seguimiento de actualización; no equivale a soporte vigente ni a ausencia
universal de vulnerabilidades. No se contrataron servicios de soporte.

Se aprueban técnicamente D001–D005 para la fundación; D006 se admite con esta
limitación de mantenimiento y revisión antes de ampliar la cadena de herramientas.
No se aceptan por extensión autenticación, RLS o funciones futuras.

## Control de publicación e integración

Antes de publicar, `git ls-remote origin` sigue vacío. GitHub confirma permisos
de escritura/administración y squash disponible; consultas de rulesets y hooks
devuelven listas vacías. La cuenta Vercel conectada no lista un proyecto Git
asociado con CuevApp. El workflow inspeccionado verifica y no despliega.

Plan: publicar únicamente el bootstrap en main, publicar la rama revisada con
esta evidencia documental, abrir PR y exigir CI de ese HEAD antes de fusionar.
El permiso permanente del usuario autoriza esta integración sin confirmación
individual. No se eluden protecciones ni se equipara CI local con CI remoto.

Despliegue: BLOCKED por infraestructura pendiente. El equipo Vercel disponible
usa Hobby, cuyo [uso es personal y no comercial](https://vercel.com/docs/plans/hobby).
No se crea proyecto, contrata plan ni cambia configuración. Supabase permanece
NOT_VERIFIED; no se reintentó acceso ni se realizó escritura.

Móviles físicos, Safari/Firefox, lector de pantalla manual, runtime remoto,
PWA instalable/offline y recuperación de producción: NOT_RUN/NOT_VERIFIED.
