# @cartera/fiscal

E13.1 · Lectura de CFDI 4.0 (M12): `parsearCfdi`, `decimalACentavos` (`docs/05-MOTORES.md` §E13). Sin React, sin Expo, sin red.

El **cálculo** de deducciones, ISR y ahorro estimado vive en `@cartera/core` (`packages/core/src/fiscal/`). Este paquete solo normaliza el XML a `CfdiLeido`.

> **Tip config fiscal:** aquí **no** se lee `config/fiscal/<año>.json`. Tras parsear un CFDI, core recibe un `ConfigFiscal` ya pasado por `validarConfigFiscal` y con `estado: "validado"`. Las pruebas de este paquete usan vectores `E13.parsear` y `E13.decimal_a_centavos` en `fixtures/motores/vectores.json`; no necesitan el JSON del ejercicio. Para deducciones e ISR, inyecta config sintética (`E13.config_prueba`, `E13.tarifa_prueba`, `E15.config`) o `ctx.configFiscal` en la app. Cómo leer el archivo real: `config/fiscal/README.md`.

## Pruebas

`pnpm test` (Vitest en la raíz): `packages/fiscal/src/cfdi.test.ts`, un caso por archivo de `fixtures/cfdi/` según el vector `E13.parsear`.
