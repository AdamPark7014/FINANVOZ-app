# fixtures/

Datos de prueba que funcionan como **contrato** de la implementación. Las pruebas los cargan por `id` o por ruta; nunca se copian dentro de los archivos de prueba.

> **Tip:** nunca edites `motores/vectores.json` a mano; regenera con `node scripts/oraculo.mjs --escribir` (ver § Cambiar un vector y § Oráculo en PowerShell).

| Archivo | Qué contiene | Quién lo consume |
|---|---|---|
| `motores/oraculo.py` | Implementación de referencia independiente (Python ≥ 3.10, solo biblioteca estándar) de los motores de `docs/05-MOTORES.md` | `node scripts/oraculo.mjs --verificar` (CI y `/verificar`) |
| `motores/vectores.json` | Salida del oráculo (versión 3): E1, E3–E16, resolutor de cuentas y economía unitaria | `packages/core`, `packages/nlu`, `packages/fiscal` |
| `nlu/contexto.json` | Usuario ficticio con espacio personal y de negocio (cuentas, alias, contactos, catálogos, fechas) | `packages/nlu` (eval y resolutor) |
| `nlu/esquema.json` | JSON Schema de `Interpretacion`; debe coincidir con el esquema Zod | `packages/nlu`, `services/proxy` |
| `nlu/golden.jsonl` | 164 frases en español de México con la interpretación esperada; `reglas: true` marca las 135 que el nivel 0 debe resolver | `pnpm eval:nlu` |
| `nlu/golden-pasos.jsonl` | 104 frases dictadas en los pasos del onboarding con la lectura esperada (`docs/06-NLU.md §13`), incluidas las correcciones dichas en la tarjeta «Entendí» («son 12 mil»); `reglas: true` marca las 90 que el lector debe resolver y `esperado: null`, las que deben dar `null` | `pnpm eval:nlu --pasos` |
| `nlu/contexto-onboarding.json` | La persona en el onboarding, todavía sin cuentas | `pnpm eval:nlu --pasos` |
| `nlu/golden-confirmacion.jsonl` | 123 respuestas habladas a una tarjeta «Entendí» (`docs/06-NLU.md §14.1`): sí (`SI*`), no (`NO*`), cambios de fila (`CA*`: cuenta, monto, categoría, cuándo; con `tarjeta` para las filas que muestra y el tipo de movimiento) y 33 ambiguas con `esperado: null` (`NU*`), donde leer cualquier cosa es un error | `pnpm eval:nlu --confirmacion` (contra `nlu/contexto.json`) |
| `nlu/golden-conversaciones.jsonl` | 88 conversaciones de varios turnos (186 turnos: 80 primeros, 87 seguimientos y 19 de charla) en español de México (`docs/06-NLU.md §15`): cada turno con su `esperado` (una interpretación o `{ "charla": <tipo> }`) y se interpreta con el turno anterior (lo dicho y lo esperado); `reglas: true` marca los 183 que el nivel 0 debe resolver y `solo_reglas` los que solo resuelve el teléfono (la cuenta de «quítale 10») | `pnpm eval:nlu --conversaciones` (contra `nlu/contexto.json`) y `--nivel nube --conversaciones` |
| `nlu/golden-reparacion.jsonl` | 52 frases que el nivel 0 no entiende (`REP*`) con las opciones de «No entendí» en orden y la frase reescrita de cada una (`docs/06-NLU.md §14.2`); cada frase debe entenderla el nivel 0 como ese tipo con ese monto | `pnpm eval:nlu --reparacion` (contra `nlu/contexto.json`) |
| `notificaciones/plantillas.ejemplo.json` | Plantillas **sintéticas** de tres bancos y una terminal de cobro ficticios | Motor de plantillas |
| `notificaciones/ejemplos.jsonl` | 12 notificaciones sintéticas (personal) con su interpretación esperada | Motor de plantillas, escenario `e-captura` |
| `notificaciones/negocio.ejemplos.jsonl` | 2 notificaciones de la terminal de cobro (espacio negocio) | Motor de plantillas, escenario `e-negocio` |
| `plantillas-firmadas/` | Copia congelada de plantillas firmada con Ed25519 (llave **pública** de prueba de RFC 8032) y `kat.json` | Verificación de plantillas remotas (M10) |
| `respaldo/` | Archivo de respaldo de ejemplo, su versión alterada y `kat.json` (scrypt + AES-256-GCM), verificados con Python y Node | Respaldo cifrado (M9) |
| `sincronizacion/kat.json` | XChaCha20-Poly1305 (draft-irtf-cfrg-xchacha-03 §A.3.1) y el blob de un evento compartido, generados por `sincronizacion/kat.py` (Python sin dependencias, independiente de `@noble/ciphers`; `python3 fixtures/sincronizacion/kat.py` verifica) | Gastos compartidos (M16, E17) |
| `cfdi/*.xml` | 9 CFDI **sintéticos** (8 versión 4.0 y uno 3.3 que debe rechazarse) | E13: lectura de CFDI y deducciones (M12) |
| `pdf/generar.mjs` | Genera los estados de cuenta en PDF **sintéticos** de M15 y, de los mismos datos, su texto (`.txt`) y lo que debe leerse (`.json`); `--verificar` comprueba que los archivos coinciden byte a byte | `packages/core` (prueba) |
| `pdf/banco_{b,e,f}.pdf`, `.txt`, `.json` | Tres bancos ficticios: Banco B (42 movimientos en dos páginas, CA-M15-02), Banco E (dos fechas por renglón, abonos `CR`) y Banco F (fechas sin año, acentos, kerning); `banco_e.protegido.pdf` (contraseña `PRUEBA2026`) y `escaneado.pdf` (solo una imagen) | `nucleo-jvm` (PDFBox extrae el `.txt`), `packages/core` (CA-M15-01), `apps/movil` (CA-M15-02 y 03) |
| `pdf/analizadores.ejemplo.json` | Analizadores **sintéticos** de esos tres bancos (`07 §8`); solo en builds de desarrollo | `packages/core`, `apps/movil` |
| `escenarios/*.json` | Estados de usuario para cargar en la app de desarrollo y verificar pantallas: `e4-01`, `e5-10`, `e-captura`, `e14-01`, `e-negocio` | Cargador de semillas de `apps/movil` |

## Oráculo en PowerShell (Windows)

Usa PowerShell 7+ (`pwsh`) o la consola integrada; el comando es el mismo. Desde la **raíz del repo** (donde está `package.json`):

```powershell
node scripts/oraculo.mjs --verificar   # CI y /verificar
node scripts/oraculo.mjs --escribir    # solo tras cambio en 05-MOTORES + oraculo.py + ESTADO
```

- **`scripts/oraculo.mjs`** localiza Python ≥ 3.10 (`py -3`, luego `python` / `python3` en Windows). No hace falta llamar `py` a mano salvo depurar el oráculo directo: `py -3 fixtures/motores/oraculo.py --verificar`.
- **`--verificar` compara JSON parseado**, no el texto del archivo ni un hash del disco: CRLF/LF y espacios de formato no importan. No uses `diff`, `fc` ni `git diff` sobre `vectores.json` para decidir si coincide (ver `docs/ESTADO.md`, decisión 2026-10-11).
- **Reproducibilidad:** mulberry32 y FNV-1a en el oráculo dan los mismos bits que Node 22 en `packages/core`. Si una prueba de vector falla, corrige la implementación o el oráculo según `docs/05-MOTORES.md`; no parchees `vectores.json`.
- **Sin Python local:** puedes **omitir** el oráculo al cerrar tu turno y anotarlo; **CI no lo omite**. Si el script termina con el mensaje de Python no encontrado, instala 3.10+ desde [python.org](https://www.python.org/downloads/) o repite en la máquina que sí lo tenga.

## Semilla en PowerShell (escenarios de la app)

Desde la **raíz del repo**:

```powershell
pnpm --filter movil semilla e4-01
```

- Lee `fixtures/escenarios/<id>.json` y usa el mismo `cargarEscenario` que la app de desarrollo.
- Deja `apps/movil/.semillas/<id>.db` (**omitir en git:** cubierto por `*.db` en `.gitignore`; no uses hash del archivo para validar).
- Imprime JSON con Hoy y el `esperado` del escenario — compara esos campos, no el `.db`.
- El CLI vive en `apps/movil/scripts/` (`tsx`); no depende de que pase `pnpm --filter movil typecheck`. Más detalle: `apps/movil/scripts/README.md`.

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
- `gastos_e14` (`e14-01`): registra cada gasto con comercio desde la cuenta indicada (por omisión `efectivo`), con categoría `suscripciones` salvo comercios `OXXO*` en `antojos`, igual que un libro equivalente al vector E14-01. `catalogo_suscripciones` (opcional) fija el catálogo semilla de E14 en el contexto de desarrollo (`[]` reproduce E14-01).
- `espacios` (solo `e-negocio`): crea cada cuenta en su espacio (con `comision_bp` si la trae). `ventas_registradas` y `gastos_registrados` crean, en la cuenta indicada, una venta (`ingreso` `ventas`) y un gasto por periodo, fechados el último día del periodo (el periodo en curso, `hoy − 1`), para que E15 tenga base. En las cuentas con movimientos registrados, el saldo inicial se fecha el primer día del periodo más antiguo y vale `saldo − ventas + gastos`, de modo que al terminar de cargar el saldo es el del archivo (`esperado.carga`).
- `captura`: fija la lista blanca de paquetes y, si la prueba lo pide, inyecta las notificaciones del archivo indicado en la cola del módulo de captura (sin `adb`).
- Fija el reloj de la app en `hoy` (solo builds de desarrollo).
- `esperado` dice qué debe verse en pantalla o quedar en el libro.

## Notificaciones con `adb` (builds de depuración)

`adb shell cmd notification post -S bigtext -t '<título>' <banco_id> '<texto>'` publica desde `com.android.shell` con la etiqueta `<banco_id>`; el build de depuración la trata como si viniera del primer paquete de ese banco en `plantillas.ejemplo.json` (`docs/07-CAPTURA.md §2.5`). Escapa `$` según tu shell.

## Estados de cuenta en PDF (`pdf/`)

Nunca se suben estados de cuenta reales. Para cambiar un PDF sintético se cambian los datos de `pdf/generar.mjs` y se regenera con `node fixtures/pdf/generar.mjs`; el `.json` sale de los mismos datos, no del analizador. Para probarlo en el teléfono, comparte el PDF con Finanvoz desde Archivos (build de desarrollo, escenario `e5-10`: las tarjetas terminan en 8812, 4410 y 1022).

## Cambiar un vector

1. Cambia la especificación en `docs/05-MOTORES.md`.
2. Cambia `motores/oraculo.py`.
3. Regenera: `node scripts/oraculo.mjs --escribir` (o `python3 fixtures/motores/oraculo.py --escribir`; en Windows `py -3`).
4. Registra la decisión en `docs/ESTADO.md`.

Nunca edites `vectores.json` a mano. Prefiere siempre el wrapper `node scripts/oraculo.mjs` (§ Oráculo en PowerShell); `--verificar` compara como JSON en Windows, macOS y Linux.
