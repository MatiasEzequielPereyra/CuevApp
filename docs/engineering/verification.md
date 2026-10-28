# Procedimiento de verificación CUEVA-001A

Fecha de implementación: 2026-10-27, America/Buenos_Aires. Los resultados y el
commit comprobado se registran al finalizar en el checkpoint y el informe.

## Reproducción local

Requisitos: Node 22.14.0 y npm 10.9.2 (familias admitidas en `package.json`).
Sin `.env`, Supabase, secretos ni servicios externos. Instalar herramientas de
desarrollo requiere acceso al registro de npm y a los binarios oficiales del
navegador de Playwright; ejecutar la página no necesita esos servicios.

```sh
npm ci
npx playwright install chromium
npm run verify
npm audit --audit-level=critical
npm run verify:sources
npm run verify:security
```

`verify` ejecuta ESLint, tipos (incluida generación de rutas de Next), build de
producción, pruebas documentales y pruebas de navegador sobre `next start`.
Puerto 3000 libre; Playwright no reutiliza un servidor ajeno. La suite guarda
capturas en `evidence/runs/` e informe JSON en `test-results/results.json`.
Esas carpetas son salidas reproducibles ignoradas; la evidencia seleccionada de
esta entrega se conserva por separado en `evidence/`.

## Cobertura

- Hash y longitud de las cuatro fuentes; enlaces de documentación mantenida.
- HTTP 200 de inicio/SVG, carga de imágenes, ausencia de errores de navegador
  y de solicitudes a terceros durante la página inicial.
- 360, 390, 768 y 1440 px en claro y oscuro; sin overflow horizontal.
- axe WCAG A/AA y contraste automatizado; revisión visual de capturas.
- Teclado: enlace de salto, botones de tema, activación con espacio/Enter,
  foco visible y navegación al contenido del proyecto.
- Preferencia persistida, sincronización entre pestañas y cambios del sistema;
  almacenamiento denegado y valor guardado inválido.
- Contenido sin JavaScript, reflow a 320 px, inexistencia de formulario y de
  service worker, y 404 de `/admin` (no equivale a una prueba de autorización).
- Comparación del lettering original/SVG mediante una ventana CSS del original.

## Límites

Chromium local no certifica Safari/iPhone/Android físicos. axe no reemplaza una
auditoría manual con lector de pantalla. CI remoto, Auth/RLS, correos, pagos,
videos, instalación PWA, offline, integración y despliegue son NOT_RUN.
Supabase es NOT_VERIFIED por alcance; no se realizan nuevas tentativas.

## Versiones y compatibilidad

Consultados el registro npm y las [instrucciones oficiales de Next.js](https://nextjs.org/docs/app/getting-started/installation).
Next estable 16.4.3 declara Node >=20.9 y React 19 como compatible; Node local
22.14.0 satisface esa condición. React/React DOM 19.3.1. TypeScript 6.0.3 es
estable y está dentro del rango del parser actual de typescript-eslint (<6.1);
TypeScript latest 7.0.2 se dejó fuera por esa incompatibilidad declarada.
Las versiones directas se fijan sin rangos y el lockfile fija las transitivas.

ESLint 9.39.5 se eligió porque los peers declarados de eslint-plugin-react,
eslint-plugin-import y eslint-plugin-jsx-a11y admiten 9 y aún no admiten 10.
El registro marca ESLint 9 como fuera de soporte: limitación explícita para
auditoría. La instalación no usa `--force` ni `--legacy-peer-deps`; se debe evaluar
el reemplazo o actualización del linter cuando el ecosistema declare soporte
compatible. La revisión de vulnerabilidades se registra separadamente.

Tailwind estable consultado: 4.3.3. Se evaluó su uso; CSS nativo evita añadir
Tailwind/PostCSS para una sola pantalla y un conjunto pequeño de variables.
La decisión D002 es PROPOSED y se puede revisar en el siguiente incremento.
