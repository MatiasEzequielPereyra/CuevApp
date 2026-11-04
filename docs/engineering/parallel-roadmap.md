# CUEVA — roadmap de entregas paralelas

Actualizado: 2026-11-04, America/Buenos_Aires. Plan del Orchestrator a pedido del usuario.

Base verificada: `fa87f778287434dbad016435b28b7d895a05f90e`, PR21 integrado.
El usuario aprobó el panel; conservar su dirección visual y el lettering SVG.
El login real por correo ya existe. La raíz todavía presenta la antigua página
de construcción y el formulario activo de ingreso todavía requiere diseño.

## Dos líneas de implementación

| Orden | Línea A: gestión del gimnasio | Línea B: acceso y entrenamiento | Dependencias |
| --- | --- | --- | --- |
| Ahora | CUEVA-ALUMNOS-001, en implementación: fichas, búsqueda, alta y edición | CUEVA-ACCESO-001, READY FOR EXECUTOR: raíz hacia ingreso y login según mockup | Acceso reutiliza Auth existente; puede entregarse antes de Alumnos |
| Siguiente | CUEVA-003A, cuotas y pagos manuales: vencimiento individual, pagos parciales, saldo e historial | CUEVA-EJERCICIOS-001, catálogo: nombre, instrucciones, búsqueda, ficha y enlace YouTube | Pagos necesita alumnos; catálogo puede desarrollarse independientemente |
| Después | CUEVA-004A, comprobantes privados y revisión administrativa | CUEVA-006A, rutina tipo Keep: borrador autoguardado, publicación y asignación | Comprobantes depende de pagos; rutinas de alumnos; ejercicios estructurados son opcionales |
| Consolidación | Correo general y recordatorio de vencimiento | Panel del alumno, consulta de rutina y registro de entrenamiento | Acceso general requiere correo operativo; recordatorio requiere vencimientos; registro requiere ejercicios estructurados |
| Cierre MVP | Aceptación de recorridos completos y correcciones | PWA instalable y lectura offline de rutinas publicadas | Instalación puede anticiparse; offline privado requiere rutina publicada, aislamiento y limpieza al salir |

No hay fechas comprometidas ni módulos de negocio aceptados por esta tabla.
Cada tarea posterior necesita su encargo acotado y revisión antes de integrarse.
Pagos y rutinas conservan prioridad sobre ampliar la biblioteca de videos.

## Reparto para evitar conflictos

- Alumnos conserva su checkout `cueva-002b-local`, rama `codex/cueva-alumnos-001`,
  rutas/API de alumnos, migración propia, componentes students, navegación del
  panel y estilos que ya está modificando. No intervenir ese trabajo.
- Acceso usa otro checkout/rama. Archivos principales: `src/app/page.tsx`,
  `src/app/ingresar/page.tsx`, componentes access, CSS Module propio y pruebas
  de entrada. No modifica globals.css, dashboard, migraciones ni manejador Auth.
- Ejercicios se agenda después del ingreso como tarea independiente, con sus
  rutas, componentes y migración propia. Los cambios comunes de navegación y
  documentación se concilian durante la integración; no editar el trabajo ajeno.
- Máximo dos implementaciones activas en este plan. La instrucción posterior del
  usuario permite paralelismo acotado; no abre todos los tracks a la vez.

## Acceso, correo y publicación

La página principal debe dejar de anunciar construcción. Un visitante llega al
login; una sesión habilitada puede continuar a su cuenta con los controles
existentes. No mostrar un registro público ni simular recuperación de contraseña.

El correo temporal sigue restringido al propietario. El catálogo administrativo
y las fichas no necesitan habilitar invitaciones. El envío general se prepara en
paralelo y se verifica antes de incorporar alumnos a sus cuentas; no repetir los
intentos de Google sin una corrección concreta ni cambiar de proveedor o contratar
servicios por inferencia. Los videos propios requieren definir límites de archivo,
almacenamiento y acceso antes de implementar uploads.

El ejecutor entrega REVIEW. El Orchestrator revisa, integra y publica cada
incremento aceptado sin esperar a terminar todos los módulos. Las migraciones
alojadas y cambios sensibles requieren su revisión específica; las tareas locales
no habilitan escrituras remotas. No usar datos inventados como datos del gimnasio.

## Verificación proporcionada

Probar lo modificado, reutilizar los recorridos existentes y dejar las comprobaciones
generales al CI correspondiente. No repetir laboratorios de identidad por cambios
visuales. Evidencia sintética, RLS local, sesión alojada y publicación se informan
por separado. No ampliar ni repetir pruebas aprobadas sin cambios o fallos nuevos.

Encargo listo: [CUEVA-ACCESO-001](CUEVA-ACCESO-001-task.md).
