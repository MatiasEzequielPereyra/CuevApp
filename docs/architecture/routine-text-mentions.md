# Rutinas en texto libre y menciones — CUEVA-006D

Fecha: 2026-11-17. Estado: implementación en rama aislada; CI aprobado en HEAD 86b16d7f914237822e85fafe9710c5bdc99f1d83. Revisión de integración pendiente.

## Modelo de edición

Cada borrador, plantilla y publicación conserva dos espacios independientes:

- **Por bloques**: mantiene los campos existentes \`content\` (observaciones) y \`plan\`.
- **Texto libre**: usa \`text_content\` y un arreglo estructurado \`mentions\`.
- **Formato**: \`format\` con valores \`blocks\` o \`text\`, persistido con la revisión.

La pestaña activa se guarda con la revisión. Cambiar de formato no limpia el
contenido del otro formato. \`block_content\` conserva las observaciones del
constructor por bloques incluso cuando el registro base necesita guardar el
texto libre en su campo \`content\` para reutilizar el escritor transaccional
existente.

## Persistencia aditiva

La migración crea dos tablas laterales:

- \`cueva_routine_text_drafts\`: una fila por borrador o plantilla, con revisión,
  formato, texto libre, contenido de bloques, menciones y \`save_id\`.
- \`cueva_routine_text_publications\`: instantánea asociada a una publicación
  existente, con formato, ambos contenidos y menciones.

No se alteran ni reescriben las filas históricas de publicaciones. Para los
registros anteriores, la migración copia su contenido a \`block_content\`; si
no tenían \`plan\` y sí texto, inicializa \`format=text\` y copia el texto a
\`text_content\`. Si tenían plan, permanecen en \`blocks\`.

La RPC \`cueva_routine_text_write\` valida y llama al escritor actual dentro de
la misma transacción. Después persiste el documento lateral bajo el mismo
bloqueo. El \`save_id\` enlaza los reintentos al mismo contenido exacto; reutilizar
una operación para cambiar menciones o texto produce conflicto. Publicar crea
una fila lateral inmutable asociada a la publicación confirmada.

## Referencias estructuradas

\`mentions\` es un arreglo JSON versionado con objetos de forma estricta:

- \`start\`: offset inclusivo, base cero.
- \`end\`: offset exclusivo.
- \`exercise_id\`: UUID estable de \`cueva_exercises\`.
- \`text\`: texto literal insertado en \`text_content\`.

Los offsets cuentan puntos de código Unicode, no unidades UTF-16. El cliente
convierte las posiciones de selección del textarea antes de persistir;
PostgreSQL valida límites y que el fragmento indicado coincida exactamente
con \`text\`. Se admiten menciones repetidas del mismo ejercicio. Al editar, una
referencia se conserva solo si el rango sigue identificando el texto insertado;
editar o borrar parte de una mención la convierte en texto normal.

## Autocompletado

Se reutiliza GET \`/api/ejercicios\` con búsqueda por prefijo y \`active=1\). La
búsqueda se dispara con debounce para el token después de \`@\` y para la palabra
actual sin \`@\`. Se cancelan o ignoran respuestas obsoletas y se conservan los
estados de carga, error, vacío y reintento. Solo se ofrecen ejercicios activos.

La sugerencia reemplaza el token consultado en la posición del cursor, inserta
el nombre y agrega su UUID. La selección funciona con flechas, Enter y Escape;
el texto no se interpreta como HTML.

## Validación y publicación

La API valida tipos, longitudes y forma general del payload. La RPC valida de
nuevo UUID, offsets enteros, fragmentos, orden, no superposición, máximo de
menciones y que el ejercicio esté activo o ya existiera en la versión anterior.
No se confía en el cliente para autor, rol, propiedad, nombre del catálogo ni
estado activo.

El guardado incluye ambos formatos, el formato seleccionado y las menciones.
La publicación conserva una instantánea inmutable del formato seleccionado y
sus contenidos. Publicar no mezcla texto libre con \`plan\` ni convierte
menciones en objetivos, bloques, series o videos.

## Lectura del alumno

RLS limita la fila lateral a la última publicación propia. La RPC
\`cueva_student_mentioned_exercises\` devuelve solo los ejercicios mencionados
en esa publicación de texto; no expone el catálogo general ni concede acceso
adicional a videos. La UI resalta las menciones con el texto capturado y muestra
los detalles complementarios de esos ejercicios. La rutina por bloques sigue
usando las consultas y autorizaciones actuales.

## Riesgos y límites

- Los cambios de texto deben mapear offsets Unicode de forma determinista.
- Renombrar un ejercicio no cambia el UUID; la UI puede mostrar el nombre actual
  en los detalles sin mutar el snapshot publicado.
- Desactivar no rompe referencias históricas, pero impide crear nuevas.
- Si una referencia ya no se puede resolver, el texto capturado sigue visible.
- No se modifican CUEVA-003B ni CUEVA-005; no hay escritura en Supabase alojado,
  deploy, Auth ni cambios de roles en esta fase.


## Evidencia de validación — HEAD 86b16d7f914237822e85fafe9710c5bdc99f1d83

Los workflows de GitHub Actions finalizaron correctamente sobre el mismo SHA del PR:

- Verify foundation: lint, typecheck, build, pruebas, verificaciones de seguridad y tests del verificador de auditoría aprobados.
- Auditoría de producción: `npm audit --omit=dev --audit-level=moderate` sin vulnerabilidades.
- Auditoría completa: se mantiene la excepción temporal estricta para el único advisory de Picomatch en dependencias de desarrollo; el verificador de allowlist y `npm audit --audit-level=critical` aprobaron. Esto no significa que el advisory haya sido corregido.
- Supabase local migrations: fresh, upgrade y hosted-compatible aprobadas, incluyendo pruebas SQL, concurrencia de publicación e integración autenticada UI–Supabase.
- Membership SQL y Receipt Storage aprobados.
- Vercel Preview: deployment completado.

Runs:
- https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44212681594
- https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44212681513
- https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44212681517

Esta evidencia no representa una migración aplicada en Supabase alojado ni una autorización de merge o despliegue.
