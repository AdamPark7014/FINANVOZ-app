---
name: verificar
description: Corre las verificaciones del repositorio de Cartera (lint, tipos, pruebas, oráculo de vectores y evaluación del intérprete). Úsala antes de cada commit y al cerrar un hito.
allowed-tools: Bash(pnpm *) Bash(node scripts/oraculo.mjs *)
---

# Verificar el repositorio

Corre en este orden. Al primer fallo: arréglalo y vuelve a empezar desde el paso que falló. Si un comando todavía no existe porque el hito que lo crea no se ha hecho, márcalo como "no aplica aún" y sigue.

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `node scripts/oraculo.mjs --verificar` — compara el oráculo con `fixtures/motores/vectores.json` como JSON. Si falla, alguien cambió el oráculo o los vectores a mano: no edites `vectores.json`; regenera con `--escribir` solo si el cambio de especificación está registrado en `docs/ESTADO.md`. Si no hay Python 3.10+, el script lo dice: repórtalo como "no aplica en esta máquina (falta Python)" y recuerda que CI sí lo corre.
5. `pnpm eval:nlu --nivel reglas` (desde M1) — cobertura 25/25 y precisión 100 %.
6. `pnpm eval:nlu --offline` (desde M3).

Reporta una tabla corta: paso, resultado (pasa / falla / no aplica aún) y, si falló, la causa en una línea.
