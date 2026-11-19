# CUEVA-CI-FIXTURES-001 — REVIEW

## Encargo y límites

Corrección común de aislamiento/lifecycle de fixtures. Sin código de producto,
permisos, SQL, dependencias, despliegue ni cambios alojados. El Orchestrator
aplica sus migraciones por separado. La base y el HEAD definitivos figuran en el
PR, luego de actualizar sobre main que incluye #63.

## Causas demostradas

La corrida [44373715105](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44373715105)
mostró dos fallos relacionados:

1. La traza de `student-plan-focus` contiene «No pudimos cargar tu rutina» y una
   espera de click en Empuje. El mock carecía de ID de publicación y documento
   lateral; #67 rechaza correctamente ese estado. Se completan los datos sintéticos
   para representar una publicación por bloques consistente, sin cambiar producto.
2. Mientras el servidor 3235 seguía ocupado con ese caso, Alumnos intentó iniciar
   otro Next en 3234. Ambos usaban el proyecto y `.next/dev/lock` compartidos: el
   segundo salió1. En una reproducción mínima, mantener un Next sano en3264 e
   iniciar otro en3265 reprodujo la misma salida1 en siete segundos.
3. Al agotarse el tiempo, el `finally` intentaba consultar una página ya cerrada,
   reemplazando el error original por `page.evaluate: Target page ... closed`.

Se contrastaron directorio compartido, puertos y procesos sin cerrar: distintos
puertos con el primer servidor sano fallan antes del arreglo; los mismos puertos
con proyectos propios funcionan. No se deshabilita el lock de Next.

## Cambio acotado

Cada llamada a `startStudentsApp` crea un directorio aleatorio propio dentro de
`.next/fixture-apps`. Copia exactamente `src`, `public`, `package.json`,
`tsconfig.json` y `next.config.ts`; mantiene el cwd del repositorio para resolver
los recursos y dependencias existentes. Next escribe lock, caché, tipos y
`next-env.d.ts` dentro de su proyecto copiado. No se copia `.env`, `node_modules`
ni datos del laboratorio. La configuración y las fuentes de la aplicación no se
modifican. La fixture usa una instantánea del código, sin hot reload de ediciones
que ocurran después de arrancarla.

El cierre es idempotente, espera la salida del proceso propio y, si no termina,
lo fuerza a los cinco segundos. Después retira solo su directorio validado dentro
del padre reservado; nunca elimina el build principal ni directorios ajenos.
Un fallo de bind produce salida1 y se limpia al cerrar la fixture; no adopta el
servidor que ya está escuchando. Los puertos fijos del mismo test siguen requiriendo
`--workers 1` al usar `--repeat-each`.

La captura de foco es best-effort y adjunta su error si falta la página. Si incluso
falla ese adjunto, conserva el error original. El arranque de foco comprueba salida
prematura como Alumnos. No se cambian timeouts, aserciones de foco, Tab/Enter,
selección, formato ni cobertura de los tests existentes.

## Pruebas y reproducción

`npm run test:fixtures` ejecuta la regresión nativa con dos Next reales y servicios
HTTP sintéticos distintos. Comprueba coexistencia, identidad de backend, headers
reales del config, archivos generados aislados, puerto ocupado, limpieza tras
fallo, doble cierre, supervivencia del segundo servidor, reinicio y ausencia de
cambios en `tsconfig.json` y `next-env.d.ts` originales. También comprueba por
identidad que el error original sobrevive a página cerrada y fallo del adjunto.
Se incorpora antes de las pruebas habituales en `npm test`.

La reproducción original fue roja; la regresión de coexistencia/lifecycle es verde.
Tipos, lint, build, documentos, fuentes/manifiesto y escaneo de seguridad se
verifican de nuevo. Las pruebas reales existentes de foco y Alumnos se ejecutan
juntas con dos workers. Los resultados finales y las corridas CI del HEAD exacto
figuran en el PR; no se reutiliza evidencia histórica como si fuera nueva.

## Integración y limpieza

Integrar este PR común primero; actualizar #67 y #63 desde ese main y revalidar
las pruebas combinadas afectadas. No cherry-pick de cambios de producto dentro de
este arreglo. #67 tiene correcciones funcionales independientes en curso.
Las fixtures cierran sus procesos y servicios, y eliminan sus proyectos propios.
Puede quedar el padre vacío `.next/fixture-apps`; no contiene un servidor vivo.
No se opera Docker ni se modifica el checkout activo del Orchestrator.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-acceptance-audit`, `diagnosing-bugs`, `code-review`, `pr`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md`, guías del host y documentación
Next instalada `custom-server.md` / `distDir.md`.
