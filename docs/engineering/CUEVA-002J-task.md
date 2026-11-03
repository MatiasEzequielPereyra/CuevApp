# CUEVA-002J — Preparación operativa del acceso

Siguiente incremento acotado sobre el candidato I aceptado apagado. Preparar un
paquete reproducible y revisable para correo, primer administrador y recuperación
de operaciones interrumpidas. Sin habilitar producción ni crear usuarios reales.

## Alcance y aceptación

- Versionar las dos plantillas exactas. Probar el correo realmente renderizado
  por GoTrue local con RedirectTo, nonce, generación y token_hash, sin traducir
  enlaces en la prueba. Verificar preservación de parámetros y ruta permitida.
- Preparar un procedimiento/script administrativo con dry-run por defecto,
  proyecto/origen exactos y credencial solo por entorno. Probar invitación y
  promoción del primer admin sintético sobre el flujo I, sin contraseña temporal,
  ni atajo público. Evitar duplicados y no repetir envíos ante resultado ambiguo.
- Documentar y probar una reconciliación controlada de una operación interrumpida,
  que exige comprobar ausencia de solicitudes anteriores en vuelo; sin timeout
  ni liberación automática. Distinguir lo que no se puede demostrar alojado.
- Incluir plan de aplicación de migración compatible, verificación de permisos,
  cuentas controladas y plan de desactivación de aplicación sin drops de datos.
- Mantener entrada del público apagada. Entregar checklist preciso de secretos
  que el usuario debe configurar directamente en Vercel, sin copiarlos al chat,
  repo, archivos persistentes o logs. No acceder a contraseñas del navegador.

Ejecutor: checkout existente o aislado autorizado, fuentes y Next docs pertinentes,
commit local, evidencia redactada y handoff REVIEW. Sin push, cambios alojados,
cuentas/correos reales, infraestructura nueva ni manipulación de Vendify.
El Orchestrator audita antes de integrar y decide cualquier aplicación separada.

Modelo recomendado: modelo heredado con razonamiento alto; alternativa según
disponibilidad. Complejidad alta, riesgo de seguridad alto; trabajo acotado sobre
el mecanismo ya elegido para evitar otro cambio de proveedor.
