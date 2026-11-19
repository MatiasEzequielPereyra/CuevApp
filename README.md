# CUEVA

Fundación de la aplicación del gimnasio. CUEVA-001A fue aceptada e integrada en el PR #1. La página está publicada en [cueva-gym.vercel.app](https://cueva-gym.vercel.app). Ver el checkpoint para la evidencia y el siguiente encargo.

## Estado actual del producto — 19/11/2026

Ver el [estado real de GitHub, Vercel, Supabase, ramas y pendientes](docs/engineering/REPO-STATUS-2026-11-19.md). Es la referencia vigente, por encima de los hitos históricos de documentación.

El `main` integra autenticación por correo e invitaciones administrativas, gestión de alumnos, cuotas y pagos parciales, vencimientos, comprobantes, rutinas por días/bloques y texto libre con referencias a ejercicios, videos y portal del alumno. El acceso usa correo obligatorio y contraseña elegida por el alumno; DNI opcional solamente en su ficha administrativa.

Al 19/11, GitHub `main` sirve la versión `aa7cd3604141` en Vercel Production (READY); Supabase Hosted registra **33 migraciones**, incluida la RPC de ejercicios asignados, los documentos de rutinas y sincronización de correo. **Aún no está activado el cron de recordatorios ni verificada la entrega Push final**, y faltan el registro de entrenamiento y la consulta de rutina offline. La rama CUEVA-006E está en desarrollo y no está integrada.

## Orden de lectura

1. [Checkpoint y límites actuales](docs/engineering/checkpoint.md).
2. [Encargo CUEVA-001A](docs/engineering/CUEVA-001A-task.md), complementado por la instrucción posterior de continuar localmente sin nuevos accesos a Supabase o Mozilla.
3. [Especificación vigente de cuotas, vencimientos, comprobantes y notificaciones](docs/product/CUEVA-FINANZAS-COMPROBANTES-NOTIFICACIONES-V1.md).
4. [Contexto funcional maestro e histórico](docs/product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md).
5. [Protocolo del Orchestrator](docs/engineering/ORCHESTRATOR-CUEVA-V2.md).
6. [Decisiones técnicas y aceptación](docs/architecture/decisions.md).
7. [Backlog](docs/engineering/backlog.md).
8. [Procedencia y hashes](docs/engineering/source-manifest.json).

Las instrucciones posteriores del usuario y el encargo acotado prevalecen sobre
el contexto y el protocolo general. El ejecutor no publica, integra ni despliega.

## Desarrollo local

Usar Node 22.14.0 y npm 10.9.2. No se requiere `.env`, cuenta ni credenciales.

```sh
npm ci
npm run dev
```

Abrir [http://127.0.0.1:3000](http://127.0.0.1:3000). `dev` y `start` escuchan
solo en loopback. Para ejecutar el build de producción: `npm run build` y luego
`npm start`. El puerto 3000 debe estar libre.

## Verificación

```sh
npx playwright install chromium
npm run verify
npm audit --audit-level=critical
npm run verify:sources
```

`verify` incluye lint, typecheck, build y pruebas. Ver
[procedimiento y límites](docs/engineering/verification.md).
La [comparación del logo](evidence/logo-comparison.html) se abre como HTML local.

## Estructura

- `src/app`: App Router, metadata, página y estilos globales con variables de tema.
- `src/components/brand`: símbolo de marca accesible.
- `src/components/theme` y `src/lib/theme.ts`: elección claro/oscuro/sistema,
  inicialización antes del primer pintado y persistencia solo de apariencia.
- `public/brand`: SVG provisional trazado del logo, sin controles de Instagram.
- `tests`: integridad documental y navegador sobre el build de producción.
- `.github/workflows`: verificación sin pasos de despliegue ni secretos.
- `docs`: fuentes originales, procedencia, decisiones, backlog y checkpoint.
- `evidence`: comparación y resultados de esta entrega; `runs/` es salida temporal.

## Alcance y decisiones abiertas

El acceso usa correo obligatorio, invitación administrativa y contraseña elegida
por el alumno. El DNI es opcional en la ficha administrativa. Las invitaciones
se envían mediante el SMTP de Brevo configurado en Supabase.

El backlog registra los pendientes de operación y producto. La activación alojada
de CUEVA-005, el registro de entrenamientos y la lectura de rutinas sin conexión
siguen pendientes. El SVG de la marca es la reconstrucción aceptada para la fundación.
