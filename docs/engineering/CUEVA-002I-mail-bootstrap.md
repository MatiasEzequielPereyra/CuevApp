# CUEVA-002I: paquete de correo y primer administrador — PROPUESTA

**No aplicado ni validado en Supabase alojado.** Las plantillas, allowlist,
correo y bootstrap requieren revisión, autorización aplicable y prueba real.
El acceso debe permanecer apagado mientras se preparan y comprueban. La cuenta
inicial prevista es Nico, con el correo registrado fuera del repositorio; nunca
conservar contraseñas o claves en el repositorio, correo de prueba, logs o chat.

## Origen y redirección

El candidato usa `CUEVA_PRODUCT_ORIGIN=https://cueva-gym.vercel.app` (sin barra
final) y construye `https://cueva-gym.vercel.app/aceptar-invitacion` con query
`nonce`, `generation` y `type`. Configurar ese origen como Site URL. Candidata
para Redirect URLs: `https://cueva-gym.vercel.app/aceptar-invitacion*`. Su
coincidencia efectiva con la query generada y su alcance deben verificarse en
el proveedor antes de usarlo; Supabase trata `?` como comodín y recomienda usar
rutas exactas en producción. No agregar wildcard de dominio. Una caída a Site
URL eliminaría el nonce y debe considerarse fallo, no una verificación exitosa.

## Plantillas candidatas

El código necesita que el usuario llegue a la aplicación con `token_hash` junto
con la query completa de `.RedirectTo`. En las plantillas **Invite user** y
**Reset password**, respectivamente, la propuesta exacta es:

```html
<h2>Te invitamos a CUEVA</h2>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Aceptar invitación</a></p>
```

```html
<h2>Recuperá tu acceso a CUEVA</h2>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Elegir contraseña</a></p>
```

Son propuestas **NOT_VERIFIED**: debe verificarse el HTML realmente renderizado,
el escape de `&`, la allowlist con query y el uso correcto de `type=invite` o
`type=recovery`, con cuentas sintéticas y correo controlado. Si se pierden o
modifican parámetros, mantener deshabilitado. Evitar previsualizaciones o logs
de enlaces completos, pues incluyen capacidades de acceso. El correo de Mailpit
se tradujo en el laboratorio y no demuestra estas plantillas.

## Bootstrap revisable, no ejecutado

No hay un bootstrap de administrador listo para producción ni se implementa un
atajo de superusuario en la aplicación. Propuesta para un procedimiento operativo
controlado después de auditar y aplicar la migración por separado:

1. Personal confiable verifica identidad y control del correo de Nico por un canal
   apropiado y confirma que no existe un administrador anterior o cuenta duplicada.
2. Un operador de servicio confiable genera una capacidad aleatoria de 32 bytes,
   conserva únicamente su SHA-256 en el estado privado mediante el RPC de invitación
   y envía una invitación con el redirect completo. El orden actual de envío y
   preparación depende del preflight 409 y debe probarse antes de usarlo.
3. Nico acepta en el sitio y establece su propia contraseña. Comprobar mediante
   sesión y perfil que la incorporación quedó activa; no pedir ni registrar clave.
4. En una operación administrativa separada y auditada, el operador autoriza el
   cambio del perfil exacto de ese UUID de `alumno` a `admin`, verificando después
   que no cambió ninguna otra fila. El SQL y los permisos mínimos de esta promoción
   aún necesitan revisión y un procedimiento operativo probado.
5. Verificar con la cuenta real únicamente las funciones autorizadas y conservar
   evidencia sin tokens ni correo sensible; no repetir cambios ante resultado
   ambiguo. Una operación huérfana requiere reconciliación confiable, nunca timeout.

Fuentes: [plantillas de Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
y [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).
