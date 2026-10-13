---
name: hito
description: Ejecuta un hito del roadmap de Cartera (M0 a M16) indicado por su id.
argument-hint: "[M0 … M16]"
disable-model-invocation: true
---

# Ejecutar el hito $ARGUMENTS

Si no hay id o no es uno de M0 a M16, detente y pide uno. No sigas sin id válido.

## Reglas que no se pierden (léelas aunque el contexto se compacte)

- `docs/ESTADO.md` es la memoria del trabajo: plan, decisiones, criterios verificados y pendientes. Actualízalo en cada paso, no al final.
- Si $ARGUMENTS ya está "En curso" en ESTADO, **retoma** desde su plan y sus criterios pendientes; no empieces de cero.
- Solo el alcance de "Entra" del hito. Lo que falte fuera de alcance va a ESTADO → Pendientes.
- Reglas no negociables de `CLAUDE.md`. Ante una ambigüedad: la opción más conservadora para el usuario, registrada en Decisiones.
- Pruebas primero con los vectores de `fixtures/` (un caso por `id`).
- Trabaja directo en `main` (`git pull --rebase origin main` antes de empezar); no crees ramas, worktrees ni PR. Commits pequeños con Conventional Commits en español, cada uno con `/verificar` en verde; después `git pull --rebase origin main` y `git push origin main`.

## 1. Preparar

1. Lee `docs/09-ROADMAP.md`, sección **$ARGUMENTS**, completa: objetivo, spike previo, bloqueantes, qué entra, qué no entra y criterios `CA-$ARGUMENTS-NN`.
2. Lee `docs/ESTADO.md`. Si el hito anterior del que depende no está cerrado (o saltado con motivo), **detente** y dile al usuario cuál falta.
3. Si el hito tiene una condición de arranque (M11, `docs/10-NEGOCIO.md §1`), verifícala con lo registrado en ESTADO; si no se cumple o no hay datos, pregunta al usuario antes de seguir.
4. Lee solo las secciones de especificación que el hito referencia (`docs/0X-*.md §…`) y los fixtures que usan sus criterios.

## 2. Planear

1. Si el hito tiene spike previo, hazlo primero, con el límite de tiempo indicado, y registra el resultado en ESTADO.
2. Escribe en `docs/ESTADO.md`, bajo el hito, un plan corto: tareas en orden, archivos que se crean o cambian, prueba por criterio, riesgos y bloqueantes externos.
3. Marca el hito "En curso" con la fecha en el tablero.
4. Muestra el plan al usuario y **espera su aprobación** si el hito toca código nativo, el esquema de una base ya publicada, dependencias mayores nuevas, servicios con costo o cuentas que el usuario debe crear; si no, continúa.

## 3. Implementar

Orden: tipos → pruebas (vectores cargados por `id`) → implementación → integración → UI.

- Respeta las reglas no negociables de `CLAUDE.md`.
- Commit al terminar cada tarea del plan, con `/verificar` en verde.
- Si necesitas una cuenta, una llave o una acción del usuario (por ejemplo, Supabase o Play Console), prepara todo lo demás, deja los pasos exactos en ESTADO → Pendientes y pídeselo.

## 4. Verificar

1. Corre `/verificar` hasta que pase completo. Si no está disponible, corre sus comandos directamente: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `node scripts/oraculo.mjs --verificar`, `pnpm eval:nlu --nivel reglas` (desde M1) y `pnpm eval:nlu --offline` (desde M3).
2. Recorre cada criterio `CA-$ARGUMENTS-NN` y anota en `docs/ESTADO.md` cómo se verificó (nombre de la prueba, comando o pasos manuales) y el resultado. Un criterio que requiere dispositivo físico, una cuenta o una persona externa (abogado, contador) se marca **"pendiente de verificación manual"** con los pasos exactos.
3. Si el comportamiento cambió respecto a `docs/`, actualiza la especificación en el mismo commit.

## 5. Cerrar

Reporta al usuario en este orden: qué quedó funcionando; criterios cumplidos y pendientes de verificación manual (con pasos); decisiones tomadas; pendientes; siguiente hito sugerido. Marca el hito como cerrado en `docs/ESTADO.md` solo si todos sus criterios están cumplidos o el usuario aceptó explícitamente los pendientes.
