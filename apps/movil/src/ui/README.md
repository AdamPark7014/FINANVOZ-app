# ui/

Componentes y tokens de FinanVoz (`docs/02-UX` §15–§16). Las pantallas importan desde `../../ui`; colores y tipografía salen de `tokens.ts` / `useTema()`, no de literales sueltos.

> **Tip:** para `gap`, `padding` y márgenes usa solo `espacio` y `margenPantalla`; no números sueltos en dp (escala base 4: `xxs` 2 → `xxxl` 48).

| Token | Uso habitual |
|---|---|
| `espacio` | Separación entre bloques, filas de botones, listas |
| `margenPantalla` | Margen lateral de `Pantalla` (= `espacio.l`) |
| `radio` | Esquinas de tarjetas, campos y botones |
| `tipo` / `Cifra` | Texto y montos (cifras tabulares) |
| `OBJETIVO_TACTIL_MIN` | Altura mínima de controles (48 dp) |

Contraste WCAG: pares en `tokens.test.ts`. Marca en `assets/marca/README.md`.
