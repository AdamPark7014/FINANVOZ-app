# 10 · Perfil de negocio y contador

> Para **personas físicas con negocio**: RESICO, actividad empresarial y profesional (freelance), conductores y vendedores de plataformas, comercios chicos (tiendita, puesto, estética, taller). **No** para personas morales con empleados.
> Se construye en M11 (negocio) y M12 (contador y deducciones personales), después de la beta. Los motores están en `05 §E7.2`, `§E13` y `§E15`.

## 1. Decisión

| Segmento | ¿Entra? | Por qué |
|---|---|---|
| Persona física con negocio o freelance | **Sí (M11)** | Mismo dolor que el usuario personal (mezcla su dinero con el del negocio), mismo mecanismo de captura y el motor ya sirve. Nadie le dice "cuánto puedes sacar para ti sin quedarte sin para impuestos". |
| Contadores | **Como canal (M12)** | Reciben de su cliente un paquete mensual ordenado y le recomiendan la app. Un portal para que el contador vea a varios clientes exige guardar datos financieros en un servidor: rompe ADR-001 y cambia el cumplimiento. Queda para después de v2 si los datos lo justifican. |
| Persona moral con empleados | **No** | Es otro producto: varios usuarios con permisos, nómina, IMSS, contabilidad electrónica. Ahí compiten Contpaqi, Aspel, Alegra o Bind. |

**Validación antes de construir:** la lista de espera de M0 pregunta "¿Para qué lo usarías? Personal / Mi negocio o freelance / Soy contador". M11 arranca si al cerrar M7 se cumple **una**: ≥ 20 % de la lista eligió "Mi negocio o freelance", o ≥ 10 probadores de la beta lo pidieron. Si no, se registra en ESTADO y se salta a M12 (deducciones personales) y M13.

## 2. Conceptos

| Término | Significado |
|---|---|
| Espacio | Conjunto separado de cuentas, categorías, compromisos y cifras. Hay `personal` y, si el usuario lo activa, un `negocio` (uno en v1). Cada cuenta pertenece a un espacio (`04 §2.4`). |
| Retiro del dueño | Dinero que pasa del negocio al bolsillo personal. No es gasto del negocio ni ingreso nuevo: es una transferencia entre espacios (`retiro_dueno`). Su opuesto: `aportacion_dueno`. |
| Impuestos apartados | ISR e IVA estimados de lo ya cobrado que todavía no se pagan (E15). Se reservan completos aunque venzan el 17 del mes siguiente. Otros impuestos del negocio (predial del local, impuesto sobre nómina, licencias) no los calcula E15: son compromisos con la categoría `otros_impuestos`. |
| Puedes retirar hasta | El dinero libre del negocio (E4 con horizonte de 30 días): lo que puedes sacar hoy sin dejar al negocio corto para sus compromisos e impuestos. |
| Fiado | Venta a crédito a un cliente (`venta_credito`). Es venta, pero para impuestos cuenta cuando se cobra (`cobro_cliente`). |
| Corte de caja | El arqueo de la caja del negocio (E7.2). Lo normal es que sobre dinero: son las ventas en efectivo no anotadas. |

## 3. Qué ve el usuario

### 3.1 Activar el negocio

Ajustes → "Tengo un negocio" → nombre, régimen (**RESICO**, **Actividad empresarial o profesional**, **No sé**), ¿cobras IVA? (Sí / No / No sé), cuentas del negocio (caja, banco, terminal de cobro con su comisión) y compromisos fijos (renta del local, proveedores). También: "¿Cuánto has cobrado este año antes de hoy?" y "¿Tienes saldo a favor de IVA?" (para encadenar E15; se pueden dejar en 0).

- **RESICO:** tabla de la configuración (E15, modo `resico_pf`).
- **Actividad empresarial o profesional:** el ISR depende de la utilidad, así que se pide el porcentaje que indique su contador (modo `porcentaje`).
- **No sé, o sin porcentaje:** `porcentaje_por_defecto_bp` de la configuración (20 % mientras el contador no lo valide; conservador a propósito) y Hoy sugiere confirmarlo con su contador.

### 3.2 Hoy del negocio

Arriba de Hoy, un selector: **Personal · Tienda**. En el negocio:

```
Tienda                                       Dom 11 oct
Puedes retirar hasta
$15,900
sin dejar corto al negocio en los próximos 30 días

En caja, banco y terminal            $45,000
Compromisos (proveedor, renta)      −$20,000
Apartado para impuestos              −$4,100   próximo pago $900 el lun 19 oct
Colchón del negocio                  −$5,000

Vendido hoy $0 · este mes $160,000          [Corte de caja]
```

Cifras del vector E4-10 y de E15-02 ($900 de septiembre, vence el lun 19 oct) + E15-09 ($3,200 de octubre en curso, vence el 17 nov). Tocar "Apartado para impuestos" abre la tabla de E15 por mes con "Ya lo pagué".

### 3.3 Registrar

- Voz: "vendí 850", "compré mercancía 2,300 con la de Banorte", "le fié 150 a doña Mari", "doña Mari me pagó lo que debía", "saqué 3 mil de la caja para mí" (`06 §3.1`).
- Captura: notificaciones de terminales de cobro (`cobro_recibido`) y del banco del negocio (`07 §5`). Una entrada a una cuenta del negocio se propone como venta.
- Corte de caja (E7.2) al cerrar: "¿Cuánto hay en la caja?" → "Vendiste $2,700 en efectivo hoy. ¿Lo registro?".
- Con "¿cobras IVA?" = Sí, cada venta pregunta una vez "¿el precio ya incluye IVA?" (se recuerda por categoría) y guarda el IVA separado (`ivaIncluido`).

### 3.4 Impuestos

Tabla por mes (E15): base, tasa, ISR, IVA, retenciones, a pagar (ajustado a pesos), fecha límite y estado (estimado · pagado). "Ya lo pagué" registra `pago_impuestos` y marca el periodo. Aviso si la estimación del mes supera 20 % la del mes anterior y si se acerca al límite anual de RESICO. Leyenda fija: "Estimación para apartar dinero. Tu declaración la presentas tú o tu contador."

### 3.5 Reportes del mes

Ventas, gastos por categoría, impuestos pagados, retiros del dueño y **utilidad** (base de efectivo: ventas cobradas − gastos pagados − impuestos pagados). Comparativo contra el mes anterior.

## 4. Datos

- `cuenta.espacio` (`personal` | `negocio`); categorías únicas por espacio (`04 §2.3`).
- Tipos de transacción del negocio: `venta_credito`, `cobro_cliente`, `retiro_dueno`, `aportacion_dueno`, `pago_impuestos` (`04 §3.1`).
- `contraparte` con subtipo `cliente` para el fiado.
- `fiscal_movimiento` (IVA, retenciones, CFDI ligado) e `impuesto_periodo` (estado de cada mes) en la migración `0004_negocio` (`04 §3.3`).
- E15 recibe como **ventas cobradas**: ventas de contado del periodo + `cobro_cliente` del periodo (las `venta_credito` no cuentan hasta cobrarse).

## 5. Parámetros fiscales

`config/fiscal/2026.json`, con `estado: "por_validar"` hasta que un contador público lo firme en ESTADO:

```json
{
  "ejercicio": 2026,
  "estado": "por_validar",
  "fuentes": ["LISR art. 113-E (RESICO personas físicas)", "LISR art. 151 (deducciones personales)", "CFF art. 20 (ajuste a pesos)"],
  "dia_pago": 17,
  "iva_tasa_general_bp": 1600,
  "porcentaje_por_defecto_bp": 2000,
  "resico_pf": { "limite_anual": 350000000, "tabla_mensual": [ { "hasta": 2500000, "tasa_bp": 100 }, "…" ] },
  "tarifa_anual_isr": [ { "limite_inferior": 0, "cuota_fija": 0, "tasa_bp": 192 }, "… (art. 152 LISR)" ],
  "uma": { "diaria": 11731, "anual": 4279464 },
  "deducciones": { "…": "estructura de E13.config_prueba; formas de pago electrónicas 02, 03, 04, 28 y 29" }
}
```

> **Tip lectura (`config/fiscal/`):** centavos y puntos base en el JSON; `"POR_DEFINIR"` bloquea `validarConfigFiscal` hasta que un contador llene esos campos; la app solo calcula con `estado: "validado"`. Detalle, validación y SHA-256 para Decisiones (hash no lo revisa el cargador): `config/fiscal/README.md`.

- La UMA diaria de 2026 ($117.31) y el valor anual que de ella resulta ($42,794.64) se confirman con el INEGI antes de M12. Una fuente secundaria publicó $43,794.64 y, con eso, un tope de 5 UMA de $218,973. Es la razón por la que ningún valor fiscal se escribe en código ni se toma de blogs sin validar.
- Retenciones de plataformas digitales: las tasas cambiaron en 2026 (por ejemplo, la retención de ISR a vendedores en plataformas sube de 1 % a 2.5 % según la prensa especializada). La app no calcula esas retenciones: el usuario las registra o las importa del CFDI de retenciones que le da la plataforma, y E15 las acredita.

## 6. Paquete para tu contador (M12)

- Un ZIP por mes generado en el teléfono y compartido con la hoja nativa. Nada se sube.
- Contenido: `resumen.pdf` (una página: ventas, gastos, impuestos estimados y pagados, retiros, utilidad), `ventas.csv`, `gastos.csv`, `retiros_y_aportaciones.csv`, `impuestos_estimados.csv`, `cfdi/` (XML del periodo), y en enero `deducciones_personales.csv` del año anterior.
- CSV en UTF-8 con BOM (Excel en Windows los abre bien), separador coma, montos con punto y 2 decimales, fechas `YYYY-MM-DD`, una fila por transacción vigente. Columnas, en este orden:
  - `ventas.csv`: `fecha, descripcion, cuenta, forma (efectivo|tarjeta|transferencia|fiado_cobrado), total, iva, base, cfdi_uuid`
  - `gastos.csv`: `fecha, descripcion, categoria, cuenta, total, iva, con_cfdi (si|no), cfdi_uuid`
  - `retiros_y_aportaciones.csv`: `fecha, tipo (retiro|aportacion), cuenta_negocio, monto`
  - `impuestos_estimados.csv`: `periodo, modo, base_isr, tasa_porcentaje, isr_a_pagar, iva_a_pagar, total_ajustado, fecha_limite, estado (estimado|pagado)`
  - `deducciones_personales.csv`: `uuid, fecha, emisor_rfc, uso_cfdi, total, deducible (si|no), motivo`
- Canal: el contador que lo recibe ve "Generado con Cartera"; un código de contador (después de M13) daría descuento al cliente. Hipótesis a validar, no se construye en M12.

## 7. Lo que no hace

- **No emite facturas.** Emitir CFDI requiere un proveedor de certificación (PAC); una integración por API puede evaluarse después de M13.
- **No presenta declaraciones** ni guarda e.firma, contraseña del SAT o CSD.
- **No calcula nómina, IMSS ni PTU.**
- **No es contabilidad electrónica** (catálogo de cuentas SAT, balanza, pólizas).

Cada una de estas cambia el perfil regulatorio y de seguridad del producto: requieren análisis previo (`08 §1`).
