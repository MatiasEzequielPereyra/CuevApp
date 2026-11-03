# CUEVA-002K — bootstrap privado con SDK, REVIEW local

Prueba acotada para [el script aislado](../../scripts/bootstrap-invitation.mjs) y
[el procedimiento one-off](../../docs/engineering/CUEVA-002K-bootstrap.md).
No modifica app, hooks, dependencias, CI ni migración. No requiere conexión
privilegiada a base para ejecutar el bootstrap; el SQL del laboratorio sirve solo
como observador/fixture de su base descartable, no como camino del script K.

Con Docker activo, Node 22, dependencias de raíz y Chromium, desde esta carpeta:

```sh
node lab.mjs
```

Reutiliza el arranque Next de J y sus mismas imágenes fijadas. Crea únicamente
red/contenedores `cueva-002k-*`, puertos loopback, plantillas privadas y datos
sintéticos; `finally` elimina sus recursos sin tocar otros proyectos.

[Evidencia redactada](evidence.json): dry-run sin llamadas fetch; check de
servicio/inventario vacío sin correo; rechazo de proyecto y build incorrectos
antes de red; invitación más RPC; segunda ejecución detenida sin reenvío;
inventario posterior sin mutación; href realmente renderizado abierto literalmente;
contraseña propia y perfil alumno; cero administradores promovidos. Los últimos
seis PASS corresponden a limpieza. No se afirma atomicidad entre canales.

La CLI no acepta modo local: únicamente el test importa la función con destinos
127.0.0.1. Apply CLI requiere metadatos Production/proyecto/SHA exactos. No hay
configuración remota ni correo/cuenta reales. One-off Vercel, Secret real, Gmail
y aceptación alojada **NOT_RUN**. El plan remoto exige capturar y restaurar
`buildCommand:null` inmediatamente porque el override API puede persistir; esa
restauración y su verificación tampoco se ejecutaron aquí. El repo no cambia su
build normal y el acceso sigue cerrado hasta decisión separada del Orchestrator.
