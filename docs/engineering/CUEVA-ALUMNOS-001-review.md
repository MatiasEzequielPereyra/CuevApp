# CUEVA-ALUMNOS-001 — entrega para revisión

Estado: REVIEW. Base efectiva `fa87f778287434dbad016435b28b7d895a05f90e`, igual a origin/main verificado. Rama `codex/cueva-alumnos-001`.

## Corrección posterior a revisión — 2026-11-04

Se corrigieron tres observaciones: búsqueda literal de correo y nombres con puntuación mediante operandos PostgREST entre comillas; reutilización del marco administrativo en listado/alta/ficha/edición, con Alumnos activo y cuenta/cierre de sesión; fecha inicial en Buenos Aires sin alterar la fecha editada. Los mensajes de carga y guardado ya no muestran detalles de migración o infraestructura. Se extrajo únicamente el marco y los controles de cuenta del panel existente, sin cambiar condiciones de permisos o envío.

Verificación de esta corrección: lint, tipos, build, documentos 2/2, panel 10/10, fuentes 4/4 y seguridad por patrones PASS. Laboratorio local de alumnos 43/43 PASS: incluye correo completo, DNI, apóstrofo, puntos/coma/paréntesis/comillas/barra, patrones porcentuales y un intento literal de imitar filtros; cuatro vistas con marco compartido; fecha fija de frontera nocturna y conservación de fecha editada; RLS/denegaciones y logout desde Alumnos. La primera corrida registró 42 PASS/1 FAIL por consultar inmediatamente el estado vacío; se añadió espera explícita al estado final y la corrida posterior pasó sin otro cambio de producción. No se repitieron laboratorios de identidad. Capturas y evidencia JSON reemplazadas por la corrida final; muestran cuentas y fichas sintéticas, incluyendo nombres de prueba de puntuación. La configuración local no representa disponibilidad alojada del correo.

Migración, dependencias y mecanismo de Auth intactos en esta corrección. Recursos exclusivos CUEVA eliminados; contenedores Vendify conservados. Revisión independiente final, aplicación alojada y publicación siguen pendientes.

Implementa listado, búsqueda por los cuatro campos de identidad, alta, consulta por UUID y edición de fichas independientes de Auth. Conserva diseño, tema, navegación al panel y sesión existente. Las tarjetas de otras funciones permanecen pendientes. El listado limita a 100 resultados y solicita refinar la búsqueda; no hay paginación en este incremento. Los nombres admiten hasta 80 caracteres, DNI de 6 a 10 dígitos opcional y fecha entre 1900 y 2100. Correo se normaliza a minúsculas. El estado administrativo no representa pagos.

La [migración](../../supabase/migrations/20261104090000_cueva_students.sql) y el [modelo con instrucciones de aplicación](../architecture/students.md) están versionados. No se ejecutaron SQL ni escrituras alojadas. El Orchestrator debe revisar, aplicar la migración y verificar el entorno antes de publicar. No hay vínculo con Auth ni operaciones de correo. El matcher del proxy se amplía a las rutas nuevas para reutilizar el refresco de sesión existente, sin cambiar roles o mecanismos de autenticación.

## Evidencia

El [resultado local](../../experiments/cueva-alumnos-local/evidence.json) usa Next, Postgres, Auth y PostgREST reales y cuentas exclusivamente sintéticas. Se verificaron alta/recarga, edición, búsqueda, ausencia de coincidencias, unicidad de correo/DNI, repetición de una misma escritura, fecha inválida, error real de guardado con conservación de formulario, permisos RLS de alumno y privilegios anónimos, solicitudes directas y por identificador, búsqueda con teclado, temas y cierre de sesión. El número de cuentas Auth permanece igual después de crear fichas. No se repitió el flujo completo de identidad ni se enviaron invitaciones.

- [Celular oscuro](../../evidence/screenshots/students-390-dark.png) / [claro](../../evidence/screenshots/students-390-light.png)
- [Computadora oscura](../../evidence/screenshots/students-1440-dark.png) / [clara](../../evidence/screenshots/students-1440-light.png)

Verificación general: lint, typecheck, build, documentos 2/2 y navegador 35/35 PASS. Fuentes originales 4/4, seguridad por patrones y diff check PASS. Las capturas son de la aplicación local con fichas ficticias. Todos los contenedores/red exclusivos del flujo se eliminaron y Next/navegador se cerraron.

## Límites

Revisión independiente, migración alojada, prueba con cuenta real y publicación: NOT_RUN. Correo temporal de propietario conservado por código, sin nuevos ensayos alojados. No se implementan altas Auth, pagos, rutinas, comprobantes ni borrado. Las ediciones concurrentes se resuelven con el último guardado; no se agrega auditoría de cambios. El escaneo por patrones no prueba ausencia absoluta de secretos. La recuperación de una respuesta de alta perdida se hace revisando el listado: un UUID repetido no crea otra ficha y devuelve conflicto. Paginación, búsqueda indexada y vinculación verificada con cuentas pertenecen a incrementos posteriores.
