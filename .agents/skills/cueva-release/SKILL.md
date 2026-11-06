---
name: cueva-release
description: Usar únicamente para preparar y ejecutar, por el Orchestrator autorizado, merge y release de PR aprobados de CUEVAPP, o auditar despliegues y rollback en Vercel.
---

# Integración y release CUEVAPP

## Preflight
1. Leer `AGENTS.md`, checkpoint y `docs/engineering/ORCHESTRATOR-CUEVA-V2.md`. Verificar autorización, rama, base, HEAD y estado del PR en GitHub.
2. Obtener auditoría independiente favorable y CI obligatoria PASS del HEAD exacto. Revisar conflictos, hilos abiertos, permisos, secretos, migraciones y efectos sobre producción.
3. Comprobar las reglas de protección del repo cuando sea posible; no usar bypass ni forzar integración.
4. Verificar proyecto y team de Vercel, rama de producción y posibilidad de despliegue automático. No solicitar despliegues duplicados por incertidumbre de la herramienta.
5. Si hay Supabase, confirmar versión de migración, preflight, backup/rollback real y autorización antes de ejecutar cambios alojados.

## Merge
- Solo Orchestrator autorizado: preferir squash cuando corresponda al repo y verificar que el PR HEAD sigue inalterado antes de ejecutar.
- No mezclar cambios de otro ejecutor, ni usar la integración como prueba de un PR pendiente.
- Tras merge: confirmar estado MERGED, main SHA, inclusión del árbol esperado y estado de CI del nuevo commit.

## Publicación
- Diferenciar cambios solo documentales de runtime. Confirmar qué SHA sirve efectivamente el alias de producción; READY no prueba funcionalidad.
- Si el merge ya desplegó por Git, verificar el deployment existente y smoke tests, no crear otro innecesariamente.
- No cambiar flags de autenticación, SMTP, claves ni RLS por una tarea documental.
- Para rollback, distinguir revert de código de reversión de datos; jamás improvisar rollback destructivo.

## Cierre
Informar PR, implementación SHA, main SHA, método de integración, CI, deployment ID/URL/SHA, comprobaciones alojadas, limitaciones y NEXT_TASK. Usar NOT_VERIFIED cuando falte evidencia y detenerse ante riesgo de datos reales, gastos o acción fuera del permiso otorgado.
