# CUEVA-ALUMNOS-001 — modelo y operación

La ficha `public.cueva_students` tiene UUID estable independiente de Auth, nombre/apellido, correo normalizado, DNI opcional, fecha de alta y estado administrativo. No existe asociación automática con cuentas ni envío de correo. El estado activo/inactivo no representa deuda. No se exponen operaciones de eliminación.

La base exige unicidad de correo y DNI no nulo, longitudes y formatos normalizados. El navegador genera un UUID por formulario; reenvíos del mismo alta chocan contra la clave primaria y no duplican fichas. Si la primera respuesta se pierde, revisar el listado antes de repetir. Ediciones concurrentes usan el último guardado; no hay historial de cambios en este incremento.

Servidor y RLS exigen administrador desde `cueva_profiles` y los controles de sesión existentes. Las consultas y escrituras utilizan el cliente del usuario, nunca service role. SELECT/INSERT/UPDATE son los únicos privilegios del rol autenticado; visitante sin privilegios, alumno sin filas ni escritura. No se otorgan permisos para vincular Auth.

## Aplicación posterior por Orchestrator

1. Auditar el commit y verificar la migración previa de acceso y su helper de sesión existentes.
2. Revisar `supabase/migrations/20261104090000_cueva_students.sql` íntegro y su hash; aplicar una sola vez tras autorización operativa correspondiente, no desde este ejecutor.
3. Comprobar tabla, restricciones, grants y políticas en el entorno elegido y repetir denegación alumno/visitante.
4. Publicar después de revisión y pruebas del entorno alojado. Hasta aplicar la migración, el listado muestra Gestión no disponible y el guardado responde un error controlado.

La búsqueda muestra un máximo de 100 filas y pide refinar al superar ese límite. No se calcula un indicador de alumnos activos en el panel hasta definirlo; el panel ofrece acceso a fichas. DNI es administrativo y nunca identifica un inicio de sesión.

## Reproducción local

Desde `experiments/cueva-alumnos-local`: `node lab.mjs`, con dependencias del repositorio instaladas, Docker existente e imágenes fijadas del laboratorio I. Se reutiliza su lanzador Next y esquema auxiliar, pero se ejecuta únicamente el flujo de alumnos. Los usuarios sintéticos se crean confirmados localmente; no se ejecutan invitaciones/recuperaciones ni se toca correo real. Credenciales efímeras solo en memoria/entorno de procesos propios; salida redactada `results.json`. Al terminar se cierran navegador, Next y los contenedores/red exclusivos `cueva-alumnos-*`; nunca se modifica Docker ni recursos de Vendify. Las imágenes compartidas se conservan.

Referencia RLS: https://supabase.com/docs/guides/database/postgres/row-level-security . El changelog se consultó mediante HTTPS tras no admitir el navegador su tipo text/markdown; no se adoptan APIs nuevas ni se cambian versiones.
