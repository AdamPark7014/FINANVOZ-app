# Ficha de Google Play (borrador de M13)

La ficha en español de México de las dos tiendas. **App Store Connect ya tiene los textos, la categoría, la
clasificación por edad y las URLs**, subidos por API con `scripts/tienda/asc-ficha.py` (estado en
[`IOS-APP-STORE.md`](IOS-APP-STORE.md) §8); las capturas de iPhone las sube el mismo script cuando el lote esté en
`capturas/ios-6.9/`. **Play se captura por navegador** con [`play/ficha.md`](play/ficha.md) (no hay cuenta de
servicio). El video de la divulgación destacada y la revisión legal del aviso siguen siendo de Adam
(`docs/ESTADO.md` → Pendientes 25, 26 y 103).

| Documento | Para qué |
|---|---|
| [`IOS-APP-STORE.md`](IOS-APP-STORE.md) | App Store Connect: alta de la app, secretos y flujo «iOS · TestFlight», información de la app, etiqueta de privacidad, versión 1.0.0 con los textos de `ios/`, notas para la revisión, pendientes |
| [`PLAY-STORE.md`](PLAY-STORE.md) | Play Console: llave de subida y AAB, alta, prueba interna, ficha con los `.txt` de esta carpeta, «Contenido de la app» (seguridad de los datos, funciones financieras, divulgación destacada), pendientes |
| [`play/ficha.md`](play/ficha.md) | Play Console, campo por campo: qué archivo o valor va en cada uno (ícono, gráfico, capturas, correo, sitio, política, categoría) |
| [`play/data-safety.md`](play/data-safety.md) | Seguridad de los datos, pregunta por pregunta como la hace la consola, y qué cambia al activar cada servicio |
| [`play/contenido-de-la-app.md`](play/contenido-de-la-app.md) | Las demás declaraciones de «Contenido de la app» (anuncios, acceso, IARC, público, financieras, ID de publicidad…) |
| [`capturas.md`](capturas.md) | El pipeline de capturas (flujos `ios-capturas.yml` y `android-capturas.yml`, `enmarcar.py`, plan y titulares), el gráfico y el video |
| `capturas/ios-6.9/`, `capturas/android-telefono/` | El lote final enmarcado (1320 × 2868 y 1080 × 1920) que se sube a cada tienda |
| `scripts/tienda/` | `asc-ficha.py` (ficha de iOS por API), `iconos-tienda.py`, `grafico-funciones.py`, `enmarcar.py`, `capturas-android.sh` y el flujo Maestro de Android |

Páginas públicas que exigen las tiendas (aviso de privacidad y soporte): GitHub Pages del repositorio,
`https://adampark7014.github.io/FINANVOZ-app/aviso-de-privacidad.html` y `…/soporte.html`, publicadas por el flujo
«Publicar calculadora» (`destino: github-pages`). Provisionales hasta que exista `finanvoz.com`.

| Archivo | Campo de Play Console | Límite |
|---|---|---|
| `titulo.txt` | Nombre de la app | 30 caracteres |
| `descripcion-corta.txt` | Descripción breve | 80 caracteres |
| `descripcion-completa.txt` | Descripción completa | 4,000 caracteres |
| `notas-version-1.0.0.txt` | Novedades de la versión 1.0.0 | 500 caracteres |
| `capturas/android-telefono/*.png` | Capturas de teléfono (1080 × 1920) | 2 a 8 capturas |
| `capturas/ios-6.9/*.png` | App Store Connect: capturas de iPhone 6.9" (1320 × 2868) | 1 a 10 capturas |
| `ios/subtitulo.txt` | App Store Connect: Subtítulo | 30 caracteres |
| `ios/texto-promocional.txt` | App Store Connect: Texto promocional | 170 caracteres |
| `ios/descripcion.txt` | App Store Connect: Descripción (sin Android, Google Play, widget, Plus ni proveedor de IA mientras la build no los tenga) | 4,000 caracteres |
| `ios/palabras-clave.txt` | App Store Connect: Palabras clave (separadas por coma, sin espacios) | 100 caracteres |
| `ios/notas-revision.txt` | App Store Connect: Información de revisión → Notas (en inglés) | 4,000 caracteres |

Los archivos `.txt` son el texto exacto que se pega en la consola (sin el salto de línea final). `apps/movil/src/tienda.test.ts` (corre con `pnpm test`) los mide en caracteres Unicode contra los límites de Play y de App Store Connect y revisa las reglas de abajo.

## Reglas del texto

- Español de México, tuteo, sin signos de exclamación (`02 §14`).
- Nada que suene a asesoría financiera ni a promesa de resultados (`08 §1`): sin "ahorra", "inversión", "recomendamos", "garantizado", "mejora tu historial". La descripción completa lleva el texto fijo de `08 §1` igual que Acerca de (`TEXTO_NO_ASESORIA`).
- Sin términos que Play no permite en el título o en la descripción breve ("gratis", "mejor", "#1", "top", "nuevo", "oferta") ni emojis.
- Sin precios: los pone la tienda y cambian por país.
- La sección de privacidad dice exactamente lo que la app envía, igual que el centro de privacidad (`SALE_DEL_TELEFONO`) y la tabla de Data safety de `08 §3.2`:

| Lo que dice la ficha | Data safety (`08 §3.2`) |
|---|---|
| Cuentas, saldos y movimientos cifrados en el teléfono; solo salen dentro del respaldo cifrado si lo activas | Movimientos: no recopilado (procesado en el dispositivo); respaldo: información financiera, opcional, cifrada |
| Avisos del banco procesados en el teléfono | Texto de notificaciones: no recopilado |
| Frases que la app no entiende van al servidor y al proveedor de IA, sin guardarse; con Plus, en preguntas libres, también resultados agregados | Información financiera, recopilada, procesada de forma efímera, necesaria para la función. **Pendiente 84**: el aviso y Data safety aún no mencionan los resultados agregados del modo explicar |
| Reportes de errores sin montos ni texto | Diagnóstico, recopilado |
| Estadísticas opcionales | Actividad en la app, recopilada, opcional |
| Plus cobrado por Google Play | Historial de compras, recopilado |
| (no lo dice la ficha; lo dice el centro de privacidad) | Identificador anónimo de la app; correo de la cuenta de respaldo (opcional) |

Si cambia lo que la app envía, cambian en el mismo commit el centro de privacidad, el aviso, `08 §3.2` y esta ficha.
