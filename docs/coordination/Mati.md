# Plan de trabajo — Mati

## Objetivo
Avanzar con `CUEVA-UI-002 — Dashboards y navegación principal` sin interferir con el trabajo de Facu ni alterar funcionalidades existentes.

## Alcance asignado

### 1. Dashboard del Administrador
- Continuar desde la rama aislada `codex/cueva-dashboard-002`.
- Revisar el estado más reciente de `main` y compararlo con la rama antes de editar.
- Conservar la identidad visual y la base responsive ya existente.
- Integrar únicamente datos y acciones que ya estén disponibles y autorizados.
- Mantener estados vacíos, de carga y de error honestos; no inventar estadísticas ni actividad.
- No presentar placeholders como si fueran funcionalidades terminadas.

### 2. Dashboard del Alumno
- Implementar la vista principal del alumno según el contexto maestro del producto.
- Mostrar solo información real y accesible para ese alumno.
- Incluir accesos a las áreas ya previstas, sin desarrollar el módulo de Rutinas.
- No crear datos ficticios ni simular pagos, cuotas o comprobantes.

### 3. Navegación por rol
- Adaptar la navegación móvil para Administrador principal y Alumno.
- Mantener navegación lateral en escritorio.
- El botón central `+` es opcional: incluirlo solo si existe una acción real, definida y funcional.
- Evitar enlaces que solo cambien el hash o que conduzcan a pantallas inexistentes.
- Asegurar indicador de sección activa, accesibilidad por teclado y `aria-current` cuando corresponda.

### 4. Responsive, accesibilidad y regresión
- Verificar anchos de 360, 390, 768, 1024 y 1440 px.
- Revisar tema visual, foco, navegación por teclado, contraste y áreas seguras del móvil.
- Comprobar que el menú no tape contenido ni formularios.
- No modificar login, invitaciones, roles, sesiones ni logout.
- Ejecutar y documentar lint, typecheck, build y pruebas disponibles. Informar resultados reales, sin afirmar pruebas no ejecutadas.

## Exclusiones explícitas
- No desarrollar Rutinas ni su editor/visor.
- No implementar cuotas, pagos ni comprobantes.
- No agregar pasarela de pago, checkout ni cobros en línea.
- No modificar Supabase, SQL, RLS, Storage, Auth, correo ni variables de entorno.
- No rediseñar la marca ni reemplazar logo, tipografía o paleta.
- No modificar `main`, fusionar, desplegar ni realizar cambios de producción.
- No asumir que los datos de pagos/cuotas ya existen: la auditoría del repositorio no encontró su implementación.

## Entregables
1. Implementación aislada en la rama de trabajo.
2. Resumen de archivos modificados y decisiones tomadas.
3. Evidencia de pruebas ejecutadas y resultados.
4. Capturas o descripción de las vistas de Administrador y Alumno en móvil y escritorio.
5. PR en borrador para revisión, si el flujo del repositorio lo permite. No fusionar.

## Coordinación con Facu
- Facu es responsable de las definiciones funcionales y especificaciones de cuotas, pagos y comprobantes.
- No crear modelos, campos, endpoints ni datos de pago por iniciativa propia.
- Si el dashboard necesita mostrar información financiera que todavía no tiene una fuente real, dejar un estado vacío honesto y documentar la dependencia.
- Antes de editar cualquier archivo, comprobar si el otro colaborador o Codex lo modificó desde la base de la rama.
- Si aparece un cambio concurrente, detenerse y coordinar; no sobrescribirlo.

## Criterio de finalización
La tarea queda lista para revisión cuando ambos dashboards y la navegación por rol funcionan con datos reales disponibles, se mantienen los comportamientos existentes y las pruebas ejecutadas están documentadas. No equivale a aprobación, merge ni despliegue.
