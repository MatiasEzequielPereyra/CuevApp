# CUEVA-006D — Rutinas en texto libre con menciones de ejercicios

Estado: implementación en rama aislada; revisión, CI e integración pendientes.
Fecha de decisión: 2026-11-16.

## Decisión de producto CONFIRMED

La pantalla de edición de cada rutina tendrá dos subpestañas:

- **Por bloques**: conserva el constructor actual, sus días, bloques, vueltas,
  ejercicios, objetivos, observaciones y controles. Se reubica sin rediseñarlo.
- **Texto libre**: nuevo editor para redactar una rutina completa sin crear días
  ni bloques. Debe permitir texto normal, saltos de línea y menciones vinculadas
  al catálogo.

No se elimina ni se reemplaza el editor actual. La pestaña activa se guarda por
rutina/plantilla y la publicación del alumno muestra únicamente el formato
seleccionado. Cambiar de pestaña no debe borrar ni convertir el contenido del
otro formato.

## Alcance funcional

1. Autocompletar ejercicios mientras se escribe:
   - Al escribir @, ofrecer búsqueda en el catálogo.
   - También buscar por prefijo al escribir directamente el nombre, sin @.
   - Debounce, cancelación/ignorancia de respuestas obsoletas, estados vacío,
     carga y error con reintento.
   - Solo ofrecer ejercicios activos para nuevas menciones.
2. Seleccionar una sugerencia inserta el nombre visible en la posición del
   cursor y conserva una referencia estructurada al UUID estable del ejercicio.
3. Permitir repetir el mismo ejercicio y conservar texto libre antes/después.
4. Mantener referencias al renombrar ejercicios. Las publicaciones históricas
   conservan el texto y UUID capturados; la UI puede mostrar el nombre vigente
   desde la información asignada al alumno.
5. No convertir una mención en una asignación dentro del plan por bloques.
   Mencionar un ejercicio no crea bloques, objetivos, series ni videos.
6. El alumno ve el texto publicado, con las menciones identificables como
   referencias. La información complementaria debe limitarse a los ejercicios
   mencionados en su propia última publicación, junto con los que ya provienen
   del plan estructurado.
7. Si una referencia histórica ya no se puede resolver, mostrar el texto
   capturado sin romper la rutina ni filtrar el catálogo administrativo.

## Persistencia y compatibilidad

- Conservar content como observaciones del formato por bloques y plan como
  estructura actual.
- Agregar contenido de texto libre, formato seleccionado y referencias
  estructuradas de menciones como datos versionados en borrador, plantilla y
  publicación.
- La migración debe ser aditiva, sin editar migraciones históricas ni reescribir
  publicaciones. Para registros previos sin plan, preservar su texto y
  presentarlo como contenido libre inicial; para registros con plan, mantener
  el formato por bloques y sus observaciones.
- Extender el CAS, idempotencia, comparación de conflictos, copia de plantillas
  y publicación para incluir todos los campos nuevos.
- Mantener la publicación inmutable y visible únicamente al alumno vinculado.
- La validación de referencias activas o ya existentes debe residir en la base,
  no solo en el navegador.

## Exclusiones

- No tocar CUEVA-003B Vencimientos ni CUEVA-005 Notificaciones.
- No modificar pagos, membresías, Auth, invitaciones, roles, SMTP, Vercel ni
  configuración Supabase alojada.
- No cambiar el contrato ni el diseño del constructor por bloques más allá de
  ubicarlo en su subpestaña.
- No crear asignaciones, objetivos o registros de entrenamiento a partir de
  menciones.
- No habilitar al alumno a editar su rutina ni a consultar catálogos ajenos.

## Criterios de aceptación

- Ambas subpestañas funcionan en plantilla y rutina de alumno, en móvil y
  escritorio, con teclado y temas claro/oscuro.
- El contenido y referencias sobreviven a recarga, conflicto, reintento,
  aplicación de plantilla y publicación.
- Autocompletado funciona con @ y sin @, tolera cambios rápidos de consulta
  y no presenta resultados de ejercicios inactivos.
- Múltiples menciones, mismo ejercicio repetido, nombres con tildes, espacios,
  signos y texto Unicode se conservan correctamente.
- Renombrar/desactivar un ejercicio no rompe menciones ya publicadas; una nueva
  mención de ejercicio inactivo se rechaza en servidor/base.
- El alumno solo recibe detalles de ejercicios de su publicación propia.
- La rutina por bloques existente, sus objetivos, videos y publicaciones
  históricas mantienen el comportamiento actual.
- Pruebas negativas para visitante, alumno ajeno, alumno que intenta escribir,
  UUID inexistente/inactivo, offsets inválidos y payloads malformados.
- Lint, typecheck, build, pruebas, verificación de fuentes/seguridad y las tres
  variantes de migración local (fresh, upgrade, hosted-compatible) se reportan
  con resultados reales. CI y auditoría independiente pendientes antes de
  integrar.

## Entrega

Rama: feature/routine-text-mentions.
Base verificada al iniciar: d85d7bca01d60b6f8bdca4477885ecb4f85c21ff.
Sin merge ni deploy. Registrar HEAD, archivos, pruebas, riesgos y estado de
migración en el handoff; el Orchestrator realiza auditoría e integración.
