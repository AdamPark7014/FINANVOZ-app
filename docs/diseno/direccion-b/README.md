# Dirección B · «Plática»

Tableros que Adam eligió el 26-10-2026 del canvas «FinanVoz · 3 direcciones» (privado). Son la fuente de verdad
del diseño de la app desde esa fecha: sustituyen la cabecera y la navegación de la Ola 7 y las propuestas H2–H6 de
`../AUDITORIA-PRO-2026-10.md`. Decisión en `docs/ESTADO.md` (Decisiones, 26-10-2026).

> Hablas con alguien que lleva tus cuentas: él empieza, tú contestas, y nunca buscas un menú.

| Archivo | Qué muestra |
|---|---|
| `B0-ficha.png` | Intención, paleta clara y oscura, tipografía, navegación y voz |
| `B1-reposo.png` | Asistente en reposo: saludo, «Hoy puedes gastar», lo pendiente y «Puedes decirme» |
| `B2-registro.png` | Tras registrar por voz: píldora del día, lo que dijiste, «Listo, la registré.» y la tarjeta |
| `B3-alcanza.png` | «¿Me alcanza?» con las dos opciones y «Cómo lo calculé» |
| `B4-movimientos.png` | Movimientos: total del mes, filtros, frase por revisar y días |
| `B5-cuentas.png` | Cuentas: Tienes, Debes y Lo que viene |
| `B6-oscuro.png` | Asistente en reposo en oscuro (el claro sigue siendo el de omisión) |
| `C2-registro.png` | Solo para los chips de la tarjeta de registro (categoría · cuenta · día), el agregado de la dirección C |

## Lo que fija

- **Navegación:** arriba, el selector Asistente · Movimientos · Cuentas y el círculo con la inicial que lleva a Tú.
  Abajo nunca hay pestañas.
- **Voz:** un dock verde pino en las tres pantallas: «Escribir», el micrófono y la acción de la pantalla
  («¿Me alcanza?», «Buscar», «Agregar»).
- **Registro:** la categoría, la cuenta y el día son chips que se cambian de un toque (de C2), en lugar de «Cambiar».
- **Paleta:** Niebla `#F3F5F1`, Tarjeta `#FFFFFF`, Tinta `#12201B`, Pino `#0F3D32`, Menta `#5EE0B0`, Cifra
  `#0B6B55`; oscuro `#0B1512`, `#13201C`, `#1C3A31` y Menta. Tokens en `apps/movil/src/ui/tokens.ts`.

Los PNG salieron de los HTML del canvas con Chrome sin ventana a 402 × 874 (520 × 874 la ficha). Las cifras son
del escenario del canvas (quincena de $13,000 el vie 30, efectivo $600, BBVA $4,649, Nu $1,850); en la app salen
de los servicios y de `packages/core`, nunca de la UI.
