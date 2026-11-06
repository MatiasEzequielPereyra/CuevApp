---
name: cueva-supabase-security
description: Usar al revisar o cambiar autenticación, invitaciones, sesiones, RLS, SQL, migraciones, Storage, permisos o seguridad de datos en Supabase para CUEVAPP.
---

# Seguridad Supabase y autenticación CUEVAPP

## Investigación de solo lectura por defecto
1. Leer `AGENTS.md`, checkpoint, `docs/architecture/decisions.md`, `docs/architecture/student-invitations.md` y migraciones pertinentes.
2. Confirmar proyecto Supabase exacto antes de consultas remotas y no mezclarlo con otros proyectos. No imprimir secretos, correos, DNI ni identificadores personales obtenidos de producción.
3. Consultar documentación actual de Supabase para la funcionalidad afectada; no asumir que versiones antiguas tienen el mismo comportamiento.
4. Identificar tablas, roles, grants, funciones SECURITY DEFINER, `search_path`, RLS, triggers y políticas actuales. Leer advisors; no clasificar avisos como vulnerabilidades confirmadas sin analizar precondiciones.

## Invariantes
- Alta de alumnos reservada a administración; el usuario debe mantener una única identidad. Correo obligatorio e invitación con contraseña propia según decisión vigente.
- Validar identidad y sesión activa en backend/base; `authenticated` por sí solo no otorga permiso de administrador ni acceso a datos de otros alumnos.
- No confiar en `user_metadata` para roles. No exponer `service_role` ni claves secretas al navegador, logs, repositorio o pruebas.
- Conservar el gate de `ready_for_current_session()` y los permisos efectivos. Antes de cambiar RPCs privilegiadas, revisar todos los caminos de invocación y autorizaciones.
- Tablas expuestas: RLS y políticas de aislamiento reales. Tablas de operación privadas: preservar su aislamiento y revocaciones. No usar `SECURITY DEFINER` para eludir errores.
- Invitaciones y correos: preservar idempotencia, estado de reconciliación, historial, leases y tratamiento de resultados inciertos; nunca repetir envíos a ciegas.

## Cambios y aceptación
- La inspección no autoriza SQL de escritura. Para una migración de producción, exigir alcance autorizado, revisión de datos, backup/rollback verificable y controles previos/posteriores.
- Probar acceso permitido y denegado para anónimo, alumno y admin; carreras, duplicados y reintentos; controles de filas y funciones, no solo UI.
- Diferenciar CI local, migración aplicada y prueba alojada. Reportar checks ejecutados, asesorías pendientes y riesgo residual sin pedir ni revelar credenciales.
