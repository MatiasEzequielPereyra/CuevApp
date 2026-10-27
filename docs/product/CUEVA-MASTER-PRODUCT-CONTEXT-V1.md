# CUEVA — MASTER PRODUCT CONTEXT & DECISION HISTORY V1

## DOCUMENTO MAESTRO DE CONTEXTO FUNCIONAL

**Proyecto:** CUEVA Gym App  
**Repositorio:** https://github.com/MatiasEzequielPereyra/CuevApp  
**Supabase:** https://supabase.com/dashboard/project/vbkzoojkdkcugxhneyzi  
**Supabase Project ID:** `vbkzoojkdkcugxhneyzi`  
**Producto:** Progressive Web App (PWA)  
**Estado:** MVP funcionalmente definido, pendiente de implementación y validación.

---

# 1. INSTRUCCIONES PARA EL ORCHESTRATOR

Este documento reúne las decisiones tomadas durante doce rondas de diseño y posteriores modificaciones solicitadas por el usuario y por Nico, dueño del gimnasio.

Debés utilizarlo como **fuente de verdad de los requisitos funcionales aprobados**.

No vuelvas a preguntar decisiones que están confirmadas.

No modifiques requisitos por iniciativa propia.

No agregues funcionalidades fuera del MVP sin justificar su necesidad o recibir autorización.

No confundas una funcionalidad considerada durante las primeras rondas con una funcionalidad finalmente aprobada para V1.

**Regla de precedencia:** las decisiones posteriores y explícitas prevalecen sobre las anteriores cuando existe una contradicción.

Ejemplos:

- Se pensó inicialmente en una aplicación nativa para Google Play y App Store. Posteriormente se decidió utilizar PWA. La decisión vigente es PWA.
- Inicialmente se habló de profesores. Luego se aclaró que solamente Nico y su socio administran el gimnasio.
- Inicialmente se contemplaron estadísticas avanzadas, asistencia QR y notificaciones push. Posteriormente Nico estableció prioridades más concretas, por lo que esos módulos quedaron fuera del MVP.
- Inicialmente el acceso era únicamente por DNI. La decisión definitiva es acceso mediante DNI o email asociados a una misma cuenta.
- Inicialmente se contempló un editor estructurado de entrenamientos. Nico pidió escribir directamente como en Google Keep. La decisión definitiva es un editor de texto libre con ejercicios estructurados opcionales.

Este contexto debe conservarse durante todo el desarrollo.

---

# 2. OBJETIVO DEL PRODUCTO

CUEVA es una aplicación destinada a administrar un gimnasio real ubicado en Argentina.

El gimnasio cuenta aproximadamente con 50–150 alumnos.

Actualmente Nico utiliza métodos manuales para trabajar, especialmente papel, pizarra y notas de Google Keep.

El objetivo es digitalizar sus tareas sin complicarle el trabajo cotidiano.

CUEVA debe permitir:

1. Administrar alumnos.
2. Controlar cuotas y pagos.
3. Avisar automáticamente cuando corresponde pagar.
4. Escribir y asignar rutinas rápidamente.
5. Permitir a los alumnos consultar sus entrenamientos.
6. Mostrar videos demostrativos de ejercicios.
7. Consultar comprobantes y movimientos.
8. Ampliar progresivamente las funciones del gimnasio.

**Principio de producto:**

La aplicación debe adaptarse a la manera de trabajar de Nico, y no obligar a Nico a adaptarse a un sistema complejo.

El objetivo no es construir una plataforma SaaS genérica para múltiples gimnasios.

El objetivo es construir una herramienta profesional y sencilla para CUEVA.

---

# 3. NECESIDADES EXPRESAS DE NICO

Nico comunicó tres prioridades fundamentales.

## PRIORIDAD 1 — GESTIÓN DE PAGOS

Nico necesita anotar los pagos de los alumnos.

También pidió que, de ser posible, el sistema envíe un email recordando el vencimiento de la cuota exactamente un día antes.

Esta es una necesidad esencial.

## PRIORIDAD 2 — RUTINAS TIPO GOOGLE KEEP

Nico indicó que quiere la misma modalidad de escritura que utiliza en Google Keep.

Su intención es abrir una nota, escribir la rutina y guardar.

No quiere completar numerosos formularios para asignar ejercicios.

Esta es otra necesidad esencial.

## PRIORIDAD 3 — VIDEOS DE EJERCICIOS

Nico comentó que sería útil tener una carpeta o biblioteca con videos demostrativos.

Inicialmente mencionó la posibilidad de usar enlaces de YouTube.

Posteriormente se decidió permitir también videos propios grabados desde el teléfono.

Es una funcionalidad aprobada para el MVP, pero no debe retrasar las funcionalidades prioritarias de pagos y rutinas.

Nico aclaró que todas las demás funcionalidades son complementarias.

**Estas tres prioridades prevalecen sobre cualquier intento de ampliar innecesariamente el producto.**

---

# 4. PLATAFORMA DEFINITIVA

La plataforma elegida es una **Progressive Web App (PWA)**.

No desarrollar aplicaciones nativas para tiendas en V1.

La aplicación debe:

- Funcionar en Android.
- Funcionar en iPhone.
- Funcionar desde computadoras.
- Ser instalable desde navegadores compatibles.
- Disponer de manifest e íconos.
- Ser responsive.
- Soportar temas claro y oscuro.
- Tener una experiencia semejante a una aplicación móvil.
- Poder actualizarse desde el servidor.
- Permitir consultar rutinas descargadas sin internet.

La modalidad offline inicialmente aprobada es **lectura de rutinas**, no edición ni sincronización completa de entrenamientos.

El sistema de pagos y la autenticación requieren conexión al servidor.

No almacenar indiscriminadamente información financiera sensible en caché.

---

# 5. USUARIOS Y ROLES

Existen tres tipos funcionales de usuarios.

## NICO — ADMINISTRADOR PRINCIPAL

Nico es el dueño del gimnasio.

Debe poder:

- Crear alumnos.
- Editar alumnos.
- Configurar permisos.
- Crear y modificar rutinas.
- Gestionar plantillas.
- Gestionar ejercicios.
- Subir videos.
- Registrar pagos.
- Confirmar comprobantes.
- Modificar vencimientos.
- Revisar saldos.
- Acceder a reportes.
- Administrar configuraciones del gimnasio.

## SOCIO DE NICO — ADMINISTRADOR

Existe un único socio de Nico.

Su nombre podría ser Andrés, pero NO está confirmado.

No utilizar Andrés como nombre definitivo en el producto hasta verificarlo.

El socio tendrá acceso administrativo según los permisos que configure Nico.

## ALUMNOS

Se esperan entre 50 y 150 usuarios inicialmente.

Pueden:

- Ingresar a sus cuentas.
- Consultar sus rutinas.
- Consultar videos de ejercicios.
- Registrar resultados de ejercicios estructurados.
- Consultar sus cuotas.
- Consultar sus pagos.
- Adjuntar comprobantes.
- Consultar el estado de sus comprobantes.

No pueden:

- Crear otros usuarios.
- Modificar la planificación asignada por Nico.
- Modificar el precio de las cuotas.
- Confirmar pagos.
- Administrar otros alumnos.
- Subir videos a la biblioteca general.

**Aclaración definitiva:** no existen profesores adicionales en V1.

Solo Nico y su socio tienen acceso administrativo.

---

# 6. AUTENTICACIÓN — REQUISITO DEFINITIVO

Este requisito fue actualizado después de las primeras rondas y debe implementarse correctamente desde la arquitectura inicial.

## REGISTRO

Los administradores podrán crear una cuenta con:

- DNI.
- Email.
- DNI y email.

Debe existir al menos uno de los dos identificadores.

El email no es obligatorio inicialmente.

El DNI tampoco es obligatorio cuando existe un email válido.

## LOGIN

La pantalla tendrá un único campo:

**DNI o correo electrónico**

El usuario podrá ingresar utilizando cualquiera de los identificadores vinculados a su cuenta.

Ejemplo:

Un alumno tiene:

DNI: 40123456  
Email: alumno@ejemplo.com

Debe poder ingresar con:

40123456 + contraseña

O:

alumno@ejemplo.com + la misma contraseña.

Ambas operaciones deben abrir exactamente la misma cuenta.

## IDENTIDAD ÚNICA

No crear cuentas duplicadas.

Si un usuario fue registrado inicialmente solo con DNI y posteriormente agrega un email, ambos identificadores deben vincularse al mismo usuario.

Debe conservar:

- Rutina.
- Historial de entrenamientos.
- Pagos.
- Comprobantes.
- Configuración.
- Identificador interno.

## CONTRASEÑAS

- La cuenta la crea Nico o su socio.
- Se establece una contraseña temporal individual.
- No utilizar una contraseña fija compartida.
- El alumno debe cambiarla obligatoriamente en su primer ingreso.
- Las contraseñas deben almacenarse mediante mecanismos seguros.
- Los administradores no pueden ver contraseñas definitivas.
- Nico o su socio pueden iniciar un restablecimiento mediante una nueva clave temporal.
- El mecanismo debe ser resistente a enumeración de cuentas, abuso e intentos masivos.

## EMAIL

Un alumno puede utilizar CUEVA aunque no tenga email.

Si no tiene correo, deberá aparecer un estado identificable como:

**Email pendiente**

No se podrá enviar el recordatorio por correo hasta que exista un email habilitado.

La vinculación de nuevos correos debe contemplar verificación y prevención de duplicados.

## REQUISITO ARQUITECTÓNICO

Investigar y diseñar correctamente la integración de Supabase Auth para soportar login mediante DNI o email.

No asumir que Supabase permite directamente este contrato.

No crear un sistema de autenticación casero inseguro.

No usar emails ficticios como solución improvisada.

No exponer directorios de DNI para resolver identificadores.

Las autorizaciones y accesos deben permanecer asociados a una identidad interna única.

---

# 7. DATOS DE LOS ALUMNOS

La ficha de alumno debe mantenerse sencilla.

Datos iniciales:

- ID interno.
- Nombre.
- Apellido.
- DNI opcional.
- Email opcional.
- Fecha de alta.
- Estado de cuenta.
- Fecha de vencimiento.
- Información de cuota.
- Rutina asignada.
- Historial de pagos.
- Comprobantes.

No se requieren fotografías personales obligatorias.

No se requieren medidas corporales.

No se requieren datos médicos.

Los alumnos no necesitan perfiles sociales.

Nico debe poder buscar por nombre, DNI o email según los datos existentes.

---

# 8. CUOTAS — REGLAS CONFIRMADAS

## PRECIO MENSUAL

El gimnasio utiliza una cuota mensual general.

No hay diferentes planes de membresía en V1.

Nico puede modificar el precio general.

Cuando cambia el precio:

- Los períodos anteriores conservan el valor original.
- Los pagos anteriores no cambian.
- Las deudas históricas conservan la información económica correspondiente.
- El nuevo valor se aplica conforme a reglas explícitas para períodos posteriores.

## VENCIMIENTOS

Cada alumno tiene un vencimiento individual.

Inicialmente se vincula a su fecha de alta o renovación.

Si alguien paga después del vencimiento, **Nico decide caso por caso** si conserva la fecha original o establece una nueva.

No imponer automáticamente un único comportamiento.

## MEDIOS DE PAGO

Registrar:

- Efectivo.
- Transferencia.
- Otros medios.

No implementar cobros online automáticos en V1.

## PAGOS PARCIALES

Deben admitirse.

Ejemplo ilustrativo:

Cuota mensual: $40.000  
Primer pago: $25.000  
Saldo pendiente: $15.000

El alumno debe poder consultar cuánto pagó y cuánto debe.

El sistema debe permitir varios movimientos asociados a un mismo período.

Los pagos no deben duplicarse por reintentos técnicos.

## HISTORIAL

Cada pago debe conservar:

- Alumno.
- Período.
- Importe.
- Fecha.
- Medio.
- Estado.
- Administrador que lo confirmó.
- Comprobante asociado, cuando exista.

Las correcciones deberán preservar trazabilidad.

No borrar o sobrescribir silenciosamente información financiera.

## CUOTAS VENCIDAS

Nico decide individualmente qué hacer con alumnos que tienen deudas.

No establecer un bloqueo automático universal de rutinas.

Cualquier restricción de acceso deberá ser explícita y autorizada.

---

# 9. COMPROBANTES DE PAGO

Decisión definitiva:

**Nico, su socio y los alumnos pueden adjuntar comprobantes, pero solamente los administradores pueden confirmar pagos.**

## FLUJO

1. El alumno realiza una transferencia.
2. Ingresa a CUEVA.
3. Selecciona su cuota.
4. Adjunta una foto o PDF.
5. El comprobante queda pendiente de revisión.
6. Nico o su socio lo verifican.
7. Un administrador confirma o rechaza el comprobante.
8. Si confirma, el sistema registra el pago.
9. Se actualiza el saldo correspondiente.
10. El alumno puede consultar el movimiento y el comprobante.

## ESTADOS

Como mínimo:

- Pendiente de revisión.
- Confirmado.
- Rechazado.

Un comprobante adjunto NO representa dinero confirmado.

## PAGOS EN EFECTIVO

Nico puede registrar un pago manualmente sin obligar a adjuntar un archivo.

## SEGURIDAD

- Archivos privados.
- Acceso restringido.
- Validación de formato.
- Tamaños limitados.
- Protección contra archivos maliciosos.
- RLS y comprobaciones del servidor.
- No permitir que un alumno confirme sus propios pagos.

Los administradores deben poder consultar los comprobantes necesarios para verificar los cobros.

---

# 10. RECORDATORIOS AUTOMÁTICOS

Nico pidió específicamente un correo electrónico **un día antes del vencimiento**.

Decisión definitiva:

Un único recordatorio previo.

No implementar secuencias adicionales de avisos por deuda en V1.

## REGLAS

Enviar si:

- Existe un email válido y habilitado.
- La cuota correspondiente está pendiente total o parcialmente.
- El vencimiento es al día siguiente.
- No se procesó exitosamente el mismo recordatorio para ese alumno y vencimiento.

No enviar si:

- El alumno no tiene email.
- La cuota ya está completamente pagada.
- El recordatorio ya fue procesado para ese vencimiento.
- No corresponde el envío según el estado autorizado de la cuenta.

Utilizar zona horaria:

`America/Argentina/Buenos_Aires`

## CONTENIDO DEL EMAIL

Debe incluir:

- Identidad de CUEVA.
- Nombre del alumno.
- Fecha de vencimiento.
- Recordatorio de la cuota.
- Información clara para consultar su situación.

No incluir información personal innecesaria.

## INFRAESTRUCTURA

- Envío automático programado.
- Registro de intentos.
- Manejo de fallos.
- Reintentos razonables.
- Prevención de correos duplicados.
- Configuración segura del proveedor.
- Distinción entre correo aceptado y correo efectivamente entregado.

El sistema debe poder operar sin que Nico tenga que abrir la PWA para ejecutar los recordatorios.

---

# 11. EDITOR DE RUTINAS — REQUISITO CENTRAL

Nico utiliza Google Keep y quiere mantener una experiencia muy parecida.

## EXPERIENCIA PRINCIPAL

1. Buscar alumno.
2. Abrir su rutina.
3. Escribir libremente.
4. Guardar automáticamente el borrador.
5. Publicar cuando esté terminada.

La escritura debe ser rápida y natural.

No imponer un formulario por cada ejercicio.

## ORGANIZACIÓN

**Una única nota principal por alumno con toda su rutina.**

Ejemplo:

LUNES — PECHO

Press plano 4x10  
Press inclinado 3x12  
Aperturas 3x15

MIÉRCOLES — ESPALDA

Dominadas 4x8  
Remo con barra 3x12

VIERNES — PIERNAS

Sentadillas 4x10  
Prensa 3x12

El contenido es de texto libre.

Nico decide su formato.

## MODALIDADES

Anteriormente se confirmó que las rutinas pueden organizarse:

- Por días de la semana.
- Por secuencia de entrenamiento: Día 1, Día 2, etc.

La nota libre debe permitir ambas formas.

No imponer una estructura rígida.

## DURACIÓN

Las rutinas se mantienen vigentes hasta que Nico o su socio las modifiquen.

No obligar a generar rutinas nuevas cada semana.

## AUTOGUARDADO

Mientras Nico escribe, el sistema conserva un borrador.

El alumno no debe ver modificaciones incompletas.

La versión publicada permanece disponible hasta que se publique una nueva.

## PUBLICACIÓN

Debe existir una acción explícita:

**Publicar rutina**

Cuando se publica, el alumno recibe la versión actualizada.

## PLANTILLAS

Se pueden crear plantillas reutilizables.

Al asignar una plantilla a un alumno, se genera una copia independiente.

Cambiar la rutina de Juan no debe modificar la rutina de Pedro.

Editar una plantilla original no debe actualizar automáticamente todas las copias asignadas.

---

# 12. EJERCICIOS ESTRUCTURADOS

Se decidió mantener un editor híbrido.

El texto libre es la experiencia principal.

Pero Nico puede agregar opcionalmente ejercicios estructurados.

Cada ejercicio estructurado puede tener:

- Nombre.
- Series.
- Repeticiones.
- Peso objetivo.

No hacer obligatorios campos avanzados de entrenamiento.

En V1 no se requieren RPE, RIR, tempo ni técnicas complejas.

## REGISTRO DEL ALUMNO

El alumno puede registrar:

- Peso utilizado.
- Series realizadas.
- Repeticiones realizadas.

No puede modificar la planificación creada por Nico.

## HISTORIAL

Los resultados reales deben conservarse.

Modificar una rutina no debe borrar entrenamientos anteriores.

## ENTRENAMIENTOS INCOMPLETOS

Se decidió permitir guardar el entrenamiento como borrador y retomarlo después.

Al finalizar una sesión, debe guardarse en el historial sin requerir aprobación administrativa.

## TEXTO LIBRE

No interpretar automáticamente todo lo escrito en la nota como ejercicios estructurados.

Los registros de resultados estarán vinculados a ejercicios estructurados explícitos.

---

# 13. BIBLIOTECA DE EJERCICIOS

Se confirmó que habrá una biblioteca común.

Nico y su socio son los únicos autorizados a crear contenido.

## EJERCICIOS

Cada ejercicio puede tener:

- Nombre.
- Instrucciones.
- Video propio.
- Enlace a YouTube.

## VIDEOS PROPIOS

Nico puede:

1. Grabar un video desde la cámara del celular.
2. Seleccionar un video existente en la galería.
3. Subir el archivo.
4. Asociarlo al ejercicio correspondiente.

Ejemplo:

Ejercicio: Press militar.

Nico sube un video mostrando la técnica correcta.

Ese video queda asociado a Press militar.

Cuando el ejercicio aparezca en distintas rutinas, se reutilizará ese mismo video.

## REUTILIZACIÓN

No duplicar un archivo por cada alumno.

La biblioteca es compartida.

Si Nico modifica el video demostrativo del ejercicio, la asociación deberá reflejar la actualización sin modificar automáticamente las series o repeticiones de las rutinas.

## YOUTUBE

Permitir agregar enlaces de YouTube.

No obligar a que los videos sean públicos en YouTube para utilizar la biblioteca.

## SEGURIDAD Y COSTOS

Controlar:

- Tamaño máximo.
- Tipos de archivo permitidos.
- Almacenamiento.
- Reproducción.
- Accesos autorizados.
- Uso de ancho de banda.

No permitir subidas anónimas.

Los alumnos no pueden publicar videos en la biblioteca general.

---

# 14. DASHBOARD DEL ADMINISTRADOR

Nico y su socio tendrán un panel adaptable a celular y computadora.

La pantalla de inicio mostrará:

- Cantidad de alumnos activos.
- Cuotas próximas a vencer.
- Cuotas vencidas.
- Comprobantes pendientes.
- Correos pendientes de completar.
- Acciones rápidas.

## ACCIONES RÁPIDAS

- Agregar alumno.
- Buscar alumno.
- Registrar pago.
- Revisar comprobante.
- Editar rutina.
- Publicar rutina.
- Administrar ejercicios.

Evitar navegación innecesaria.

La tarea de registrar un pago o editar una rutina debe requerir pocos pasos.

---

# 15. DASHBOARD DEL ALUMNO

El alumno tendrá una experiencia principalmente móvil.

Pantalla principal:

- Saludo.
- Rutina asignada.
- Estado de cuota.
- Próximo vencimiento.
- Acceso a pagos.
- Acceso a comprobantes.
- Acceso a ejercicios y videos.

Las primeras rondas también contemplaron asistencia y progreso como indicadores del dashboard, pero sus módulos avanzados se postergaron.

No mostrar números ficticios como si fueran datos reales.

Si una funcionalidad todavía no existe, no presentar botones operativos falsos.

---

# 16. IDENTIDAD VISUAL OFICIAL

El usuario proporcionó una captura del logo oficial de CUEVA.

**Debe adjuntarse esa imagen original al Orchestrator y a Codex.**

El logo consiste en la palabra:

**CUEVA**

Con lettering:

- Blanco.
- Geométrico.
- Ancho.
- Angular.
- Deportivo.
- Trazos gruesos.
- Construcción visual personalizada.

Está sobre un círculo negro.

La captura muestra además elementos de Instagram y un botón azul/violeta.

**Esos elementos de Instagram no pertenecen necesariamente a la identidad oficial del gimnasio.**

No asumir que azul o violeta son colores oficiales.

## REQUISITO FUNDAMENTAL

No utilizar una tipografía genérica para simular el logo.

No escribir simplemente CUEVA con Arial, Inter o una fuente convencional y darlo por terminado.

Analizar la imagen proporcionada.

Preparar una reproducción vectorial fiel mediante SVG o utilizar el recurso original adecuadamente recortado cuando no sea posible reproducirlo con precisión.

Conservar:

- Formas de las letras.
- Cortes diagonales.
- Proporciones.
- Espaciado.
- Grosor.
- Geometría.

La reconstrucción debe compararse visualmente con la referencia original.

No modificar el lettering sin autorización.

## COLORES INICIALES

Paleta visual base:

- Negro.
- Blanco.
- Grafito.
- Grises.

Se podrán incorporar colores adicionales únicamente después de confirmar que son compatibles con la identidad oficial.

## TEMAS

La aplicación tendrá:

- Modo oscuro.
- Modo claro.
- Elección del usuario.

## ESTÉTICA

- Deportiva.
- Moderna.
- Minimalista.
- Profesional.
- Navegación sencilla.
- Excelente adaptación móvil.
- Sin diseños genéricos innecesariamente complejos.

---

# 17. EXPERIENCIA RESPONSIVE

## ADMINISTRADORES

Deben poder utilizar la aplicación desde:

- PC.
- Notebook.
- Tablet.
- Celular.

El panel administrativo debe adaptarse correctamente a cada pantalla.

No desarrollar versiones separadas sin necesidad.

## ALUMNOS

Experiencia prioritariamente móvil.

- Botones cómodos.
- Navegación clara.
- Textos legibles.
- Acceso rápido a rutinas.
- Consultas sencillas de pagos.
- Visualización de videos.

---

# 18. FUNCIONES APROBADAS PARA ETAPAS POSTERIORES

Durante las primeras rondas se evaluaron funcionalidades más amplias.

Estas decisiones deben conservarse como backlog, pero NO bloquear el MVP.

## ASISTENCIA

Se había definido:

- Registro manual.
- Registro mediante QR.
- QR dinámico que cambia periódicamente.
- El alumno escanea el QR mostrado dentro del gimnasio.

Todavía no está confirmado qué dispositivo tendrán para mostrarlo.

Puede utilizarse una pantalla, tablet o dispositivo dedicado.

No implementar QR en V1.

## PROGRESO AVANZADO

Se contemplaron:

- Evolución de pesos.
- Repeticiones.
- Récords personales.
- Estadísticas.
- Gráficos.
- Constancia.
- Asistencia.

Para V1 solo es necesario guardar correctamente los resultados de ejercicios estructurados.

Los gráficos y métricas avanzadas quedan posteriores.

## NOTIFICACIONES

Inicialmente se decidió incorporar:

- Notificaciones internas.
- Notificaciones push.
- Avisos automáticos.
- Mensajes manuales de Nico.

Después se priorizó específicamente el email recordatorio de cuotas.

Por lo tanto:

**Email recordatorio: V1.**

**Sistema completo de notificaciones y push: posterior al MVP.**

## OTRAS FUNCIONES POSTERGADAS

- Cobros online.
- Estadísticas avanzadas.
- Integraciones sociales.
- Aplicaciones nativas en tiendas.
- Automatizaciones no esenciales.
- Funciones avanzadas de entrenamiento.

Registrar estas ideas para V1.1/V2.

---

# 19. TECNOLOGÍAS PROPUESTAS

Arquitectura inicial:

- Next.js.
- React.
- TypeScript estricto.
- Tailwind CSS.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- PWA.
- Service Worker controlado.
- Vercel para hosting y deployments, si se configura correctamente.

Estas tecnologías fueron propuestas, pero el Orchestrator debe verificar su vigencia y compatibilidad antes de implementarlas.

No seleccionar herramientas únicamente porque aparezcan en este documento.

Priorizar una arquitectura sencilla y mantenible.

---

# 20. GITHUB Y SUPABASE

## GITHUB

Repositorio oficial:

https://github.com/MatiasEzequielPereyra/CuevApp

Al realizar una inspección anterior, el repositorio estaba vacío.

Esto es información histórica, NO una garantía del estado actual.

El Orchestrator deberá verificar:

- Rama principal.
- HEAD.
- Archivos.
- PRs.
- Commits.
- Workflows.
- Configuración de despliegues.
- Protecciones de ramas.

No inventar resultados.

## SUPABASE

Proyecto:

`vbkzoojkdkcugxhneyzi`

El proyecto fue creado por el usuario.

Durante una comprobación anterior no se consiguió inspeccionar su contenido debido a un problema de permisos de la conexión.

No asumir que está vacío o configurado.

Verificar acceso antes de realizar operaciones.

## SEGURIDAD

Aplicar:

- RLS.
- Autorizaciones en servidor.
- Control de roles.
- Aislamiento de datos.
- Protección de comprobantes.
- Protección de secretos.
- Integridad transaccional.
- Registro de operaciones financieras.

Nunca exponer claves administrativas en el navegador.

---

# 21. MODELO DE DESARROLLO — ORCHESTRATOR Y CODEX

El usuario decidió trabajar mediante chats especializados.

## CHAT 1 — ORCHESTRATOR CUEVA

Es el coordinador técnico.

Responsabilidades:

- Investigar.
- Diseñar arquitectura.
- Planificar.
- Preparar prompts.
- Recomendar modelos.
- Auditar.
- Solicitar correcciones.
- Aceptar implementaciones.
- Ejecutar merges autorizados.
- Coordinar despliegues.
- Verificar resultados.
- Reevaluar prioridades.
- Continuar el backlog.

No implementa normalmente funcionalidades.

## CHAT 2 — CODEX EXECUTOR

Responsabilidades:

- Implementar código.
- Crear pruebas.
- Ejecutar verificaciones.
- Realizar autoauditoría.
- Preparar PRs.
- Entregar evidencia.
- Devolver handoffs.

No realiza merges ni despliegues de producción por iniciativa propia.

## COMUNICACIÓN

Flujo aprobado:

ORCHESTRATOR  
→ PROMPT DE TAREA  
→ CODEX EXECUTOR  
→ IMPLEMENTACIÓN  
→ TESTS  
→ HANDOFF  
→ ORCHESTRATOR  
→ AUDITORÍA INDEPENDIENTE  
→ CORRECCIONES SI CORRESPONDE  
→ ACEPTACIÓN  
→ MERGE  
→ DEPLOY  
→ VALIDACIÓN  
→ SIGUIENTE TAREA

No asumir que distintos chats pueden comunicarse automáticamente.

El usuario podrá transferir prompts y handoffs cuando resulte necesario.

Mantener el contexto y los checkpoints en archivos versionados siempre que sea posible.

---

# 22. AUTORIZACIÓN DE MERGES Y DESPLIEGUES

El usuario autorizó al ORCHESTRATOR CUEVA a realizar merges y deployments ordinarios cuando se encuentren correctamente verificados.

No necesita solicitar confirmación para cada merge rutinario.

## ANTES DEL MERGE

Verificar:

- Base SHA.
- HEAD SHA.
- Diff.
- CI.
- Tests.
- Build.
- Seguridad.
- Compatibilidad.
- Regresiones.
- Aceptación independiente.

No hacer merges de código defectuoso o sin evidencia suficiente.

## DESPUÉS DEL MERGE

Verificar:

- PR integrado.
- SHA resultante.
- Estado de main.
- Deployment correspondiente.
- URL desplegada.
- Smoke tests.
- Ausencia de errores críticos.

Si existe integración GitHub/Vercel con despliegue automático, no crear deployments duplicados innecesariamente.

## EXCEPCIONES

Consultar al usuario ante:

- Operaciones destructivas.
- Nuevos costos importantes.
- Eliminaciones de datos reales.
- Migraciones de alto riesgo.
- Cambios de alcance.
- Decisiones comerciales.
- Bloqueos críticos de seguridad.

La autorización general no permite eludir controles de seguridad.

---

# 23. SELECCIÓN DE MODELOS

Antes de cada tarea, el Orchestrator debe recomendar el modelo y esfuerzo adecuados.

Como referencia inicial:

- Astra / Alto: arquitectura, autenticación, seguridad y problemas complejos.
- Sol / Medio-Alto: implementación full-stack, componentes y funcionalidades.
- Terra / Bajo-Medio: documentación y mantenimiento sencillo.
- Luna / Bajo-Medio: tareas pequeñas y verificables.

Debe verificar qué modelos están realmente disponibles.

Debe considerar:

- Dificultad.
- Riesgo.
- Contexto.
- Calidad esperada.
- Costos.
- Tiempo.
- Necesidad de auditoría.

No asumir que indicar un modelo dentro de un prompt cambia automáticamente la configuración del chat.

El usuario puede necesitar seleccionar el modelo manualmente.

---

# 24. BACKLOG INICIAL

## CUEVA-001 — FUNDACIÓN

- Repositorio.
- Arquitectura.
- Next.js.
- TypeScript.
- Tailwind.
- Identidad visual.
- Logo oficial.
- Layouts.
- Configuración de desarrollo.

## CUEVA-002 — AUTENTICACIÓN

- DNI/email.
- Identidad única.
- Contraseñas temporales.
- Roles.
- RLS.
- Administración de alumnos.

## CUEVA-003 — CUOTAS

- Cuota mensual general.
- Vencimientos.
- Pagos parciales.
- Movimientos.
- Saldos.
- Historial.

## CUEVA-004 — COMPROBANTES

- Upload seguro.
- Estados.
- Revisión.
- Confirmación administrativa.
- Integridad financiera.

## CUEVA-005 — EMAILS

- Recordatorio previo al vencimiento.
- Programación.
- Idempotencia.
- Logs.
- Gestión de errores.

## CUEVA-006 — RUTINAS

- Editor libre tipo Keep.
- Borradores.
- Publicación.
- Plantillas.
- Ejercicios estructurados.
- Registro de resultados.

## CUEVA-007 — VIDEOS

- Biblioteca.
- Ejercicios.
- Subidas desde celular.
- Reutilización.
- Enlaces de YouTube.

## CUEVA-008 — VALIDACIÓN INTEGRAL

- PWA instalable.
- Consulta offline.
- Seguridad.
- Tests end-to-end.
- Rendimiento.
- Despliegue.
- Validación del MVP.

El Orchestrator puede dividir estos bloques en tareas más pequeñas.

Debe avanzar de una tarea aceptada a la siguiente, respetando dependencias técnicas.

---

# 25. DECISIONES QUE SIGUEN PENDIENTES

No confundir cuestiones todavía abiertas con requisitos aprobados.

Entre ellas:

- Nombre definitivo del socio.
- Dispositivo físico para mostrar el QR futuro.
- Color secundario oficial, si existe.
- Dominio definitivo.
- Proveedor de envío de emails.
- Límites de videos y almacenamiento.
- Configuración final de Vercel.
- Políticas precisas de conservación y eliminación de datos.
- Detalles de determinadas excepciones administrativas.
- Requisitos de publicación y operación definitiva.

El Orchestrator deberá resolver técnicamente lo que pueda y consultar únicamente cuando sea necesaria una decisión del usuario.

No bloquear el desarrollo inicial por decisiones que corresponden a módulos posteriores.

---

# 26. CRITERIOS DE ÉXITO DEL MVP

CUEVA V1 estará terminada cuando:

1. Nico y su socio puedan administrar alumnos.
2. Los alumnos puedan ingresar usando DNI o email asociados a la misma cuenta.
3. Las contraseñas temporales funcionen correctamente.
4. Los roles y permisos sean seguros.
5. Nico pueda registrar cuotas y pagos.
6. Se admitan pagos parciales.
7. Los saldos sean correctos.
8. Los comprobantes puedan cargarse.
9. Solo los administradores puedan confirmar pagos.
10. Los emails de vencimiento funcionen automáticamente.
11. Nico pueda escribir rutinas fácilmente.
12. Los borradores y la publicación funcionen.
13. Las plantillas sean reutilizables.
14. Los ejercicios estructurados permitan registrar resultados.
15. Nico pueda subir y reutilizar videos.
16. Los alumnos puedan consultar su información.
17. La PWA pueda instalarse.
18. Las rutinas descargadas puedan consultarse sin conexión.
19. El diseño respete el logo original.
20. Las pruebas funcionales y de seguridad estén aprobadas.
21. El código esté integrado correctamente.
22. La aplicación esté desplegada.
23. La versión desplegada haya superado verificaciones reales.
24. No existan bloqueos críticos de seguridad o integridad.

No declarar MVP COMPLETED por tener pantallas visualmente atractivas.

El sistema debe funcionar realmente.

---

# 27. FILOSOFÍA DEL PROYECTO

CUEVA debe ser:

- Sencilla para Nico.
- Sencilla para el socio.
- Sencilla para los alumnos.
- Segura.
- Rápida.
- Mantenible.
- Económica de operar.
- Extensible sin sobreingeniería.
- Visualmente fiel a la marca.
- Útil desde su primera versión.

El éxito se medirá por la capacidad de Nico de administrar su gimnasio con menos trabajo.

No por la cantidad de funcionalidades implementadas.

**La prioridad absoluta del MVP es resolver pagos, recordatorios y rutinas con una experiencia de uso excelente.**

---

# 28. INSTRUCCIÓN FINAL PARA ORCHESTRATOR CUEVA

Incorporá este documento como contexto funcional permanente del proyecto.

Contrastá su contenido con el estado real de GitHub y Supabase.

Si el repositorio todavía no contiene documentación funcional, prepará una tarea para que CODEX EXECUTOR incorpore una versión mantenible y versionada de este contexto, por ejemplo en `docs/product/`.

No asumas que el contenido de una conversación está automáticamente disponible en otros chats.

Mantené checkpoints claros para evitar pérdidas de contexto.

En cada tarea:

1. Verificá el estado actual.
2. Consultá decisiones relevantes.
3. Seleccioná modelo y razonamiento.
4. Delegá mediante prompt autocontenido.
5. Recibí el handoff.
6. Auditá independientemente.
7. Solicitá correcciones o aceptá.
8. Realizá merge si supera las verificaciones.
9. Desplegá según los controles acordados.
10. Verificá el deployment.
11. Prepará la siguiente tarea.

No repitas preguntas ya contestadas.

No amplíes el MVP sin autorización.

No aceptes implementaciones sin evidencia.

No anuncies éxito sin comprobarlo.

**OBJETIVO FINAL: ENTREGAR CUEVA V1.0 FUNCIONAL, SEGURA, DESPLEGADA, PROBADA Y LISTA PARA QUE NICO LA UTILICE EN SU GIMNASIO.**

FIN DEL DOCUMENTO MAESTRO DE CONTEXTO.
