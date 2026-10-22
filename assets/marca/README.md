# Marca: Finanvoz

Nombre comercial elegido por Adam el 2026-10-12: finanzas que se manejan con la voz. `finanvoz.com` estaba libre ese día (consulta RDAP de Verisign); se compra en Cloudflare Registrar. El repositorio interno y los identificadores del código siguen usando "Cartera" como nombre de trabajo; falta la búsqueda de marca en el IMPI (`docs/ESTADO.md`, pendiente 5).

## Ícono

Un globo de diálogo (la voz) con tres barras que suben (la onda de voz y "sí te alcanza"). Verde de acento sobre fondo degradado.

| Archivo | Uso |
|---|---|
| `icono.svg` | Fuente maestra (1024 × 1024, esquinas de 224) |
| `icono-1024.png` | App Store: **a sangre, RGB sin canal alfa** (ITMS-90717). Mismo glifo que `apps/movil/assets/icono-ios.png`; lo genera `scripts/tienda/iconos-tienda.py` |
| `icono-512.png` | Google Play: **a sangre, PNG de 32 bits con alfa opaco** (Play redondea solo); lo genera `iconos-tienda.py` |
| `icono-192.png` | Manifiesto web de la calculadora (`apps/calculadora/public/`, con esquinas redondeadas y transparencia) |
| `favicon-48.png` | Favicon de la calculadora |
| `grafico-funciones-1024x500.png` | Gráfico de funciones de Play: degradado, ícono y «Cuánto puedes gastar hoy»; lo genera `scripts/tienda/grafico-funciones.py` |
| `icono-primer-plano.svg` · `android-primer-plano-1024.png` | Ícono adaptativo de Android: primer plano dentro de la zona segura; fondo `#0E8A6E` |
| `icono-monocromo.svg` · `android-monocromo-1024.png` | Ícono temático de Android 13+ (una tinta) |

Colores: `#14A37F` (claro), `#0E8A6E` (acento), `#0A6B57` (oscuro), `#FFFFFF`.

Para regenerar los PNG, renderiza los SVG con cualquier navegador o con `rsvg-convert -w <tamaño>`. Los de tienda se
rehacen con `py -3 scripts/tienda/iconos-tienda.py` (compone el glifo sobre el degradado completo; `--verificar`
solo comprueba tamaño y alfa) y `py -3 scripts/tienda/grafico-funciones.py` (letra Inter, OFL, que se baja a la
carpeta temporal del sistema y no entra al repositorio).
