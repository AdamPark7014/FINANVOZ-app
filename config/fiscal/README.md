# Parámetros fiscales por ejercicio

Un archivo por año: `config/fiscal/<año>.json`. Es la **única** fuente de tasas, topes, tablas RESICO y reglas de deducciones que consumen E13 y E15 (regla 13 de `CLAUDE.md`: nada de valores fiscales en código).

> **Tip lectura:** montos en **centavos** enteros (`11731` = $117.31 UMA diaria); porcentajes en **puntos base** (`1600` = 16,00 % IVA, `192` = 1,92 % en tarifa ISR). La forma del JSON es la de `docs/10-NEGOCIO.md` §5; el validador puro es `validarConfigFiscal` en `packages/core/src/fiscal/config.ts`.

## Marcadores y estado

| Campo | Significado |
|---|---|
| `"POR_DEFINIR"` | Falta valor que debe llenar un contador público. Mientras exista uno, `validarConfigFiscal` lanza `config_fiscal_incompleta` y el mensaje lista rutas (`camposPorDefinir`). |
| `estado: "por_validar"` | Archivo revisable en repo; la app **no** usa estos parámetros para calcular deducciones ni RESICO en producción. |
| `estado: "validado"` | Tras firma del contador en `docs/ESTADO.md` (CA-M12-06). Solo entonces `cargarConfigFiscal` en la app devuelve `{ estado: 'lista', config }`. |

La app importa el JSON en build (`apps/movil/src/servicios/config-fiscal.ts`). En pruebas se sustituye con `ctx.configFiscal` (config sintética de vectores, marcada `validado` solo en el test). **No** copies `E13.config_prueba` al archivo del ejercicio: es sintético (`fixtures/README.md`).

## Cómo comprobar un cambio (sin publicar cifras)

1. Parsear el JSON y llamar `validarConfigFiscal(datos, ejercicio)`.
2. Si falla `config_fiscal_incompleta`, las rutas pendientes deben coincidir con los pendientes 90–93 de `docs/ESTADO.md` (prueba en `packages/core/src/fiscal/config.test.ts`).
3. Cuando el contador complete valores y ponga `estado: "validado"`, registrar en **Decisiones** nombre, cédula, fecha y SHA-256 del archivo (`docs/08-CUMPLIMIENTO.md`, `docs/LANZAMIENTO.md`). La app **no** verifica ese hash en runtime (skip automático): es trazabilidad humana, no un check del cargador.

### SHA-256 del archivo (solo registro)

Windows (PowerShell, desde la raíz del repo):

```powershell
(Get-FileHash -Algorithm SHA256 "config/fiscal/2026.json").Hash.ToLowerInvariant()
```

Linux / macOS:

```bash
sha256sum config/fiscal/2026.json
```

## Archivos

| Archivo | Notas |
|---|---|
| `2026.json` | `por_validar`; pendientes 90–93. No inventar tasas en código ni en blogs sin validar contador + INEGI (`10 §5`). |
