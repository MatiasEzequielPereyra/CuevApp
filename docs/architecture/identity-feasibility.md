# CUEVA-002A — Viabilidad y diseño de identidad DNI/email

Estado de la propuesta D007: **PROPOSED**. Investigación: 2026-10-28 y
2026-10-29, America/Buenos_Aires. Entrega documental, sin Auth implementada.

## 1. Base, contrato y dictamen

BASE_SHA inicial: `535ff7fade52aa1380f1769dbbd76afcb7b798fa`, main remoto
obtenido y comparado con el checkout limpio antes de crear
`codex/cueva-002a-identity-design`. La fundación aceptada es
`064cbfaadc3c68145adb2411989584bbc32782c5`; hasta esa base inicial había seis
archivos documentales de continuidad. Durante el trabajo origin/main avanzó a
`2423b14a4835b08ec8d3e487b03d606ef36f1f5e`, con cuatro archivos documentales de
despliegue/configuración pública. Se comunicó el cambio y se rebasó la propuesta:
**BASE_SHA final de ejecución: `2423b14a4835b08ec8d3e487b03d606ef36f1f5e`.**
Se conserva CUEVA-001A DEPLOYED según el registro del Orchestrator; esa evidencia
no cubre identidad ni fue repetida por este ejecutor.

Rigen el [maestro](../product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md), especialmente
§5–7 y §10, y el [encargo](../engineering/CUEVA-002A-task.md). Alta administrativa
con DNI, email o ambos; sin email ni teléfono obligatorios; misma identidad y
contraseña; clave temporal individual y cambio obligatorio; recuperación por
administradores; Nico configura permisos del socio. Nada de esto se relaja.

**Dictamen: VÍA DOCUMENTADA CONDICIONAL; FACTIBILIDAD OPERATIVA NO DEMOSTRADA.**
Supabase no documenta un grant nativo DNI+contraseña. Sí documenta federación
Custom OIDC con `email_optional: true`. Se propone evaluar un IdP maduro que
verifique username/email y contraseña (Keycloak como candidato), conservando una
sesión nativa Supabase después de OAuth. Ver [fuentes S01–S08](identity-research-sources.md).
Una tabla de perfiles, un alias o un broker de identificadores no bastan.

| Clase de evidencia | Resultado de esta entrega |
| --- | --- |
| Capacidad pública documentada | Contraseña email/teléfono nativa; OIDC con email opcional; IdP candidato con contraseña temporal. |
| Corroboración estática | Código público fijado de Supabase Auth y Keycloak, sin ejecución. |
| Composición propuesta | Diseño descrito aquí; no demuestra comportamiento integrado. |
| Prueba local de Auth / prueba pura desechable | NOT_RUN; no aporta instalar un sustituto o simular sesiones. |
| Supabase `vbkzoojkdkcugxhneyzi` para esta evaluación | NOT_VERIFIED; sin nuevas tentativas ni inferencias de viabilidad. El antecedente de dashboard/API pública del Orchestrator no prueba el mecanismo Auth/RLS. |
| IdP, sesiones genuinas, SSR y RLS | NOT_RUN. No existe proveedor aprobado ni entorno de integración verificado. |

Si E1–E6 de §8 no pueden demostrarse, no aprobar D007 ni implementar login de
producto. La entrega de este diseño puede pasar a REVIEW con esos límites.
En particular, **E3 está bloqueado técnicamente**: aún no se seleccionó/demostró
una prueba confiable del cambio por el alumno ligada a la operación y sesión.
Permitir continuar con solo una bandera administrativa relajaría el contrato.

| Requisito del encargo | Trazabilidad | Estado de evidencia |
| --- | --- | --- |
| Alta administrativa DNI/email o ambos, sin correo obligatorio | §2–3; T01/T02/T05/T06; E1/E2/E4 | Diseño condicional; integrado NOT_RUN. |
| Una contraseña, temporal individual y cambio previo a operar | §2–3; T03/T04; E3 | Bloqueo de corroboración explícito; no PASS. |
| Recuperación sin correo y revocación | §3/§5; T15/T16/T17/T23; E5/E6 | Canal humano y coordinación pendientes. |
| Permisos Nico/socio y propiedad del alumno | §4–6; T07/T08/T09/T10; E5 | Matriz propuesta; denegaciones reales NOT_RUN. |
| Identidad e historial estables, colisiones/carreras | §2/§4; T11–T14/T22; E2/E4 | Invariantes propuestos; sin cambio de datos. |
| Distinguir correo de acceso, verificación y recordatorios | §3; T24; CUEVA-005 | Sin envío ni habilitación implementados. |
| Una siguiente implementación acotada | §8, CUEVA-002B | Propuesta condicionada; no autorizada. |

## 2. Opciones y recomendación

| Opción | Contraseña y sesión | Contrato / decisión |
| --- | --- | --- |
| Supabase nativo + resolver DNI→email privado | Supabase verifica contraseña y emite sesión. | Útil solo si existe un email real; no cubre DNI-only. DESCARTADA como solución completa. |
| Email inventado, teléfono obligatorio, anónimo convertido o cuenta compartida | Cambia identidad o depende de otro identificador. | No satisface el contrato; DESCARTADA. El estado anónimo no acredita contraseña ni persona. |
| Perfiles/metadata + `admin.createUser` o generateLink | Administración de usuarios/enlaces, no verificación de la contraseña de DNI. | No resuelve el grant ni DNI-only; no usar claves privilegiadas para fabricar login. |
| Password Verification Hook | Interviene en un grant que ya resolvió un usuario nativo. | No incorpora por sí mismo un identificador ni un almacén externo de contraseñas. |
| **IdP maduro + Custom OIDC email opcional** | IdP almacena/verifica la contraseña; Supabase valida OIDC y emite access/refresh propios. | **RECOMENDADA PARA PRUEBA**, no aceptada. Conserva UUID de Auth y un solo verificador de contraseña. |
| IdP + Third-party Custom OIDC directo | IdP emite JWT aceptado por las APIs de datos. | Alternativa documentada, pero no crea la misma sesión Auth. Exige adaptar identidad `(iss, sub)`, renovación y RLS; no es un fallback intercambiable. |
| Verificar hashes, firmar JWT propios o modificar Auth para admitir DNI | La aplicación se vuelve sistema de autenticación. | Fuera de alcance y no recomendado; no diseñar criptografía ni almacenar contraseñas propias. |

La recomendación evita dos almacenes de contraseñas y una migración posterior de
alumnos sin correo. Su costo es operar y asegurar otro servicio y coordinar dos
dominios de sesiones. Un IdP alojado por un tercero es alternativa de operación,
no un servicio aprobado. No se declara costo cero, cotización ni plan disponible.

### Recorrido real de la credencial

El campo **DNI o correo electrónico** y la contraseña se presentan en la página
de login del IdP, traducida y configurada para CUEVA. La aplicación redirige a ese
formulario mediante Supabase. La contraseña definitiva nunca se envía al código
de CUEVA ni a una tabla propia. El IdP aplica su verificador y políticas maduras.
El alta/reset administrativo puede manejar una clave temporal solo de forma
transitoria para entregarla por un procedimiento aprobado; no se conserva en logs,
metadata, historial ni respuestas posteriores. No hay una contraseña fija común.

En DNI-only se propone username canónico DNI en el IdP; email-only usa username
interno opaco y login por email; con ambos se usa DNI y el mismo email verificado
como alternativa de acceso. Ese username interno **no es un email ficticio** y
no convierte el grant de Supabase en username/password. No se promete soporte a
varios DNI por persona. Cambiar username conserva el subject del mismo usuario
del IdP; eso debe comprobarse, no asumirse por semejanza de nombres.

### Modelo conceptual propuesto (sin tablas creadas)

| Concepto | Responsabilidad e invariantes |
| --- | --- |
| Persona CUEVA | UUID interno estable, creado administrativamente; todos los historiales referencian esta persona. Nunca DNI/email como PK o FK. |
| Vínculo IdP | `(issuer exacto, subject opaco)` único e inmutable asociado a persona. El realm/issuer y el client están fijados por configuración, nunca por una URL del usuario. |
| Vínculo Supabase | UUID de `auth.users` obtenido por federación y asignado una sola vez a la persona esperada. Dos UUID/subjects inesperados provocan bloqueo, no fusión. |
| Identificadores privados | DNI y email canónicos reservados con unicidad; el IdP es la autoridad del login. El registro CUEVA coordina operaciones y permisos, no verifica contraseñas. |
| Estado de acceso | Aprovisionando, entrega pendiente, cambio requerido, activo, reset requerido, revocado o error pendiente de conciliación. Versión de acceso creciente. |
| Sesión autorizada | Session ID de Supabase ligado en servidor a persona y versión de acceso; existencia de JWT no la autoriza por sí sola. |
| Permisos | Capacidades actuales administradas por Nico; registros protegidos, no metadata editable por alumnos. |

No mover ni recrear historiales al agregar email o corregir DNI. La recuperación
es sobre la misma persona/subject, no sobre una nueva cuenta con datos copiados.

### Evitar altas y asociaciones accidentales

Realm dedicado, sin autorregistro, sin federación entrante de otros usuarios ni
clients que permitan crear cuentas por caminos alternativos. Nico/socio usan
capacidades de CUEVA, no una consola IdP con privilegios irrestrictos.
Se reserva una persona y un vínculo de aprovisionamiento antes de habilitar login.

El primer OAuth puede crear técnicamente la fila Auth de una cuenta ya dada de
alta por un administrador. `DisableSignup` global impediría esa creación, y
`admin.createUser` sin email/teléfono no es alternativa. Por eso no se propone
activar ese flag a ciegas. E1 debe demostrar que solo el realm administrado puede
producir identidades y que los grants/proveedores anónimos, nativos o no previstos
no permiten autorregistro ni acceso. Si se necesita Before User Created Hook,
verificar plan, payload y procedencia del subject antes de elegirlo: no leer una
fila `auth.identities` aún no creada ni confiar en `user_metadata` del cliente.

Para evitar linking automático por email se propone **no enviar email, DNI ni
preferred_username a Supabase en ID token/UserInfo**, incluso cuando el usuario
ya tenga correo. Configurar scopes y mappers del client IdP para exponer el subject
opaco mínimo; quitar `email` del scope por sí solo no demuestra que desaparezca.
El correo sigue disponible en el IdP para login y en un registro privado para
recordatorios. Esta separación no está implementada; E2 debe comprobar todos los
payloads y una colisión deliberada de email. No asumir que el linking automático
de Supabase se puede desactivar. No habilitar linking manual ni password nativo
como segunda puerta para eludir el IdP.

## 3. Ciclo de vida propuesto

Todos los diagramas describen **diseño futuro**, no operaciones ejecutadas.
`Gate` significa autorización viva de cuenta, sesión y permisos en servidor y
datos. La activación solo puede proceder de verificación confiable del servidor.

### Alta, entrega, primer cambio y login por cada identificador

```mermaid
sequenceDiagram
    actor Admin as Nico o socio autorizado
    participant C as Servidor CUEVA
    participant I as IdP
    actor A as Alumno
    participant S as Supabase Auth
    participant G as Gate y datos
    Admin->>C: Alta con DNI, email o ambos
    C->>C: Autorizar, reservar identificadores y persona
    C->>I: Crear usuario sin autorregistro, clave temporal y cambio requerido
    I-->>C: Subject estable y resultado administrativo
    C->>C: Vincular subject; estado cambio requerido
    Admin-->>A: Entrega inicial por procedimiento aún por aprobar
    A->>C: Iniciar acceso
    C->>S: Inicio OAuth con PKCE y callback permitido
    S->>I: Authorization Code OIDC
    alt Usuario tiene DNI
        A->>I: DNI canónico y contraseña
    else Usuario usa su email habilitado para login
        A->>I: Email y la misma contraseña
    end
    I->>I: Verificar secreto y políticas
    opt Cambio obligatorio pendiente
        I-->>A: Exigir contraseña definitiva distinta
        A->>I: Completar cambio mediante el IdP
    end
    I-->>S: Código solo después de completar acciones obligatorias
    S->>I: Canjear código; verificar firma, issuer, audience y nonce
    S-->>C: Código PKCE para callback de la aplicación
    C->>S: Canje server-side y validación de sesión
    C->>G: Comprobar vínculo esperado y evidencia del cambio
    alt Prueba confiable completa y versión vigente
        G->>G: Autorizar solo esa sesión; activar acceso
        C-->>A: Acceso propio permitido
    else Estado o evidencia inciertos
        C-->>A: Acceso funcional denegado
    end
```

Los dos PKCE corresponden a tramos distintos: IdP↔Supabase y aplicación↔Supabase.
No aceptar tokens pegados por el cliente ni crear una sesión mediante poder
administrativo porque el DNI existe. El formulario debe admitir email-only sin
pedir DNI, y DNI-only sin perfil obligatorio de correo/teléfono.

**Cambio inicial:** la acción temporal del IdP es una primera barrera, no toda la
autorización. Antes del cambio ningún token debe poder operar sobre datos. El
servidor debe corroborar usuario, subject, operación de alta/reset vigente, acción
de cambio completada y sesión nueva; registrar entonces la sesión autorizada en
la versión actual. Una afirmación del navegador, una fecha en `user_metadata` o
un flag oculto no habilitan acceso. Si el IdP/API no permite una corroboración
confiable y libre de carreras, E3 falla y el acceso queda bloqueado. No se especifica
un webhook o claim mágico inexistente. La prueba debe elegir y demostrar el
mecanismo de corroboración antes de codificar el gate de producción.

Corroboración candidata para E3: consultar por
[Admin REST del IdP](https://www.keycloak.org/docs-api/26.8.1/rest-api/index.html)
el mismo subject y sus acciones requeridas, comprobar que la operación pendiente
es la generación esperada y que la sesión Auth fue creada después de la barrera
de alta/reset, y autorizar ese session_id en una transacción que vuelva a comparar
la versión. La ausencia de `UPDATE_PASSWORD` por sí sola no es prueba del cambio:
hay que demostrar que no se pudo quitar por un camino administrativo/alternativo
sin completar la política, y que una sesión anterior no se convierte en nueva
mediante refresh. Si ese contrato no puede establecerse con las APIs y flujos
reales, **E3 permanece bloqueado**; no reemplazar la prueba por timestamps del
cliente, metadata o una consulta que solo muestre usuario habilitado.
La revisión del [código fijado S10](identity-research-sources.md) confirma que un
administrador puede retirar acciones y que el listado de credenciales no aporta
el indicador temporal confiable buscado. Los eventos existentes de cambio requieren
un canal y correlación demostrados; esa integración todavía no está diseñada ni
probada. No se toma esta consulta candidata como mecanismo suficiente.

Reutilizar la temporal como definitiva debe ser rechazado por política madura del
IdP (historial/no reutilización). También se prueba nueva autenticación mientras
queda una sesión SSO previa y el intento de usar un grant directo; no habilitar
Direct Access Grants ni implicit flow para evitar acciones obligatorias.

### Asociación y cambio de email

```mermaid
sequenceDiagram
    actor U as Alumno o administrador autorizado
    participant C as Servidor CUEVA
    participant I as IdP
    participant M as Correo de verificación
    U->>C: Solicitar asociación o cambio con sesión válida
    C->>C: Autorizar propietario/capacidad, reservar nuevo email
    C->>I: Iniciar actualización con reautenticación y verificación
    I->>M: Prueba de control del nuevo buzón
    Note over C,I: Mantener email anterior; nuevo email pendiente
    U->>I: Completar verificación del cambio
    I-->>C: Resultado consultable y confiable del mismo subject
    C->>C: Confirmar unicidad y versión; actualizar registro privado
    Note over C,I: Mismo subject, UUID Auth y persona; no linking por email
    C-->>U: Email de acceso actualizado, recordatorios con estado separado
```

Propuesta: usar el flujo `UPDATE_EMAIL` del candidato con verificación forzada
para el cambio y reautenticación, sin exigir correo a todo el realm. La guía
describe mantener pendiente el nuevo email hasta verificarlo; disponibilidad y
comportamiento del candidato fijado deben probarse en E4. No marcar verificado
un correo porque un administrador lo escribió. Una edición administrativa de
atributos no debe saltar la verificación ni habilitar login antes de tiempo.

| Dato | Significado |
| --- | --- |
| Email de acceso | Alias real, único y habilitado por el IdP tras el flujo acordado. No es el email de `auth.users` en esta propuesta. |
| Email verificado | Evidencia de control de ese buzón, para ese valor y versión; caduca al cambiar el valor. |
| Email habilitado para recordatorios | Estado de uso/notificación sobre email verificado, no revocado ni suspendido. No nace automáticamente de un claim o login. |
| Email pendiente | Sin correo o pendiente de verificación/habilitación. El contrato preserva acceso por DNI; E4 debe demostrarlo incluso con verificación pendiente. No se envía recordatorio. |

Conservar el login previo hasta el commit del cambio, si el IdP lo permite.
Si una verificación pendiente bloquea temporalmente el siguiente login por DNI,
debe poder cancelarse con seguridad sin eliminar ese DNI. Probar ese efecto;
no convertir una asociación opcional de correo en una obligación permanente.
No permitir retirar el único identificador ni abandonar una cuenta sin recuperación.

### Recuperación, reset administrativo y revocación

```mermaid
sequenceDiagram
    actor A as Alumno
    actor N as Administrador con capacidad
    participant C as Servidor y registro CUEVA
    participant I as IdP
    participant S as Supabase Auth
    A->>N: Solicitar recuperación sin revelar contraseña anterior
    N->>N: Comprobar identidad según procedimiento aprobado
    N->>C: Orden de reset autorizada e idempotente
    C->>C: Bloquear acceso, incrementar versión e invalidar sesiones admitidas
    C->>I: Revocar sesiones SSO y asignar nueva temporal individual
    C->>S: Revocar sesiones/refresh del usuario según API aplicable
    alt Todas las operaciones confirmadas
        C->>C: Reset requerido, pendiente de entrega
        N-->>A: Entrega por canal aprobado
        A->>I: Login y cambio obligatorio nuevamente
        Note over C,S: Nueva sesión solo tras E3; antiguas versiones siguen denegadas
    else Fallo parcial o timeout ambiguo
        C->>C: Mantener bloqueado y registrar conciliación
        C-->>N: Estado pendiente, sin anunciar éxito ni recrear usuario
    end
```

Con email, el IdP puede ofrecer recuperación con verificación; sin email,
recuperación administrativa tras comprobación humana. El DNI público no es un
secreto ni una prueba suficiente de identidad. No inventar WhatsApp, SMS, email
automático o entrega presencial como canal ya aprobado. Presencial supervisado es
una opción para que el propietario evalúe, no una decisión tomada.

Revocar cuenta o permiso se aplica primero al gate vivo; después se coordinan IdP
y Supabase. Un logout en un sistema no asegura logout en el otro. Un JWT firmado
puede seguir vigente después de revocar refresh; no basta esperar a que expire.
La cuenta revocada conserva su UUID e historial. No borrar usuarios o recrearlos
como mecanismo de reset. No hay rollback automático que vuelva a activar acceso
tras un fallo parcial. Un reintento exige conocer el estado e idempotencia de la
operación; ante resultado ambiguo, consultar y conciliar antes de reenviar secretos.

Todo camino de cambio/reset del IdP debe coordinar antes la barrera CUEVA, o
permanecer deshabilitado para el producto. Esto incluye Account Console y
recuperación iniciada fuera de CUEVA; no se presupone back-channel logout ni
notificaciones de cambios hacia Supabase. La intervención excepcional del operador
requiere bloquear/conciliar el acceso. Sin esa garantía E5 no puede aprobarse.

## 4. Invariantes de datos y concurrencia

Estas reglas son propuestas a materializar con constraints y transacciones
revisadas posteriormente; no constituyen SQL ni esquema remoto verificado.

1. Al menos un identificador utilizable por persona. DNI se trata como texto, no
   número: no perder ceros ni convertirlo en email/teléfono, password o URL.
2. Definir una sola política canónica versionada en aplicación e IdP. Propuesta
   conservadora: namespace documental, dígitos ASCII y formato canónico de DNI;
   email con tratamiento de dominio/caso alineado al IdP. No usar una regex como
   prueba de DNI real ni inventar un checksum. Longitudes/tipos admitidos, puntos,
   espacios, ceros iniciales y email internacional requieren cierre de validación.
3. Rechazar vacío, controles e identificadores malformados. En formularios
   administrativos autenticados se puede explicar el error; el login y la
   recuperación públicos no revelan existencia, email resuelto ni estado del DNI.
4. Unicidad atómica de `(tipo, namespace, valor_canónico)` entre cuentas activas y
   reservas pendientes; el IdP no debe permitir emails duplicados. No confiar en
   un SELECT previo. Colisión contra otra persona termina en conflicto y revisión,
   nunca merge o transferencia automática. La misma persona puede reintentar una
   operación identificada sin crear otra identidad.
5. `(issuer, sub)` único; también UUID Auth único cuando se vincula. No aceptar un
   issuer desde un formulario. Reconfigurar realm/issuer o migrar IdP requiere un
   plan específico de preservación; no reasignar subject de una cuenta eliminada.
6. Alta y cambios se coordinan como operación con ID opaco y versión esperada:
   reservar en CUEVA → actuar en IdP → confirmar resultado → finalizar. No hay
   transacción distribuida implícita entre IdP, Auth y base. Ante carrera solo una
   reserva confirma; ante fallo parcial queda bloqueada/pendiente de conciliación.
7. No activar identificador ni marcar email verificado con un callback viejo,
   duplicado, para otro valor o de otra versión. La reserva tiene vencimiento y
   liberación tras conciliación; no dejar un email permanentemente secuestrado
   mediante solicitudes anónimas.
8. Cambiar DNI/username o email preserva persona, subject y UUID Auth. Los
   historiales referencian persona. Comprobar cantidades y contenidos no vacíos
   antes/después; no alcanza igualdad de nombre o una pantalla sin errores.
9. Solo Nico cambia permisos del socio; socio no puede otorgarse capacidades,
   restablecer al dueño o crear nuevos administradores por derivación de su rol.
   La matriz precisa de capacidades del socio queda pendiente de configuración
   por Nico. El bootstrap del dueño es una identidad comprobada por canal
   administrativo, no los primeros registros ni un email/DNI codificado en código.

## 5. Amenazas y controles exigidos

| Amenaza | Control propuesto y comprobación necesaria |
| --- | --- |
| Enumeración de DNI/email | Login y recuperación con respuesta genérica; sin endpoint público DNI→email; comparar cuerpo/status/timing y redirecciones del IdP, incluso usuario inexistente/deshabilitado. No prometer tiempos idénticos sin medir. |
| Fuerza bruta, spraying y bloqueo abusivo | Límites persistentes en IdP y endpoints CUEVA por origen/cuenta pseudonimizada; topes globales y backoff con recuperación administrativa. Los límites Supabase no protegen automáticamente el login IdP. No depender de memoria de un proceso ni fijar números como aprobados. |
| Filtración por logs | Redactar cuerpos, cookies, tokens, códigos OAuth, login_hint, DNI y emails en app, IdP, proxy, errores y auditoría de proveedor. Registrar operación, tipo, resultado y referencias opacas con acceso/retención restringidos; no loguear claves temporales. |
| Robo/fijación/replay de sesión | HTTPS, redirect URIs exactas, state/nonce/PKCE por SDK, códigos de un uso y respuesta sin caché. No desactivar nonce/PKCE para hacer pasar una prueba. Sin open redirect o tokens en query/telemetría. |
| Cookie falsificada o claims viejos | Validar firma/issuer/audiencia/exp con API/SDK; no autorizar con `getSession()` ni con cookie decodificada. El gate consulta estado, versión y permisos actuales. |
| Uso antes del primer cambio | IdP exige cambio; RLS y servidor exigen gate y sesión autorizada. No bypass por API, Storage, grants alternativos, SSO existente o refresh. Evidencia de cambio confiable es condición E3. |
| Token válido después de reset/revocación | Invalidar sesiones admitidas e incrementar versión en transacción antes de actuar externamente. Consultar vínculo de session_id y sesión Auth existente; E5 cubre JWT aún no vencido y refresh concurrente. |
| Escalada de privilegio | Capacidades vivas, no `user_metadata`; no usar solo `TO authenticated`. Cliente y alumno no escriben estado/gate/vínculos/permisos. Revocar permisos del socio afecta la siguiente operación protegida. |
| CSRF/XSS | Mutaciones POST con comprobación de origen y mecanismo CSRF de framework/biblioteca; SameSite y cookies Secure en producción. Texto seguro/CSP revisada; no HTML de notas ni tokens en almacenamiento de tema. OAuth callback sigue su validación de state/PKCE. |
| Claves privilegiadas | Clientes administrativos aislados, solo servidor y mínimo alcance; jamás secret/service_role en navegador. Operaciones ordinarias usan JWT de usuario para conservar RLS; no convertir todo acceso a datos en acceso administrativo. |
| Confusión de identidad por email/issuer | Subject opaco y vínculo administrativo estable; claims mínimos sin email para Auth, sin linking manual; pruebas de colisión y mappers en E2/E4. |
| Caída del IdP/base/caché | Fallar cerrado en alta, activación y comprobaciones críticas; no elevar rol ni omitir gate por indisponibilidad. Reconciliación explícita y evidencia de resultado externo antes de reanudar. |

RLS debe cubrir todas las superficies expuestas: tablas, vistas, RPC y Storage;
SELECT propio y mutaciones propias autorizadas; WITH CHECK/propiedad para evitar
reasignaciones. Permisos de columnas y funciones también se revisan. Si un helper
de política requiere leer un registro privado de sesiones, revisar privilegios,
search_path, propietario y EXECUTE mínimo; no usar SECURITY DEFINER como arreglo
genérico. No hay SQL propuesto para aplicar en esta entrega.

### SSR y sesiones

La guía de [SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
distingue `getClaims` (validación del token), `getUser` (consulta actual a Auth) y
`getSession` (lectura de sesión). Ninguno sustituye permisos vivos del producto.
Usar cliente por petición y conservar cookies/headers de renovación; no cachear
respuestas personales o Set-Cookie en CDN/ISR. No habilitar RSC público para datos
privados por una comprobación visual de ruta.

Los [access tokens](https://supabase.com/docs/guides/auth/sessions) incluyen
session_id; se debe comprobar su vigencia y la admisión en la versión de acceso
actual para denegación inmediata. Un JWT válido criptográficamente no demuestra
que se completó el cambio requerido ni que la sesión siga autorizada.

Propuesta de integración a validar: acceso Auth/datos del producto a través del
servidor; renovación y callback gestionados allí. Cookies HttpOnly solo si el
cliente no necesita leer ni refrescar tokens; no mezclarlo con un cliente Supabase
Auth en navegador que dependa de cookies legibles. La
[guía avanzada](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
explica esa diferencia. La política exacta se fijará en la prueba, incluidos
Secure, SameSite, path, expiración, concurrencia de refresh y compatibilidad móvil;
no se presenta como una configuración ya disponible en el proyecto.

## 6. Matriz de pruebas futuras

**Todas las pruebas de esta matriz: NOT_RUN.** Exigen sesiones genuinas y un
entorno aislado autorizado; documentación y mocks no acreditan denegación real.
Fixtures sintéticos: alumnos A (DNI-only) y B (ambos), C (email-only), Nico, socio
con capacidad de alumnos pero sin confirmar pagos, y socio con esa capacidad
concedida temporalmente por Nico (misma identidad antes/después). No crear estos
usuarios ni datos en el proyecto objetivo durante CUEVA-002A.

Cada alumno tendrá al menos una rutina publicada y un movimiento/comprobante de
prueba con contenido distinguible y no vacío cuando el módulo exista. Para el
spike de identidad basta un recurso privado mínimo sintético. Capturar rol,
contexto, estado inicial/final e identificadores opacos; nunca tokens/contraseñas
en evidencia. Una lectura vacía, error de Auth/transporte o botón oculto no es PASS
de autorización. En SELECT, si RLS filtra filas, comparar contra una lectura propia
no vacía y una consulta administrativa acotada que pruebe que la fila ajena existe;
en mutación exigir denegación identificable y comprobar ausencia de efectos.

| ID | Actor / caso | Permitir y denegar / evidencia requerida |
| --- | --- | --- |
| T01 | Nico / alta A sin correo | Permitir cuenta administrativa DNI-only; ningún email/teléfono ficticio u obligatorio en API/perfil/acciones. |
| T02 | Alumno/anónimo / alta | Denegar creación de alumno/rol por UI, API nativa, grants no previstos y OAuth de subject no autorizado. |
| T03 | A / temporal inicial | Exigir cambio; antes de él denegar recurso real por servidor y API de datos, no solo redirigir. |
| T04 | A / temporal reutilizada | Rechazar temporal como definitiva y login posterior con ella; nueva contraseña válida sí funciona. |
| T05 | B / DNI y email | Ambos con misma contraseña llegan a la misma persona, subject y UUID Auth; recurso propio no vacío idéntico. |
| T06 | C / email-only | Login válido sin DNI ni teléfono; no exponer username interno como dato requerido. |
| T07 | A y B / acceso cruzado | A lee/escribe recurso propio; A no lee ni altera el de B por API, RPC/Storage cuando existan. |
| T08 | Socio sin capacidad | Administrar alumnos permitido según concesión; confirmar pago y otorgarse permisos denegados con fixtures existentes. |
| T09 | Nico / capacidades del socio | Conceder y revocar; permiso cambia efectivamente para el mismo socio aun con JWT viejo. |
| T10 | Alumno / metadata manipulada | Editar flags/rol/owner/session_id del cliente no habilita cuenta ni cambia autorización. |
| T11 | A / asociación email | Verificar nuevo buzón y mantener UUID e historial; mientras pendiente no usar nuevo alias ni enviar recordatorios. |
| T12 | B / email ocupado por C | Rechazar colisión, incluidas variantes canónicas; C no pierde cuenta ni recibe historial de B. |
| T13 | Dos administradores / carrera | Alta simultánea mismo DNI/email: una identidad, conflicto controlado para la otra; sin huérfanos activos. |
| T14 | Cambio DNI/email concurrente | Versión antigua o callback reutilizado no confirma; subject y contenido histórico se preservan. |
| T15 | A / recuperación sin correo | Administrador autorizado comprueba identidad/entrega según política; DNI solo o solicitud anónima no produce reset. |
| T16 | Reset con SSO/JWT/refresh previos | Sesiones antiguas denegadas inmediatamente, incluso no vencidas; nueva temporal exige nuevo cambio y nueva sesión autorizada. |
| T17 | Baja/revocación | Denegar todo acceso funcional y refresh según alcance; conservar historial; revocar IdP solo o Supabase solo no se cuenta como revocación completa. |
| T18 | OAuth/PKCE/issuer | Rechazar state/verifier/nonce erróneo, issuer/audience incorrectos y código repetido; URI fuera de allowlist denegada. |
| T19 | IdP/SMTP/Auth/base falla | Alta/reset/cambio email queda pendiente y bloqueado según su estado; no duplicar usuario/pago/email ni anunciar éxito incierto. |
| T20 | Enumeración y abuso | DNI inexistente/existente/deshabilitado: respuesta sin directorio; medir patrones/timing, rate limit distribuido y no bypass entre instancias. |
| T21 | Cookies/CSRF/caché | Mutación cross-site denegada; refresh conserva cookies; usuario B no recibe respuesta ni Set-Cookie cacheados de A. |
| T22 | Linking y claims | Email coincidente preexistente no une sujetos; UserInfo/ID token/metadata no contienen DNI/email/username innecesarios. |
| T23 | Cambio/reset desde otro camino IdP | Account console, enlace de recuperación o administración fuera del flujo no dejan sesiones CUEVA antiguas activas. Exigir coordinación o bloquear ese camino. |
| T24 | Email recordatorios | Sin correo, no verificado, deshabilitado o cuota pagada: no programar; login por email no equivale a email habilitado para avisos. Envío real pertenece a CUEVA-005. |

## 7. Decisiones humanas y costos pendientes

**Decisión mínima indispensable de arquitectura/operación:** aceptar o rechazar
un IdP adicional, con responsable de operación, hosting/plan y presupuesto límite.
Se propone Keycloak para evaluar, no desplegarlo. Si no se acepta un IdP adicional,
el contrato DNI-only con contraseña queda bloqueado con la evidencia disponible;
no reemplazarlo por correo obligatorio, email inventado o un password grant casero.
Ese bloqueo exige nueva decisión técnica/producto del propietario y Orchestrator.

**Decisión operativa indispensable:** procedimiento de comprobación humana y
entrega inicial/recuperación para alumnos sin correo; responsables y permisos de
Nico/socio, vigencia de temporal y manejo de pérdida/abuso. No se solicita una
credencial en el chat ni se presupone un canal ya autorizado.

También cerrar la validación canónica de DNI/email, la matriz de capacidades del
socio y política de bloqueo/revisión de colisiones. No reabrir si se permiten
alumnos sin email: eso ya está confirmado. Proveedor de correos/verificación,
retención de auditoría y objetivos de disponibilidad requieren definición antes
de operar los flujos correspondientes, sin implementar recordatorios aún.

Costos no cotizados: IdP y su base persistente, TLS/dominio, mantenimiento y
parches, recuperación/backups comprobables, observabilidad y proveedor de correo
para los alumnos que sí lo usen; plan/capacidades del servicio Supabase aislado.
Las cuotas públicas de custom providers no prueban entitlement del proyecto.
La escala de 50–150 alumnos no demuestra capacidad ni disponibilidad. No se
contrata ni instala nada en esta tarea.

## 8. Evidencia faltante y único siguiente incremento

| Gate | Evidencia necesaria para aceptar el mecanismo |
| --- | --- |
| E1 · Alta exclusivamente administrativa | IdP cerrado y vínculo preaprobado; ausencia de autorregistro por todos los endpoints habilitados; primer JIT Auth DNI-only permitido sin abrir otra vía. Payload/hook confiable si se usa. |
| E2 · Federación e identidad | OIDC con email opcional disponible en entorno autorizado, PKCE válido, UUID persistente sin email/username en claims; colisión deliberada sin linking. |
| E3 · Temporal y activación | Acción de cambio real y no reutilización; evidencia server-side suficiente para activar una sesión nueva; intento directo antes del cambio denegado y sin carrera con reset. |
| E4 · Alias sin duplicación | DNI-only, ambos y email-only, cambio de DNI/email con mismo subject/UUID, verificación antes de activar alias y ninguna obligación global de correo. |
| E5 · Revocación y permisos | Gate aplicado también en RLS/Storage/RPC, versión y sesión vivas; JWT/refresh/SSO anteriores denegados tras reset/revocación y cambio de permiso. |
| E6 · Operación aprobada | Proveedor/operador/costos, entorno de prueba aislado, canal humano, custodia de secretos y procedimiento de conciliación/recuperación aceptados. |

**Proponer CUEVA-002B: spike de integración federada aislada**, condicionado a D007
revisada, E6 aprobado y acceso explícito al entorno de prueba. No está autorizado
por este encargo y no debe usar el proyecto objetivo como sandbox por inferencia.

Alcance único: aprovisionar administrativamente dos fixtures sintéticos (DNI-only
y ambos), completar OIDC y cambio temporal, leer un recurso privado mínimo propio,
denegar el ajeno y el acceso previo al cambio, repetir ambos logins con identidad
estable, y demostrar reset con JWT anterior denegado. Implementar solo el adaptador
y gate mínimos de prueba; excluir pantallas/módulos de negocio, datos reales,
recordatorios, migraciones de producción y despliegue comercial. Email-only y
colisiones deben quedar al menos caracterizados en ese entorno antes de aceptar
el contrato completo; no extrapolar un caso exitoso al resto de T01–T24.

Criterios: versiones/configuración fijadas, fixture genuino no vacío, evidencia
del verificador y de emisión de sesión, permisos de endpoints, claims mínimos,
UUID/subject antes-después, denegaciones reproducibles y fallos parciales
registrados. STOP del mecanismo si E1/E3 no se pueden probar; no ampliar a la
implementación general de Auth ni declarar PASS operacional por un mock.

## 9. Verificación de CUEVA-002A

Ver [registro de entrega](../engineering/CUEVA-002A-verification.md): comandos,
resultados, fechas e identidad comprobada. No se repiten build/navegador porque
esta rama solo modifica documentación. La evidencia funcional de CUEVA-001A se
referencia como histórica; no se presenta como prueba de autenticación.
