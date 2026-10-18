# @cartera/nlu

Esquema Zod, resolutor, nivel 0 (reglas) y cliente del intérprete (`docs/06-NLU.md`). El LLM interpreta; no calcula ni escribe en la base.

Golden set y contexto: `fixtures/nlu/`. Umbrales y comparación por campo: `docs/06-NLU.md` §8. Benchmark en la nube y grabaciones: `services/proxy/README.md`.

> **Tip eval (pwsh):** desde la raíz del monorepo en Windows, la CLI va con `pnpm eval:nlu` (delega en este paquete). La salida va a **consola** (ids, campos y agregados; nunca el texto dictado ni montos — regla 9):
>
> ```powershell
> Set-Location C:\dev\apps\FINANVOZ-app
> pnpm eval:nlu --nivel reglas
> pnpm eval:nlu --offline
> # Nube (llaves solo en el entorno; nunca en el repo):
> $env:ANTHROPIC_API_KEY = '<tu llave>'
> pnpm eval:nlu --nivel nube --proveedor anthropic --limite 3
> # Igual con openai + OPENAI_API_KEY o google + GOOGLE_API_KEY.
> # Contra el proxy desplegado o `supabase functions serve nlu-interpretar`:
> $env:NLU_PROXY_URL = 'https://…/functions/v1/nlu-interpretar'
> $env:NLU_PROXY_JWT = '<access_token>'
> pnpm eval:nlu --nivel nube --proveedor anthropic --limite 3
> ```
>
> **Nivel reglas:** líneas `Cobertura` / `Precisión` y lista `sin cubrir` o `incorrecto: <id>`. **Nube u offline:** bloque alineado con `formatearReporte` (aciertos por campo vs umbral, latencia p50/p95, tokens, costo si hay precio en `config/nlu/precios.json`, `incorrecto: <id>`). Código de salida 0 = pasa umbrales (offline sin grabaciones también sale 0 con aviso). Detalle: cabecera de `scripts/eval-nlu.ts`.

## Pruebas

`pnpm --filter @cartera/nlu test` (Vitest, proyecto del workspace). Reglas contra golden: `pnpm eval:nlu --nivel reglas`.
