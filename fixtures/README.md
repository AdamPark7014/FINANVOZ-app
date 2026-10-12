# fixtures/

Datos de prueba que funcionan como **contrato** de la implementación. Las pruebas los cargan por `id` o por ruta; nunca se copian dentro de los archivos de prueba.

| Archivo | Qué contiene | Quién lo consume |
|---|---|---|
| `motores/oraculo.py` | Implementación de referencia independiente (Python ≥ 3.10, solo biblioteca estándar) de los motores de `docs/05-MOTORES.md` | `node scripts/oraculo.mjs --verificar` (CI y `/verificar`) |
| `motores/vectores.json` | Salida del oráculo (versión 3): E1, E3–E16, resolutor de cuentas y economía unitaria | `packages/core`, `packages/nlu`, `packages/fiscal` |
| `nlu/contexto.json` | Usuario ficticio con espacio personal y de negocio (cuentas, alias, contactos, catálogos, fechas) | `packages/nlu` (eval y resolutor) |
| `nlu/esquema.json` | JSON Schema de `Interpretacion`; debe coincidir con el esquema Zod | `packages/nlu`, `services/proxy` |
| `nlu/golden.jsonl` | 144 frases en español de México con la interpretación esperada; `reglas: true` marca las 16 que el nivel 0 debe resolver | `pnpm eval:nlu` |
| `notificaciones/plantillas.ejemplo.json` | Plantillas **sintéticas** de tres bancos y una terminal de cobro ficticios | Motor de plantillas |
| `notificaciones/ejemplos.jsonl` | 12 notificaciones sintéticas (personal) con su interpretación esperada | Motor de plantillas, escenario `e-captura` |
| `notificaciones/negocio.ejemplos.jsonl` | 2 notificaciones de la terminal de cobro (espacio negocio) | Motor de plantillas, escenario `e-negocio` |
| `plantillas-firmadas/` | Copia congelada de plantillas firmada con Ed25519 (llave **pública** de prueba de RFC 8032) y `kat.json` | Verificación de plantillas remotas (M10) |
| `respaldo/` | Archivo de respaldo de ejemplo, su versión alterada y `kat.json` (scrypt + AES-256-GCM), verificados con Python y Node | Respaldo cifrado (M9) |
| `cfdi/*.xml` | 9 CFDI **sintéticos** (8 versión 4.0 y uno 3.3 que debe rechazarse) | E13: lectura de CFDI y deducciones (M12) |
| `escenarios/*.json` | Estados de usuario para cargar en la app de desarrollo y verificar pantallas: `e4-01`, `e5-10`, `e-captura`, `e-negocio` | Cargador de semillas de `apps/movil` |

## Cómo usar los vectores

- Dinero en centavos; fechas `YYYY-MM-DD`; porcentajes en puntos base.
- Cada vector tiene `id`. Una prueba por vector, con el `id` en el nombre de la prueba: `it('E4-01 · escenario de la maqueta', …)`.
- Probabilidades y similitudes: tolerancia `1e-6`; en E8 se comparan además `exitos` exactos (el algoritmo y el orden de llamadas al PRNG están especificados) y, cuando existe, `probabilidad_analitica` con su `tolerancia`.
- El vector E8-22 tarda unos segundos: márcalo como prueba lenta, no lo omitas.
- E13 usa `config_prueba` y `tarifa_prueba`: parámetros **sintéticos** para probar la lógica. Los valores fiscales reales viven en `config/fiscal/<año>.json` y los valida un contador (M12).

## Cargador de escenarios (`escenarios/*.json`)

- Crea las cuentas con sus alias y, para cada una, una transacción `saldo_inicial` con fecha `hoy − 1` contra `capital:saldos_iniciales`. En tarjetas, `saldo` es deuda (positiva en el archivo, pasivo en el libro). En contactos, `te_debe` crea el saldo de la cuenta por cobrar.
- Crea el ingreso recurrente como programado con `define_horizonte = 1` y marca como cubierta la ocurrencia `ultimo_recibido`.
- Crea cada elemento de `compromisos_unicos` como programado de egreso con regla `{ "tipo": "unica", "fecha": … }` (sus ocurrencias quedan pendientes).
- `espacios` (solo `e-negocio`): crea cada cuenta en su espacio (con `comision_bp` si la trae). `ventas_registradas` y `gastos_registrados` crean, en la cuenta indicada, una venta (`ingreso` `ventas`) y un gasto por periodo, fechados el último día del periodo (el periodo en curso, `hoy − 1`), para que E15 tenga base. En las cuentas con movimientos registrados, el saldo inicial se fecha el primer día del periodo más antiguo y vale `saldo − ventas + gastos`, de modo que al terminar de cargar el saldo es el del archivo (`esperado.carga`).
- `captura`: fija la lista blanca de paquetes y, si la prueba lo pide, inyecta las notificaciones del archivo indicado en la cola del módulo de captura (sin `adb`).
- Fija el reloj de la app en `hoy` (solo builds de desarrollo).
- `esperado` dice qué debe verse en pantalla o quedar en el libro.

## Notificaciones con `adb` (builds de depuración)

`adb shell cmd notification post -S bigtext -t '<título>' <banco_id> '<texto>'` publica desde `com.android.shell` con la etiqueta `<banco_id>`; el build de depuración la trata como si viniera del primer paquete de ese banco en `plantillas.ejemplo.json` (`docs/07-CAPTURA.md §2.5`). Escapa `$` según tu shell.

## Cambiar un vector

1. Cambia la especificación en `docs/05-MOTORES.md`.
2. Cambia `motores/oraculo.py`.
3. Regenera: `node scripts/oraculo.mjs --escribir` (o `python3 fixtures/motores/oraculo.py --escribir`; en Windows `py -3`).
4. Registra la decisión en `docs/ESTADO.md`.

Nunca edites `vectores.json` a mano. `--verificar` compara como JSON, así que funciona igual en Windows, macOS y Linux.
