# CUEVA-006C — Catálogo de rutinas, días y bloques

Estado: READY como encargo; implementación NOT_STARTED. Decisiones del usuario
recogidas en diez preguntas el 2026-11-06. Esta instrucción posterior prevalece
sobre los contratos anteriores contradictorios de rutinas. No modifica fuentes
históricas protegidas. No declara cambios integrados o desplegados.

## Base y aislamiento

Main remoto verificado: `7663e51f7b60c269a9bb7f13f0f69d26358b609d`.
Revalidar antes de empezar; revisar ramas/PR relacionados y trabajo concurrente.
Facu trabaja en `feature/cueva-003b-vencimientos`: no intervenir esa rama ni pagos.
Usar rama y checkout Git aislados. Incorporar este encargo al checkout de trabajo.
Leer AGENTS, checkpoint, README y skills pertinentes de desarrollo, arquitectura
y seguridad. Registrar SKILLS_SELECTED, SKILLS_APPLIED y SKILL_SOURCES reales.

## Contrato aprobado

1. `/rutinas` abre el catálogo de plantillas de rutinas, no una lista de alumnos.
   Crear, consultar y editar plantillas desde allí. Mostrar estados vacíos honestos.
2. Desde la ficha de un alumno se asigna una copia independiente de una plantilla.
   Su personalización no modifica origen ni otros alumnos. Editar una plantilla
   tampoco cambia copias asignadas. Confirmar reemplazos de contenido existente.
3. La planificación contiene días/sesiones ordenados, con nombres libres como
   Lunes, Día 1 o Piernas. Admitir diferentes cantidades por alumno; no fijar 5.
4. Cada día contiene varios bloques ordenados. Cada bloque agrupa varios ejercicios
   ordenados que se hacen sucesivamente y se repiten antes de pasar al siguiente.
5. Las series/vueltas se configuran UNA vez por bloque. Los ejercicios de ese bloque
   comparten esa cantidad: no exponer series independientes por ejercicio.
6. La biblioteca de ejercicios muestra una lista visible desde el inicio. Crear
   un ejercicio define su identidad y descripción, no kilos, repeticiones o vueltas
   específicos de entrenamiento. Esos objetivos pertenecen a cada rutina/plantilla.
7. Selección múltiple de ejercicios para agregarlos juntos a un bloque y posterior
   reordenamiento. Mantener buscador como ayuda, no como requisito para ver opciones.
   Investigar y corregir por qué ejercicios disponibles no aparecen. Si hay
   paginación, ofrecer acceso visible al resto sin truncamiento silencioso.
8. Cada aparición permite elegir modo peso/repeticiones o tiempo (segundos/minutos),
   con nota opcional. El peso puede quedar sin especificar para ejercicios sin carga.
   La elección se hace en la rutina, sin limitar usos posteriores del ejercicio.
9. Incluir acceso al video explicativo asociado al ejercicio desde biblioteca/rutina.
   Revisar primero la biblioteca real. Implementar una asociación mínima funcional
   si falta: enlace opcional validado a YouTube, sin uploads ni nueva infraestructura.
   No inventar videos, navegar a páginas inexistentes ni abrir datos administrativos
   al alumno. Sin video, mostrar disponibilidad honesta. Lectura del alumno limitada
   a recursos autorizados de sus ejercicios publicados; validar destinos en servidor.
10. Alumno ve todos sus días asignados; al elegir uno, ve todos sus bloques,
    ejercicios, vueltas, objetivos y notas. Solo lectura de su planificación publicada.
11. Autoguardado de borrador y PUBLICAR explícito: los cambios del administrador
    llegan al alumno solamente al publicar. Asignar plantilla prepara el borrador;
    la copia no se publica por sorpresa. Conservar conflictos/reintentos y avisos.

## Implementación y compatibilidad

Reutilizar sistema de marca, temas, gate, permisos, borradores CAS, plantillas
independientes e instantáneas publicadas. Extender el modelo versionado para
días -> bloques (vueltas) -> ejercicios (modo y objetivos), validado en servidor/DB.
Preparar una migración aditiva nueva cuando corresponda. No editar migraciones
históricas, borrar datos ni reinterpretar notas automáticamente.

La estructura anterior v1 guarda series por ejercicio y carece de días. Debe
seguir siendo legible, incluidos borradores y publicaciones. Documentar adaptación
sin pérdida; si hay series diferentes en un bloque anterior, no igualarlas ni
descartarlas silenciosamente. Una conversión debe conservar información y permitir
revisión administrativa. No sustituir una publicación existente hasta publicar.

Editar días, bloques y ejercicios debe ser usable en móvil y teclado, incluyendo
reordenamiento con controles accesibles; no depender exclusivamente de arrastrar.
Mantener aislamiento por alumno, historial, copias independientes e idempotencia.
Catálogo/plantillas/borradores administrativos no se exponen por agregar videos.

## Aceptación

- Recorrido admin: crear plantilla de varios días con nombres libres, múltiples
  bloques/día y varios ejercicios/bloque; configurar vueltas comunes y objetivos
  por peso o tiempo; guardar, reabrir, reordenar y publicar.
- Lista de ejercicios completa/accesible y selección múltiple conserva orden/datos.
- Asignar la misma plantilla a dos alumnos; personalizar uno y modificar origen;
  comprobar independencia de las tres estructuras.
- Recorrido alumno: elegir cualquier día publicado y ver todos sus bloques;
  borrador modificado sigue oculto hasta publicar; video funciona si está disponible.
- Visitante y alumno ajeno no leen/modifican plantillas, borradores, rutinas o
  recursos privados. Probar permisos también mediante API/RPC, no solo UI.
- Probar legado, publicación/reintento, conflictos entre administradores,
  cambios de modo sin objetivos ocultos contradictorios y preservación de historia.
- Móvil/escritorio, temas, teclado y regresiones pertinentes. Ejecutar controles
  generales del proyecto al cerrar; documentar resultados reales y CI del HEAD.

## Límites operativos y entrega

Sin cambios de pagos, vencimientos, Auth, SMTP, roles ni rama de Facu. Sin resultados
realizados, temporizador, uploads, offline, correos reales o infraestructura nueva.
Ejecutor no integra ni aplica migraciones alojadas ni despliega a producción.

Este entorno ya presentó Node24/npm11 incompatibles, falta de dependencias/Docker
y restricciones de Git/red. Usar Node22/npm10 y documentación Next instalada.
No repetir esos diagnósticos ni instalar infraestructura por rutina: si continúan
sin resolver, emitir bloqueo breve que identifique el requisito externo faltante.
No usar una instantánea git archive como checkout Git ni aceptar escaneo de cero
archivos como prueba de seguridad. Mantener separación entre local/CI/alojado.

Handoff de siete líneas: TAREA/ESTADO; BASE/HEAD/RAMA; PR; CAMBIOS;
PRUEBAS/CI; PENDIENTES/RIESGOS; CARPETA/ESTADO_GIT. Enlazar evidencia detallada.

## Ampliación posterior confirmada durante ejecución — 2026-11-06

El Product Owner indicó: «la idea es que nel video se suba de la galeria» y confirmó
«Sí, 50 MB y carga solo admin». Esta decisión reemplaza la exclusión de uploads de
los puntos 9 y Límites operativos para la asociación de videos de ejercicios.
Se prepara carga desde galería a un bucket privado existente en la plataforma
Supabase, con máximo 50 MB y autorización exclusiva de administradores. Se mantiene
la prohibición de aplicar migraciones alojadas y operar producción. No se autoriza
contratar planes, subir datos reales, cambiar Auth ni intervenir el trabajo de Facu.
El enlace de YouTube permanece como alternativa opcional.
