# Registro de decisiones técnicas

Fecha: 2026-10-27. Todas las decisiones técnicas de esta entrega tienen estado
**PROPOSED** hasta la auditoría independiente. Implementar una propuesta local no
equivale a aceptarla.

| ID | Estado | Propuesta y motivo | Alternativas consideradas | Consecuencias |
| --- | --- | --- | --- | --- |
| D001 | PROPOSED | Next.js App Router, React y TypeScript estricto; composición en servidor y cliente solo para apariencia. | SPA separada; más capas de infraestructura. | Una sola aplicación, sin contratos de datos anticipados. |
| D002 | PROPOSED | CSS nativo con variables de tema. Evaluar Tailwind actual sin incorporarlo en esta pantalla pequeña. | Tailwind, propuesto en el maestro; CSS-in-JS. | Menos dependencias y compilación de estilos; reversible al ampliar componentes. |
| D003 | PROPOSED | Lettering SVG geométrico trazado de la referencia, identificado como provisional. | Tipografía genérica (no cumple); recorte del original. | Comparación visual obligatoria; maestro vectorial aún no disponible. |
| D004 | PROPOSED | Claro, oscuro y preferencia del sistema; persistir únicamente apariencia en el navegador. | Tema fijo; almacenamiento del lado servidor. | Sin datos personales ni credenciales; funcionamiento aun sin almacenamiento disponible. |
| D005 | PROPOSED | Playwright sobre build de producción, axe y verificaciones documentales. | Pruebas solo de componentes. | Verifica recursos, navegación y responsive reales; no certifica móviles físicos. |

## Contratos de producto preservados

Los requisitos aprobados son los del [maestro](../product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md),
no decisiones técnicas aceptadas por este ejecutor. Mantener una identidad por
alumno, alta administrativa por DNI/email o ambos, contraseña temporal individual
y cambio obligatorio; pagos parciales con historial trazable y confirmación
administrativa de comprobantes; un email un día antes del vencimiento en
America/Argentina/Buenos_Aires; una nota principal por alumno con borrador y
publicación; estructura opcional y resultados persistentes; videos reutilizables;
PWA instalable y lectura offline de rutinas. Ninguno se implementa en CUEVA-001A.

La integración de DNI sin email con Supabase Auth requiere investigación posterior:
no se elige un mecanismo, no se fabrican emails ni directorios públicos de DNI.

## Cambios de alcance

- 2026-10-27: el encargo actualizado incorpora el maestro V1 y protocolo V2 íntegros,
  ambos temas y el backlog vigente. Sustituye las hipótesis del prompt histórico.
- 2026-10-27: instrucción posterior del usuario: continuar CUEVA-001A localmente;
  Supabase NOT_VERIFIED y sin nuevas tentativas de acceso remoto al servicio.
- Futuras modificaciones: agregar fecha, fuente, motivo y efecto sobre requisitos;
  nunca editar silenciosamente las copias originales.
