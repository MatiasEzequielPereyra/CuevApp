# Auditoría CUEVA-002J

2026-11-03. Base `e264810408a3750cfb68a851d0810de5dd03cf94`, ejecutor
`8caced7eba239135b6034e1903075afecb1024b7`. **ACCEPTED LOCAL**, integración
apagada y paquete operativo de referencia. No certifica correo ni Auth alojados.

Standards y Spec independientes: sin bloqueos para ese alcance. El script de
operador termina el dry-run antes de conectarse, restringe destinos, no reintenta
envíos y promueve una sola cuenta activa con correo/UUID exactos. El advisory
lock solo coordina ese script: requiere excluir otros escritores confiables.
La promoción bloquea perfil, estado y usuario para verificar el correo en la misma
transacción. No incorpora bootstrap web público ni cambios de runtime o migración.

El Orchestrator repitió `node lab.mjs`: exit 0, 25 PASS y 1 NOT_RUN, incluyendo
seis limpiezas. Las dos plantillas se renderizaron en GoTrue y el navegador abrió
el href literal para invitación y recuperación. El redirect externo se eliminó;
su fallback produjo enlace inválido sin capacidad de incorporación, no un alta.
El bootstrap sintético completó contraseña propia, promoción exacta y rechazos de
duplicado, correo incorrecto y promoción anticipada. Reconciliación comprobada
solo con procesos/control exclusivo del laboratorio: no trasladarla al alojado.

Comparación contra base: src, Next config, dependencias, migración, tests de raíz
y CI idénticos. No se repite localmente el build completo sin cambios allí;
el laboratorio sí ejecuta Next real. CI del PR debe volver a pasar antes de merge.
Documentos, fuentes, seguridad por patrones y diff check se verifican al preparar PR.

## Aplicación remota y primera prueba

El inventario actual del proyecto exacto está vacío: cero cuentas, buckets y tablas
de aplicación; sin historial de migraciones. La migración I revisada es aditiva.
Antes de aplicar, fijar hash, volver a comprobar inventario e historial; aplicar
una sola vez y registrar versión generada por el mecanismo y correspondencia con
el archivo. Verificar catálogo/RLS/permisos y advisors después. Ante incertidumbre
no repetir. No crear cuentas ni habilitar ingreso por el hecho de migrar.

La preparación autorizada comprende migración y configuración revisadas,
con banderas apagadas. El alta real inicial y una prueba con activación técnica
controlada requieren una decisión explícita sobre cuenta/correo y ventana de
prueba; no están autorizadas por esta aceptación local. El paso 6 del plan se
refiere a disponibilidad general posterior. No afirmar que se prueba la app
alojada con sus rutas deshabilitadas. Sin entorno de prueba operativo o acuerdo
para una prueba controlada, conservar el cierre y reportar ese límite concreto.

Una interrupción alojada permanece cerrada; la falta de control demostrable de
los escritores del proveedor impide liberar el lock, no autoriza un timeout.
SMTP y secreto de Vercel fueron guardados por el usuario; no se leyeron sus valores
ni se certificó entrega, validez de clave, HTTPS autenticado o permisos de cuentas.
