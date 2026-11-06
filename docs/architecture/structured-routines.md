# Rutinas estructuradas — CUEVA-006B

Cambio de producto CONFIRMED por el [encargo](../engineering/CUEVA-006B-task.md):
el constructor reemplaza la nota principal; el texto queda como observación.
Arquitectura PROPOSED para revisión independiente. CUEVA-006A sigue REVIEW.
No se editan el maestro ni otras fuentes originales para acomodar el cambio.

## Contrato

Una planificación principal por ficha. Cada borrador/plantilla/publicación de
006A incorpora `plan jsonb` nullable. NULL representa contenido anterior sin
convertir: ni backfill, ni parser de notas, ni borrado. El contenido de `content`
se mantiene íntegro y editable como observación complementaria. Publicaciones
anteriores continúan visibles con su fecha hasta una nueva publicación.

La estructura v1 tiene un arreglo ordenado de bloques `{id,name,exercises}`.
Cada aparición de ejercicio tiene UUID propio, `exercise_id`, nombre capturado,
series, repeticiones, peso objetivo nullable y observación. El mismo ejercicio
puede aparecer varias veces con valores y UUID independientes. El orden de los
arreglos es significativo. El peso NULL significa sin definir; 0 es un objetivo
explícito. Son objetivos de planificación, nunca resultados del entrenamiento.

Límites: 20 bloques, 30 apariciones por bloque, 300 totales; nombres de bloque
1–80, ejercicio 1–120, observación 0–300; series enteras 1–30; repeticiones enteras
1–999 o rango ascendente sencillo, por ejemplo 8-12; peso 0–2000 kg con dos
decimales como máximo. Observación general hasta 40.000 caracteres.
El endpoint acota además el cuerpo HTTP completo a 350.000 bytes.

La validación se ejecuta en PostgreSQL bajo el mismo advisory lock de 006A y
antes de escribir. Identificadores de bloque/aparición únicos dentro del plan,
forma/versión/tipos/cantidades controlados. Las actualizaciones requieren la
revisión esperada. La publicación compara estructura y texto completos contra
el borrador confirmado. UUID de operación y ficha/revisión evitan duplicados.
El renderer utiliza texto React, sin HTML ni interpretación de notas.

## Catálogo y conservación histórica

`cueva_exercises` tiene identidad UUID estable, nombre normalizado único, activo,
revisión, actor y fecha servidor. Nombre equivalente: minúsculas y espacios
blancos colapsados/recortados. No elimina tildes ni equipara nombres distintos
por inferencia. Una colisión se rechaza también por solicitudes concurrentes.
El catálogo inicia vacío, sin seeds en la migración.

No se concede INSERT/UPDATE/DELETE directo a roles API. Una capacidad privada
verifica administrador habilitado y serializa CAS/duplicados; wrapper público
invoker con EXECUTE explícito. RLS solo permite SELECT de catálogo a admin con
gate y sesión actuales. Alumno/visitante no reciben el catálogo administrativo.

La estructura almacena el UUID y una copia del nombre seleccionado/asignado.
No hace joins al catálogo para renderizar objetivos o versiones publicadas.
Renombrar/desactivar no reescribe borradores, plantillas ni publicaciones.
El nombre copiado es texto de planificación aportado por el administrador, no
una autoridad de autorización. El servidor comprueba existencia del UUID para
cada aparición. Catálogo y borradores se serializan con el mismo lock.

Desactivar impide nuevas selecciones, incluso copias de plantilla con nuevas
apariciones. Referencias ya presentes en el borrador conservan edición/publicación
si coinciden UUID de aparición y ejercicio; cambiar solo el UUID del ejercicio
no elude esa comprobación. El usuario recibe error y conserva el borrador para
retirar/reemplazar la referencia nueva inactiva. No hay operación de borrado del
catálogo ni permiso API para hacerlo. Los UUID dentro de JSON se validan al
escribir; no son FK relacionales. Una intervención SQL privilegiada que elimine
catálogo queda fuera del producto; snapshots continúan legibles pero nuevas
ediciones con referencias inexistentes se rechazan. No se promete cascada alguna.

Plantillas copian toda la estructura/observaciones y renuevan UUID de bloques y
apariciones. No existe relación viva con el origen. No publican automáticamente
y reemplazar un borrador requiere confirmación. La selección/alta inline conserva
el plan más reciente aunque haya cambios durante la respuesta del catálogo.

## Seguridad, compatibilidad y alternativas

Se reutilizan gate, RLS, vínculo ficha–Auth y helper de propiedad de 006A, sin
asociación por email, service role ni cambios de Auth. Solo la última publicación
es visible al alumno propio. Las FK de ficha de 006A y su eliminación protegida
siguen vigentes, también con rutinas estructuradas. Sin caché compartida.

El writer nuevo tiene séptimo argumento `p_plan`. Se revoca el acceso API al
writer viejo de seis argumentos: un cliente anterior no puede publicar sin
comprobar la estructura. No se modifica ninguna migración histórica. El lector
nuevo admite notas anteriores; no se afirma compatibilidad de escritura hacia
atrás. UI mantiene el serializador de peticiones, confirmación, recuperación y
comparación de 006A; la igualdad incluye estructura con claves canónicas.

Alternativa considerada: tablas por bloque/aparición y múltiples escrituras.
JSON versionado permite reutilizar el CAS y publicar una instantánea completa
atómicamente sin multiplicar operaciones del editor. Coste: validación explícita
de referencias y ausencia de FK de ejercicio en JSON. No se agrega sincronización,
multigimnasio, procesamiento automático ni dependencias nuevas.

Documentación consultada el 2026-11-06: guías Next 16.4.3 instaladas (Server/Client
Components y Route Handlers), [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
y [funciones/permisos](https://supabase.com/docs/guides/database/functions).
Sin advisors alojados: no autorizados por este encargo. La evidencia local no
certifica funcionamiento alojado, CI remoto ni aplicación de migraciones.
