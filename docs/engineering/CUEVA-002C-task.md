# CUEVA-002C — Acceso por correo y contraseña

El usuario decidió el 2026-10-29 que el correo es obligatorio para todos y que
el DNI no se usa para iniciar sesión. Esta decisión prevalece sobre los requisitos
anteriores de identidad sin correo. El DNI como dato de ficha no está decidido.
El alta sigue exclusivamente en manos de administradores; preservar permisos
del socio y la exigencia de primer acceso seguro y cambio obligatorio.

## Encargo

Implementar un incremento acotado de acceso con Supabase Auth nativo, empezando
por evaluar y documentar cómo satisfacer primer acceso, altas cerradas, recuperación
y revocación. Usar documentación vigente y biblioteca oficial SSR adecuada para
Next.js; leer las guías instaladas de Next.js antes de escribir código. Una
invitación por correo es candidata, pero no sustituye el requisito de cambio
obligatorio sin pruebas y decisión de producto cuando corresponda.

Crear interfaz de acceso por correo y contraseña con estados claros, teclado y
responsive. Conectar solo cuando pueda comprobarse el comportamiento real; no
presentar autenticación simulada como funcional. Credenciales secretas solo en
servidor, nunca en cliente ni en el repositorio. No crear usuarios reales ni
configurar cuentas, migraciones, servicios de email o Supabase alojado durante
el desarrollo local sin el alcance operativo apropiado y pruebas verificables.
No inferir que el correo por defecto del proveedor alcanza para uso real.

Comprobar explícitamente que el autorregistro esté cerrado en el proveedor, que
un usuario sin sesión no acceda a datos, que recuperación no enumere cuentas y
que cualquier restricción de primer acceso se imponga del lado servidor y en los
datos, no solo en la interfaz. Si alguna garantía no se puede demostrar, dejarla
BLOCKED y evitar declarar lista la autenticación. Ninguna clave compartida en el
chat es fixture; no almacenar ni mostrar contraseñas reales.

Crear rama y checkout aislados desde main actualizado, preservar fuentes e
historial. Entregar pruebas y evidencia de límites, commit local y handoff REVIEW
al Orchestrator; sin push, PR ni deploy por el ejecutor. La auditoría posterior
decidirá integración. No tocar Keycloak ni recursos de otros proyectos.
