# CUEVA-UX-STUDENT-PROFILE-ACTIONS-002 — Perfil y navegación del alumno

**Estado:** implementación aislada; sin merge ni despliegue autorizado.
**Rama:** `feature/cueva-student-profile-actions-nav`.
**BASE_SHA:** `52d67dd90f6ecee880ca2bf72ffda4836546e2ad`.

## Alcance solicitado (19/11/2026)

1. Marcar **Cerrar sesión** en rojo al pasar el puntero, también en foco de teclado, dentro del menú desplegable superior del alumno; mantener `POST /api/acceso/salir`.
2. Mostrar el **logo de CUEVA grande como Inicio, exactamente centrado en la navegación inferior del alumno**, análogo al símbolo central del administrador. Conservar las cuatro rutas existentes: Inicio, Rutina, Cuotas y Avisos. No volver a duplicar Perfil fuera del menú de persona.
3. En **Mi perfil** dar a **Enviar verificación** y **Actualizar contraseña** estados deshabilitado/habilitado claramente contrastados y feedback de hover/foco. Recién habilitar correo cuando el formato sea válido y diferente del actual; contraseña cuando están completos los tres campos, la nueva tiene 8 o más caracteres, coincide con la confirmación y difiere de la contraseña actual.

## Exclusiones y reglas

- No cambiar endpoints, cookies, permisos, condiciones de Auth, SQL, migraciones ni facturación.
- La validación de interfaz es ayuda visual: el servidor continúa como autoridad.
- Mantener el componente compartido de contraseña sin cambios de comportamiento administrativo salvo optar explícitamente por la habilitación reactiva desde la pantalla del alumno.
- Evitar persistir contraseñas en estado React o almacenamiento local: solo almacenar el booleano de habilitación.
- CSS restringido al portal del alumno; compatibilidad claro/oscuro/sistema, 320px+; controles accesibles y zonas táctiles de 44px como mínimo.
- No sustituir `docs/product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md` ni otras fuentes protegidas.

## Aceptación

- Salir: botón rojo con mouse/teclado, envía POST, no cambia acceso de administrador.
- Inicio: logo real y visible centrado en la barra inferior a 320/390/680px, más grande que otros íconos, un solo acceso a Inicio.
- Formulario: botones inactivos al cargar, activan con valores válidos, vuelven a inactivarse al invalidarse y conservan la validación nativa y protección del servidor.
- PR con CI Verify, pruebas de navegador del shell y migraciones sin fallos sobre el HEAD exacto; no declarar producción lista sin integración y deploy verificados.

SKILLS_SELECTED: `cueva-feature-development`, `cueva-supabase-security` (auditoría sin cambios backend).
SKILLS_APPLIED: revisión del `main` / PR existentes, componentes de cuenta, contratos de formularios, límites de seguridad, rama aislada y fixtures relevantes.
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`, `.agents/skills/cueva-supabase-security/SKILL.md`, `AGENTS.md`.
