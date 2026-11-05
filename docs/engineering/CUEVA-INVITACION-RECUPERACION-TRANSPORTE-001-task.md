# CUEVA-INVITACION-RECUPERACION-TRANSPORTE-001

Fuente: ORCHESTRATOR_TO_CODEX_HANDOFF_V1 del usuario, 2026-11-05.
Antecedente auditado `db0835bce40ad9604c0e1c45db0109c4b7846e9c`, integrado
en PR26/main `67d44e2d954bd09af0ea821b718a8151cd9af28a`, migración aplicada
según el handoff. No reabrir identidad ni repetir la matriz66/66.

El Orchestrator observó conexión directa IPv6 sin TCP5432 desde este equipo,
y Session pooler oficial IPv4 con TCP5432 abierto. Adicionar únicamente:
aws-1-ca-central-1.pooler.supabase.com, puerto5432, SESSION,
usuario postgres.vbkzoojkdkcugxhneyzi, base postgres.

Mantener pg.Client de sesión, advisory y transacciones/locks, TLS verificado y
conexión directa admitida. Rechazar otro host/proyecto/usuario/puerto/base,
transaction6543, comodines y opciones de URL inesperadas o que alteren TLS/destino.
No modificar reserva, nonce, generaciones, evidencia, Auth, ledger, flags ni envío.

Actualizar operación IPv4 y suministro privado de las dos credenciales existentes:
clave de base y clave de servicio, distintas de la clave de aplicación Gmail.
Nunca pedirlas en chat, ponerlas en argumentos/historial/logs/archivos versionados,
ni exportar/descifrar la credencial sensible de Vercel. Captura interactiva segura
local es opcional si hiciera falta para la operación del Orchestrator.

Validación acotada de destinos/TLS/usuario/puerto y continuidad de sesión durante
operación. Solo laboratorio necesario, lint/tipos/fuentes/seguridad/docs/diff;
build únicamente si cambia runtime/configuración de app. TCP no prueba TLS/Auth/envío.

Sin push/PR/merge/deploy, migraciones o conexiones autenticadas remotas, envío real,
cambio de contraseña/SMTP/cuenta, extracción de secretos ni liberar review manualmente.
No editar/reaplicar la migración de PR26 ni el checkout del Orchestrator. Entregar
REVIEW con BASE_SHA, HEAD_SHA, rama, archivos, pruebas y árbol limpio.
