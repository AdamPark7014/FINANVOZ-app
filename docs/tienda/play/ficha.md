# Ficha de Play Console — qué va en cada campo

Todo lo que pide **Crecimiento → Presencia en Google Play Store → Ficha principal de Play Store** y **Configuración
de la ficha**, con el archivo o el valor exacto. Play no tiene cuenta de servicio en este proyecto: la ficha se
captura por navegador (lo hace el coordinador con la cuenta NEXARA; a Adam solo le toca iniciar sesión). Los textos
se pegan sin el salto de línea final; `apps/movil/src/tienda.test.ts` ya los midió contra los límites.

App: **Finanvoz**, paquete `com.finanvoz.app`, id de Play Console `4974369200915032127`, idioma predeterminado
**Español (Latinoamérica) – es-419** (la ficha se escribe en español de México; Play no ofrece es-MX como
predeterminado y es-419 la cubre).

## Ficha principal de Play Store

| Campo de la consola | Valor | Límite |
| --- | --- | --- |
| Nombre de la app | archivo [`../titulo.txt`](../titulo.txt): `Finanvoz: gastos y tarjetas` | 30 |
| Descripción breve | archivo [`../descripcion-corta.txt`](../descripcion-corta.txt) | 80 |
| Descripción completa | archivo [`../descripcion-completa.txt`](../descripcion-completa.txt). **Antes de pegar**: la build 1.0.0 no tiene compras ni nube; la decisión de `PLAY-STORE.md` §4 es quitar el párrafo «PLUS» entero (desde «PLUS» hasta «…sin perder ningún dato.») hasta que RevenueCat esté activo. Lo demás se queda | 4,000 |
| Ícono de la app | `assets/marca/icono-512.png` (512 × 512, PNG de 32 bits, fondo a sangre sin transparencia, 41 KB; lo genera `scripts/tienda/iconos-tienda.py`) | 1 MB |
| Gráfico de funciones | `assets/marca/grafico-funciones-1024x500.png` (1024 × 500, «Cuánto puedes gastar hoy», sin capturas ni precios; `scripts/tienda/grafico-funciones.py`) | 15 MB |
| Capturas de pantalla del teléfono | `docs/tienda/capturas/android-telefono/*.png` en orden de nombre (`01-hoy` … `06-hoy-oscuro`), 1080 × 1920 PNG, enmarcadas por `scripts/tienda/enmarcar.py`. Entre 2 y 8; si el lote trae menos de 2, se sube el crudo de `maestro-capturas-android` sin marco | 2–8, ≤ 8 MB c/u |
| Capturas de tablet de 7" y 10" | Ninguna (la app es solo teléfono; dejar vacío no bloquea) | — |
| Video | Ninguno (opcional; el de la divulgación destacada es otro, `PLAY-STORE.md` §5.9) | — |

## Configuración de la ficha → Detalles de la app

| Campo | Valor |
| --- | --- |
| Categoría de la app | **Aplicación → Finanzas** |
| Etiquetas | Finanzas personales, Presupuesto (las que ofrezca la consola; máximo 5) |
| Correo electrónico de contacto | `gerencia@nexara.com.mx` (el del aviso de privacidad y de Ajustes › Ayuda; Play lo muestra en la ficha) |
| Teléfono de contacto | Vacío (opcional) |
| Sitio web | `https://adampark7014.github.io/FINANVOZ-app/` — provisional (GitHub Pages del repositorio público) hasta que exista `finanvoz.com`; cambiarlo entonces es un cambio de ficha, no de código |
| Detalles de contacto externos (ficha pública) | Correo: `gerencia@nexara.com.mx`; dirección: la del responsable del aviso (`apps/calculadora/src/responsable.json`) si Play la exige para la cuenta de organización |

## Configuración de la ficha → Política → Contenido de la app

Cada declaración está contestada en [`contenido-de-la-app.md`](contenido-de-la-app.md) y la de Seguridad de los
datos, pregunta por pregunta, en [`data-safety.md`](data-safety.md).

| Declaración | Valor corto |
| --- | --- |
| Política de privacidad | `https://adampark7014.github.io/FINANVOZ-app/aviso-de-privacidad.html` |
| Anuncios | No contiene anuncios |
| Acceso a la app | Toda la funcionalidad está disponible sin restricciones |
| Clasificación del contenido | Cuestionario IARC: todo «No»; resultado esperado «Para todos» |
| Público objetivo | 18 años o más |
| Seguridad de los datos | Build 1.0.0: no recopila ni comparte datos |
| Funciones financieras | Sí: gestión de finanzas personales (presupuesto y registro de gastos); nada más |
| ID de publicidad | No usa el ID de publicidad |

## Notas de la versión (producción o prueba cerrada)

Archivo [`../notas-version-1.0.0.txt`](../notas-version-1.0.0.txt) (≤ 500). Misma decisión que la descripción:
quitar la viñeta «Plus: …» hasta que RevenueCat esté activo. Idioma: es-419 (la consola pide la etiqueta
`<es-419>` si se pegan varias; con un solo idioma no hace falta).

## Cómo se regenera lo gráfico

```powershell
py -3 scripts/tienda/iconos-tienda.py        # icono-512 e icono-1024 a sangre
py -3 scripts/tienda/grafico-funciones.py    # gráfico 1024 × 500
# capturas: flujo «Android · Capturas de tienda» → artefacto capturas-enmarcadas-android → docs/tienda/capturas/android-telefono
```

Detalle de las capturas y del flujo: [`../capturas.md`](../capturas.md).
