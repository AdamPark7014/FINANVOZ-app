# Grabaciones del nivel nube

Respuestas reales de los proveedores de LLM al golden set (`../golden.jsonl`), para reproducir el reporte de `docs/06-NLU.md §8` sin red ni llaves: `pnpm eval:nlu --offline` (CA-M3-06, corre en CI).

Se escriben **solo** con `--grabar` (golden set completo, sin `--limite`):

```
ANTHROPIC_API_KEY=... pnpm eval:nlu --nivel nube --proveedor anthropic --grabar
OPENAI_API_KEY=...    pnpm eval:nlu --nivel nube --proveedor openai --grabar
GOOGLE_API_KEY=...    pnpm eval:nlu --nivel nube --proveedor google --grabar
```

Las llaves van solo en el entorno de quien corre el benchmark; nunca en el repositorio (regla 8). Detalle en `services/proxy/README.md`.

## Formato

`<proveedor>/<modelo>.jsonl`, una línea por caso, ordenadas por id:

```json
{"id":"G01","proveedor":"anthropic","modelo":"claude-haiku-5-5","codigo":"ok","interpretacion":{"intencion":"registrar","movimientos":[…]},"tokens_entrada":2300,"tokens_salida":90,"latencia_ms":840}
```

| Campo | Significado |
|---|---|
| `id` | Id del caso del golden set. No se guarda el texto. |
| `codigo` | `ok`, `reintento_validacion` (pasó al segundo intento con el error de Zod), `no_entendi` (dos respuestas inválidas) o el error (`proveedor_fallo`, `tiempo_agotado`, `red`, …). |
| `interpretacion` | La salida ya validada con Zod (o `aclarar/no_entendi`); `null` si hubo error. |
| `tokens_entrada`, `tokens_salida` | Del proveedor (la entrada incluye los tokens leídos de la caché). |
| `latencia_ms` | Tiempo total del caso, reintentos incluidos. |

El costo por caso completo correcto usa `config/nlu/precios.json`.

Las frases y montos son los del golden set (ficticios); no hay datos de usuarios. Sin archivos aquí, `--offline` termina con éxito y avisa "sin grabaciones".
