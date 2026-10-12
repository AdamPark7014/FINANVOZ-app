# 05 · Motores de cálculo

> Contrato de comportamiento de `packages/core`. Cada motor es una función pura: sin I/O, sin reloj, sin aleatoriedad implícita. Recibe `hoy` y, cuando aplica, `semilla`.
> Los vectores de prueba están en `fixtures/motores/vectores.json` (versión 3), generados por `fixtures/motores/oraculo.py`, una implementación independiente en Python. **Si tu implementación no reproduce un vector, el error está en tu implementación** salvo que demuestres lo contrario y lo registres en `docs/ESTADO.md`.
>
> Dónde vive cada motor: E1–E12, E14 y E15 en `packages/core` (puros, sin dependencias); la lectura de CFDI de E13 en `packages/fiscal` (necesita un lector de XML) y su cálculo en `core`; E16 en `packages/respaldo` (recibe la criptografía inyectada); E17 en `packages/sincronizacion` (v2).

## Convenciones

| Concepto | Regla |
|---|---|
| Dinero | `Centavos` = entero. `150000` = $1,500.00. Prohibido `number` con decimales para dinero. |
| Puntos base | `bp`: 10000 = 100 %. Porcentajes de negocio se guardan en bp (enteros). |
| Fecha civil | `PlainDate` = string `'YYYY-MM-DD'`. Aritmética en `core/fecha.ts`. No uses `Date` para lógica de negocio. |
| Día de la semana | ISO: 1 = lunes … 7 = domingo. |
| Intervalos | Semiabiertos `[inicio, fin)` salvo que se diga otra cosa. |
| Redondeo | Siempre explícito. Repartos con **mayor residuo** (E1.1). Divisiones de dinero entre días: piso. Porcentajes mostrados: E1.3. Donde este documento dice `redondear(n / d)` (con `n ≥ 0`, `d > 0`) significa el entero más cercano con .5 hacia arriba, en aritmética entera: `piso((2n + d) / (2d))`. Vectores que lo distinguen del piso: `E15.iva_incluido` (100 → 14), `E13.isr_por_tarifa` (1000010 → 19201), E15-10. |
| Flotantes | Solo probabilidades y similitudes. Se comparan con tolerancia `1e-6` (los vectores las traen con 6 decimales) salvo que el vector indique otra. |

Términos (definidos una vez, usados en todo el documento):

- **L · liquidez**: suma de saldos de cuentas líquidas (efectivo, débito, billeteras) **menos** el saldo acreedor de `pasivo:por_asignar` (gastos dictados sin método de pago) y el tránsito negativo (pagos que llegaron sin ver de qué cuenta salieron). Excluye ahorro, crédito, tránsito positivo, entradas por asignar y cuentas externas. Fórmula en `docs/04-DATOS.md §2.2`.
- **C · colchón**: monto mínimo que el usuario decide no tocar.
- **H · horizonte**: intervalo `[hoy, fin_efectivo)`; `fin_efectivo` lo calcula E3.3 a partir del próximo ingreso que todavía no llega.
- **d · días del horizonte**: `fin_efectivo − hoy`, nunca menor que 1.
- **R · reservado**: lo que debe salir de L antes de `fin_efectivo` o que ya es deuda que no debe financiarse con dinero futuro (E4).
- **Libre**: `L − C − R`. **Hoy puedes**: `piso(libre / d)` si libre > 0; si no, 0.
- **PNGI**: pago para no generar intereses de una tarjeta (término de los estados de cuenta mexicanos).
- **Corte**: fecha en que el banco cierra el periodo de la tarjeta. **Límite**: fecha límite de pago de ese periodo.
- **MSI**: compra a meses sin intereses; se paga en N cuotas.
- **Ocurrencia**: una instancia con fecha de un ingreso o egreso programado (la quincena del 15, la renta del 1).

---

## E1 · Dinero, fechas y porcentajes

### E1.1 `distribuirMayorResiduo(total: Centavos, pesos: number[]): Centavos[]`

Reparte `total` en proporción a `pesos` (enteros ≥ 0, suma > 0) sin perder ni inventar centavos.

1. `W = Σ pesos`. Si `total = 0` → todos 0.
2. Con `T = |total|`: `base_i = piso(T·p_i / W)`, `resto_i = (T·p_i) mod W` (aritmética entera; usa `BigInt` si `T·p_i` puede pasar de 2^53).
3. `faltante = T − Σ base_i`. Suma 1 a los `faltante` índices con mayor `resto_i`; empate → índice menor.
4. Si `total < 0`, cambia el signo de todo.

Propiedades: `Σ salida = total`; un peso 0 siempre recibe 0; `|salida_i − T·p_i/W| < 1`. Vectores: `E1.distribuir_mayor_residuo`.

### E1.2 Fechas

- `conDia(anio, mes, dia)`: fecha con `dia` acotado al último día del mes. Vectores `E1.con_dia_acotado`.
- `ajustarFinDeSemana(fecha, modo)`: `anterior` (sáb −1, dom −2), `siguiente` (sáb +2, dom +1), `ninguno`. Vectores `E1.ajuste_fin_de_semana`.
- Días festivos no se modelan en v1. Sus efectos (depósitos adelantados o retrasados) los absorbe E3.3.

### E1.3 Porcentajes

- `redondearPorcentaje(num, den) = piso((num·200 + den) / (2·den))`: entero, mitad hacia arriba, sin flotantes. Se usa para el uso de tarjetas (`uso_bp` 7066 → 71).
- `porcentajeMostrado(exitos, n)`: `p = redondearPorcentaje(exitos, n)`; `p = 0` → `"< 1 %"`; `p = 100` → `"> 99 %"`; si no `"p %"`. Una probabilidad simulada nunca se muestra como 0 % ni 100 %.

Vectores: `E1.porcentaje_mostrado`, `E1.redondear_porcentaje`.

---

## E2 · Libro contable

Especificación de datos en `docs/04-DATOS.md`. Reglas del motor:

1. `registrar(tx)` recibe una transacción con ≥ 2 asientos; rechaza si `Σ montos ≠ 0`, si algún monto es 0, si una cuenta está archivada o si el `tipo` no es válido (`04 §3`). Si la `clave_idempotencia` ya existe devuelve la transacción existente (no es error).
2. Las transacciones confirmadas son **inmutables**. `anular(id)` crea una transacción espejo (`tipo = 'reversa'`, asientos con signo invertido) con `revierte_a = id`. Una transacción se anula una sola vez (`ya_anulada`) y una reversa no se anula (`reversa_no_anulable`); para deshacer una anulación se registra de nuevo el movimiento. `reemplazar(id, nueva)` = anular + registrar la nueva con `reemplaza_a = id`, en una sola transacción SQLite.
3. `saldo(cuenta, hasta?)` = Σ montos de **todos** los asientos de la cuenta cuya transacción tiene `fecha ≤ hasta`. No se filtra por estado: la transacción espejo ya compensa.
4. Signo: débito positivo, crédito negativo. Activos y gastos tienen saldo normal positivo; pasivos, ingresos y capital, negativo. La UI muestra pasivos como "debes $X".

Invariantes (pruebas de propiedades con `fast-check`):

- I1: para toda transacción, `Σ montos = 0`.
- I2: `Σ saldos de todas las cuentas = 0` en todo momento.
- I3: después de `anular(x)`, todos los saldos son iguales a los que había antes de registrar `x`; `reemplazar(x, y)` deja los mismos saldos que registrar solo `y`.
- I4: registrar dos veces con la misma clave de idempotencia produce una sola transacción.
- I5: ningún saldo existe fuera del libro: no hay columna "saldo" editable. Saldos iniciales y conciliaciones son transacciones contra `capital:saldos_iniciales` o `capital:ajuste_conciliacion`.

---

## E3 · Ingresos, horizonte y compromisos

### E3.1 Reglas de recurrencia

```ts
type Regla =
  | { tipo: 'quincenal_15_ultimo'; ajuste?: Ajuste }
  | { tipo: 'quincenal_dias'; dias: [number, number]; ajuste?: Ajuste }
  | { tipo: 'mensual'; dia: number; ajuste?: Ajuste }
  | { tipo: 'semanal'; dia_semana: 1|2|3|4|5|6|7; ajuste?: Ajuste }
  | { tipo: 'catorcenal'; ancla: PlainDate; ajuste?: Ajuste }
  | { tipo: 'anual'; mes: 1|2|…|12; dia: number; ajuste?: Ajuste }    // seguro del coche, predial, dominio web
  | { tipo: 'unica'; fecha: PlainDate };
type Ajuste = 'anterior' | 'siguiente' | 'ninguno';   // si se omite: 'ninguno'
```

`quincenal_15_ultimo` = días 15 y último del mes. Todos los días se acotan con `conDia` (un `anual` del 29 de febrero cae el 28 en años no bisiestos, E3-08). `unica` sirve para compromisos de una sola vez.

### E3.2 `proximasFechas(regla, desde, n)`

Primeras `n` fechas **efectivas** (ya ajustadas) `≥ desde`: genera nominales en `[desde − 7, desde + alcance]` con `alcance = 370·(n+1)` días para `anual` y `40·(n+2)` para las demás, ajusta, quita duplicados, ordena, filtra `≥ desde`, toma `n`. Si el 15 cae en domingo y se paga el viernes 13, desde el sábado 14 esa quincena ya pasó (E3-07). Vectores: `E3.proximas_fechas`.

### E3.3 `horizonte(hoy, regla, recibidas)`

El horizonte termina en el próximo ingreso **que todavía no llega**, no en el próximo calendario. Así un depósito adelantado no convierte toda la quincena en "hoy puedes".

- `recibidas`: fechas de ocurrencias de ingreso ya cubiertas (E3.5).
- `ocurrencias = proximasFechas(regla, hoy − 2, 6)`; `fin` = la primera que no está en `recibidas`.
- `estado`: `normal` si `fin > hoy`; `dia_de_pago` si `fin = hoy`; `retrasado` si `fin < hoy`.
- `fin_efectivo = fin` si `normal`; si no, `fin + 3` (se asume que el depósito puede tardar hasta 2 días más; así no se ofrece todo el dinero libre en un solo día).
- `dias = fin_efectivo − hoy`.

Una ocurrencia con más de 2 días de retraso deja de considerarse y el horizonte pasa a la siguiente (E3-16); por separado, Hoy avisa "No ha llegado tu quincena del 15" si una ocurrencia de los últimos 31 días quedó sin cubrir.

**Modo ingreso variable** (sin regla): `fin = fin_efectivo = hoy + 30`, `estado = 'ingreso_variable'`; el ingreso no se proyecta (E3-17).

Vectores: `E3.horizonte` (E3-10 a E3-17).

### E3.4 `expandirProgramados(programados, desde, hasta)`

Instancias de egresos programados con fecha efectiva en `[desde, hasta)`. Las nominales se generan en `[desde − 7, hasta + 7]` antes de ajustar, para no perder una que el ajuste mete a la ventana (renta del domingo 1 de noviembre pagada el viernes 30 de octubre, E3-20) ni contarla dos veces (E3-21). Orden: fecha, concepto. Vectores: `E3.expandir_programados`.

### E3.5 `cubreOcurrencia(ocurrencia, movimiento)` → `'cubrir' | 'preguntar' | 'no'`

Una sola regla para marcar ocurrencias como cubiertas (al registrar o capturar cualquier movimiento):

- **Qué movimientos cuentan** (los elige servicios antes de llamar a E3.5): para una ocurrencia de **ingreso**, un `ingreso` o la entrada personal de un `retiro_dueno`; para una de **egreso**, un `gasto` o una `cuenta_dividida` (con el monto que salió de tu cuenta), un `pago_tarjeta` (su "categoría" es la tarjeta que recibe el pago, `04 §5`) o un `aportacion_tanda` (E11). Una `transferencia` entre cuentas propias, los préstamos y los cobros nunca cubren una ocurrencia.
- Si la ocurrencia tiene cuenta y no coincide con la del movimiento → `no`.
- **Ingreso:** movimiento de entrada con `fecha − ocurrencia ∈ [−3, +2]` días y monto dentro de ±10 % → `cubrir`.
- **Egreso:** movimiento de salida con diferencia de fechas ≤ 3 días y que coincide por **categoría** o por **comercio** (similitud E9.2 ≥ 0.85):
  - monto exacto → `cubrir`;
  - diferencia ≤ 25 % → `cubrir` si el programado es `variable` (recibos de luz, agua, gas), `preguntar` si no;
  - si no → `no`.
- Si varias ocurrencias califican: la de menor diferencia relativa de monto, luego la fecha más cercana.

Las ocurrencias de egreso vencidas sin cubrir **siguen reservándose** en E4; Hoy muestra la tarjeta "¿Ya pagaste la luz?" (Ya la pagué · Todavía no · Ya no aplica). Vectores: `E3.cobertura`.

---

## E4 · Dinero libre y "hoy puedes gastar"

### Principios

1. **La tarjeta de crédito no da dinero extra; solo cambia cuándo sale.** La deuda revolvente de tarjetas se reserva completa (aunque venza después del horizonte). Comprar con crédito no infla el "hoy puedes" y no hay doble conteo: el gasto reduce el libre al comprar; el pago posterior es una transferencia.
2. **El dinero prestado no es tuyo.** Lo que debes a personas se reserva, salvo que el usuario indique "no apartarlo" para esa deuda.
3. Las cuotas MSI **no facturadas** son la excepción deliberada: están diseñadas para pagarse con ingresos futuros; solo se reservan las que vencen dentro del horizonte.
4. Un **saldo a favor** (revolvente negativo) no crea dinero libre.

### Entrada

```ts
interface EntradaLibre {
  hoy: PlainDate;
  fin_horizonte: PlainDate;              // fin_efectivo de E3.3
  liquidez: Centavos;                    // L
  colchon: Centavos;                     // C
  compromisos: { concepto: string; fecha: PlainDate; monto: Centavos }[];  // ocurrencias de egreso pendientes (no tarjetas)
  tarjetas: { id: string; modo: 'totalero' | 'plan'; saldo_revolvente: Centavos;
              pagos_planeados?: { fecha: PlainDate; monto: Centavos }[] }[];
  cuotas_msi_no_facturadas: { plan: string; fecha_limite: PlainDate; monto: Centavos }[];
  deudas_personas?: { contraparte: string; monto: Centavos; apartar: boolean }[];   // subtipos persona, cliente y pareja; las tandas no
  impuestos_estimados?: Centavos;        // solo espacio negocio: Σ E15 no pagado (meses vencidos + mes en curso)
}
```

E4 se calcula **por espacio** (`04 §2.4`): L, C y R solo con cuentas, compromisos y tarjetas de ese espacio. En el espacio negocio el horizonte es fijo de 30 días (como el modo ingreso variable) y la cifra principal es "Puedes retirar hasta" = `max(0, libre)`, no `hoy_puedes`.

### Algoritmo

```
fin_ef = max(fin_horizonte, hoy + 1);  d = fin_ef − hoy
enH(f) = f < fin_ef                                   // incluye vencidos no pagados
tarjeta en plan CON pagos planeados → suma sus pagos con enH(fecha)          → tarjetas_pagos_planeados
cualquier otra tarjeta (totalera, o en plan sin pagos) → max(0, saldo_revolvente) → tarjetas_saldo_completo
R = Σ compromisos[enH] + tarjetas_saldo_completo + tarjetas_pagos_planeados
  + Σ cuotas_msi_no_facturadas[enH(fecha_limite)] + Σ deudas_personas[apartar]
  + max(0, impuestos_estimados)          // completos, aunque venzan después del horizonte
libre = L − C − R
hoy_puedes = libre > 0 ? piso(libre / d) : 0;  mostrado = piso(hoy_puedes / 100)
faltante = libre < 0 ? −libre : 0
```

Salida: `{ dias, reservado, desglose{compromisos, tarjetas_saldo_completo, tarjetas_pagos_planeados, cuotas_msi, deudas_personas, impuestos}, libre, hoy_puedes_centavos, hoy_puedes_pesos_mostrados, faltante }`.

Vectores: `E4` (E4-01 reproduce la maqueta: libre $856, hoy $214; E4-05 día de pago sin depósito; E4-07 saldo a favor; E4-08 plan sin pagos; E4-09 préstamo de persona; E4-10 espacio negocio con impuestos apartados: puedes retirar $15,900).

Las deudas formales con pagos mensuales (préstamo personal de un banco) se modelan como programados de egreso: se reservan sus pagos, no el saldo.

---

## E5 · Tarjetas de crédito

### Configuración

`dia_corte` (1–31) y **uno** de: `dias_para_pagar` o `dia_limite_pago`. `limite_credito` en centavos. `modo`: `totalero | plan`. `alta`: fecha en que se registró en la app.

### E5.1 Ciclo

- `corteDe(fecha)`: `c = conDia(año, mes, dia_corte)`; si `c ≥ fecha` → `c`; si no, el del mes siguiente. Una compra **el día de corte entra en ese corte**.
- `limiteDe(corte)`: con `dias_para_pagar` → `corte + n`. Con `dia_limite_pago` → `conDia(mes del corte)` si es `> corte`; si no, `conDia(mes siguiente)`.
- `diasFinanciamiento(compra) = limiteDe(corteDe(compra)) − compra`.

Vectores: `E5.ciclo`.

### E5.2 `recomendarTarjeta(compra, tarjetas, umbral_uso_bp = 3000)`

1. Candidatas: tarjetas en modo `totalero` (una tarjeta con saldo revolvente suele cobrar intereses sobre saldo promedio diario también a compras nuevas; verificar contrato).
2. `uso_bp = piso((max(0, saldo_revolvente) + msi_no_facturado + monto)·10000 / limite_credito)`.
3. Elegibles: `uso_bp ≤ umbral` (30 %, recomendación de Condusef sobre el uso del límite). Si ninguna, relaja a `≤ 10000` con advertencia `uso_alto`; si ninguna, `sin_credito_disponible`.
4. Orden: mayor `dias` → menor `uso_bp` → `id` ascendente.

Vectores: `E5.recomendacion` (E5-15: saldo a favor).

**Tarjeta del día** (Hoy, sin compra concreta): `monto` = mediana de las compras con crédito de los últimos 60 días; si no hay, $500. Solo se muestra con ≥ 2 tarjetas elegibles.

### E5.3 Cierre de periodo (proceso de sistema)

- `cortesAProcesar(tarjeta, alta, hoy, procesados)`: cortes `c` con `alta < c ≤ hoy` que no estén en `procesados`. **Nunca** se procesan cortes anteriores o iguales al alta: el saldo que el usuario dio en el onboarding ya los incluye. Vectores: `E6.cortes_a_procesar` (E6-07 a E6-09).
- Por cada corte, en una transacción SQLite: reclasificar las cuotas MSI de ese corte (E6.2) y guardar `estado_cuenta` con `saldo_corte` (revolvente al corte, ya con esas cuotas). Clave: `corte:{tarjeta}:{fecha}`. El PNGI no se guarda: se deriva como `max(0, saldo_corte − pagos y abonos con fecha posterior al corte)`.
- Corre al abrir la app y en la tarea diaria.

---

## E6 · Meses sin intereses

### E6.1 Planes

**Compra nueva** `planMsi(monto, meses, fecha_compra, tarjeta, meses_diferimiento = 0)`: `cuotas = distribuirMayorResiduo(monto, [1 × meses])` (las primeras cuotas llevan el centavo extra); `corte_1 = corteDe(fecha_compra)` avanzado `meses_diferimiento` cortes; cuota k en `corte_k`, vence en `limiteDe(corte_k)`. Supuesto a validar por banco: `meses_diferimiento = 0`. Vectores: `E6.planes`.

**Plan que ya existía** al registrar la tarjeta (onboarding) `planMsiExistente(mensualidad, restantes, hoy, tarjeta)`: solo las cuotas que faltan, todas iguales a la mensualidad; la primera en el primer corte **estrictamente posterior** a hoy. Vector: `E6.planes_existentes` (E6-06).

`compromisoPorMes`: suma de cuotas por mes de `limite`.

### E6.2 Contabilidad

- **Compra nueva:** `gasto:<categoria> +monto` / `pasivo:tarjeta:<id>:msi:<plan> −monto`. El consumo se reconoce completo el día de compra (reportes), pero E4 solo reserva cuotas dentro del horizonte.
- **Plan existente:** `capital:saldos_iniciales +restante` / `pasivo:tarjeta:<id>:msi:<plan> −restante`. **No** es gasto (ocurrió antes de usar la app).
- **En cada corte:** `pasivo:…:msi:<plan> +cuota_k` / `pasivo:tarjeta:<id> −cuota_k`. Clave `msi:{plan}:{k}`.
- **Pasar a meses** (una compra capturada como normal que en realidad fue a MSI): `reemplazar` la transacción por una compra MSI con el mismo monto y fecha.
- **Liquidar MSI por adelantado:** si un pago a la tarjeta deja el revolvente negativo, la app pregunta si fue para liquidar meses; si sí, `pasivo:…:msi:<plan> +x` / `pasivo:tarjeta:<id> −x` y el plan queda `liquidado` (sus cuotas futuras ya no se generan).

---

## E7 · Arqueo de efectivo

Permite llevar el efectivo sin anotar cada gasto.

**Entrada:** `saldo_contable` (saldo de la cuenta de efectivo), `efectivo_real` (lo que el usuario dice traer), `historial` (gastos en efectivo **confirmados y no estimados** de los últimos 60 días: `{categoria, monto}[]`), `marcados` (montos "por asignar" que el usuario confirma en este arqueo como pagados en efectivo).

**Orden obligatorio:** primero se reasignan los marcados al efectivo; después se calcula el hueco. Si se hiciera al revés, esos gastos se contarían dos veces (E7-08).

```
reasignado = Σ marcados
hueco = saldo_contable − reasignado − efectivo_real
hueco = 0 → 'ninguna'
hueco < 0 → 'aclarar_sobrante' (¿te dieron dinero?, ¿te pagaron un préstamo?, ¿error previo?). Nunca se registra solo.
hueco > 0:
  si hueco < 5000 ($50) o historial vacío → una propuesta 'varios_efectivo' por el total
  si no: agrega historial por categoría; descarta montos 0; ordena por monto desc, empate slug asc; toma 3;
         el resto va a 'varios_efectivo' (al final, si > 0); montos = distribuirMayorResiduo(hueco, pesos)
```

Las propuestas se registran como **una** transacción `ajuste_arqueo` (`estimada = 1`) solo cuando el usuario confirma. Vectores: `E7.arqueo`. Disparadores en `docs/02-UX.md §7`.

### E7.2 Corte de caja (espacio negocio)

En la caja de un negocio lo normal es lo contrario: **sobra** dinero, porque las ventas en efectivo no se anotan una por una.

```
reasignado = Σ marcados                 // gastos por asignar del negocio pagados con la caja (mismo orden que E7)
esperado   = saldo_contable − reasignado
diferencia = efectivo_real − esperado
diferencia = 0 → 'ninguna'
diferencia > 0 → 'proponer_ventas': una venta en efectivo (categoría ventas) por la diferencia
diferencia < 0 → 'aclarar_faltante': ¿lo sacaste para ti? (retiro_dueno) · ¿pagaste algo del negocio? (gasto) · No sé (ajuste)
```

Nada se registra sin confirmación. Vectores: `E7.corte_de_caja` (E7-20 a E7-23).

---

## E8 · Simulador probabilístico

Responde "¿qué probabilidad tengo de llegar a mi próximo ingreso sin tocar el colchón?" y "¿me alcanza para X?".

### E8.1 PRNG y semilla (bit a bit idénticos)

```ts
export function mulberry32(semilla: number): () => number {
  let a = semilla | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function fnv1a32(texto: string): number { /* FNV-1a 32 bits sobre bytes UTF-8; base 0x811c9dc5, primo 0x01000193 */ }
```

Semilla de producción: `fnv1a32(`${hoy}|${VERSION_SIMULADOR}`)`: el número no cambia en el mismo día. Vectores: `E8.mulberry32`, `E8.fnv1a32`.

### E8.2 Historial

`construirHistorial(transacciones, inicio_uso, hoy, fechas_ingreso)` → un registro `{fecha, clase, consumo}` por día completo en `[max(inicio_uso, hoy − 90), hoy)`. Recibe solo transacciones **vigentes** (`04 §3`, vista `transaccion_vigente`: ni anuladas ni reversas; de un reemplazo cuenta solo la nueva). Cada una trae `monto_gasto` = Σ de sus asientos en cuentas de gasto.

- Cuentan los tipos `gasto`, `cuenta_dividida` (solo la parte del usuario), `ajuste_arqueo` y `reembolso` (negativo). Se excluyen transferencias, pagos de tarjeta, `compra_msi` (sus cuotas son compromisos), movimientos que **cubrieron una ocurrencia** programada (ya se modelan como compromisos) y los marcados `extraordinaria`.
- Un `ajuste_arqueo` se reparte en partes iguales (E1.1; los días más antiguos reciben el centavo extra) entre los días `(arqueo anterior, fecha del arqueo]`; si es el primer arqueo, entre los 7 días que terminan en su fecha (sin pasar de `inicio_uso`). Así el efectivo de varios días no cae en un solo día.
- `consumo` del día = `max(0, Σ)`. Días sin movimientos valen 0 y **sí** cuentan.
- `clase`: `pago` si la fecha es una ocurrencia de ingreso recibida; si no `finde` (sáb, dom) o `habil`.

Vector: `E8.historial` (E8-30).

Pools: por clase; si una clase tiene < 5 días, usa el pool `todos`. Con < 14 días → `{estado: 'datos_insuficientes'}`; entre 14 y 41 días la UI muestra "estimación inicial".

### E8.3 Horizontes y excedente

El estado de cada trayectoria es el **excedente** `E`: dinero por encima de compromisos y colchón.

- `E₀ = libre` de E4.
- `construirHorizontes(hoy, regla, monto_ingreso, programados, hasta, recibidas)`: `H₀ = [hoy, fin_efectivo de E3.3)`; después un horizonte por cada ocurrencia de ingreso pendiente, `H_k = [f_k, f_{k+1})`. Se generan hasta que el último termina después de `hasta`, con mínimo 2 y tope de 24 meses. Para `k ≥ 1`: `ingreso_k` = monto programado y `compromisos_k` = `expandirProgramados` en `H_k` + pagos planeados de tarjetas en plan + cuotas MSI no facturadas con límite en `H_k`. Los compromisos de H₀ no se suman: ya están en `E₀`. Vector: E8-21.
- Modo ingreso variable: solo `K = 1` con `H₀ = [hoy, hoy + 30)`.
- `hoy_es_dia_de_pago` (entrada de la simulación) = hoy es una ocurrencia de ingreso recibida hoy; ese día usa la clase `pago`.

### E8.4 Algoritmo (orden exacto de consumo del PRNG)

```
rng = mulberry32(semilla)
para i en 0..N-1:
  E = E₀; ok = true
  para k en 0..K-1:
    si k > 0: E += ingreso_k − compromisos_k
    para cada día de H_k en orden cronológico:
      pool = pools[clase(día)]
      E −= pool[piso(rng() · pool.length)]
    si k = 0: guarda E como final₀
    si E < 0: ok = false          // NO se corta la trayectoria: siempre se consumen todos los días
  exitos += ok
P = exitos / N
p10, p50, p90 de final₀: rango más cercano sobre la lista ordenada (elemento techo(p·N) − 1)
```

Ningún atajo puede alterar el orden o la cantidad de llamadas a `rng()`; de eso depende reproducir `exitos`. Cada vector trae además `probabilidad_analitica` (+ tolerancia) para validar el método. Pantalla Hoy: `K = 1`, `N = 10 000`. Vectores: `E8.simulacion`.

### E8.5 "¿Me alcanza?"

**Escenarios** — `generarEscenarios(precio, hoy, proximo_ingreso, tarjetas, meses?, fecha_compra?)`:

1. Siempre `base` (sin compra) y `contado_hoy`.
2. `esperar` con la fecha que dijo el usuario o, si no dijo, la del próximo ingreso (si es posterior a hoy).
3. `msi`: con los meses que pidió el usuario; si no pidió y `precio ≥ $1,000`, 3 meses. Tarjeta = `recomendarTarjeta({hoy, precio})`; si devuelve advertencia, se informa en `nota`; si no hay tarjeta, no hay escenario MSI y `nota = 'sin_tarjeta_para_msi'`.

Vectores: `E8.escenarios.E8-23_generar_escenarios`.

**Comparación** — `compararEscenarios`:

1. Cargos de cada escenario: contado → hoy; esperar → su fecha; MSI → cada cuota en su `limite` (E6.1).
2. `hasta` = la fecha de cargo más tardía; los horizontes se construyen una vez hasta ahí (E8.3). **Todos los escenarios se evalúan en la misma ventana**; si no, el MSI saldría favorecido porque sus cuotas quedarían fuera. Un cargo posterior al tope de 24 meses se ignora y el escenario se marca `parcial`.
3. Cada cargo se aplica en el horizonte que contiene su fecha: en H₀ se resta de `E₀`; si no, se suma a `compromisos_k`.
4. Todos con **la misma semilla** (números aleatorios comunes): las diferencias se deben a la compra, no al azar. `N = 10 000` si la ventana tiene ≤ 62 días; si no, `N = 5 000`.
5. Recomendación: entre los escenarios con compra, el de más `exitos`; empatados los que estén a ≤ 2 puntos (`(mejor − exitos)·10000 ≤ 200·N`). Desempate: `contado_hoy` > `esperar` > `msi`; luego fecha más cercana.
6. Cada resultado trae `porcentaje` con E1.3.

Vector E8-22: unos tenis de $1,500 con el usuario de ejemplo → contado hoy `< 1 %`, esperar a la quincena (jue 15) `79 %`, 3 MSI con la Oro `89 %`, sin comprar `90 %`; se recomienda MSI. El motor no tiene sesgo contra el crédito: si los MSI son realmente sin intereses, repartir el golpe es racional y el modelo lo refleja.

### E8.6 Calibración

Al iniciar cada horizonte se guarda `{p_predicha (K=1), fecha}`; al cerrarlo, `resultado = E_final ≥ 0`. Métrica: Brier `= promedio((p − resultado)²)`. Objetivo ≤ 0.20 en beta. Solo se envía agregado y anónimo con autorización del usuario.

---

## E9 · Normalización de comercios y deduplicación

### E9.1 `normalizarComercio(s)`

1. `null`/vacío → `''`.
2. NFD, quitar marcas diacríticas, mayúsculas.
3. Todo carácter fuera de `A–Z0–9` → espacio.
4. Tokens; elimina los puramente numéricos y las palabras vacías `SA DE CV SAPI SAB S A C V RL MX MEX SUC SUCURSAL TDA TIENDA POS COMPRA PAGO EN`.
5. Une con un espacio.

Vectores: `E9.normalizar_comercio`.

### E9.2 Similitud

- **Jaro**: ventana `max(piso(max(|a|,|b|)/2) − 1, 0)`; `t` = (coincidencias fuera de orden)/2 **sin redondear**; `(m/|a| + m/|b| + (m − t)/m)/3`.
- **Jaro–Winkler**: si `jaro > 0.7`, `jaro + l·0.1·(1 − jaro)` con `l` = prefijo común ≤ 4; si no, `jaro`.
- **similitud(a, b)** (ya normalizados): 0 si alguno vacío; 1 si los tokens del más corto ⊆ tokens del más largo; si no, Jaro–Winkler.

Vectores: `E9.jaro_winkler`, `E9.similitud`.

### E9.3 Captura ↔ movimiento existente

**Cuenta compatible:** la del movimiento (su **cuenta raíz**: una subcuenta MSI cuenta como su tarjeta) es la de la captura, **o** es la cuenta puente del mismo sentido (`por_asignar` para salidas, `por_asignar_entradas` para entradas). Si no → `nuevo`.

| Caso (cuenta compatible) | Fusionar | Preguntar | Nuevo |
|---|---|---|---|
| Mismo monto; movimiento en cuenta puente o sin comercio | Δ ≤ 1 | Δ = 2 | resto |
| Mismo monto; movimiento con comercio, `s = similitud` | Δ ≤ 1 y s ≥ 0.85 | Δ ≤ 2 y s ≥ 0.70 | resto |
| Entrada vs ingreso dictado, monto distinto ≤ 10 % | — | Δ ≤ 2 | resto |
| Cualquier otro monto distinto | — | — | siempre |

`Δ` = días entre fechas. Emparejamiento uno a uno: un movimiento absorbe como máximo una captura por fuente; con varias candidatas: menor Δ, luego mayor s, luego la registrada primero.

Al **fusionar**: si el movimiento estaba en una cuenta puente, se `reemplaza` con la cuenta de la captura (conservando descripción y categoría dictadas); si era una compra MSI dictada, se conserva el plan y la captura solo se vincula. "Preguntar" en ingresos: "¿Esto es tu quincena? Registraste $8,000 y llegaron $7,850" → reemplaza con el monto real. Si la captura forma pareja de E9.4 mientras espera la respuesta, el par también espera y la respuesta se aplica a la transacción final (`07 §5`, paso 2).

Vectores: `E9.decision` (E9-38 por asignar, E9-40 MSI, E9-41 a E9-43 ingresos). Pendiente después de M13: propinas (monto final ≠ preautorizado).

### E9.4 Transferencias entre cuentas propias

Pagar la tarjeta desde el banco genera **dos** capturas ("Enviaste $4,200" y "Recibimos tu pago de $4,200"); mover dinero a una billetera también. Deben quedar como **una** transacción.

- Cada captura se registra **en cuanto llega**, sin esperar a su pareja:
  - salida → `transferencia_pendiente`: `activo:transito +X` / `cuenta origen −X` (el dinero sale de L de inmediato; el tránsito positivo no es líquido);
  - pago recibido en tarjeta → `transferencia_pendiente`: `pasivo:tarjeta +X` / `activo:transito −X` (el tránsito negativo resta de L hasta ver la salida);
  - entrada a una cuenta líquida → según `07 §5` (cobro de préstamo, ingreso que cubre una ocurrencia, o ingreso por revisar).

  Asientos de cada caso y preguntas a las 24 h: `docs/04-DATOS.md §4` (casos 15 a 19).
- Con cada captura nueva se corre `emparejarTransferencias` sobre las salidas y entradas de las últimas 24 h sin pareja: misma cantidad, cuentas propias distintas, `Δ ≤ 1` día; orden `(Δ, id salida, id entrada)`; asignación voraz uno a uno.
- **Movimiento resultante.** Mismo espacio: `pago_tarjeta` si la entrada es `pago_recibido_tarjeta`, si no `transferencia`. **Espacios distintos** (`04 §2.4`): `retiro_dueno` si sale del negocio y entra a lo personal, `aportacion_dueno` al revés; si además la entrada es el pago de una tarjeta, la salida devuelve `pago_tarjeta: true` y servicios lo descompone (`04 §4`, caso 29).
- Un par encontrado **reemplaza** (E2) lo ya registrado por una sola transacción, incluido un movimiento dictado con el que se fusionó cualquiera de las dos mitades (E9.3, `07 §5` paso 2): el mismo dinero nunca cuenta dos veces. Si la entrada había cubierto una ocurrencia de ingreso, esa ocurrencia vuelve a pendiente, **salvo** que el par sea un `retiro_dueno`: el sueldo del dueño sí es su ingreso personal, así que la ocurrencia sigue cubierta y se vincula a la transacción nueva. Si la salida del negocio llegó primero (E9-51), la entrada nunca pasó por E3.5: el `retiro_dueno` se compara con las ocurrencias de ingreso del espacio personal y, si cubre una, se vincula. Un `pago_tarjeta` resultante también pasa por E3.5 (pago planeado de una tarjeta en modo plan, `04 §5`).
- Salida sin pareja después de 24 h → pregunta "¿A quién le mandaste $X?" (A otra cuenta mía → elegir entre las entradas candidatas o una cuenta externa · Le presté · Pagué algo · Otro). Con negocio activo y una salida de una cuenta del negocio, la primera opción es "A mi cuenta personal (retiro)".

Vectores: `E9.emparejar_transferencias`, `E9.emparejar_entrada_primero`, `E9.emparejar_entre_espacios` (E9-50), `E9.emparejar_entre_espacios_salida_primero` (E9-51).

---

## E10 · Capacidad de endeudamiento (calculadora pública, M0)

Dos referencias: Condusef recomienda que el pago total de deudas no supere 30 % del ingreso; especialistas sugieren que los MSI no pasen de 10 %.

```
tope_deuda = piso(ingreso·3000/10000);  tope_msi = piso(ingreso·1000/10000)
cap_deuda = tope_deuda − pagos_deuda_mensuales (incluye MSI)
cap_msi   = tope_msi − pagos_msi_mensuales
capacidad = max(0, min(cap_deuda, cap_msi))
limitante = cap_deuda ≤ cap_msi ? 'deuda_total' : 'msi'
precio_maximo[n] = capacidad·n  para n ∈ {3, 6, 9, 12, 18, 24}
compra: cuota_maxima = max(distribuirMayorResiduo(precio, n)); cabe = cuota_maxima ≤ capacidad; margen = capacidad − cuota_maxima
```

Vectores: `E10`. Porcentajes configurables (bp); la calculadora cita la fuente en pantalla.

---

## E11 · Tandas (M8)

Aportación `a`, `n` participantes, turno `k` (1 = cobras primero), fechas por `Regla` desde `inicio`.

- **Calendario:** `rondas = proximasFechas(regla, inicio, n)`; la aportación `t` vence en `rondas[t−1]`; cobras en `rondas[k−1]`.
- **Posición** después de la aportación `t`: `aportado = a·t`; `recibido = a·n` si `t ≥ k`, si no 0; `posicion = aportado − recibido`; `en_riesgo = max(0, posicion)` (lo que perderías si la tanda se cae); `por_aportar = a·(n − t)`.
- **Contabilidad:** cuenta `contraparte:tanda:<id>` (saldo positivo = te deben; negativo = debes). Aportar: `aportacion_tanda` = `tanda +a / líquida −a`. Cobrar: `cobro_tanda` = `líquida +a·n / tanda −a·n`. **Cobrar la tanda no es ingreso** ni aportar es gasto.
- **Compromisos:** al crear la tanda se crea un programado de egreso con la misma regla, `desde = inicio` y `hasta = rondas[n−1]`; sus ocurrencias son las aportaciones y E4 las aparta como cualquier compromiso. Para E3.5, la "categoría" del programado es la tanda y la cubre un `aportacion_tanda` a esa tanda.
- **E4:** el saldo negativo de una tanda (ya cobraste y faltan aportaciones) **no** entra en `deudas_personas`: esas aportaciones ya están como compromisos y contarlas dos veces sería un error. El cobro futuro no se proyecta como ingreso hasta que llega.
- **Tanda que ya existía** `tandaExistente(a, n, k, regla, inicio, hoy)`: las rondas con fecha `< hoy` se toman como aportadas (el usuario puede corregir el número antes de guardar); `saldo_inicial = posicion` después de esas aportaciones, registrado como `saldo_inicial` de `contraparte:tanda:<id>` contra `capital:saldos_iniciales` (`04 §4`, caso 23b); esas ocurrencias se crean como `omitida` (ni se apartan ni se vuelven a cobrar); las pendientes, como cualquier compromiso.

Vectores: `E11` (E11-01 semanal, turno 4 de 10; E11-02 quincenal, turno 1; E11-03 tanda que ya existía: 6 aportaciones hechas, ya cobró, saldo inicial −$2,000).

---

## E12 · Cuenta dividida, cobros y gastos de pareja

### E12.1 Cuenta dividida y cuentas por cobrar (M8)

`dividirCuenta(total, partes)`: `distribuirMayorResiduo(total, [1×partes])`; el índice 0 es el usuario (absorbe los centavos sobrantes). `por_cobrar_total = total − parte_usuario`.

"Pagué la cena de 1,200 entre 4 con la Nu": `gasto:comida_fuera +300.00`, `contraparte:<persona> +300.00` ×3, `pasivo:tarjeta:nu −1,200.00`. Cuando un amigo paga: `líquida +300 / contraparte:<persona> −300`. **No es ingreso.** Vectores: `E12.dividir_cuenta`.

**Cobrar** no mueve dinero: arma un mensaje con el monto, el concepto y los datos para pagarte (celular para DiMo o CLABE, guardados solo en el teléfono) y lo comparte con la hoja nativa (`02 §17`).

### E12.2 Gastos compartidos en pareja (M16, v2)

- `repartoPareja(total, proporcion_a_bp)` = `distribuirMayorResiduo(total, [p, 10000 − p])` → `{parte_a, parte_b}`. La proporción puede ser 50/50 o, por ejemplo, según ingresos (60/40).
- `balancePareja(eventos)`: por cada evento no anulado: un **gasto** suma `parte_b` si pagó A y resta `parte_a` si pagó B; un **pago** para saldar `{tipo: 'pago', de, monto}` suma el monto si paga A y lo resta si paga B. `saldo > 0` → B le debe a A; `< 0` → A le debe a B.
- **Contabilidad en el libro de cada quien:** si pagaste tú, `cuenta_dividida` como en E12.1 (tu parte a gasto, la del otro a `contraparte:<pareja>`); si pagó tu pareja, `cuenta_dividida` con `gasto:<categoria> +tu_parte` / `contraparte:<pareja> −tu_parte` (le debes); un pago para saldar es `pago_prestamo` o `cobro_prestamo` contra `contraparte:<pareja>`. Lo que le debes a tu pareja entra en `deudas_personas` de E4.

Vectores: `E12.reparto_pareja`, `E12.balance_pareja` (E12-20: A le debe a B $1,600.01; E12-21: A salda en dos pagos y queda en 0).

---

## E13 · Fiscal personal: CFDI y deducciones personales (M12)

> El resultado es una **estimación** para preparar la declaración anual con tu contador. La app no presenta declaraciones ni se conecta al SAT. Los parámetros de cada ejercicio (`config/fiscal/<año>.json`) los valida un contador público antes de publicarse; los vectores usan parámetros sintéticos (`E13.config_prueba`) para probar la lógica.

### E13.1 `parsearCfdi(xml)` (`packages/fiscal`)

- Solo CFDI 4.0 (`http://www.sat.gob.mx/cfd/4`); otra versión → `{error: 'version_no_soportada'}`. Sin `TimbreFiscalDigital` → `{error: 'sin_timbre'}`.
- Salida: `uuid` (en mayúsculas), `fecha` (los 10 primeros caracteres de `Fecha`), `tipo_comprobante`, `forma_pago`, `metodo_pago`, `moneda`, `subtotal`, `total`, `iva_trasladado` (Σ `Traslado` con `Impuesto="002"` del nodo `Impuestos` del comprobante), `emisor_rfc`, `emisor_nombre`, `receptor_rfc`, `uso_cfdi`.
- Importes con `decimalACentavos`: hasta 6 decimales, aritmética entera, redondeo al centavo mitad hacia arriba (`"0.005"` → 1, `"0.004999"` → 0).
- Un XML inválido no se importa. El XML original se guarda cifrado en la base (`04 §3.3`), nunca sale del teléfono salvo en el paquete para el contador.

Vectores: `E13.parsear` (9 archivos de `fixtures/cfdi/`), `E13.decimal_a_centavos`.

### E13.2 `estimarDeducciones(cfdis, ingresos, ejercicio, rfc, config, etiquetas)` (`packages/core`)

**Entradas:** `ingresos` = ingresos brutos del ejercicio, incluidos los exentos (no los depósitos netos que ve la app), y `rfc` del usuario; ambos los da el usuario en la pantalla de Deducciones y se guardan en `ajuste.perfil_fiscal` (`04 §3`). `etiquetas` por UUID: `{lentes, beneficiario, alumno, nivel, pagado, forma_pago}`.

1. **Exclusiones**, en este orden (gana la primera): `no_es_ingreso` (tipo ≠ I), `otro_receptor`, `otro_ejercicio`, `cancelado` (estatus que dio el usuario), `moneda_extranjera`, `no_deducible` (uso fuera de D01–D10), `ppd_sin_pago` (método PPD sin que el usuario confirme el pago), `pago_en_efectivo` o `forma_de_pago_no_valida` (si el uso exige pago electrónico: cheque nominativo 02, transferencia 03, tarjeta de crédito 04, débito 28 o servicios 29), `falta_alumno_nivel` (colegiaturas sin alumno y nivel). Un PPD trae `FormaPago` 99 ("por definir"): al confirmar el pago, la app pide la forma de pago real (`etiquetas.forma_pago`) y esa es la que se revisa (E13-12).
2. **Monto deducible** de cada CFDI = `total` (con IVA). Lentes ópticos (etiqueta del usuario): tope por beneficiario por año.
3. **Por uso:** colegiaturas (D10) con tope por alumno: si cursó más de un nivel en el año, el **tope mayor** de esos niveles; los demás con su `tope` (`umas`, `porcentaje_ingresos_bp` y/o `fijo`: se toma el menor).
4. **Tope global** para los usos marcados `en_tope_global`: el menor entre `umas × UMA anual` y `porcentaje × ingresos`. El excedente se pierde (no se arrastra).
5. `total_deducible = min(sujeto_a_tope_global, tope_global) + Σ usos fuera del tope`.

Salida: `{por_uso{uso: {cfdis, bruto, deducible, en_tope_global}}, excluidos[{uuid, motivo}], sujeto_a_tope_global, tope_global, excedente_perdido, total_deducible}`.

Alerta preventiva (la más útil): al registrar un gasto de salud **en efectivo**, Hoy avisa "Si lo pagas con tarjeta o transferencia y pides factura, lo puedes deducir".

Vectores: `E13.deducciones` (E13-10 sin recorte; E13-11 con recorte del 15 %; E13-12 PPD confirmado por transferencia).

### E13.3 `ahorroPorDeducciones(base_gravable, deducciones, tarifa)`

`isrPorTarifa(base)`: fila con el mayor `limite_inferior ≤ base`; `cuota_fija + redondear((base − limite_inferior)·tasa_bp / 10000)`. `ahorro = isr(base) − isr(max(0, base − deducciones))`. `base_gravable` es la base anual estimada que el usuario da en `ajuste.perfil_fiscal` (su constancia de sueldos o su contador); la tarifa anual del art. 152 vive en `config/fiscal/<año>.json` (`tarifa_anual_isr`). Se muestra como "podrías pagar unos $X menos de ISR" con la leyenda de estimación. Vectores: `E13.isr_por_tarifa`, `E13.ahorro` (con `E13.tarifa_prueba`, sintética).

---

## E14 · Detección de suscripciones (M10)

`detectarSuscripciones(gastos, hoy, catalogo)` sobre gastos vigentes de los últimos 400 días, agrupados por comercio normalizado (E9.1):

| Periodicidad | Días entre cargos | Cargos mínimos | Cargos al año |
|---|---|---|---|
| mensual | 27–33 | 3 (2 si el comercio está en el catálogo semilla de suscripciones) | 12 |
| semanal | 6–8 | 4 | 52 |
| anual | 358–372 | 2 | 1 |

1. Por cada periodicidad y cada **ancla** (los 3 cargos más recientes): se recorre hacia atrás desde el ancla. Los días se miden siempre contra el **último cargo aceptado** en la serie (al ir hacia atrás, el más antiguo aceptado hasta ese momento). Un cargo a menos del mínimo de días se salta (otra compra en el mismo comercio no rompe la serie); a más del máximo, se corta; si el monto se aleja más de 15 % del monto del ancla, se **salta** (no corta) y se sigue con el anterior (E14-03).
2. Se elige la serie más larga; empate → mensual, semanal, anual; luego el ancla más reciente.
3. `monto_tipico` = mediana baja; `activa` si `hoy − último ≤ máximo + 7`; `proximo_cargo`: mensual = mismo día del mes siguiente (el mayor día de los 3 últimos cargos, acotado con `conDia`), anual = misma fecha del año siguiente, semanal = +7.
4. `monto_anterior`: el monto del cargo **distinto** más reciente de la serie si es menor que el último (aumento de precio: Spotify "antes $115"); si no, `null`.
5. Orden: activas primero, por costo anual descendente.

Uso: Cuentas → Suscripciones ("Pagas unos $X al mes en N suscripciones", con `X = piso(Σ costo_anual de las activas / 12)`, `E14-01.resumen_activas`); "Convertir en compromiso" crea el programado con regla `mensual` con `dia` = el mayor día de los 3 últimos cargos **sin acotar** (un cargo del 31 queda `dia: 31`; `conDia` lo lleva al 30 en noviembre y lo regresa al 31 en diciembre, en vez de quedarse en el día acotado de `proximo_cargo`), `semanal` con el `dia_semana` del último cargo, o `anual` con el mes y el día del último cargo (un 29 de febrero queda `dia: 29`, E3-08), y E4 lo aparta; "Ya la cancelé" la oculta. Vectores: `E14` (Netflix con una renta de película en medio; Spotify con aumento de precio; yoga semanal; dominio anual; Disney inactiva; OXXO no es suscripción; E14-03 cargo de otro monto en medio de la serie).

---

## E15 · Impuestos del negocio (M11)

> Estimación para **apartar** dinero, no para declarar. La tabla y el día de pago viven en `config/fiscal/<año>.json`, validados por un contador público (los vectores usan la tabla de RESICO de personas físicas del art. 113-E de la LISR, `E15.config`). Si el contador del usuario le da otro porcentaje, se usa el modo `porcentaje`.

`impuestosMes(e, config)` con las ventas **cobradas** y los gastos **pagados** del periodo (`YYYY-MM`), cada uno con su IVA ya separado:

```
base_isr = Σ (venta.total − venta.iva)
tasa_bp  = modo 'resico_pf' → primera fila de la tabla con base_isr ≤ hasta (la tasa aplica a toda la base, no por tramos)
           modo 'porcentaje' → porcentaje_bp del usuario
isr_causado = redondear(base_isr·tasa_bp / 10000);   isr_a_pagar = max(0, isr_causado − retención ISR)
iva_neto = Σ iva ventas − IVA retenido − Σ iva gastos con CFDI − saldo a favor previo
iva_a_pagar = max(0, iva_neto);   saldo_favor_iva = max(0, −iva_neto)   (se arrastra al mes siguiente)
ajustados: art. 20 CFF (1 a 50 centavos al peso inferior; 51 a 99 al superior), a CADA impuesto por separado y después se suman (E15-10)
fecha_limite = día 17 del mes siguiente; si cae en fin de semana, el lunes siguiente (días festivos: no en v1)
avisos: excede_tabla, excede_limite_anual (ingresos del año > límite de RESICO)
```

- `ivaIncluido(total, tasa) = redondear(total·tasa / (10000 + tasa))` con `tasa = iva_tasa_general_bp` de la configuración: al registrar una venta "con IVA incluido".
- **Encadenamiento:** `saldo_favor_iva_previo` es el `saldo_favor_iva` del mes anterior e `ingresos_acumulados_previos` la suma de `base_isr` de los meses anteriores del ejercicio; ambos se obtienen calculando E15 mes por mes desde enero (o desde el mes en que se activó el negocio, partiendo de `ajuste.negocio.ingresos_previos_ejercicio` y `saldo_favor_iva_inicial`, que el usuario da al activarlo). No se guardan: se recalculan del libro.
- **Modos:** `resico_pf` usa la tabla; `porcentaje` usa el porcentaje que dio el contador del usuario. "Actividad empresarial o profesional" exige `porcentaje`; si el usuario no lo sabe (o eligió "No sé" en el régimen), se usa `porcentaje_por_defecto_bp` de la configuración (conservador; por validar) y Hoy le pide confirmarlo con su contador.
- **Apartado:** `impuestos_estimados` de E4 (negocio) = Σ `total_a_pagar_ajustado` de los periodos no pagados, **incluido el mes en curso** con lo cobrado hasta hoy. Pagar impuestos es una transacción `pago_impuestos` que marca como pagado el periodo indicado: el mes donde se tocó "Ya lo pagué"; por voz o texto, la tarjeta de confirmación (siempre se muestra para un pago de impuestos, `06 §7`) propone el periodo más antiguo sin pagar y deja cambiarlo (caso 27: septiembre). Como E4 ya aparta estos impuestos, no existe un compromiso con categoría `impuestos` (ni por voz ni por formulario): se apartarían dos veces; la app explica que ya los aparta y ofrece el modo `porcentaje` (`06 §3.1`). E15 solo calcula ISR e IVA: los demás impuestos del negocio (`otros_impuestos`: predial del local, impuesto sobre nómina, licencias) son gastos y compromisos normales que E4 aparta como cualquier otro.

Vectores: `E15.impuestos_mes` (E15-01 freelance con retenciones; E15-02 tienda, límite el lunes 19 oct; E15-03 porcentaje; E15-04/05 IVA a favor arrastrado; E15-06/07 frontera de tabla; E15-08 límite anual; E15-09 mes en curso; E15-10 redondeo y ajuste por impuesto), `E15.iva_incluido`, `E15.ajustar_cff`.

---

## E16 · Respaldo cifrado (M9)

Formato del archivo `.cartera` (`packages/respaldo`):

```
"CARTERA1" (8 bytes ASCII) | largo del encabezado (uint32 big-endian) | encabezado (JSON UTF-8) | cifrado AES-256-GCM (texto cifrado ‖ etiqueta de 16 bytes)
encabezado = {formato:'cartera-respaldo', version:1, kdf:{alg:'scrypt', n, r, p, sal_b64}, cifrado:{alg:'AES-256-GCM', nonce_b64},
              creado_en, version_esquema, contenido:'json+gzip'}   // serializado con llaves ordenadas y sin espacios
llave = scrypt(NFKC(contraseña) en UTF-8, sal, n = 2^17, r = 8, p = 1, 32 bytes)   // memoria: 128·r·n = 128 MiB
nonce = 12 bytes aleatorios, nuevo en cada respaldo;  AAD = los bytes exactos del encabezado
contenido = gzip(exportación JSON completa, 04 §6, más las llaves de grupos compartidos de E17)
```

- **Llave y sal.** Al crear la contraseña de respaldo se generan una `sal` de 16 bytes y la `llave`; se guarda **solo la llave** (32 bytes) en el almacén seguro (Android Keystore; en iOS, accesibilidad `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, porque la tarea automática corre con el teléfono bloqueado) junto con la sal. Cada respaldo, manual o automático, reutiliza esa sal (va en el encabezado) con un nonce nuevo; así la tarea en segundo plano cifra sin pedir la contraseña. La contraseña nunca se guarda ni se envía.
- **Cambiar la contraseña** genera sal y llave nuevas (los respaldos viejos siguen abriéndose con la contraseña vieja). **Borrar todo** destruye la llave.
- **Abrir:** verificar la magia; leer el encabezado (≤ 4 KiB) y **validar sus parámetros antes de derivar nada**: `n ∈ {2^16, 2^17}`, `r = 8`, `p = 1`, sal de 16 bytes, nonce de 12 bytes (las pruebas pueden permitir `n = 2^14` con una opción explícita, para los vectores rápidos); derivar la llave con un límite de memoria de al menos 256 MiB (`maxmem` en `node:crypto`; el valor por omisión, 32 MiB, falla con `n = 2^17`); descifrar con AAD (un byte alterado o una contraseña equivocada fallan igual: `respaldo_corrupto_o_contrasena_incorrecta`); descomprimir (tamaño máximo descomprimido: 200 MB); validar con Zod; importar en una base nueva y correr la comprobación de integridad.
- Si `n = 2^17` tarda más de 3 s en el teléfono de referencia, se baja a `2^16` y se registra en ESTADO (el valor viaja en el encabezado, así que los respaldos viejos se siguen abriendo).
- Si se olvida la contraseña, el respaldo no se puede abrir: la UI lo dice antes de crearla.

Vectores: `E16.kdf` (E16-01 = RFC 7914; E16-03 normalización NFKC; E16-04 parámetros de producción) y `fixtures/respaldo/kat.json` (archivo completo verificado con Python y con Node; su versión alterada debe rechazarse).

---

## E17 · Sincronización de gastos compartidos (M16, v2)

Para finanzas en pareja sin romper el principio "local primero":

- **Qué se sincroniza:** solo los eventos de un **grupo compartido** (dos personas): gastos, pagos para saldar y anulaciones. Nunca el libro personal de nadie.
- **Evento:** `{id, grupo_id, autor, creado_en, tipo, cuerpo}`; inmutable; idempotente por `id`. `id` es un UUIDv4 (aleatorio: un UUIDv7 dejaría en claro el instante de creación). `autor` es `'a'` (quien creó el grupo) o `'b'` (quien se unió). Tipos: `gasto_compartido_creado` (cuerpo `{fecha, total, pago: 'a'|'b', proporcion_a_bp, descripcion, categoria}`), `pago_compartido_creado` (saldar: `{fecha, de: 'a'|'b', monto}`) y `evento_anulado` (`{id_anulado}`, anula un gasto o un pago).
- **Entrada de E12.2:** `packages/sincronizacion` traduce los eventos vigentes (los que ningún `evento_anulado` apunta): `gasto_compartido_creado` → `{id, total, pago, proporcion_a_bp}` con los campos de `cuerpo`; `pago_compartido_creado` → `{id, tipo: 'pago', de, monto}`. Es el formato de los vectores `E12.balance_pareja`, donde un gasto anulado aparece con `anulado: true`.
- **Cifrado de extremo a extremo:** llave simétrica del grupo (32 bytes aleatorios) que viaja **solo** en un código QR que la otra persona escanea en persona, junto con un código de unión de un solo uso; nunca pasa por el servidor en claro (solo dentro del respaldo cifrado con la contraseña del usuario, E16). Cada evento va cifrado con XChaCha20-Poly1305 (nonce de 24 bytes aleatorio, AAD = bytes UTF-8 de `grupo_id|id|autor`). La interfaz de criptografía inyectada de `packages/sincronizacion` agrega `xchacha20poly1305Cifrar/Descifrar` (`node:crypto` no lo trae: en pruebas y en la app se usa `@noble/ciphers`).
- **Formato en el servidor:** fila `{grupo_id, id, autor, recibido_en, blob}` con `blob = base64(nonce ‖ texto cifrado ‖ etiqueta)` del JSON `{tipo, creado_en, cuerpo}`. En claro solo van `grupo_id`, `id` y `autor` (sin datos personales): el servidor no ve tipos, montos, descripciones ni nombres. Al descifrar, el evento se arma con los campos en claro y los del blob.
- **Llave después de restaurar:** la llave del grupo viaja dentro del respaldo cifrado (E16). Si falta (un respaldo anterior a unirse) o el servidor ya no reconoce la sesión (`no_miembro`: restaurar desde archivo crea una sesión anónima nueva), la app ofrece **"Volver a vincular"**: la otra persona pide un código nuevo (`/compartido/codigo`) y muestra de nuevo su QR con la llave; al escanearlo, la sesión nueva ocupa el lugar (`'a'` o `'b'`) de la anterior.
- **Fusión:** unión de eventos por `id`; un gasto o pago con un `evento_anulado` que lo apunta no cuenta; no hay ediciones (corregir = anular + crear). Como los eventos solo se agregan, no hay conflictos.
- **Saldo:** `balancePareja` (E12.2) sobre los eventos vigentes (gastos y pagos no anulados). Cada persona registra en **su** libro los asientos de E12.2 (contabilidad en el libro de cada quien).
- **Salir del grupo** lo cierra para los dos, sin dejar saldos distintos:
  1. El teléfono de quien sale publica sus eventos pendientes.
  2. El servidor marca `cerrado_en`. Desde ahí rechaza **publicaciones** de los dos (403, `grupo_cerrado`); los miembros todavía pueden **descargar** lo ya publicado.
  3. Quien sale descarga todo lo publicado hasta `cerrado_en` (también lo que el otro haya publicado mientras salía) y solo entonces borra la llave de su almacén seguro. La llave puede seguir dentro de sus respaldos anteriores (E16): el cierre lo garantiza el servidor, no la llave.
  4. El otro teléfono, en su siguiente sincronización, descarga lo que le falte y muestra "Ana cerró el grupo compartido". Un evento creado sin conexión que ya no se pudo publicar se anula en el libro de quien lo creó, con aviso ("No se compartió: el grupo ya estaba cerrado").
  5. Cada teléfono guarda `cerrado_en` en su `grupo_compartido`; los dos quedan con el mismo conjunto de eventos y el mismo saldo final. Volver a compartir crea un grupo nuevo con una llave nueva; una llave nunca se reutiliza.

Sin vectores numéricos propios (usa E12.2); la prueba de propiedades: cualquier orden de llegada de los mismos eventos produce el mismo saldo.
