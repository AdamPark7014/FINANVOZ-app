# Dirección B+ · «Viva»

Segunda ronda sobre la dirección B (`../direccion-b/`), en el mismo canvas «FinanVoz · 3 direcciones» (privado), fila
«B+ · Viva». El 28-10-2026 Adam dijo que la app le «agrada pero no le encanta» y dejó la elección en nuestras manos;
se eligió el inicio **Tablero vivo** (`D1-reposo.png`). La otra opción, «La voz primero», queda solo como referencia
(`D1b-voz-no-elegida.png`). Decisión en `docs/ESTADO.md` (Decisiones, 28-10-2026).

Estos tableros mandan sobre los de B donde se contradicen. Lo que B ya fija y aquí no cambia: navegación arriba
(selector Asistente · Movimientos · Cuentas y el círculo de Tú), dock de voz verde pino, chips de un toque en la
tarjeta de registro, claro por omisión y letra Figtree.

| Archivo | Qué muestra |
|---|---|
| `D0-ficha.png` | Qué cambia frente a B, la paleta de categorías y el movimiento |
| `D1-reposo.png` | Inicio: orbe y saludo, «$275 al día», barra de tu dinero (apartado · colchón · libre), pista a la quincena y lo pendiente (la Nu) |
| `D2-escuchando.png` | «Te escucho»: pantalla pino, orbe grande con ondas, la frase en vivo, «Voy entendiendo» con chips y la onda de voz |
| `D3-registro.png` | Tras registrar: píldora con «−$7», orbe + «Listo, la registré.», tarjeta con mosaico de color, chips, «Tu día $275 → $268» con la barra recortada, «Deshacer» de 10 s y la racha |
| `D4-alcanza.png` | «¿Me alcanza?»: veredicto con orbe, las dos opciones lado a lado con su barra, «Cómo lo calculé» como barra apilada |
| `D5-movimientos.png` | Movimientos: frase del mes, «En qué se fue» (barra por categoría con leyenda), filtros, por revisar y días con íconos de color |
| `D6-cuentas.png` | Cuentas: tarjetas de cuenta con su color, la Nu con anillo de uso y pago sin intereses, «Lo que viene» como línea de tiempo |
| `D7-oscuro.png` | El inicio en oscuro |

## Lo que fija

- **Orbe:** círculo menta (`#5EE0B0`) con sombra interior; respira (escala 1 → 1.22, 3.2 s) en reposo y lanza ondas
  al escuchar. Es la cara del asistente: va junto al saludo y antes de cada respuesta.
- **Categorías:** mosaico claro + ícono oscuro, y un color de barra con luminosidad distinta entre sí:
  antojos `#FFF0D1`/`#7A4F00`/`#F2B33D`, comida fuera `#FFE4DB`/`#9C3417`/`#EE7650`, súper `#DDF5EA`/`#0B5E45`/`#2FB386`,
  transporte `#E1EBFF`/`#224C9E`/`#5B8DEF`, salidas `#EDE5FF`/`#5533A8`/`#9B7BF0`, casa `#E6ECE8`/`#0F3D32`/`#0F3D32`.
- **Barra de tu dinero:** apartado `#0F3D32`, colchón `#9CC5B5`, libre `#5EE0B0` (en oscuro `#3E7D6B`, `#8FB3A6`, menta).
- **Cuentas:** efectivo menta, débito azul `#1D3B6F`, crédito violeta `#5B2A86`; sin logotipos de bancos.
- **Movimiento:** las cifras cuentan hasta el valor nuevo; la barra del día se recorta al registrar; vibración corta al
  soltar el micrófono. Todo respeta «Reducir movimiento» del sistema.

Las cifras son las del escenario del canvas (las de B). Solo el gasto de octubre por categoría y la racha de 6 días
son de ejemplo para la maqueta; en la app salen de los servicios y de `packages/core`, nunca de la UI.
