Actuá como CODEX EXECUTOR de CUEVA.

TASK_ID: CUEVA-006B — Rutinas estructuradas y catálogo básico.
CONTINUACIÓN: CUEVA-006A, commit fd315ca0bd6a9db3131449b2cd58ae6eb43b8759.

CAMBIO DE PRODUCTO CONFIRMADO:
El usuario reemplaza el editor principal tipo notas por un constructor de rutinas mediante selección de ejercicios. Esta instrucción prevalece sobre el requisito anterior de nota libre.

CUEVA-006A permanece REVIEW; no asumir aceptación independiente. Continuá desde su implementación en una rama codex/cueva-006b-rutinas-estructuradas, preservando trabajo ajeno y declarando las bases efectivas.

## 1. Catálogo básico de ejercicios

- Sección administrativa para crear, buscar y editar ejercicios por nombre.
- Desde el constructor, buscar un ejercicio y agregarlo sin perder la rutina en edición.
- Permitir crear un ejercicio si no existe y continuar con el armado.
- Detectar nombres equivalentes por mayúsculas y espacios para evitar duplicados accidentales.
- Identidad estable por ejercicio.
- Poder desactivar ejercicios para nuevas selecciones conservando las referencias existentes.
- Sin datos ficticios cargados en producción.

Este catálogo es la primera parte de la biblioteca. Videos, imágenes y archivos quedan fuera de esta entrega.

## 2. Constructor de rutinas

- Una rutina principal por alumno.
- Organizar en bloques con nombre editable: “Día 1”, “Lunes”, “Pecho”, etc.
- Agregar ejercicios desde el catálogo.
- Para cada aparición configurar:
  - Series.
  - Repeticiones, admitiendo cantidad o rango sencillo.
  - Peso objetivo opcional en kg.
  - Observación breve opcional.
- Peso sin definir debe distinguirse de cero.
- Permitir ordenar bloques y ejercicios, editar y quitar elementos del borrador.
- Controles utilizables desde celular y teclado; no depender únicamente de arrastrar.
- El mismo ejercicio puede aparecer en distintos días, con valores independientes.
- No interpretar automáticamente notas antiguas para generar ejercicios.

Mantener el diseño, temas, logo y navegación aprobados. El texto libre queda como observación complementaria.

## 3. Conservar el trabajo de CUEVA-006A

Adaptar, sin rehacer innecesariamente:
- Autoguardado confirmado.
- Recuperación ante errores y conflictos entre administradores.
- Publicación explícita, consistente e idempotente.
- Historial de versiones publicadas.
- Plantillas copiadas de forma independiente.
- Consulta privada del alumno.

El alumno sigue viendo la última publicación mientras el administrador modifica el borrador.

Las plantillas ahora deben copiar la estructura completa: bloques, ejercicios y objetivos. Cambiar una copia no modifica la plantilla ni otras rutinas.

## 4. Consulta del alumno

Mostrar bloques y ejercicios ordenados, con series, repeticiones, peso objetivo y observaciones.

El alumno no puede modificar la planificación. El registro de pesos o repeticiones realmente realizados queda para otro incremento: no confundir objetivos con resultados.

Modificar o desactivar un ejercicio del catálogo no debe reescribir publicaciones históricas ni objetivos asignados. Definir y documentar cómo se preservan los datos publicados.

## 5. Datos y seguridad

- Conservar contenido existente de CUEVA-006A sin borrarlo ni convertirlo automáticamente.
- Preparar una evolución versionada del esquema y documentar su aplicación desde main.
- No modificar migraciones históricas.
- Mantener RLS, permisos, vínculo ficha–Auth y controles actuales de sesión.
- Administrador gestiona catálogo y planificación; alumno consulta únicamente su publicación.
- No exponer catálogo administrativo, borradores, plantillas ni rutinas ajenas por solicitudes directas.
- Conservar la protección contra eliminación de fichas con rutinas.
- No modificar Auth, SMTP, invitaciones, pagos ni configuración alojada.

Actualizar la documentación de decisiones y alcance con este cambio explícito del usuario; conservar las fuentes originales.

## 6. Verificación acotada

Adaptar el laboratorio de Rutinas existente. Comprobar:
- Crear y buscar ejercicio; agregarlo y configurar objetivos.
- Ordenar y quitar elementos.
- Persistencia de la estructura tras recargar.
- Validaciones, errores y conflictos.
- Independencia de plantillas.
- Borradores privados y publicación consistente.
- Modificar/desactivar catálogo sin alterar publicaciones anteriores.
- Permisos mediante API/base reales.
- Uso móvil, computadora y teclado.

Ejecutar lint, tipos, build, documentos y seguridad pertinentes. No repetir laboratorios de identidad, SMTP, transporte ni matrices ajenas al cambio.

## 7. Entrega

Entregar CODEX_TO_ORCHESTRATOR_HANDOFF_V1, informe, migración, evidencia y capturas nuevas.

Distinguir resultados nuevos de evidencia anterior y declarar el diff acumulado desde main para la auditoría.

Estado esperado: REVIEW.
Sin push, PR, merge, deploy ni escrituras remotas.

El Orchestrator audita e integra; las correcciones las realiza el ejecutor.