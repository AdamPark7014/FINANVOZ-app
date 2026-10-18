# Scripts de `movil` (Node + `tsx`)

Utilidades de desarrollo y CI local. La app en el teléfono no ejecuta estos archivos.

| Script npm | Archivo | Para qué |
|---|---|---|
| `semilla` | `semilla.ts` | Carga un escenario de `fixtures/escenarios/<id>.json` y muestra Hoy junto al `esperado` |
| `migraciones` | `generar-migraciones.ts` | Genera SQL de migraciones Drizzle |
| `secretos` | `buscar-secretos.ts` | Barrido de secretos antes de exportar |

> **Tip semilla (PowerShell):** desde la **raíz del repo** (donde está el `package.json` del workspace), con dependencias instaladas:

```powershell
pnpm --filter movil semilla e4-01
pnpm --filter movil semilla e14-01
```

- **Ids válidos:** los JSON en `fixtures/escenarios/` (`e4-01`, `e5-10`, `e-captura`, `e14-01`, `e-negocio`, …). Solo `[a-z0-9-]`.
- **Salida:** JSON en stdout con `hoy_puedes_pesos`, `texto_dias`, `desglose` y el bloque `esperado` del fixture. Úsalo para cotejar pantalla Hoy sin abrir la app.
- **Base local:** escribe `apps/movil/.semillas/<id>.db` (better-sqlite3, llave en memoria, datos sintéticos). En el teléfono el build de desarrollo carga el mismo JSON con `cargarEscenario` sobre la base cifrada (Ajustes → tocar 7 veces la versión → escenario, o ver `docs/tienda/capturas.md`).
- **Git / hash — omitir:** esos `.db` entran en el patrón `*.db` del `.gitignore` de la raíz; no los commitees ni compares por hash de archivo. La comprobación es el JSON impreso frente a `esperado`, no el binario de SQLite.
- **Typecheck — omitir para el CLI:** `scripts/` no está en el `include` de `apps/movil/tsconfig.json`; `pnpm --filter movil semilla` corre con `tsx` aunque `pnpm --filter movil typecheck` siga rojo por otros archivos. No confundir con `src/servicios/semilla.ts` (servicio de la app; sus errores de tipos son independientes del script).

Detalle del formato de escenarios: `fixtures/README.md` (§ Cargador de escenarios).
