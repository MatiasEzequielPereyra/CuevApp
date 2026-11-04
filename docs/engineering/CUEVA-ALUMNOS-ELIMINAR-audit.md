# Revisión independiente — CUEVA-ALUMNOS-ELIMINAR

Base `67d44e2d954bd09af0ea821b718a8151cd9af28a`, candidato revisado
`4a221649951dcf1c88e28bf06e17e0d972156cd4`. Dos agentes de solo lectura,
Standards y Spec, aplicando code-review sobre diff de esa base, con el encargo
versionado. No repitieron laboratorios ni operaron servicios alojados.

## Standards

Sin violaciones documentadas ni smells materiales. Mantiene CSS/temas y limita el
componente cliente al diálogo. Identifica alumno, foco inicial en Cancelar, ambos
extremos de Tab, errores conservados y bloqueo mientras procesa. Autorización en
servidor y SQL mediante administrador/sesión/gate reales; sin metadatos editables.
Definer privado con search_path vacío, wrapper invoker y permisos explícitos;
DELETE directo sigue revocado. Locks compatibles y FK sin cascadas.
Revisión del delta corregido confirmó ausencia de nuevos bloqueos.

## Spec

Dos hallazgos iniciales corregidos antes de integrar:

1. Un job failed sin UUID puede esconder una creación Auth remota aún incierta.
   Se conserva siempre. Solo blocked sin provisión/cuenta puede eliminarse.
   La falta actual de una cuenta no se presenta como garantía de quiescencia.
2. Un correo Unicode permitido por la ficha puede exceder512 bytes en JSON.
   El límite se elevó a2048, manteniendo el cuerpo acotado; prueba específica añadida.

Sin hallazgos abiertos ni scope creep en el candidato corregido. El orden advisory
de pagos→ficha→job coincide con escritores, y FK inesperada revierte toda la función.
Confirmación, cancelación, estado obsoleto, protección de historial, idempotencia y
error incierto corresponden al encargo. Evidencia nueva49/49 PASS examinada.

Standards: **0 abiertos**. Spec: **0 abiertos,2 corregidos**. Aceptado localmente para
integración, sujeto a CI y registro separado de migración/publicación alojadas.
