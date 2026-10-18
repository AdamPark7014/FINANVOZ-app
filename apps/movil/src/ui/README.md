# ui/

Componentes y tokens de FinanVoz (`docs/02-UX` §15–§16). Las pantallas importan desde `../../ui`; colores y tipografía salen de `tokens.ts` / `useTema()`, no de literales sueltos.

> **Tip:** en `StyleSheet` y props de layout, usa solo `espacio.*` y `margenPantalla` para `gap`, `padding` y márgenes horizontales; no literales en dp. Escala base 4 en `tokens.ts`: `xxs` 2, `xs` 4, `s` 8, `m` 12, `l` 16, `xl` 24, `xxl` 32, `xxxl` 48.

| Token | Uso habitual |
|---|---|
| `espacio` | Separación entre bloques, filas de botones, listas |
| `margenPantalla` | Margen lateral de `Pantalla` (= `espacio.l`) |
| `radio` | Esquinas de tarjetas, campos y botones |
| `tipo` / `Cifra` | Texto y montos (cifras tabulares) |
| `OBJETIVO_TACTIL_MIN` | Altura mínima de controles (48 dp) |

Contraste WCAG: pares en `tokens.test.ts`. Marca en `assets/marca/README.md`.

**Accesibilidad:** los controles llevan `accessibilityLabel` (cifras en palabras vía `etiquetaHablada` / `Cifra`); el texto visible duplicado va oculto al lector con `accessibilityElementsHidden`. Campos con error usan `accessibilityState.invalid`; barras de progreso, `accessibilityValue`.
