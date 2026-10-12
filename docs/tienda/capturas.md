# Plan de capturas, gráfico y video (M13)

Todas salen de un build de desarrollo con los escenarios semilla de `fixtures/escenarios` (Ajustes → tocar 7 veces la versión → elegir escenario, o `pnpm --filter movil semilla <id>`), nunca con datos de una persona. Teléfono en español, tema claro salvo donde se indica, letra del sistema al 100 %, hora del sistema 10:00, batería y señal llenas, sin notificaciones en la barra. Formato: PNG vertical 1080 × 1920 (9:16), sin marcos de teléfono ni texto encima que prometa resultados.

| # | Pantalla | Escenario | Qué se ve | Cómo llegar |
|---|---|---|---|---|
| 1 | Hoy | `e4-01` | "Hoy puedes gastar $214", "4 días para tu quincena (jue 15)" y el desglose abierto (efectivo y débito, reservado, colchón, libre) | Abrir la app; tocar la cifra para el desglose |
| 2 | Registrar por voz | `e4-01` | El aviso "Registré: Coca $25 · Antojos · Efectivo — Deshacer" | Mantener el botón de voz y decir «coca 25 en efectivo» |
| 3 | Capturas automáticas | `e-captura` | Movimientos con la insignia `automático` y el filtro "Por revisar" | Pestaña Movimientos |
| 4 | Arqueo | `e4-01` | "Deberías traer … en efectivo. ¿Cuánto traes?" con las opciones | Cuentas → Contar mi efectivo |
| 5 | Tarjeta y meses | `e5-10` | Detalle de una tarjeta: corte, fecha límite, pago para no generar intereses y meses activos | Cuentas → Debes → una tarjeta |
| 6 | ¿Me alcanza? (Plus) | `e5-10` con Plus de prueba | Comparación de contado, a meses y esperar para «unos tenis de 1,500» | Hoy → ¿Me alcanza? (Plus de prueba con la tienda de pruebas de RevenueCat) |
| 7 | Privacidad | `e4-01` | "Qué sale de tu teléfono y a quién" | Ajustes → Privacidad |
| 8 | Hoy en tema oscuro | `e4-01` | La captura 1 en tema oscuro | Tema oscuro del sistema |

Pendiente de definir con los escenarios: la captura 6 necesita historial suficiente para la probabilidad (si `e5-10` muestra "Necesito 2 semanas…", proponer un escenario con historial como cambio de `fixtures/`, regla 7).

## Gráfico de funciones

1024 × 500, fondo con el degradado de marca (`assets/marca`), el ícono y la frase "Cuánto puedes gastar hoy". Sin capturas encimadas ni precios.

## Video

- **Ficha (opcional):** 30 a 60 s en YouTube, mismo guion que las capturas 1 → 2 → 3 → 5, sin música con derechos de terceros.
- **Revisión de Play (obligatorio, pendiente 25):** la divulgación destacada de `08 §3.1` desde Hoy hasta la captura de un movimiento; no es el mismo video de la ficha.
