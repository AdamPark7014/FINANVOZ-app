# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-28
- **Rama:** main

## Hecho en este turno

- **Dirección B+ «Viva» (Adam, 28-10).** Se construye sobre B (commits `7f098a3`, `d1b6cfa`, `c4bff70`, `371fabb`,
  Figtree en `4fc3cad`) con los tableros de `docs/diseno/direccion-b-plus/` (D0–D7; `D1b` no se construye). Decisión
  en `docs/ESTADO.md` (Decisiones, 28-10-2026). Cinco fases, un commit verificado y un push por fase:
  1. Fundamentos · 2. Inicio «Tablero vivo» (D1, D7) · 3. «Te escucho» (D2) · 4. Registro (D3) y «¿Me alcanza?» (D4) ·
  5. Movimientos (D5) y Cuentas (D6).
- **Fase 1 hecha (fundamentos):** paletas nuevas en `ui/tokens.ts` — `coloresCategoria` (seis familias del tablero +
  `otros` gris; mosaico, ícono y barra en claro y oscuro), `familiaDeCategoria(slug)`, `coloresDinero` (apartado,
  colchón, libre, compra, recorte), `coloresCuenta` (efectivo menta, débito azul, crédito violeta), `coloresEscucha`
  (pantalla pino) y `orbe`; pruebas de contraste en `tokens.test.ts` (ícono/mosaico ≥ 4.5, textos de tarjetas y de
  «Te escucho» ≥ 4.5). Componentes `ui/componentes/Orbe.tsx` (respira en reposo, ondas al escuchar, quieto con
  «Reducir movimiento»; `Orbe.test.tsx`) y `Mosaico.tsx`; los ciclos de animación pasaron a `ui/movimiento.ts`. El
  mosaico ya va en cada fila de Movimientos (`mosaico-<id>`) y en la tarjeta de registro (`aviso-mosaico`). Íconos
  nuevos `cerrar` y `llama`. `02 §16` lo describe.
- **Fase 2 hecha (Inicio «Tablero vivo», D1 y D7):** `Reposo.tsx` con el orbe junto al saludo, «Hoy puedes gastar»,
  la cifra con «al día» y la frase de siempre (`hoy-fecha`, `hoy-puedes`, `hoy-secundario` sin cambios). Debajo,
  `BarraDinero.tsx` («De tus $X», barra apartado · colchón · libre con `ui/componentes/BarraApilada.tsx` y su leyenda;
  `partesDinero` en `asistente/textos.ts` es el mismo desglose de E4) con «Cómo lo calculé ›» = `boton-desglose`, que
  sigue abriendo `desglose` debajo. `PistaQuincena.tsx` con el servicio nuevo `servicios/pista.ts`
  (`pistaQuincena(ctx, proximoIngreso)` + `armarPista` puro, `pista.test.ts`): de hoy al ingreso, pagos fijos,
  «Pagar Nu» el día límite de una tarjeta con PNGI y el ingreso; con más de cinco días, hoy + días con algo + ingreso.
  Lo pendiente del pago de tarjeta es ahora una fila (mosaico violeta, «Tu Nu vence el jue 29», «Paga $1,420 y no
  generas intereses» o, vencida, «Pago para no generar intereses: $X», «Ya la pagué»); **«Todavía no» se quedó debajo
  en chico** aunque D1 no lo muestra (quitarlo dejaba sin salida). Pruebas: `asistente/direccion-b-plus.test.tsx`
  (D1) y una de D7 en `oscuro-b6.test.tsx`. `02 §4` y `§16` al día.
- **Fase 3 hecha («Te escucho», D2):** `pantallas/asistente/TeEscucho.tsx` a pantalla completa mientras
  `microfono.escuchando` (solo en el asistente; los paneles y la confirmación por voz siguen con la hoja chica). Tapa
  también la navegación con un portal: `pantallas/navegacion/CapaPantalla.tsx` (`AnfitrionCapa` en
  `app/(tabs)/_layout.tsx`; sin anfitrión, p. ej. en pruebas, se pinta encima de la pantalla). El toque que ya empezó
  en el micrófono del dock sigue siendo suyo: soltar termina y registra. «Voy entendiendo» con el servicio nuevo
  `servicios/entendiendo.ts` (`prepararEntendiendo(ctx)` → nivel 0 sobre la frase a medias, quitando hasta tres
  palabras del final; cuenta tentativa por prefijo; `entendiendo.test.ts`); `cuentasResolutor` ahora se exporta de
  `registrar.ts`. Onda con volumen: `MotorDictado.suscribirVolumen` opcional y `volumeChangeEventOptions` en
  `motor-expo.ts` (`nivelDeVolumen`, de −2..10 a 0..1); sin volumen se anima sola. «Desliza para cancelar»:
  `BotonHablar.alDeslizarFuera` + `pressRetentionOffset` de 64 pt en `MicrofonoAsistente`. La vibración al soltar ya
  existía (`voz/senales.ts`, expo-haptics ya era dependencia: no hay dependencia nueva). testIDs que siguen:
  `hoja-escuchando`, `transcripcion-en-vivo`, `boton-cancelar-escucha` (la X), `onda-voz`; nuevos `voy-entendiendo`,
  `entendido-*`, `pista-escucha`, `boton-terminar-escucha`. **Sin probar en teléfono real** (volumen y deslizar).
- **Fase 4 hecha (Registro D3 y «¿Me alcanza?» D4):** `TurnoRegistro` con el orbe y «Listo, lo registré.», mosaico,
  «Hoy, 9:41» (`DetalleRegistro.registradaEn`, la hora solo si es de hoy), chips con el punto de color y el ícono de
  la cuenta, «Tu día $X → $Y» (`ui/componentes/CifraQueCuenta.tsx`: la cifra cuenta por cuadros y `BarraDelDia` se
  recorta; quietas con «Reducir movimiento») y la racha (`servicios/racha.ts`: `diasSeguidos` puro +
  `rachaAnotando`, solo voz/texto/formulario, desde 3 días). Los turnos de registro traen `dia: {antes, despues,
  delta}` (`leerCambioDia` en `asistente/flujos/textos.ts` relee la frase de `lineaCambioDia`; la diferencia se
  calcula ahí, no en la UI) y la píldora muestra el «−$7» (`pildora-delta`). `TurnoPuedoGastar` con veredicto
  («Sí te alcanza.»/«No te alcanza.», `sublineaPuedoGastar` con el pronombre de «unos/una…»), las dos opciones lado a
  lado con su barra y «Cómo lo calculé» como barra apilada con «$575 libres ÷ 4 días = $143 al día»; el lector sigue
  oyendo la frase completa de `turno.texto` y los `calculo-*` siguen (ahora como leyenda). **El título dice «Listo, lo
  registré.»** (genérico) aunque D3 diga «la registré» (concordar con cada sustantivo no es confiable).
- **Fase 5 hecha (Movimientos D5 y Cuentas D6):** «En qué se fue» (`EnQueSeFue.tsx` + `agruparPorCategoria` puro y
  `enQueSeFue` en `servicios/movimientos.ts`, `en-que-se-fue.test.ts`: la suma da `salieron`; seis partes como máximo,
  lo demás en «Otros»), «entraron» en verde, por revisar en ámbar. Cuentas: `CarruselCuentas.tsx` (efectivo menta,
  débito azul, crédito violeta; testIDs de siempre `cuenta-<id>`, `-saldo`, `-accion` = contar el efectivo, `-ver` =
  «⋯» del efectivo, `-abrir`; las de crédito `carrusel-<id>`), `TarjetaCreditoLista` con `ui/componentes/AnilloUso.tsx`
  (`tarjeta-credito-<id>`, `cuenta-<id>-anillo-uso`), «Lo que viene» como línea de tiempo (`LoQueViene.tsx`, con los
  ingresos: `VistaCuentas.loQueViene` y `CuentaTienes.contadaEl` vía `fechaUltimoArqueo`). Debes solo con personas (o
  vacío). En pruebas, `jest.setup.ts` apaga `Animated.loop` (los bucles del orbe volvían lentísima la suite).
  Verificado: suite completa de jest 933/934 (la que falló, `estados-cuenta.test.tsx`, pasa sola: tiempo bajo carga,
  igual que antes `nube`, `respaldo`, `analitica-correccion-voz` y `masvs` en vitest) y vitest de la app 1159/1159.
- **Lo que se apartó de los tableros (a propósito):** «En qué se fue» usa los nombres reales de las categorías
  («Vivienda», «Entretenimiento») y no los de familia del tablero («Casa», «Salidas»), que mezclarían categorías (Salud
  saldría como «Súper»); «⋯» solo en el efectivo (es su único segundo botón; en el débito sería repetir «abrir»); bajo
  el débito va su tipo/••últimos 4 y no «Al día con tus avisos» (no hay ese dato por cuenta); «Todavía no» sigue en la
  fila del pago de tarjeta; «Listo, lo registré.» genérico; en «Te escucho» el micrófono de abajo no queda exactamente
  bajo el dedo del dock (el tablero lo sube para dejar la pista abajo).
- **Ojo con los colores del README de B+:** las barras de transporte (`#5B8DEF`) y salidas (`#9B7BF0`) tienen la misma
  luminosidad (0.275 y 0.274) aunque el README diga «luminosidad distinta»; se respetaron tal cual porque la leyenda
  dice nombre y cifra. Si Adam quiere distinguirlas sin color, hay que mover uno.
- **No se puede compilar Android aquí desde la app de escritorio:** `expo run:android` muere en el CMake de
  `expo-sqlite` con NTSTATUS 0xC0E90002 (política de integridad de código del proceso de Claude, igual que
  cursor-agent). La verificación visual es por las capturas de «iOS · Maestro» en GitHub.
- Turno anterior (27-10): dirección B «Plática» completa en cuatro fases (navegación arriba y dock, Asistente B1–B3,
  Movimientos y Cuentas B4–B5, oscuro B6); detalle en `git log` y en `02 §2`, `§4`, `§10`, `§11` y `§16`.

## Estado de tiendas

- **TestFlight 1.0.0 (14)** desde `dad15f2` (nivel 0 nuevo + tema claro + H1/H8/06): VALID e `IN_BETA_TESTING` en el
  grupo interno «Equipo Finanvoz (interno)» (acceso a todas las builds, Adam es el único tester), consultado por API el
  26-10. La 13 (`fce19b9`, tema claro sin el nivel 0 nuevo) queda superada.
- **Play**: el AAB que se sube es el 1.0.0 (versionCode 5) desde `dad15f2` (corrida 40410380877), firmado con la llave
  de subida (SHA-256 8F:67:…:05:00 comprobada); copia en `C:\dev\builds\FINANVOZ\1.0.0-5\bundle\release\app-release.aab`.
  El 4 queda superado.
- **Maestro de iPhone en `dad15f2`**: pasan 02, 04, 05, 06, 07, 08 y 09. Fallan 01 («Debes»: el desplazamiento deja la
  tarjeta arriba, fuera de pantalla) y 03 (`ajustes-terminos` está en pantalla y en el árbol, pero Maestro no lo da por
  visible al final de la lista): fallos del flujo, no de la app (capturas revisadas).
- **App Store Connect**: app creada el 22-10 (es-MX, SKU `FINANVOZ-IOS`); falta ficha, privacidad y revisión (§5–§7 de
  `docs/tienda/IOS-APP-STORE.md`). Ficha de Play en `docs/tienda/play/`.
- **Play**: no hay cuenta de servicio; subir a la prueba interna es a mano en la consola.
- Secretos de firma de iOS y Android cargados en GitHub el 22-10 (nombres en `docs/tienda/`; los valores viven fuera
  del repo). Flujos: `ios-testflight.yml`, `android-play.yml`.

## Backend y puerta de IA

- Backend propio en el Hetzner: `https://finanvoz-api.zynoratek.com` (Supabase mínimo; compose en
  `/opt/finanvoz-backend`, plantilla en `services/proxy/deploy/`). La IA va por la puerta única
  (`ANTHROPIC_BASE_URL=http://puerta-ia:8080`, token del proyecto en la carpeta local de secretos, nunca en el repo),
  Haiku 5.5 en modo herramienta, `NLU_PROVEEDORES=anthropic` (sin alterno: el 2.º intento es con Claude).
- Funciones al día con este turno (26-10). Para redesplegar: `bash services/proxy/scripts/desplegar-funciones.sh` y
  después `node services/proxy/scripts/probar-backend.mjs`.
- Evals de la nube: por la puerta con el token de `pruebas` (Haiku; nunca Opus de juez), `--concurrencia 2
  --por-minuto 30`. Al 26-10 el proyecto `pruebas` lleva ~3.6 de 4 USD del mes (también lo usan otras apps).
- Respaldo en la nube apagado hasta tener SMTP; sin respaldos de la base (decisión de Adam).

## Norte de producto (Adam, voz)

App que se siente trivial (hablar y listo) con motores, proxy y libro pesados detrás. Nada fuera de `01-PRD.md` sin
spec: web con el libro, facturar por voz, «todo el planeta» o SAT automático son decisiones de producto y legal.

## A medias — CUIDADO

- **El nivel 0 nuevo no está en ninguna build**: hace falta otra de TestFlight y otro AAB para probarlo en teléfono.
- **Ola 7 y la UI de Cursor sin probar en teléfono**: asistente, voz y onboarding por voz solo se han visto en jest y
  en el simulador de CI.
- **Maestro de iPhone nunca ha estado en verde**: pasan 02, 04, 05, 07, 08 y 09; 01 y 03 fallan por tiempos.
- M0, dominio `finanvoz.com` y aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa).
- Respaldar las llaves de Android fuera de la PC.

## Siguiente

1. Nueva build (TestFlight y AAB) con el nivel 0 nuevo y probar en teléfono frases como «unas chelas, 340 en
   efectivo», «le pasé 200 a mi jefa», «croquetas para el perro 640 con la oro» sin internet.
2. Adam prueba la build de `fce19b9` (tema claro, H1, H8, H10).
3. Adam decide la auditoría (`docs/diseno/AUDITORIA-PRO-2026-10.md`): propuestas 2–6 esperan su visto bueno.

## No tocar

- Solo `main`; sin ramas, PR ni reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal; `packages/core` E*; vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Emitir facturas, declaraciones u open banking con la clave del banco sin cambio de spec y legal.
- Credenciales fuera del repo (solo los scripts de Adam las leen); este archivo es público: sin correos, llaves ni
  enlaces privados.

## Estimación rápida

FinanVoz código ~95 %; camino a tiendas ~70 % (prueba interna en Play y TestFlight; faltan fichas públicas, dominio y
legal).
