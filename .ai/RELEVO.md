# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-27
- **Rama:** main

## Hecho en este turno

- **Dirección B «Plática» (decisión de Adam del 26-10, en curso).** Adam eligió B del canvas «FinanVoz · 3
  direcciones» con los chips de un toque de C en la tarjeta de registro. Decisión en `docs/ESTADO.md`; tableros B y C2
  en `docs/diseno/direccion-b/` (mandan sobre las maquetas anteriores); `02 §2`, `§4`, `§10` y `§11` reescritos.
  Fases: 1) navegación y dock, 2) Asistente B1–B3, 3) Movimientos y Cuentas, 4) oscuro; un commit verificado por fase.
  Falta la fase 4 (repaso en oscuro contra B6) y comparar las capturas de «iOS · Maestro» contra los PNG de B.
- **Fase 1 hecha:** navegación arriba (`src/pantallas/navegacion/NavegacionSuperior.tsx`, `tabBarPosition: 'top'`):
  segmentos `pestana-hoy|movimientos|cuentas` y el círculo «Tú» con testID `boton-ajustes` (la app no pide nombre: no
  hay inicial). Dock de voz (`DockVoz`, `DockSeccion`): en Asistente «Escribir» (`boton-escribir`), micrófono
  (`boton-hablar`) y «¿Me alcanza?» (`dock-me-alcanza`, escucha con «me alcanza para…»); en Movimientos «Buscar»
  (`boton-buscar`, `FiltroMovimientos.texto`) y en Cuentas «Agregar» (`boton-agregar` → `menu-agregar` con los
  `boton-agregar-*` de antes). Paleta B0 en `ui/tokens.ts` (tokens nuevos `dock`, `microfono`, `segmento`…; AA en
  `tokens.test.ts`). Íconos de línea con `react-native-svg` 15.15.4 (dependencia nueva, la del SDK 57).
- **Fase 2 hecha (Asistente B1–B3):** reposo (`Reposo.tsx`: saludo por hora en `hoy-fecha`, cifra `hoy-puedes`,
  «Cómo lo calculé ›» = `boton-desglose`, lo pendiente y «Puedes decirme» con los `chip-intencion-*`); con turnos de
  la sesión, la píldora (`PildoraDia`, también `boton-desglose`) y la conversación (lo del día en chico). Tarjeta de
  registro B2 en `TurnoRegistro` (`aviso`, `aviso-chip-categoria|cuenta|dia` → `aviso-opcion-*`, corrigen con
  `aplicarCorreccion`; «Deshacer» con anillo de 10 s; pista «Si oí mal…»). «¿Me alcanza?» B3 en `TurnoPuedoGastar`
  (dos opciones, «Cómo lo calculé», «Lo compré», «Recuérdamelo»). Servicios nuevos: `detalleRegistro`,
  `nombresLiquidez`. Pruebas: `fraseRegistro`/`oida` en `principal/__pruebas__/arnes.tsx` (la tarjeta dice la frase,
  no la muestra entera).
- **Fase 3 hecha (Movimientos B4 y Cuentas B5):** arriba de Movimientos la frase del mes (`movimientos-titulo`,
  servicio `totalesDelMes`); sin «Registrar» arriba (se registra con el dock; el vacío conserva
  `boton-registrar-primer-movimiento`); las frases por revisar plegadas en `por-revisar-resumen` (al abrirlo salen
  `revisar-*`/`descartar-*`); días en tarjetas con «−$25» a la derecha (`movimientos-dia-total-*`) e ícono por
  categoría. En Cuentas la frase «Tienes … y debes …» (`cuentas-titulo`, servicio `totalesCuentas`: los MSI cuentan y
  el saldo a favor no resta), secciones en tarjetas, «Lo que viene» (antes Compromisos) y, en cada tarjeta de crédito
  con pago para no generar intereses, la caja `cuenta-<id>-pngi` con «Pagar» (`cuenta-<id>-pagar`), que abre
  `/tarjetas/[id]?pagar=1` con el formulario de pago abierto (`pagarAlAbrir`). Chips de filtro con el estilo B.
  `02 §10` y `§11` al día.
- Maestro de iPhone en verde sobre `7f098a3` (fase 1); en las capturas «Movimientos» se partía en el segmento
  elegido: los segmentos ya no son tercios iguales.
- **No se puede compilar Android aquí desde la app de escritorio:** `expo run:android` muere en el CMake de
  `expo-sqlite` con NTSTATUS 0xC0E90002 (política de integridad de código del proceso de Claude, igual que
  cursor-agent). La verificación visual es por las capturas de «iOS · Maestro» en GitHub.
- Turno anterior (mismo día): intérprete «perfeccionado» — nivel 0 162/164 del golden sin red, nube 163/164 con Haiku
  5.5, ~0.003 USD por 1,000 frases; números en `docs/ESTADO.md` (Decisiones 26-10, M3) y `services/proxy/README.md`.

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
