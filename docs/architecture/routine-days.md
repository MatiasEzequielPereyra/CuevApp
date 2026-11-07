# Días, bloques y videos — CUEVA-006C

2026-11-06. Producto CONFIRMED por el [encargo](../engineering/CUEVA-006C-task.md)
y la ampliación del usuario durante la ejecución: subir desde la galería, hasta
50 MB, solo administradores. Diseño implementado localmente, pendiente de revisión
independiente. Sin aplicación alojada ni cambios de pagos, vencimientos o Auth.

## Modelo y compatibilidad

`plan` admite NULL (nota histórica), v1 de 006B y v2:
`{version:2,days:[{id,name,blocks:[{id,name,rounds,exercises:[]}]}]}`.
Cada aparición tiene UUID, exercise_id, nombre copiado y nota; modo `weight`
con reps y weight_kg nullable, o `time` con duration entera y unit seconds/minutes.
Las claves del otro modo se rechazan en DB y se retiran al cambiar en UI.
Las vueltas se guardan exclusivamente en el bloque. Orden = orden de arreglos.

Límites: 30 días, 300 bloques y 300 apariciones totales, 30 ejercicios/bloque;
nombres de día/bloque hasta 80, nombre de ejercicio hasta 120, nota hasta 300;
vueltas 1–30; repeticiones 1–999 o rango ascendente; peso 0–2000 con dos decimales;
duración entera 1–86400 en la unidad elegida. Se conserva el límite HTTP de
350.000 bytes y las observaciones de hasta 40.000 caracteres.

La migración de días no reescribe datos. v1 permanece legible en publicaciones,
borradores y plantillas. Convertir requiere confirmación: crea un Día 1 y separa
cada bloque anterior en grupos contiguos de ejercicios con iguales series.
Ejemplo series 3,5,3 → tres bloques con vueltas 3,5,3, preservando el orden y todos
los objetivos/notas/nombres. Mantiene UUID de apariciones para conservar referencias
inactivas existentes; renueva UUID de bloques. Incluso el máximo v1 cabe en 300
bloques. No interpreta texto ni cambia la publicación. El administrador revisa la
copia y publica explícitamente. Copiar una plantilla renueva todos los UUID de día,
bloque y aparición y conserva la identidad del ejercicio.

Se reutilizan CAS, advisory lock, autor/fecha servidor, deduplicación y publicación
atómica de 006A/006B. La comparación canónica incluye la estructura completa. No hay
joins al catálogo que cambien nombres u objetivos históricos. Una referencia nueva
inactiva/inexistente se rechaza; una aparición inactiva ya presente puede conservarse.

## Catálogos y rutas

`/rutinas` muestra las plantillas; la ficha conserva el enlace
`/rutinas?alumno=UUID` para copiar y personalizar su borrador. El catálogo de plantillas
pagina con enlaces visibles. La biblioteca carga al abrir y ofrece Mostrar más
cada 100 ejercicios, con orden estable nombre/UUID y búsqueda literal opcional.
Se corrigieron ambos cortes de 006B: `.limit(101)` sin cursor y `.slice(0,100)`.
La selección múltiple conserva el orden de selección y se agrega en una operación
local, sobre la versión más reciente del plan. Los botones permiten ordenar con
teclado días, bloques y apariciones; no requieren arrastrar.

## Videos de galería y YouTube

Se agregan description, video_url y video_path al ejercicio. Descripción hasta
2000 caracteres, sin objetivos de entrenamiento. Se permite una sola fuente de
video a la vez. YouTube opcional usa HTTPS y dominios/rutas exactos con ID de 11
caracteres; sin parámetros adicionales, HTML, iframe ni URL arbitraria. El servidor
y la DB validan. No se inventan videos ni se comprueba su existencia usando datos
reales. Sin asociación se informa disponibilidad vacía.

Bucket privado `cueva-exercise-videos`, límite 52.428.800 bytes (50 MiB presentados
como 50 MB en UI), MIME MP4, QuickTime/MOV y WebM. El administrador elige un archivo
de la galería mediante input file; se genera una URL de carga firmada para una
ruta nueva `exercise_uuid/asset_uuid.ext`, sin upsert. El archivo va directamente
a Storage, sin atravesar el límite de cuerpo del servidor web. Luego Guardar
asocia la ruta en un CAS: valida prefijo, existencia y metadatos tamaño/MIME en DB.
Las cargas incompletas o fallidas no reemplazan la asociación anterior. Una respuesta
incierta del guardado conserva el mismo UUID/revisión para reintentar.

No hay permisos de borrado ni sobrescritura para este bucket desde el producto.
Una carga abandonada o reemplazada puede quedar privada y sin asociación; no se
hace limpieza destructiva automática. La carga estándar no es reanudable; una conexión móvil interrumpida requiere
reintentar el archivo. No hay transcodificación, análisis antivirus,
validación completa del contenedor/codec ni reproducción garantizada de cada codec
MOV. Los formatos se restringen por MIME/tamaño en Storage; un video dañado puede
no reproducirse. Retención/limpieza y costos/cuotas se deben revisar antes de habilitar
el bucket alojado. No se contratan servicios ni se cambian cuotas de servicio.

La capacidad privada `exercise_allowed` verifica admin habilitado o pertenencia del
UUID del ejercicio a la última publicación del alumno vinculado. La RPC pública
invoker `cueva_exercise_resource` devuelve solo video_url/video_path. No expone
catálogo, plantillas, borradores, fichas ni metadata administrativa. RLS de Storage
consulta esa misma capacidad mediante un helper privado de ruta. El alumno obtiene
un enlace firmado de lectura por 60 segundos; esa capacidad temporal puede seguir
vigente hasta expirar después de un cambio de planificación. El endpoint revalida
sesión/propiedad en cada solicitud, responde no-store y no-referrer. No se usa
service role. La asociación de video es un recurso reutilizable actual de la
biblioteca, no una nueva versión de objetivos del entrenamiento.

## Migración y recuperación

Aplicar primero `20261106223307_cueva_routine_days.sql` y luego
`20261106223644_cueva_exercise_videos.sql`, después de 006A/006B, solo tras revisión
independiente y por el Orchestrator autorizado. El bucket/objetos de Storage
requieren el servicio existente; no se autoriza su aplicación desde esta entrega.
Las RPC nuevas revocan el writer de ejercicios antiguo para que no eluda el CAS
de descripción/video. No se modifican las migraciones históricas.

Ante un fallo alojado, cerrar la nueva carga/edición y mantener lectura de datos;
no hacer rollback a código incapaz de leer v2 una vez escritos planes v2. Preferir
corrección hacia delante. No borrar columnas, bucket, objetos ni publicaciones.
La recuperación de datos requiere backup verificado por el operador antes del
release; no se ejecutó ni se promete un rollback destructivo.

## Fuentes técnicas consultadas

Guías instaladas Next 16.4.3: Server and Client Components y Route Handlers.
Changelog Supabase revisado el 2026-11-06: novedades Flutter/CLI no cambian este SQL;
se conserva CLI 2.121.0 para generar los nombres de migración, sin actualización.
Documentación oficial: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funciones](https://supabase.com/docs/guides/database/functions),
[carga estándar](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[permisos Storage](https://supabase.com/docs/guides/storage/security/access-control).
Advisors alojados NOT_RUN. La prueba local no acredita producción ni CI remoto.
