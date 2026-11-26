# Recuperación autónoma — CUEVA-AUTH-RECOVERY-001

Base: `ec33fa7a629db49f7a1b614e99e92f44d70122ff`. Una rama/PR, sin migraciones.

Desde Ingresar se solicita un enlace mediante `resetPasswordForEmail`, con clave
pública y destino fijo. La respuesta es idéntica para cuenta desconocida, límites
de envío y rechazo SMTP: no confirma entrega. No modifica el gate al solicitar;
un fallo de envío no bloquea la contraseña ni la sesión existente. No hay reenvío
automático; el formulario evita duplicados durante la solicitud y tras aceptarla.

El enlace nuevo lleva el hash en el fragmento, nunca en una consulta HTTP. La
pantalla lo retira del historial y conserva solo en memoria. Al enviar ambas
contraseñas, el servidor verifica `type: recovery`, identidad con Auth y perfil
propio mediante RLS; actualiza con `updateUser` del mismo usuario. No publica
cookies de recuperación ni escribe roles/gates. Cuenta pendiente/bloqueada sigue
pendiente: este flujo no sustituye la aceptación de su invitación. Después del
éxito se confirma y vuelve al ingreso. Una actualización rechazada/ambigua consume
potencialmente el enlace: ingresar con la contraseña elegida o solicitar otro;
no se promete éxito ni se reintenta automáticamente.

## Configuración manual antes de aceptar en producción

1. Conservar SMTP existente. En Supabase Auth, Site URL debe ser exactamente
   `https://cueva-gym.vercel.app` (sin barra final), igual a `CUEVA_PRODUCT_ORIGIN`.
2. Agregar a Redirect URLs la URL exacta
   `https://cueva-gym.vercel.app/recuperar-contrasena`; conservar las URL actuales
   de invitaciones y recuperación administrativa. Sin comodines ni previews.
3. Después de publicar el código aprobado, instalar el contenido completo de
   `supabase/templates/recovery.html` en **Reset Password**. Su rama nueva usa
   `.RedirectTo == .SiteURL + "/recuperar-contrasena"` y fragmento; la rama
   administrativa conserva su enlace actual con nonce/generación.
4. Comprobar privadamente un correo autorizado: recepción real, hash solo en el
   fragmento, nueva contraseña y login. Plantilla/URL incorrectas son un bloqueo
   operativo, no motivo para abrir destinos externos o modificar permisos.

No se cambiaron estas configuraciones ni se enviaron correos reales. La entrega
al buzón y aceptación alojada quedan **NOT_VERIFIED** hasta esa operación separada.

## Verificación acotada

Pruebas reutilizadas: `test:account-password-change` incluye la ruta nueva y
conserva roles/cambio/recuperación administrativa. Tres casos del componente real
en `access-form.spec.ts` cubren teclado, foco, duplicados, móvil/claro y
escritorio/oscuro, coincidencia, retorno e invalidez/error. Sin capturas nuevas.
El CI existente ejecuta una prueba adicional en su stack fresh: Auth/PostgREST
reales, token generado localmente, nueva contraseña/login y replay; perfiles,
estados de invitación y gates sintéticos preconfigurados. No certifica envío ni
repite los recorridos completos de alta/invitación. Resultados/SHA exactos en PR.

Fuentes: [recuperación oficial](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[plantillas](https://supabase.com/docs/guides/auth/auth-email-templates).
SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `supabase:supabase`, `vercel:react-best-practices`, `pr`.
SKILL_SOURCES: `.agents/skills/` y guías del host. Sin cambios en RLS, roles,
registro, finanzas, rutinas o configuración alojada.
