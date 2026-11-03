# CUEVA-UI-002 — Dashboards por rol y navegación principal

Estado: READY FOR IMPLEMENTATION. Alcance limitado a dashboards y navegación. No incluye rutinas.

## Base y continuidad
- Rama: `codex/cueva-dashboard-002`
- Base verificada: `fa87f778287434dbad016435b28b7d895a05f90e` (HEAD de `main` al iniciar esta tarea).
- CUEVA-UI-001 / PR #21 está integrado. Su Dashboard del Administrador es la base visual existente; no reconstruirlo.
- Antes de implementar, volver a verificar HEAD de main y rama. Si main avanzó, detenerse y reconciliar mediante una nueva rama/base; no sobrescribir trabajo ajeno.
- Leer checkpoint, README, Product Master, Orchestrator y decisiones vigentes. Las instrucciones recientes del Product Owner prevalecen sobre documentos históricos.

## Objetivo
Completar la experiencia de inicio para los dos roles vigentes de CUEVA:
1. Administrador principal.
2. Alumno.

Construir una navegación responsive coherente con el mockup CUEVA: sidebar en escritorio y barra inferior fija en mobile. El control central "+" es opcional y contextual; no debe implementarse por obligación. Rutinas queda expresamente fuera del alcance funcional de esta tarea.

## Alcance funcional

### A. Dashboard del Administrador principal
- Reutilizar `src/components/dashboard/admin-dashboard.tsx` y sus estilos actuales.
- Mantener la identidad existente: marca CUEVA, paleta grafito/negro/grises, violeta, tipografía y temas claro/oscuro.
- Presentar únicamente indicadores respaldados por consultas y datos reales disponibles. Si una fuente aún no existe, conservar estado vacío honesto; no fabricar cifras ni registros.
- Los accesos a módulos no implementados deben identificarse como no disponibles y no aparentar navegación/operación funcional.
- No introducir CRUD de alumnos, pagos, comprobantes ni rutinas en este incremento.
- Mantener el cierre de sesión actual sin alterar su endpoint ni su semántica.

### B. Dashboard del Alumno
- Inspeccionar el flujo de autenticación, perfil, rol y rutas protegidas ya existentes antes de crear rutas o componentes.
- Crear la pantalla de inicio específica del alumno, usando el mismo sistema visual.
- Mostrar solo información existente y autorizada del alumno: identidad/perfil y estados reales disponibles.
- Si cuota, vencimiento, pagos, comprobantes, rutina o actividad no tienen modelo/consulta operativa, mostrar estado vacío o "próximamente" sin datos sintéticos.
- No implementar editor, asignación ni consulta funcional de rutinas. No modificar el dominio de rutinas.
- No agregar endpoints, tablas, migraciones ni políticas RLS para completar tarjetas visuales.

### C. Navegación por rol
- Escritorio: reutilizar/adaptar el sidebar existente.
- Mobile: barra inferior fija con safe-area, accesible y sin tapar contenido.
- El conjunto de destinos debe derivar de capacidades/rutas reales y variar por rol.
- Administrador principal: Inicio, Alumnos, accesos administrativos existentes y Cuenta; elementos no implementados deben quedar fuera de navegación activa o explícitamente deshabilitados.
- Alumno: Inicio, Perfil y únicamente destinos que ya estén implementados. Rutinas puede aparecer como acceso informativo no funcional solo si el Product Master lo requiere; no crear pantalla de rutinas.
- No inventar rutas ni enlaces hash como sustituto de módulos reales.
- "+" no es requisito. Si no existe una acción segura, omitirlo. Si se propone acción contextual, debe invocar una operación ya existente y autorizada.
- Estado activo accesible (`aria-current`), foco visible, etiquetas legibles y objetivos táctiles adecuados.

## Exclusiones explícitas
- Rutinas (editor, asignación, publicación o visualización funcional).
- Cambios en autenticación, onboarding, roles, permisos, sesiones o logout.
- Cambios en Supabase, SQL, RLS, Storage, Auth, correo o variables de entorno.
- Nuevos módulos de alumnos, cuotas, pagos, comprobantes, ejercicios, videos o historial.
- Cambios de marca/rediseño general.
- Datos ficticios, fixtures visibles en runtime o estadísticas inventadas.
- Merge, despliegue y cambios en main por parte del ejecutor.

## Requisitos técnicos
- Respetar la versión real de Next.js 16.4.3 y leer la guía correspondiente en node_modules antes de editar (AGENTS.md).
- Mantener TypeScript estricto y componentes server/client según necesidad real.
- No agregar dependencias salvo justificación documentada.
- Evitar duplicar layout y navegación entre roles: extraer componentes compartidos solo cuando el diseño actual lo permita sin regresión.
- Mantener la página pública y la vista de ingreso actuales.
- No cambiar tema global ni persistencia de apariencia.

## Criterios de aceptación
1. Administrador principal llega a su dashboard y ve solo opciones acordes a su rol.
2. Alumno llega a su dashboard y no ve acciones administrativas.
3. Acceso directo a rutas no autorizadas continúa protegido por los controles existentes; no confiar solo en ocultar enlaces.
4. Navegación de escritorio y mobile consistente con el mockup y los tokens actuales.
5. Barra mobile respeta safe-area y no cubre el último contenido ni controles.
6. No hay overflow horizontal a 360, 390, 768, 1024 y 1440 px.
7. Temas claro/oscuro/sistema mantienen contraste y legibilidad.
8. Teclado, foco visible, skip link, nombres accesibles y axe sin violaciones nuevas.
9. Estados vacíos, carga y error son honestos; ninguna cifra de muestra se presenta como real.
10. Logout conserva el comportamiento actual.
11. La página pública, ingreso, aceptación de invitación y cuenta no sufren regresiones.
12. No se altera Auth, roles, sesiones, RLS ni Supabase.

## Pruebas obligatorias
- Lint, typecheck, build, suite completa y verificación de fuentes/seguridad existentes.
- Playwright para ambos roles usando fixtures aislados; no crear cuentas reales ni llamar Supabase alojado.
- Comprobar separación de navegación por rol y denegación de rutas protegidas con el mecanismo actual.
- Viewports 360, 390, 768, 1024 y 1440; ambos temas.
- Axe, teclado, foco, safe-area y scroll inferior.
- Comparación visual con las capturas aceptadas de UI-001 y el mockup de marca.
- Registrar comandos y resultados exactos; NOT_RUN/NOT_VERIFIED si no se ejecutan.

## Entrega
- Implementar en rama aislada y preparar PR draft solo si el flujo de trabajo vigente lo permite.
- No hacer merge ni deploy.
- Entregar HEAD/base, archivos cambiados, resumen, resultados de pruebas, capturas y limitaciones.
- Estado final: REVIEW; la auditoría independiente corresponde al Orchestrator.

## Recomendación de ejecución
Modelo: GPT-6, razonamiento High.
Complejidad: media.
Riesgo: medio por navegación y separación de roles; bajo si se mantienen intactos Auth y Supabase.
