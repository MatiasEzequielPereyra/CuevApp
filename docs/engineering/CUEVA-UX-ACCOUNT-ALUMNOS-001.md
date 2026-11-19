# CUEVA-UX-ACCOUNT-ALUMNOS-001 — Cuenta e invitaciones en sus secciones

Base verificada: `0d0e83fe402b76ca2fd0ba1165c2debfab1bab95`.

## Alcance
- Inicio `/cuenta`: solo acceso a las siete funciones del gimnasio y saludo.
  La información personal y el formulario de contraseña ya no aparecen allí.
- Menú de usuario, lateral y móvil: `/mi-cuenta` para el administrador.
  Incluye correo, rol, cambio de contraseña y cierre de sesión.
  El alumno conserva `/mi-perfil`, sin acceso al perfil del administrador.
- Alta de alumno: se conserva la invitación marcada por defecto y el guardado
  previo de la ficha, con mensajes de estado y reintento seguro.
- Ficha existente: consultar invitación y reintentar cuando corresponde.
  Si existe la identidad Auth asociada y el estado es enviada, se muestra
  la acción de recuperación en un panel cerrado inicialmente.
- El formulario de recuperación remite el correo de la ficha al endpoint
  existente, que valida sesión admin, vínculo de usuario y rol y envía
  exclusivamente al correo registrado en Auth. Al finalizar vuelve a la ficha.
  El servidor conserva el bloqueo/reconciliación ante envío ambiguo o fallido.
- No hay nuevas tablas, migraciones, SMTP, permisos, credenciales ni envíos
  de correo al abrir pantallas. No se cambia lógica financiera o de rutinas.

## Verificación
Probar roles, enlaces de navegación, móvil/escritorio, teclado y WCAG;
alta con invitación seleccionada, estados sent/failed/review/processing,
email vinculado, recuperación autorizada y alumno rechazado, correos fallidos,
contraseña propia y destino del redirect. Ejecutar CI sobre HEAD exacto.

SKILLS_SELECTED / SKILLS_APPLIED: cueva-feature-development,
cueva-supabase-security, cueva-acceptance-audit.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md`.
