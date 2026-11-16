# Rutinas en texto libre y menciones — CUEVA-006D

Fecha: 2026-11-16. Estado: diseño confirmado, implementación en curso.

## Modelo de edición

Cada borrador, plantilla y publicación conserva dos espacios independientes:

- Formato por bloques: campos actuales content (observaciones) y plan.
- Formato texto: text_content y text_mentions.
- editor_mode: blocks o text, versionado en la misma instantánea.

La subpestaña activa no es solo estado local: se guarda con la revisión para que
al recargar se mantenga el editor elegido y para que el alumno vea exactamente
el formato publicado. Cambiar de subpestaña no limpia los datos del otro formato.
Las plantillas copian ambos formatos y editor_mode; cada copia mantiene su
independencia actual.

Para compatibilidad, los registros previos con plan no nulo siguen en blocks.
Los registros previos sin plan cuyo content contiene texto se inicializan como
text y se copia el texto a text_content, sin borrar ni modificar content.
Las publicaciones existentes siguen siendo inmutables y legibles.

## Referencias estructuradas

text_mentions es un arreglo JSON versionado con objetos de forma estricta:

- start: offset inclusivo, base cero.
- end: offset exclusivo.
- exercise_id: UUID estable de cueva_exercises.
- label: texto literal insertado en text_content (puede incluir @).

Los offsets cuentan puntos de código Unicode, no unidades UTF-16. El cliente
convierte los offsets de selección del textarea antes de persistir; PostgreSQL
valida límites y que el fragmento indicado coincida exactamente con label.
Esto evita desfasajes con emojis y caracteres suplementarios.

Se admiten menciones repetidas del mismo ejercicio. Al editar, una referencia
se conserva solo si el rango sigue identificando el texto insertado; editar o
borrar parte de una mención la convierte en texto normal y elimina su vínculo.
La UI debe actualizar offsets al insertar, borrar o reemplazar texto fuera de
las menciones y nunca conservar referencias superpuestas o desalineadas.

## Autocompletado

Reutilizar GET /api/ejercicios con q por prefijo y active=1. La búsqueda se
dispara con debounce tanto para el token después de @ como para la palabra
actual sin @. Se ignoran respuestas obsoletas y se conserva el texto ante
errores. El endpoint mantiene su autorización administrativa; el alumno nunca
recibe el catálogo completo.

La sugerencia seleccionada reemplaza el token consultado en la posición del
cursor, inserta el nombre del ejercicio y agrega su referencia por UUID. La
selección debe funcionar con teclado (flechas, Enter, Escape), lectores de
pantalla y táctil.

## Validación y publicación

La ruta API valida tipos, longitud, cantidad máxima de menciones, UUIDs, offsets,
fragmentos y tamaño total del payload. La RPC transaccional valida de nuevo:
ejercicio activo para una nueva mención, o una referencia ya existente en la
versión anterior para permitir conservar publicaciones cuando el ejercicio
posteriormente se desactiva. Nunca se confía en el cliente para autor, rol,
propiedad, nombre del catálogo ni estado activo.

El CAS, idempotencia, comparación de conflictos y publicación incluyen
editor_mode, text_content y text_mentions. Una publicación es una instantánea
inmutable del formato seleccionado y de ambos espacios de edición. Publicar no
mezcla automáticamente el texto libre con plan ni convierte menciones en
objetivos estructurados.

## Lectura del alumno

La última publicación propia se consulta mediante el vínculo Auth/ficha y RLS
vigentes. La RPC cueva_student_assigned_exercises debe incluir la unión de
ejercicios del plan y de text_mentions, limitada a la última publicación propia.
La UI resuelve cada mención contra esa lista autorizada para mostrar el nombre
vigente y enlazar a la descripción del ejercicio dentro de la misma pantalla.
Si la referencia no aparece en la lista, se muestra label como texto plano.
No se concede lectura del catálogo general ni se amplían permisos de video.
El reproductor continúa sujeto a cueva_my_routine_video_ids.

## Riesgos y límites

- Los cambios de texto deben mapear offsets Unicode de forma determinista.
- El render nunca interpreta HTML; texto y nombres se renderizan como nodos React.
- Renombrar el ejercicio no cambia el UUID; la UI del alumno puede mostrar el
  nombre actual sin mutar el snapshot publicado.
- Desactivar no rompe referencias históricas, pero impide crear nuevas.
- No hay borrado normal de ejercicios; si una intervención privilegiada elimina
  una fila, la publicación sigue mostrando label sin enlace.
- Sin migraciones alojadas, cambios de RLS/Auth, deploy ni escritura remota como
  parte de esta tarea.
