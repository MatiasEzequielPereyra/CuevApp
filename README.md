# CUEVA

Fundación de la aplicación del gimnasio. CUEVA-001A fue aceptada e integrada en el PR #1. La página está publicada en [cueva-gym.vercel.app](https://cueva-gym.vercel.app). Ver el checkpoint para la evidencia y el siguiente encargo.

## Orden de lectura

1. [Checkpoint y límites actuales](docs/engineering/checkpoint.md).
2. [Encargo CUEVA-001A](docs/engineering/CUEVA-001A-task.md), complementado por la instrucción posterior de continuar localmente sin nuevos accesos a Supabase o Mozilla.
3. [Contexto funcional maestro](docs/product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md).
4. [Protocolo del Orchestrator](docs/engineering/ORCHESTRATOR-CUEVA-V2.md).
5. [Decisiones técnicas y aceptación](docs/architecture/decisions.md).
6. [Backlog](docs/engineering/backlog.md).
7. [Procedencia y hashes](docs/engineering/source-manifest.json).

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

La pantalla informa que las funciones del gimnasio están en desarrollo. No hay
cuentas, datos reales, administración, SQL, pagos, emails, videos operativos,
manifest de instalación ni service worker. Solo se guarda la preferencia de tema
en este navegador. Sin JavaScript el contenido se mantiene y el tema sigue al sistema.

La paleta gris, el layout, CSS nativo y el SVG reconstruido fueron aceptados para la fundación. El SVG sigue siendo una reconstrucción, no el maestro vectorial original. Identidad DNI sin email, proveedor
de correo, retención, límites de video y hosting se resolverán en sus tracks.
No reintroducir QR/push/estadísticas avanzadas en V1.
