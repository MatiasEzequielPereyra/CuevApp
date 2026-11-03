# CUEVA-UI-001 — Panel administrador

Estado: REVIEW, pendiente de auditoría independiente, integración y publicación.
Base: `a5bcf43862cf487b0f1dfc59f0203e36db29c0e7` (`origin/main` verificado al inicio).

Referencia recibida: [mockup original](../brand/panel-admin-mockup.png), SHA-256 `fc40f9caa5b08564a3250e96612cbf5045da9959e8ae39ee3cf7e80f3ac507cb`. La fuente original se conserva sin alteraciones.

## Comparación visual

El panel conserva del mockup el fondo oscuro, tarjetas, sidebar, acento violeta, SVG de CUEVA y navegación móvil inferior; agrega equivalentes claros y selector existente de tema. Las cuatro tarjetas y las secciones de alumnos, vencimientos, pagos y comprobantes no presentan las cifras de ejemplo: muestran ausencia de datos y disponibilidad futura. Los enlaces desplazan a explicaciones dentro de la página; no ejecutan operaciones pendientes. El nombre se toma de los metadatos de sesión cuando existe, o del correo de la sesión como alternativa; el rol deriva de la consulta de perfil existente.

Las capturas de abajo se generaron con el **componente real renderizado con datos sintéticos**, sin credenciales ni acceso a datos reales. Se comprueban 360, 390, 768 y 1440 px en ambos temas, axe y ausencia de desbordamiento; navegación de teclado y foco en escritorio. El selector visual de esta muestra es estático: su implementación real de tema se verifica por separado en las pruebas existentes. La muestra no verifica sesión real, consulta alojada ni cierre de sesión de extremo a extremo; la página mantiene los controles y consultas existentes. No se repitieron laboratorios de identidad.

- [Computadora oscura](../../evidence/screenshots/admin-1440-dark.png) · [computadora clara](../../evidence/screenshots/admin-1440-light.png)
- [Celular oscuro](../../evidence/screenshots/admin-390-dark.png) · [celular claro](../../evidence/screenshots/admin-390-light.png)

La composición está inspirada en el bloque de administrador del mockup, no en sus pantallas de datos y operaciones aún no construidas. La comparación es visual, no una certificación de fidelidad pixel a pixel. El maestro visual incluye ejemplos y decisiones antiguas de DNI/contraseña temporal que no representan el acceso vigente por correo.

## Verificaciones del ejecutor

`npm run verify`: lint, typecheck, build, documentos 2/2 y 34 pruebas de navegador PASS. Tras agregar el caso de teclado móvil, la suite específica del panel pasó 10/10. `verify:sources` 4/4, `verify:security` y `git diff --check` PASS. `npm audit --audit-level=critical` termina correctamente y reporta 16 vulnerabilidades moderadas en dependencias existentes; no se modificó el lockfile. Auditoría por patrones no demuestra ausencia absoluta de secretos.
