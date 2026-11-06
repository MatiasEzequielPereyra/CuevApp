---
name: cueva-architecture
description: Usar al diseñar la arquitectura de CUEVAPP, cambiar límites entre Next.js y Supabase, tomar decisiones técnicas o revisar contratos y dependencias entre módulos.
---

# Arquitectura de CUEVAPP

## Preparación
1. Leer `AGENTS.md`, `docs/engineering/checkpoint.md` y `README.md`, respetando ese orden de precedencia.
2. Verificar HEAD de `main`, rama de trabajo y archivos reales antes de proponer cambios.
3. Consultar `docs/architecture/decisions.md`, `docs/engineering/backlog.md` y las especificaciones posteriores vigentes. Las fuentes protegidas por `docs/engineering/source-manifest.json` son históricas: no editarlas ni actualizar sus hashes para adaptar requisitos.
4. Para modificar código Next.js, leer primero la guía pertinente de la versión instalada en `node_modules/next/dist/docs/`, como exige `AGENTS.md`. Si no está disponible, declarar la limitación.

## Diseño
- Mantener Next.js App Router, React, TypeScript y Supabase existentes salvo decisión justificada. Priorizar cambios pequeños y compatibles, no reescrituras.
- Distinguir servidor, navegador y funciones de base de datos. No trasladar al cliente validaciones de autorización o reglas económicas.
- Mantener CUEVA como herramienta de un gimnasio; no introducir multitenancy ni servicios genéricos sin pedido.
- Usar el contexto vigente: correo obligatorio, invitación administrativa y contraseña propia; DNI opcional de ficha, no login. No revivir requisitos históricos.
- Identificar efectos sobre estudiantes, acceso, cobros, rutinas, recursos y producción. No asumir que una carpeta o prototipo equivale a funcionalidad integrada.
- Documentar decisiones nuevas en un archivo no protegido, con fecha, alternativas, riesgos, contrato y consecuencias para migraciones y pruebas.

## Entrega
Presentar diseño mínimo, rutas/tablas implicadas, dependencias, casos negativos y plan de reversión. Separar CONFIRMED / REPORTED / PLANNED / BLOCKED. No afirmar validación alojada a partir de pruebas locales.
