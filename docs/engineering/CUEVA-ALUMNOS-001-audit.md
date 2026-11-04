# CUEVA-ALUMNOS-001 — auditoría del Orchestrator

Fecha: 2026-11-04, America/Buenos_Aires.
Base: `fa87f778287434dbad016435b28b7d895a05f90e`.
Entrega original: `f7de1ad770ddff7568870d58a55d4e13766b3b46`.
Correcciones: `27cf4e8aaf80c0027225349e0dd768d864512c42`.

## Standards y seguridad

Revisión independiente original y del delta final: 0 bloqueos pendientes. Servidor
y RLS verifican perfil admin y sesión habilitada; cliente de usuario, origen exacto,
body limitado, restricciones de datos y privilegios mínimos. El marco compartido
no concede permisos por sus propiedades. Auth, correo y bootstrap se conservan.

## Spec

Se resolvieron tres P2: búsqueda que eliminaba puntuación de correos/apellidos,
pantallas de alumnos sin el marco administrativo y fecha inicial calculada en UTC.
La búsqueda ahora usa literal escapado, el marco se comparte y la fecha del nuevo
formulario usa Buenos Aires sin alterar fechas editadas. El Orchestrator inspeccionó
las capturas de 1440 y 390 px. Mensajes de error simplificados para el usuario.

## Evidencia y límites

- Laboratorio acotado Alumnos con Next/Auth/PostgREST/Postgres reales: 43/43 PASS,
  con búsqueda de correo, DNI, puntuación y filtros tratados como datos; permisos,
  persistencia, marco en cuatro vistas, fecha fija nocturna, temas y logout.
- Primera corrida de corrección: 42 PASS/1 FAIL por lectura antes del render del
  estado vacío. Espera explícita agregada y repetición justificada: 43/43 PASS.
- Corrección: lint, tipos, build, documentos 2/2, panel 10/10, fuentes 4/4 y revisión
  por patrones de secretos PASS. Revisión estática independiente posterior sin
  repetir el laboratorio. Los datos de capturas son sintéticos y locales.
- Cien resultados por búsqueda y último guardado concurrente son límites conocidos.
  No hay altas Auth, correo general ni asociación automática de fichas con cuentas.

## Migración y release

Archivo: `supabase/migrations/20261104090000_cueva_students.sql`.
SHA256: `708e86f455688666d674438593a52079110d2fc56a227e97a9a1c4acd375858f`.
El archivo no cambió durante las correcciones. Preflight alojado confirmó proyecto
CUEVA saludable, migración previa de acceso registrada, helper de sesión compatible,
un perfil y ausencia de `cueva_students`. No se leyeron credenciales ni datos privados.

La migración crea solo tabla, restricciones, grants y políticas propios; no altera
filas existentes ni crea funciones privilegiadas. Se admite como compatible y no
destructiva bajo la sección 8 del protocolo. Aplicar una vez, después de CI; ante
respuesta ambigua, reconciliar catálogo e historial antes de decidir cualquier paso.
Verificar políticas, grants y columnas después de aplicar. Rollback de aplicación:
versión anterior; conservar tabla y datos, sin DROP automático.

Advisors previo: INFO esperado de RLS privado sin acceso directo y WARN existente
de protección de contraseñas filtradas deshabilitada. No se modifica Auth en este
release ni se atribuye ese estado a la nueva tabla.

**ACCEPTED LOCAL.** CI, aplicación alojada, despliegue y smoke se registran en el PR
de `codex/cueva-alumnos-001`. La prueba local no acredita por sí sola una sesión
real alojada ni el flujo de un alumno alojado; indicar los límites en el cierre.
