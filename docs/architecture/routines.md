# Rutinas — modelo CUEVA-006A

Estado: implementación local para revisión. Fuente: [encargo](../engineering/CUEVA-006A-task.md),
secciones 11–12 del maestro; el texto original permanece intacto. Los ejercicios
estructurados y registros de entrenamientos de la sección 12 siguen pendientes.

## Datos y autoridad

- `cueva_routine_drafts`: PK ficha, texto de hasta 40.000 caracteres, revisión
  entera positiva, último identificador de guardado, autor y fecha del servidor.
  Cero filas equivale a borrador vacío revisión 0. No se crea al abrir el editor.
- `cueva_routine_publications`: instantánea inmutable, UUID de operación como PK,
  ficha, revisión fuente, texto, autor y fecha del servidor. Restricción única
  ficha/revisión. Se conserva todo el historial, sin pantalla de historial.
- `cueva_routine_templates`: PK propia, título, texto, revisión y confirmación
  de guardado. Su contenido se copia al editor: no existe relación viva entre
  plantillas y rutinas.

Todas las FK de rutinas a fichas impiden borrado. La misma migración amplía la
comprobación de eliminación vacía; aun un borrador vacío persistido protege la
ficha. No hay borrado de Auth, cascadas, correos ni cambios en invitaciones.

La consulta del alumno utiliza exclusivamente el UUID vinculado por el flujo
existente en `cueva_student_invitations`, el perfil alumno y el gate/sesión actuales.
El correo nunca asocia identidad. No se consulta deuda para autorizar rutinas.

## Escrituras y concurrencia

Las tablas permiten únicamente SELECT a `authenticated`, con RLS. Borradores y
plantillas requieren administrador habilitado. Publicaciones permiten al alumno
vinculado solamente la revisión publicada más reciente de su ficha. Visitantes,
sesiones no habilitadas y alumnos ajenos no obtienen contenido. No hay service role
en los módulos de rutinas. Los helpers privados no exponen datos de otras fichas.

La RPC pública invoker delega en una capacidad privada definer, con search_path
vacío, permisos EXECUTE explícitos y comprobación de rol/gate/Auth antes de cada
operación. La capacidad es necesaria para evitar que un cliente escriba autor,
fechas o snapshots arbitrarios mediante acceso directo a las tablas. No acepta
autor ni rol del navegador. No habilita UPDATE/INSERT/DELETE directos.

Se reutiliza el advisory lock transaccional de pagos/eliminación (903004001),
seguido por el lock de ficha y borrador. Cada guardado exige revisión esperada.
Un CAS perdido devuelve conflicto sin escribir. Guardar es idempotente para el
último identificador/revisión/contenido exactos; un resultado perdido seguido de
otro identificador provoca comparación explícita, no sobrescritura silenciosa.
La escala prevista (50–150 alumnos) permite esta serialización breve; no se hacen
llamadas de red dentro de la transacción. El lock no serializa la escritura humana.

Publicar exige que revisión y texto coincidan exactamente con el borrador
confirmado. Un identificador de publicación queda vinculado permanentemente a
ficha/revisión/texto/actor. Operaciones distintas de la misma revisión devuelven
el snapshot ya existente. Doble clic, concurrencia y reintento no agregan versiones.
Una nueva revisión no reemplaza la publicada hasta una acción explícita.

## Editor y recuperación

El editor mantiene texto local y base confirmada por separado. Permite solo un
guardado en vuelo; una respuesta cambia la base confirmada pero nunca el texto
actual. Si se escribió durante la petición, se guarda luego contra la nueva base.
No anuncia guardado antes de recibir confirmación. Publicar está deshabilitado
mientras hay texto sin guardar, conflicto o petición en curso; la RPC vuelve a
validarlo. Los reintentos de publicación conservan el identificador por revisión.

Ante fallo se conserva lo escrito en memoria, se ofrece reintentar/comparar y se
advierte al intentar cerrar con cambios locales. No hay almacenamiento offline
ni persistencia local de datos privados. Cerrar forzosamente el navegador o
perder el dispositivo puede perder cambios no confirmados. Ante conflicto se
muestran ambas versiones y se exige elegir explícitamente: guardar el texto local
sobre la revisión comparada, o descartar lo local con confirmación. Otro cambio
concurrente vuelve a producir conflicto. Aplicar una plantilla a texto existente
requiere confirmación y nunca publica.

El render usa nodos de texto React/`pre-wrap`, sin HTML ni interpretación de
ejercicios. Páginas dinámicas y respuestas no-store, sin caché compartida.

## Referencias técnicas consultadas

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
  y [funciones/permisos](https://supabase.com/docs/guides/database/functions),
  consultadas el 2026-11-06. MCP search_docs no disponible sin link_id;
  se usó documentación oficial pública. Changelog revisado: CLI v3 cambia destino
  predeterminado y confirmaciones alojadas; aquí se utilizó únicamente `migration
  new` local con CLI instalada 2.118.0-beta.42, sin actualizar herramientas.
- Guías instaladas Next 16.4.3: Server and Client Components, Fetching Data y
  Route Handlers. Cliente solo para interacción, datos privados en servidor,
  searchParams asincrónicos y caché deshabilitada.

Aplicación alojada, migración remota y comportamiento con usuarios reales:
NOT_RUN / NOT_VERIFIED. No se declaran aceptados antes de auditoría independiente.
