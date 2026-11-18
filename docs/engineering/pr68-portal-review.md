# PR #68 — fecha SSR y foco tras cerrar el video

Estado de implementación: REVIEW; CI del HEAD final se registra en el PR.
Base inicial del portal: `38420710c4cdfb1e5a82ecce5fa13cdbf473c508`.
La entrega incorpora también el main con #64 antes de publicar el candidato.

## Hidratación

Se conserva `StudentPageHeading`, la composición `student-notifications` y los
estilos publicados. `Notificaciones` calcula `created_at_label` en el servidor;
el componente cliente representa ese valor sin volver a ejecutar Intl ni
suprimir advertencias de hidratación.

La regresión usa Next y el componente reales con respuestas sintéticas. Cambia
deliberadamente el formateador del navegador, conserva el texto del servidor y
verifica la interacción de marcar leído después de hidratar, sin errores.

## Causa demostrada del foco

El registro histórico de CI sólo indicaba `inactive`; no identificaba el
elemento activo. El repro controlado conserva el componente real y fuerza una
intercalación posible: cierre nativo del diálogo, foco solicitado en Empuje y
entrega posterior del evento `close`. No depende de acertar un retardo.

[Antes](../../evidence/reviews/pr68-focus-before.json): la página mantiene
`document.hasFocus() = true`. El cierre nativo restaura Press militar; el
llamador enfoca Empuje; `close` observa Empuje; el handler vuelve a enfocar
Press militar. Tab termina en el host `NEXTJS-PORTAL` del entorno de desarrollo,
en lugar de Tirón. La aserción `toBeFocused()` de Tirón falla.

[Después](../../evidence/reviews/pr68-focus-after.json): el mismo escenario
conserva el foco solicitado y Tab/Enter llegan y activan Tirón. El handler limpia
la reproducción siempre, pero sólo restaura foco/scroll cuando el foco todavía
está en el diálogo, su disparador o el documento sin otro control activo.
El cierre ordinario sigue restaurando el ejercicio y su posición.

Esto acredita la carrera del componente, sin afirmar que el registro histórico
de CI demuestra por sí solo esa misma intercalación. No se eliminó la aserción
original ni se aumentaron sus tiempos de espera.

## Verificación y límites

- Repro controlado: FAIL antes de la corrección; tres corridas PASS después.
- Dos regresiones de fecha/foco PASS con Chromium y respuestas sintéticas.
- Ensayo original con Auth, PostgreSQL, Storage y Chromium reales: seis
  combinaciones de ancho/tema, video privado reproducido y foco/scroll PASS;
  acceso SQL/Storage aislado PASS.
- WebKit local quedó detenido en `video.readyState = 0` con los videos de prueba
  VP8 y VP9; no se declara PASS. La corrida Linux de CI, que genera su propio
  video, conserva íntegra la prueba de ambos navegadores y es requisito del HEAD.
- El ensayo acepta `CUEVA_PRODUCT_ORIGIN` de loopback para usar un puerto libre;
  el valor predeterminado y la secuencia/aserciones existentes de CI se conservan.

No hay cambios en permisos, contratos HTTP o esquema. No se utilizaron cuentas,
correos o datos reales. Los resultados finales de lint, tipos, build, fuentes,
seguridad y CI se registran en el PR con su HEAD exacto.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`, `diagnosing-bugs`,
`resolving-merge-conflicts`, `vercel:react-best-practices`,
`cueva-supabase-security`, `supabase:supabase`, `cueva-acceptance-audit`,
`code-review` y `pr`. SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías
del host. La integración y publicación quedan a cargo del Orchestrator.
