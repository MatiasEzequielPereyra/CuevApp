---
name: cueva-acceptance-audit
description: Usar al auditar de manera independiente un cambio, PR, migración o handoff de CUEVAPP y decidir PASS, CHANGES_REQUIRED o BLOCKED_WITH_EVIDENCE.
---

# Auditoría y aceptación independiente CUEVAPP

## Secuencia
1. Leer `AGENTS.md`, checkpoint y encargo vigente. Determinar quién implementó y qué autorizó el usuario.
2. Verificar repo, `main`, SHA base, SHA HEAD del PR, listado completo de archivos y diff real. Si la rama cambió, reiniciar las verificaciones afectadas.
3. Inspeccionar las fuentes pertinentes, tests y cambios de permisos. Comparar contratos funcionales con decisiones posteriores integradas; no usar notas antiguas como autoridad.
4. Evaluar errores de diseño, regresiones, filtraciones de secretos/PII, autorización, integridad, duplicados, concurrency/races, retries y rollback.
5. Corroborar resultados de CI para el HEAD preciso. Separar checks observados, ejecutados por el auditor, declarados por el ejecutor y NOT_RUN.
6. Si toca Supabase o finanzas, aplicar también `cueva-supabase-security` o `cueva-finance` y exigir pruebas específicas de acceso/negocio.
7. Para documentos, validar Markdown/enlaces y hashes de `docs/engineering/source-manifest.json`; no modificar registros protegidos ni cambiar el gate para aprobar.

## Decisión
- `PASS`: alcance y evidencias suficientes, sin bloqueos abiertos; no implica automáticamente producción probada.
- `CHANGES_REQUIRED`: defecto reproducible con archivo/causa y aceptación esperada.
- `BLOCKED_WITH_EVIDENCE`: faltan acceso, entorno, CI o evidencia indispensable; detallar lo observado sin inventar.
- Las pruebas verdes por sí solas no prueban comportamiento alojado. Una revisión del propio implementador no reemplaza una auditoría independiente.

## Informe
Emitir TASK_ID, BASE/HEAD actuales, archivos, invariantes revisadas, hallazgos por severidad, CHECKS_EXECUTED/NOT_EXECUTED, SKILLS_SELECTED/APPLIED/SOURCES, decisión y handoff de corrección o próximo paso. No hacer merge de un PR con checks obligatorios rojos.
