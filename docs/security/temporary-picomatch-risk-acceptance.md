# Excepción temporal de riesgo — Picomatch (CUEVA-006D)

Fecha de evaluación: 2026-11-17  
Rama evaluada: `feature/routine-text-mentions`  
HEAD evaluado: `0e03d042aebce367b90f222875a33da8b33175b2`  
Estado: excepción técnica acotada implementada en CI; no equivale a declarar el hallazgo corregido.

## Hallazgo

La auditoría completa de npm identifica el aviso `GHSA-fc5q-39xc-vjpf`
(CVE-2026-112366, ReDoS en extglobs repetidos de una sola rama) para:

- `picomatch@2.3.2`, instalado en `node_modules/picomatch`.
- `picomatch@4.0.7`, instalado en
  `node_modules/tinyglobby/node_modules/picomatch`.

Ambas instalaciones están marcadas como dependencias de desarrollo en el
lockfile. El árbol de dependencias las alcanza desde tooling de ESLint/Next y
TypeScript-ESLint. No son dependencias runtime directas de la aplicación.

La ejecución CI comprobada el 2026-11-17 informa:
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades.
- `npm audit --audit-level=moderate`: falla por el aviso de Picomatch y su
  propagación por dependencias transitivas.
- `npm audit fix --force` propone instalar `eslint-config-next@16.3.8`,
  downgrade incompatible con el `16.4.6` fijado por el proyecto.

## Decisión temporal y límites

Se propone aceptar únicamente el riesgo residual del aviso anterior en las
dependencias de desarrollo indicadas, hasta que exista una versión oficial
corregida y compatible que permita eliminar las instalaciones afectadas.

Esta excepción NO:
- acepta vulnerabilidades de producción ni de dependencias runtime;
- permite otros avisos, CVE, paquetes, severidades o nuevos rangos afectados;
- permite `npm audit fix --force`, downgrades, overrides arbitrarios o
  reemplazar Node.js/Next.js para silenciar el resultado;
- permite desactivar la auditoría, ocultar su salida o convertir cualquier
  fallo de `npm audit` en éxito;
- autoriza despliegues, cambios en Supabase alojado ni merge por sí sola.

## Controles obligatorios mientras dure

1. Mantener `npm audit --omit=dev --audit-level=moderate` como control
   bloqueante de producción.
2. Mantener la auditoría completa y publicar su resultado íntegro en CI.
3. Cualquier automatización de excepción debe validar de forma explícita el
   identificador `GHSA-fc5q-39xc-vjpf`, los paquetes/versiones y el árbol
   conocido; debe fallar ante cualquier hallazgo adicional o cambio del
   conjunto permitido. No se admite una regla genérica de `continue-on-error`.
4. Revisar el aviso y el lockfile en cada actualización de dependencias y al
   menos antes de integrar una nueva entrega.
5. No declarar el riesgo corregido: reportarlo como aceptado temporalmente y
   visible en la evidencia de CI.

## Condición de retirada

Retirar esta excepción en cuanto exista una versión oficial corregida y
compatible. Actualizar únicamente las dependencias transitivas/directas
necesarias, regenerar el lockfile con Node 22.14.0 / npm 10.9.2 y ejecutar la
suite completa, auditoría de producción y auditoría total. Eliminar entonces
esta excepción y confirmar que ambas instalaciones vulnerables desaparecieron.

## Estado de aprobación

La autorización para preparar esta documentación se recibió en la conversación
de trabajo. La excepción técnica se implementa mediante `scripts/check-dependency-audit.mjs`.
El verificador permite únicamente el grafo de 14 entradas reportado por npm,
las versiones y rutas dev fijadas en el lockfile, y el advisory exacto. Sus
pruebas positivas y negativas se ejecutan en CI. La excepción permanece
condicionada a que el audit de producción siga limpio y a que todos los checks
del PR estén verdes; no autoriza merge por sí sola.
