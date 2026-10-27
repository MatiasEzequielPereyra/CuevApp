Actuá como CODEX EXECUTOR de CUEVA.

TASK_ID: CUEVA-001A
OBJETIVO: establecer el contexto versionado del proyecto y una fundación local ejecutable para auditoría independiente.

MODEL_RECOMMENDATION:
- MODEL: gpt-6.1-sol
- REASONING_EFFORT: high
- ALTERNATIVE: gpt-6-astra / high
- REASON: documentación operativa, fundación técnica y visual acotada.
- COMPLEXITY: media.
- SECURITY_RISK: bajo en esta entrega; autenticación y datos reales están excluidos.
- EXPECTED_EFFICIENCY: adecuada para implementación verificable sin dedicar Astra a tareas rutinarias.

FUENTES AUTORIZADAS

Repositorio:
https://github.com/MatiasEzequielPereyra/CuevApp

Directorio:
C:\Users\pereyram\Desktop\CuevApp

Contexto funcional maestro:
C:\Users\pereyram\.codex\attachments\ff4fde59-2d6a-487e-bf18-7f87ec5819b8\Texto pegado.txt

Protocolo ORCHESTRATOR V2:
C:\Users\pereyram\.codex\attachments\28610252-af20-4057-8e19-bfa7fb3b22dd\Texto pegado.txt

Logo original:
C:\Users\pereyram\Downloads\WhatsApp Image 2026-10-27 at 3.03.43 PM.jpeg

Supabase objetivo:
vbkzoojkdkcugxhneyzi

El contexto maestro define los requisitos funcionales; el protocolo V2 define responsabilidades y controles. Las instrucciones posteriores del usuario prevalecen. El prompt técnico anterior es histórico y no debe reintroducir requisitos descartados.

BASE_SHA: NOT_APPLICABLE_EMPTY_REMOTE.
La última inspección confirmó un remoto sin referencias ni commits y una carpeta local vacía. Revalidar antes de actuar.

1. VERIFICACIÓN INICIAL

Comprobar ruta física, archivos existentes, instrucciones aplicables, remoto, ramas y HEAD. Preservar cualquier trabajo aparecido desde la inspección. Si el estado cambió, informar y adaptar el trabajo a la base real; nunca inventar un SHA ni sobrescribir cambios.

2. CONTEXTO VERSIONADO

Incorporar:

- docs/product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md: copia íntegra del documento entregado.
- docs/engineering/ORCHESTRATOR-CUEVA-V2.md: copia íntegra del protocolo.
- docs/architecture/decisions.md: registro de decisiones técnicas, con estado propuesto/aceptado, motivo, alternativas y consecuencias.
- docs/engineering/checkpoint.md: tarea, estado, evidencia, bloqueos, base, implementación, integración, despliegue y siguiente paso.
- docs/engineering/backlog.md: tracks CUEVA-001 a CUEVA-008 y backlog posterior claramente separado.
- docs/brand/reference.jpeg: referencia original del logo, separada de los assets utilizados por la aplicación.
- README.md: instrucciones de desarrollo y orden de lectura para futuros ejecutores.

Registrar la procedencia y comprobar hashes de las copias de los documentos y la imagen. Mantener los documentos originales sin reinterpretarlos silenciosamente. Registrar futuras modificaciones de alcance con su decisión correspondiente.

En el checkpoint inicial:
- Supabase: NOT_VERIFIED, acceso rechazado.
- Integración y despliegue: NOT_RUN.
- CUEVA-001A: IN_PROGRESS durante el trabajo; REVIEW al entregar.
- No marcar decisiones técnicas como aceptadas antes de la auditoría.

Evitar un SHA autorreferencial: el handoff identifica el HEAD final; el checkpoint distingue el commit auditado del commit que posteriormente registra la aceptación.

3. PREPARACIÓN GIT

Si el remoto sigue vacío, inicializar el repositorio local con el origin exacto. Crear un commit raíz documental en main y registrar BOOTSTRAP_SHA. Desde esa base, crear una rama de implementación para CUEVA-001A.

Mantener ambos pasos locales y auditables. La publicación inicial de main queda a cargo del ORCHESTRATOR después de revisar el bootstrap.

4. FUNDACIÓN EJECUTABLE

- Preparar Next.js App Router, React y TypeScript estricto. Evaluar Tailwind según compatibilidad actual; registrar versiones exactas y lockfile.
- Crear una pantalla inicial en español, responsive y accesible.
- Implementar temas claro y oscuro con elección del usuario.
- Utilizar negro, blanco, grafito y grises.
- Reproducir fielmente el lettering mediante SVG o recurso original recortado. Compararlo visualmente con la referencia; no sustituirlo por texto de una fuente genérica.
- Excluir de los assets de aplicación la barra del teléfono y los controles de Instagram.
- Preparar scripts de lint, typecheck, pruebas pertinentes y build.
- Preparar CI de verificación sin despliegue ni secretos.
- Permitir ejecución local sin credenciales ni conexión a Supabase.

No presentar dashboards con cifras ficticias ni botones que aparenten funcionalidades operativas.

Archivos previstos: package.json, lockfile, configuraciones, src/app, componentes de marca y temas, public/brand, pruebas pertinentes, .github/workflows y documentación indicada.

5. REQUISITOS QUE LA FUNDACIÓN DEBE PRESERVAR

El MVP prioriza pagos, recordatorios y rutinas:
- Alta administrativa con DNI, email o ambos y una identidad única.
- Contraseña temporal individual y cambio obligatorio.
- Pagos parciales, saldos e historial trazable.
- Confirmación administrativa de comprobantes.
- Un email el día anterior al vencimiento, usando America/Argentina/Buenos_Aires.
- Una nota principal por alumno, autoguardado de borrador y publicación explícita.
- Ejercicios estructurados opcionales con resultados persistentes.
- Videos propios y YouTube reutilizables.
- PWA instalable y lectura offline de rutinas.

Asistencia/QR, push y estadísticas avanzadas pertenecen al backlog posterior. No implementarlos ni usarlos como requisitos de aceptación de V1.

6. EXCLUSIONES DE ESTA TAREA

No implementar todavía autenticación, base de datos, pagos, comprobantes, emails, editor funcional, videos operativos ni service worker.

No ejecutar SQL remoto, crear infraestructura, contratar servicios, configurar secretos, publicar ramas, abrir PR, hacer merge o desplegar.

7. VERIFICACIÓN

Exigir:
- Copias documentales íntegras y enlaces locales válidos.
- Backlog coherente con el contexto maestro.
- Instalación reproducible desde lockfile.
- Lint, typecheck, pruebas pertinentes y build aprobados.
- Smoke local de página y assets.
- Evidencia visual a 360, 390, 768 y 1440 píxeles.
- Ambos temas, teclado, foco visible, contraste y ausencia de desbordamiento horizontal.
- Comparación visual del logo.
- Revisión de secretos y vulnerabilidades críticas conocidas introducidas.

Registrar comandos, resultados, fecha y commit comprobado. Usar NOT_RUN o NOT_VERIFIED cuando corresponda.

8. HANDOFF

Entregar commits locales revisables y árbol limpio, salvo evidencia documentada. PR_URL: NOT_CREATED_EMPTY_REMOTE mientras no exista base remota.

CODEX_TO_ORCHESTRATOR_HANDOFF_V1
TASK_ID:
BASE_SHA:
BOOTSTRAP_SHA:
HEAD_SHA:
BRANCH:
PR_URL:
FILES_CHANGED:
IMPLEMENTATION_SUMMARY:
TEST_RESULTS:
SECURITY_RESULTS:
KNOWN_LIMITATIONS:
EVIDENCE:
WORKTREE_STATUS:
DEPLOYMENT_STATUS:
RISKS:

Finalizar en REVIEW. La auditoría independiente, aceptación, integración y despliegue corresponden al ORCHESTRATOR.