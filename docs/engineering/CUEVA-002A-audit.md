# CUEVA-002A — Auditoría independiente

Fecha: 2026-10-29. ORCHESTRATOR CUEVA.

## Dictamen

**ACCEPTED como investigación documental. D007 permanece PROPOSED.**
No se acepta factibilidad operativa ni se autoriza instalar un IdP permanente,
configurar proveedores remotos, migrar datos o implementar login de producto.
E1–E6 siguen sin prueba integrada; E3 está explícitamente bloqueado.

- BASE_SHA: 2423b14a4835b08ec8d3e487b03d606ef36f1f5e.
- HEAD entregado: b7b98e3cf79089c6fcbc1edf69e4811f6194f027.
- Diseño comprobado por ejecutor: 87ac5a1eedb38f2cca452e723b8bee7523f9d538.
- Siete archivos documentales; merge-base igual a BASE_SHA; árbol del ejecutor limpio.
- origin/main coincide con BASE_SHA en el precheck de auditoría.
- No cambios de runtime, dependencias, configuración, pruebas ni fuentes originales.

## Standards

Revisión principal: 0 hallazgos bloqueantes. Procedencia, versiones fijadas,
invariantes, separación de evidencia y tratamiento de secretos adecuados al encargo.
El registro diferencia propuesta, capacidad documentada y prueba operativa.
El reporte cita diff de base a HEAD, mientras el JSON conserva `git diff --check`
sin rango sobre árbol limpio: ese JSON por sí solo no acredita el delta. La auditoría
independiente ejecutó el rango explícito completo y obtuvo PASS, cerrando ese límite.

## Spec

Revisión principal: 0 incumplimientos bloqueantes del alcance documental. Conserva
DNI-only, email-only o ambos, identidad estable, alta administrativa, contraseña
individual, cambio obligatorio y recuperación. Incluye amenazas, diagramas y 24
pruebas futuras, todas correctamente NOT_RUN. El encargo admite entregar un bloqueo
preciso cuando no pueda demostrarse una vía segura; no exige inventar su solución.

Se intentaron las dos revisiones delegadas requeridas por la guía code-review;
ambas terminaron por límite de uso de plataforma. Ninguna se cuenta como completada.
El Orchestrator realizó ambos ejes por separado sobre la entrega del ejecutor.

## Contraste independiente de fuentes

Se verificaron el 2026-10-29 la guía pública de
[Custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers),
[signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
y la [administración de Keycloak](https://www.keycloak.org/docs/latest/server_admin/index.html).
La guía documenta email opcional para proveedores externos; el grant nativo sigue
orientado a email/teléfono. Contraseña temporal documentada no demuestra toda la
composición CUEVA. No hay una prueba del proyecto alojado en estas páginas.

También se contrastaron external.go de Supabase Auth en
4eee58f296d9698a1c2c0ae14d7a0b379c7622d3 y UpdatePassword/UserResource/
ModelToRepresentation de Keycloak en 24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b,
enlazados en las [fuentes del ejecutor](../architecture/identity-research-sources.md).
El callback contempla email opcional y signup deshabilitado impide creación JIT.
Keycloak emite eventos de cambio; su existencia no demuestra entrega/correlación
con una operación y sesión CUEVA. La ausencia de acción pendiente no es evidencia
suficiente por sí sola. El bloqueo E3 se conserva.

## Verificación independiente

Sobre HEAD entregado: documentos 2/2 PASS; fuentes 4/4 PASS; revisión de patrones
80 archivos sin hallazgos; `git diff --check 2423b14 b7b98e3` PASS. Se inspeccionaron
el diff completo y la evidencia JSON. No se repitió build/navegador local por prosa.
El CI remoto deberá aprobar el HEAD que incluya esta aceptación antes del merge.
La integración Git ya activa generará despliegue automático de la misma aplicación;
se verificará su SHA y HTTP, sin tratarlo como implementación de autenticación.

## Continuidad

Antes de contratar u operar otro servicio, se prepara
[CUEVA-002B-LOCAL](CUEVA-002B-LOCAL-task.md): prueba desechable del cambio temporal
en Keycloak local, sin federación con Supabase alojado ni datos reales. No es la
prueba integrada CUEVA-002B propuesta por el ejecutor y no satisface E1–E6 completos.
D007 no cambia de estado. Proveedor permanente, operación, presupuesto, entrega y
recuperación real siguen pendientes antes de la prueba integrada y del producto.

La designación posterior de Nico como administrador inicial queda preservada en
la nota privada solicitada por el usuario. No se publica su credencial, no se crea
la cuenta y no se convierte la coincidencia de correo en autorización de rol.
