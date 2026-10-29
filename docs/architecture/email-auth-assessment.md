# CUEVA-002C: evaluación de acceso por correo

Estado: **BLOCKED para autenticación real**. La interfaz es una vista previa
estática con campos deshabilitados; no recoge ni envía credenciales. Se evaluó
documentación oficial el 2026-10-29; no se accedió al proyecto Supabase alojado.

## Alternativa y límites

- [Supabase Auth admite email y contraseña](https://supabase.com/docs/guides/auth/passwords).
  Con correo obligatorio deja de ser necesario el IdP adicional investigado para
  DNI sin correo. Esto no demuestra por sí solo el cierre de altas ni E3.
- [Invitar por email](https://supabase.com/docs/guides/auth/users) es una opción
  para que el administrador inicie el alta y el alumno establezca su contraseña.
  La operación requiere servidor confiable y clave secreta, nunca navegador. Es
  una candidata funcional distinta de entregar contraseña temporal: no se considera
  aprobada ni equivalente al requisito de cambio obligatorio sin decisión y prueba.
- La [recuperación por correo](https://supabase.com/docs/guides/auth/passwords)
  devuelve respuesta no reveladora de existencia de cuenta; probar el circuito
  completo y el manejo de errores antes de habilitarlo. Los redirects deben estar
  permitidos y vinculados al origen legítimo. El servicio de correo predeterminado
  es limitado y de prueba; envío operativo requiere configuración y prueba reales.
- [SSR con `@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
  gestiona cookies; verificar sesión en servidor y aplicar autorización y RLS por
  recurso. Ni `user_metadata` editable ni un botón o una ruta visual constituyen
  control de permisos. JWT existentes pueden sobrevivir cambios o eliminación;
  evaluar revocación y caducidad con sesiones reales.
- Configurar altas cerradas únicamente como parte de una integración autorizada y
  verificar contra el proveedor real que un usuario desconocido no pueda crear
  cuenta, incluyendo rutas alternativas; ocultar un formulario no alcanza.

## Resultados y puertas pendientes

| Control | Estado | Evidencia requerida antes de habilitar |
| --- | --- | --- |
| Vista previa de ingreso | LOCAL | Campos y botón deshabilitados; sin envío ni sesión. |
| Alta solo administrativa | NOT_VERIFIED | Configuración del proveedor y pruebas negativas reales. |
| Cambio obligatorio y primer acceso | BLOCKED | Diseñar y probar control confiable en servidor y datos; acordar si invitación reemplaza contraseña temporal. |
| Acceso a datos sin sesión | NOT_RUN | Pruebas reales de RLS y autorización por recurso. |
| Recuperación sin enumeración | NOT_RUN | Prueba del flujo real y error de la interfaz. |
| Revocación y cambio de permisos | NOT_RUN | Pruebas de sesiones, expiración y protección de datos. |
| Correo operativo | NOT_RUN | Proveedor, configuración, entrega y recuperación probados. |

No se crearon usuarios, tablas, políticas, servicios ni configuraciones remotas;
no se agregaron paquetes de Supabase ni secretos. E3 de la investigación de
Keycloak permanece BLOCKED como conclusión histórica, no como prueba del diseño
nativo. D007 sigue PROPOSED. La cuenta de administración inicial se tratará en
una tarea específica, sin credenciales en código ni registros.

Fuentes adicionales: [administración de usuarios](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[sesiones](https://supabase.com/docs/guides/auth/sessions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y
[changelog](https://supabase.com/changelog); se revisaron cambios relevantes a
Auth y compatibilidad Node 22, sin asumir configuración efectiva del proyecto.
