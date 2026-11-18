export function PasswordChangeForm() {
  return <form className="access-fields" method="post" action="/api/acceso/cambiar-contrasena">
    <label htmlFor="current-password">Contraseña actual</label>
    <input id="current-password" type="password" name="current_password" autoComplete="current-password" maxLength={1024} required />
    <label htmlFor="new-password">Nueva contraseña</label>
    <input id="new-password" type="password" name="new_password" autoComplete="new-password" minLength={8} maxLength={1024} required />
    <label htmlFor="confirm-password">Confirmar nueva contraseña</label>
    <input id="confirm-password" type="password" name="confirm_password" autoComplete="new-password" minLength={8} maxLength={1024} required />
    <p>Usá al menos 8 caracteres. Tu contraseña no se muestra ni se guarda en texto plano.</p>
    <button type="submit">Actualizar contraseña</button>
  </form>;
}
