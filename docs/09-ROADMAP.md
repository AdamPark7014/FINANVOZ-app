# 09 · Hitos de implementación

> Cada hito es una rebanada vertical con criterios de aceptación verificables. Se ejecuta con `/hito <id>` (`.claude/skills/hito`). Un hito no empieza si el anterior del que depende no está cerrado en `docs/ESTADO.md`.

```
M0 ─► M1 ─► M2 ─► M3 ─┬─► M4 ─┐
                      └─► M5 ─┴─► M6 ─► M7 ─► M8 ─► M9 ─► M10 ─► M11* ─► M12 ─► M13 ─┬─► M14
                                                                                    ├─► M15
                                                                                    └─► M16
* M11 arranca solo si se cumple la validación de 10 §1; si no, se registra en ESTADO y se pasa a M12.
```

| Hito | Nombre | Tamaño (días de trabajo enfocado) | Versión | Fecha comprometida |
|---|---|---|---|---|
| M0 | Calculadora pública "¿Cuántos MSI aguantas?" | 3–5 | — | **Publicada antes del 6 nov 2026** (Buen Fin: 13–17 nov) |
| M1 | Núcleo: motores, datos e intérprete de reglas | 5–8 | v1 | — |
| M2 | App base sin conexión | 10–14 | v1 | — |
| M3 | Intérprete en la nube | 4–6 | v1 | — |
| M4 | Tarjetas, MSI y compromisos | 6–8 | v1 | — |
| M5 | Captura automática Android y arqueo | 9–13 | v1 | — |
| M6 | Simulador y "¿Me alcanza?" | 4–6 | v1 | — |
| M7 | Beta cerrada en Google Play | 6–10 | v1 | — |
| M8 | Personas: cuentas divididas, cobros y tandas | 5–7 | v1 | — |
| M9 | Respaldo cifrado y cambio de teléfono | 6–9 | v1 | — |
| M10 | Suscripciones, plantillas remotas, widget y modo explicar | 7–10 | v1 | — |
| M11 | Perfil de negocio | 10–14 | v1 | Condicionado (`10 §1`) |
| M12 | Deducciones personales y paquete para el contador | 8–12 | v1 | — |
| M13 | Lanzamiento público | 5–8 | v1 | — |
| M14 | iPhone | 10–15 | v2 | — |
| M15 | Estados de cuenta en PDF | 6–10 | v2 | — |
| M16 | Gastos compartidos en pareja | 10–14 | v2 | — |

Recomendación: abrir la beta al cerrar M7 y publicar en producción al cerrar M9 (con respaldo); M10–M13 salen como actualizaciones.

## Definición de terminado (todos los hitos)

1. CI en verde: `lint`, `typecheck`, `test` y verificación del oráculo; `eval:nlu --nivel reglas` desde M1 y `eval:nlu --offline` desde M3 (antes no hay grabaciones).
2. Cada criterio `CA-Mx-NN` tiene en `docs/ESTADO.md` cómo se verificó (prueba, comando o pasos manuales con resultado).
3. Las decisiones tomadas por ambigüedad de la especificación están registradas en `docs/ESTADO.md` → Decisiones.
4. Ningún `TODO` sin entrada en `docs/ESTADO.md` → Pendientes.
5. La especificación (`docs/`) se actualiza en el mismo commit si el comportamiento cambió.

---

## M0 · Calculadora pública "¿Cuántos MSI aguantas?"

**Objetivo:** validar demanda y juntar lista de espera antes del Buen Fin, reutilizando el motor real.

**Entra:** monorepo (pnpm, TS estricto, ESLint, Prettier, Vitest, GitHub Actions con verificación del oráculo); `packages/core` con E1.1 y E10; `apps/calculadora` (Vite + React) estática, móvil primero; formulario de lista de espera (correo + 4 preguntas: ¿Android o iPhone?, ¿tu banco te avisa con notificación en cada compra?, ¿cuánto pagarías al mes?, ¿para qué lo usarías? Personal / Mi negocio o freelance / Soy contador) con casilla de consentimiento y aviso de privacidad de la lista de espera (`08 §2.1`); almacenamiento en Supabase mediante una Edge Function con límite por IP; despliegue estático.

**No entra:** app móvil, cuentas de usuario, analítica de terceros (solo conteo de envíos).

**Bloqueante externo:** la identidad del responsable del aviso de privacidad (nombre o razón social, domicilio y correo de contacto) la define Adam antes de publicar. Sin ella, CA-M0-07 no se cumple y no se publica.

**Pantalla:** ingreso mensual neto; pagos mensuales de deudas (de los cuales, MSI); compra opcional (precio y meses). Resultado: capacidad mensual, qué la limita, precio máximo por plazo (3, 6, 9, 12, 18, 24), veredicto de la compra, fuentes (Condusef 30 %, especialistas 10 % en MSI) y leyenda "no es asesoría".

| ID | Criterio |
|---|---|
| CA-M0-01 | `pnpm test` pasa todos los vectores `E1.distribuir_mayor_residuo` y `E10`. |
| CA-M0-02 | Dado ingreso $20,000, deudas $3,000 (MSI $1,000) y compra $12,000 a 12 meses, cuando calculo, entonces veo capacidad $1,000/mes, limitante "MSI" y "Sí cabe" con margen $0 (E10-01). |
| CA-M0-03 | Dado ingreso $15,000, deudas $5,000 (MSI $2,000), cuando calculo, entonces veo capacidad $0 y el mensaje de que ya rebasa la recomendación (E10-03). |
| CA-M0-04 | Lighthouse móvil ≥ 90 en Rendimiento y Accesibilidad. |
| CA-M0-05 | El formulario no envía sin consentimiento, rechaza correos inválidos y limita envíos por IP. |
| CA-M0-06 | Publicada en URL pública antes del 6 de noviembre de 2026. |
| CA-M0-07 | El aviso de privacidad de la lista de espera identifica al responsable (nombre o razón social, domicilio, correo de contacto), finalidades, encargados y cómo darse de baja; los montos que el usuario escribe en la calculadora no salen del navegador (verificado en la pestaña de red). |

Opcional: exportar la lista de espera a Brevo para campañas (agregar Brevo como encargado en el aviso).

---

## M1 · Núcleo: motores, datos e intérprete de reglas

**Entra:** `packages/core`: E1, E2 (constructores de asientos para todos los casos de `04 §4`), E3, E4, E5, E6, E7, E9, E11, E12, motor de plantillas (`07 §3`) y catálogo semilla de comercios (`07 §6`). `packages/datos`: esquema Drizzle, migración `0001_inicial` con triggers, vista `transaccion_vigente`, cuentas de sistema y catálogo; repositorio del libro (`registrar` con validación de patrón por tipo, `anular`, `reemplazar`, `saldo`); comprobación de integridad. `packages/nlu`: esquema Zod, `normalizarAlias`, resolutor, nivel 0 (`06 §9`), CLI `eval:nlu` para el nivel de reglas.

**No entra:** UI, E8, red.

| ID | Criterio |
|---|---|
| CA-M1-01 | Pasan todos los vectores de E1, E3, E4, E5, E6, E7, E9, E11, E12 y `NLU_resolver`. |
| CA-M1-02 | Propiedades I1–I5 de E2 con ≥ 1,000 corridas cada una. |
| CA-M1-03 | La migración crea todas las tablas en SQLite (Node). Fallan por trigger o `CHECK`: `UPDATE`/`DELETE` sobre `asiento`, cambiar `fecha` o `tipo` de una transacción, anular dos veces la misma transacción y anular una reversa. |
| CA-M1-04 | Registrar cada caso de `04 §4` del 1 al 23b, con sus variantes, produce exactamente los asientos documentados; un patrón de cuentas que no corresponde al tipo se rechaza; la comprobación de integridad devuelve vacío. Los casos 24 a 31 se prueban en M11 y M16, cuando existen sus categorías y tablas. |
| CA-M1-05 | `pnpm eval:nlu --nivel reglas`: cobertura 16/16 en casos `reglas: true` y precisión 100 %. |
| CA-M1-06 | Los 144 `esperado` del golden set validan con el esquema Zod y con `fixtures/nlu/esquema.json`; una prueba con casos inválidos (por ejemplo, `ingreso_recurrente` con regla `unica`, `mercancia` con `espacio: 'personal'` o un `compromiso` de `renta_local` sin `espacio`) confirma que ambos rechazan lo mismo. |
| CA-M1-07 | Los 12 ejemplos de `fixtures/notificaciones` pasan con el motor de plantillas; `OXXO GAS` → gasolina y `UBER EATS` → comida fuera. |
| CA-M1-08 | Cobertura de líneas de `packages/core` ≥ 90 %. |

---

## M2 · App base sin conexión

**Entra:** app Expo (Android); apertura de la base con SQLCipher y llave en almacén seguro; migraciones al arrancar; onboarding O1–O7 con tarjetas completas en O4 (`02 §3.1`: ciclo, límite, modo, saldo obligatorio y MSI que ya existían) y pagos fijos en O5 (O6 muestra "Disponible pronto"); Hoy con E3.3, E4, tarjetas de acción y estados de `02 §4`; programados y ocurrencias con cobertura **manual** (Ya la pagué · Todavía no · Ya no aplica; la automática llega en M4); deudas con personas e interruptor "Apartar lo que le debo"; registro por voz y texto con nivel 0 (lo no cubierto queda "por interpretar") y formulario de movimiento para los tipos que origina el usuario; registro optimista con Deshacer; Movimientos; Cuentas; Ajustes con exportar, borrar todo y bloqueo (RF-CFG-03); consentimiento con evidencia; cargador de escenarios semilla (`fixtures/escenarios`, `pnpm --filter movil semilla <id>`, solo en builds de desarrollo); Sentry con depuración; tokens de diseño.

**No entra:** cierre de cortes ni reclasificación MSI (M4); captura (M5); probabilidad (M6).

| ID | Criterio |
|---|---|
| CA-M2-01 | Un flujo de Maestro completa el onboarding en el emulador; cronometrado manualmente, una persona nueva lo termina en ≤ 4 min. |
| CA-M2-02 | Dado modo avión, cuando digo o escribo "coca 25 en efectivo", entonces se registra, el efectivo baja $25 y aparece "Deshacer"; al tocar Deshacer el efectivo vuelve a su valor. |
| CA-M2-03 | Con la semilla `e4-01`, Hoy muestra "$214", "4 días para tu quincena (jue 15)" y el desglose del vector. |
| CA-M2-04 | El archivo de la base no se abre con `sqlite3` sin llave; exportar genera JSON y CSV; borrar todo deja la app como recién instalada. |
| CA-M2-05 | Sin aceptar el consentimiento no se escribe ningún dato; al aceptarlo queda la evidencia local. |
| CA-M2-06 | Una prueba intercepta los eventos de Sentry y falla si contienen montos, comercios, alias o texto dictado. |
| CA-M2-07 | Se define el teléfono de referencia y se registran en ESTADO las mediciones de RNF-01 aplicables (arranque, E4, nivel 0). |
| CA-M2-08 | Con reloj inyectado en el 15 oct sin depósito (E3-11), Hoy muestra el estado "día de pago" con $456 (E4-05); al registrar el depósito, recalcula con el horizonte al 30 oct. |
| CA-M2-09 | Con la semilla `e4-01` más un préstamo recibido de la jefa por $2,000 a BBVA (apartado), Hoy sigue en $214 (E4-09); al apagar "Apartar lo que le debo", sube. |
| CA-M2-10 | Un compromiso vencido sin cubrir aparece como "¿Ya pagaste…?"; "Todavía no" lo mantiene reservado; "Ya la pagué" registra el gasto y cubre la ocurrencia; "Ya no aplica" la omite y E4 deja de reservarla. |
| CA-M2-11 | Con el bloqueo activado, al volver a la app después de 1 min en segundo plano se pide biometría o el PIN del sistema; con "ocultar en multitarea", la vista previa sale en blanco. |
| CA-M2-12 | Onboarding de una tarjeta con MSI que ya existían y "No sé" en "¿El saldo ya los incluye?": no se resta del saldo y Hoy muestra una vez el aviso de `02 §3.1`. |

---

## M3 · Intérprete en la nube

**Entra:** proyecto Supabase; sesión anónima; Edge Function `/nlu/interpretar` con adaptadores para ≥ 2 proveedores, salida estructurada con el esquema de proveedor (`06 §10.1`), reintento, proveedor alterno, límites y registro solo de metadatos; nivel 2 en la app con validación Zod y cola "por interpretar"; correcciones (incluida "pasar a meses" como intención; su efecto contable llega en M4), anulaciones y revisar duplicados por voz (`06 §7`); configurar compromisos por voz; política de confirmación completa; benchmark y elección de modelo.

| ID | Criterio |
|---|---|
| CA-M3-01 | `pnpm eval:nlu --nivel nube` con el modelo elegido cumple todos los umbrales de `06 §8`; el reporte comparativo y la decisión están en ESTADO. |
| CA-M3-02 | Dado red, cuando digo "me eché unos tacos de 80 con la Nu y una coca de 25 en efectivo", entonces se registran 2 movimientos correctos. |
| CA-M3-03 | Cuando después digo "no, los tacos fueron en efectivo", entonces se reemplaza el movimiento: la deuda de Nu vuelve a su valor, el efectivo baja $80 y el historial muestra el cambio. |
| CA-M3-04 | El proxy responde 401 sin JWT, 429 al rebasar límites y sus registros no contienen cuerpos (prueba). |
| CA-M3-05 | Frases guardadas sin red se interpretan al reconectar, en orden. |
| CA-M3-06 | `pnpm eval:nlu --offline` reproduce el reporte con grabaciones y corre en CI. |
| CA-M3-07 | Prueba de contrato del esquema de proveedor por cada adaptador (`06 §10.1`): sin palabras clave fuera de la lista permitida y todos los `esperado` del golden set validan contra la proyección. |
| CA-M3-08 | "La renta son 6,500 cada día primero" crea el programado mensual y sus ocurrencias; "me pagaron 2,000" sin destino queda en entradas por asignar y no sube el "hoy puedes". |

---

## M4 · Tarjetas, MSI y compromisos

**Entra:** configuración de tarjetas por voz y formulario; cierre de corte idempotente solo de cortes posteriores al alta (E5.3, `cortesAProcesar`); PNGI derivado; MSI con alta, calendario, reclasificación (E6.2) y compromiso de 12 meses; MSI que ya existían (E6.1); pasar a meses y liquidar MSI (E6.2); tarjetas en modo plan con pagos planeados (RF-TAR-06); cobertura **automática** de ocurrencias (E3.5); tarjeta del día; avisos de corte y fecha límite con horario silencioso; pantalla Tarjetas con saldo a favor.

| ID | Criterio |
|---|---|
| CA-M4-01 | Con reloj inyectado del 11 oct 2026 al 31 ene 2027 y el plan E6-01, se generan exactamente 3 reclasificaciones; repetir el proceso no duplica nada. |
| CA-M4-02 | En un caso guionado, el PNGI mostrado = saldo al corte − pagos posteriores. |
| CA-M4-03 | Con la semilla `e5-10`, la tarjeta del día es "Banamex Oro ••8812" con 50 días. |
| CA-M4-04 | Los avisos de fecha límite se programan 3 días antes y respetan el horario silencioso. |
| CA-M4-05 | Programado "Netflix $219 el día 14" + cargo de $219 en ±3 días → ocurrencia cubierta y E4 deja de reservarla (E3-36). |
| CA-M4-06 | "Compré una tele de 12 mil a 12 meses sin intereses con la oro" crea el plan, el gasto completo en su categoría y 12 meses de compromiso visibles. |
| CA-M4-07 | Una tarjeta dada de alta el 11 oct con corte el día 10 procesa sus cortes a partir del 10 nov y nunca uno anterior o igual al alta (E6-07 a E6-09). |
| CA-M4-08 | Un MSI que ya existía (mensualidad $1,000, faltan 7) genera las cuotas de E6-06, no aparece como gasto en ningún reporte y E4 reserva solo la cuota que vence dentro del horizonte. |
| CA-M4-09 | Pasar a meses un cargo de $12,000 deja la deuda revolvente como estaba antes del cargo, crea el plan y el gasto aparece una sola vez. |
| CA-M4-10 | Un pago que deja saldo a favor con un plan activo pregunta "¿Este pago fue para liquidar tus meses?"; al confirmar, el plan queda liquidado y no se generan más cuotas. El saldo a favor nunca sube el "hoy puedes" (E4-07). |
| CA-M4-11 | La cobertura automática reproduce E3-30 a E3-36 con movimientos reales del libro (luz variable se cubre sola; renta fija con monto distinto pregunta). |
| CA-M4-12 | Tarjeta en modo plan: con pagos planeados, E4 reserva solo los que vencen en el horizonte; sin pagos planeados, la deuda completa (E4-08). |

---

## M5 · Captura automática Android y arqueo

**Spikes previos (máx. 1 día cada uno, resultado en ESTADO):** S1 servicio de notificaciones en un Samsung y un Xiaomi reales (sobrevive cierre de app y reinicio); S2 modo diagnóstico y captura de formatos reales de los bancos de los probadores.

**Entra:** `modules/captura-android` + config plugin; divulgación destacada; lista blanca; cola; ingesta idempotente con la huella de `07 §2.4`; mapeo por etiqueta de `adb` en builds de depuración; los pasos de `07 §5` (pareja de transferencia con tránsito, duplicados, registro, ocurrencias); plantillas reales de ≥ 6 bancos; categorización; "¿Fue a meses?"; tarjeta nueva detectada; captura inactiva; semilla `e-captura`; arqueo completo (`02 §7`) con los gastos por asignar marcados primero.

| ID | Criterio |
|---|---|
| CA-M5-01 | Con la semilla `e-captura`, los 12 ejemplos producen exactamente los resultados por notificación, los saldos finales y la lista "Por revisar" de `fixtures/escenarios/e-captura.json`: en una prueba de integración que inyecta la cola (CI) y, en build de depuración, publicándolos con `adb shell cmd notification post` y la etiqueta de cada banco. |
| CA-M5-02 | Una notificación de una app no autorizada no aparece en la cola ni se persiste (prueba instrumentada). |
| CA-M5-03 | "Coca 25" dictada sin método + notificación de cargo de $25 en la Nu el mismo día → una sola transacción vigente con la Nu como cuenta y la descripción dictada; `pasivo:por_asignar` vuelve a 0 (E9-38). |
| CA-M5-04 | N-04 y N-08 producen un solo `pago_tarjeta` de Banco A a la tarjeta ••8812 y el tránsito queda en 0, en cualquier orden de llegada; mientras falta la salida, el tránsito negativo resta del dinero libre. |
| CA-M5-05 | Arqueo con saldo $640, un gasto por asignar de $25 marcado como efectivo y respuesta $300 → la cifra esperada es $615 y la propuesta es la del vector E7-08 (faltan $315); al confirmar, el efectivo queda en $300 y los gastos quedan marcados como estimados. |
| CA-M5-06 | Con 72 h simuladas sin eventos y apps bancarias instaladas, aparece el aviso de captura inactiva. |
| CA-M5-07 | Plantillas reales de ≥ 6 bancos, cada una con ejemplo anonimizado y prueba. |
| CA-M5-08 | El servicio sobrevive cierre de la app y reinicio en las 2 marcas del spike S1 (pasos y resultado documentados). |
| CA-M5-09 | Una salida sin pareja después de 24 h pregunta "¿A quién le mandaste $X?" y cada respuesta produce los asientos del caso 18 de `04 §4`. |
| CA-M5-10 | La misma notificación procesada dos veces (reconexión del servicio) se registra una vez; dos notificaciones idénticas con `cuando` distinto se registran dos veces. |
| CA-M5-11 | Con la tarjeta ••8812 en modo plan y un pago planeado de $4,200 para el 12 oct, el `pago_tarjeta` que forman N-04 y N-08 cubre esa ocurrencia en cualquier orden de llegada y E4 deja de reservarla; una `transferencia` entre cuentas propias del mismo monto que la quincena no la cubre. |

---

## M6 · Simulador y "¿Me alcanza?"

**Entra:** E8 completo (PRNG, semilla diaria, pools, simulación por bloques); constructor de historial (`05 §E8.2`); Hoy con probabilidad (K = 1) y estados de datos; "¿Me alcanza?" con `generarEscenarios`, `compararEscenarios`, notas, recomendación, "cómo lo calculé" y "Lo compré"; calibración local E8.6.

| ID | Criterio |
|---|---|
| CA-M6-01 | Pasan todos los vectores E8: exactos (`exitos`, cuantiles), analíticos con su tolerancia, E8-21 a E8-23 y E8-30. |
| CA-M6-02 | E8 con K = 1 y N = 10,000 tarda < 150 ms en el teléfono de referencia y la UI no se congela durante el cálculo. |
| CA-M6-03 | Inyectando el resultado de E8-22, la pantalla muestra "< 1 %", "89 %", "79 %" y "90 %" y la frase "Puedes. Lo más seguro: a 3 MSI con la Oro". |
| CA-M6-04 | El constructor de historial reproduce E8-30 y, sobre un libro de prueba, excluye transferencias, pagos de tarjeta, compras MSI, movimientos que cubrieron ocurrencias, extraordinarias, anuladas y reversas; incluye días en 0. |
| CA-M6-05 | Con 13 días de historial se ve "Necesito 2 semanas…"; con 20, la etiqueta "estimación inicial". |
| CA-M6-06 | La probabilidad no cambia al volver a abrir Hoy el mismo día. |
| CA-M6-07 | Con reloj inyectado, al cerrar un horizonte se guarda el resultado y se calcula el Brier. |
| CA-M6-08 | Los cinco casos de E8-23 producen los escenarios esperados y, en pantalla, las notas `uso_alto` y `sin_tarjeta_para_msi` con el texto de `02 §9`. |

---

## M7 · Beta cerrada en Google Play

**Entra:** RevenueCat, paywall, prueba de 14 días, planes Gratis y Plus de `01 §11` aplicados en app y proxy (webhook); consultas tipadas (RF-CON-01); aviso de riesgo (P < 50 %); centro de privacidad completo; aviso de privacidad con revisión legal; Data safety y declaración de funciones financieras; video de la divulgación; checklist MASVS L1; PostHog con lista blanca y opt-in; accesibilidad; EAS Submit a pista cerrada; 30–50 probadores; tablero de métricas del PRD §10.

| ID | Criterio |
|---|---|
| CA-M7-01 | Una compra con licencia de prueba de Play activa Plus; la cancelación lo desactiva al vencer; el webhook actualiza los derechos en el proxy. |
| CA-M7-02 | Un usuario Gratis recibe un mensaje claro al agotar 30 interpretaciones del mes y el nivel de reglas sigue funcionando. |
| CA-M7-03 | Las consultas Q01–Q11 del golden set responden con la plantilla correcta sobre la semilla `e4-01` (Q12, suscripciones, llega en M10; Q13, explicar, en M10). |
| CA-M7-04 | Checklist `08 §7.1` completo. |
| CA-M7-05 | TalkBack recorre Hoy, registro y arqueo; con texto al 200 % no se corta ninguna cifra. |
| CA-M7-06 | Build en pista cerrada con ≥ 30 probadores y tablero con la métrica norte y las de insumo. |
| CA-M7-07 | Al terminar la prueba sin pagar, la cuenta vuelve a Gratis: todos los datos siguen visibles y editables, exportar funciona y solo se ocultan las funciones de Plus (`01 §11`). |

---

## M8 · Personas: cuentas divididas, cobros y tandas

**Entra:** cuenta dividida por voz y formulario con contactos (E12.1); "Cobrar" con mensaje y datos de cobro (`02 §17`); recordatorios de cobro; tandas (migración `0002_tandas`, creación por voz TK01 y formulario, calendario, programado de aportaciones, `cobro_tanda`, dinero en riesgo; `02 §18`); tarjetas de Hoy de la tanda.

| ID | Criterio |
|---|---|
| CA-M8-01 | "Cena de 1,200 entre 4 con la Nu" con tres contactos produce los asientos del caso 8 de `04 §4`; "Te deben" muestra $300 por persona; un cobro de $300 de Caro deja su saldo en 0. |
| CA-M8-02 | "Cobrar" arma el mensaje de `02 §17` con los datos de cobro y abre la hoja de compartir; sin datos de cobro, primero los pide. |
| CA-M8-03 | Con reloj del 16 oct 2026, crear la tanda de E11-01 produce las 10 rondas del vector, la ronda 4 marcada como cobro y 10 ocurrencias de aportación. |
| CA-M8-04 | Hoy aparta la aportación que cae en el horizonte; "Ya la di" registra `aportacion_tanda` y cubre la ocurrencia; "Me tocó la tanda" registra `cobro_tanda` sin ingreso; el saldo negativo de la tanda no entra en `deudas_personas`. |
| CA-M8-05 | El dinero en riesgo mostrado después de cada ronda coincide con `en_riesgo` de E11-01. |
| CA-M8-06 | Registrar la tanda de E11-03 (empezó el 4 sep) con reloj del 11 oct propone 6 aportaciones hechas y "ya cobraste"; guarda el saldo inicial de −$2,000 (caso 23b), crea las 6 ocurrencias pasadas como `omitida` y deja 4 pendientes (16, 23 y 30 de octubre y 6 de noviembre); E4 aparta solo las que caen antes del fin del horizonte. |

---

## M9 · Respaldo cifrado y cambio de teléfono

**Spike previo (≤ 1 día):** biblioteca de criptografía (`03 §3`) y tiempo de scrypt con `n = 2^17` en el teléfono de referencia.

**Entra:** `packages/respaldo` (E16) con criptografía inyectada; exportar e importar `.cartera`; cuenta de respaldo con correo y código (Supabase Auth); Storage con RLS; endpoints `/respaldo/url` y `/respaldo/lista`; respaldo automático semanal con Wi-Fi; restauración en el primer arranque; aviso a los 14 días (`02 §19`).

| ID | Criterio |
|---|---|
| CA-M9-01 | `packages/respaldo` abre `fixtures/respaldo/ejemplo.cartera` con la contraseña de `kat.json` y reproduce su contenido; rechaza `ejemplo-alterado.cartera` y una contraseña equivocada con el mismo error. Pasan los vectores `E16.kdf` en Node y en una prueba instrumentada en el teléfono. |
| CA-M9-02 | Ida y vuelta: semilla `e4-01` + 50,000 asientos generados → exportar → importar en una instalación limpia → mismos saldos, mismo Hoy, integridad vacía; < 30 s (RNF-11). |
| CA-M9-03 | Tiempo de scrypt registrado en ESTADO; si `n = 2^17` tarda más de 3 s, la decisión de bajar a `2^16` queda registrada. |
| CA-M9-04 | El respaldo automático sube en segundo plano y conserva solo los 4 más recientes; el blob guardado no contiene montos, nombres ni comercios legibles (prueba con `strings`). |
| CA-M9-05 | Restaurar en un segundo emulador con correo, código y contraseña reproduce el estado; una cuenta no puede listar ni bajar respaldos de otra (prueba de RLS). |
| CA-M9-06 | Con 14 días simulados sin respaldo aparece el aviso. |
| CA-M9-07 | Antes de publicar en producción: aviso de privacidad y Data safety actualizados con el respaldo en la nube y el correo (`08 §2.2`, `08 §3.2`), y borrar la cuenta de respaldo elimina sus archivos de punta a punta. |
| CA-M9-08 | La tarea automática respalda con el teléfono bloqueado usando la llave guardada (la contraseña no está en ningún almacenamiento); cambiar la contraseña genera sal y llave nuevas y el respaldo anterior se sigue abriendo con la contraseña anterior. Un encabezado con parámetros fuera de la lista blanca de E16 se rechaza sin derivar la llave. |

---

## M10 · Suscripciones, plantillas remotas, widget y modo explicar

**Spike previo (≤ 1 día):** widget de Android con la biblioteca de `03 §3` en un build de desarrollo.

**Entra:** E14 en la tarea diaria, pantalla de suscripciones y "Convertir en compromiso" (`02 §20`); plantillas remotas firmadas (`07 §3.1`, migración `0003_suscripciones`); widget (`02 §21`); modo explicar (`/llm/turno`, herramientas en el teléfono, validación de cifras; `02 §22`).

| ID | Criterio |
|---|---|
| CA-M10-01 | Pasan los vectores E14; con un libro equivalente a E14-01, la pantalla muestra las 5 suscripciones activas con los montos y fechas de `02 §20`, "Pagas unos $1,626 al mes", "antes $115" en Spotify y Disney Plus en "Ya no se cobran"; Q12 del golden set responde con esa lista. |
| CA-M10-02 | "Convertir en compromiso" crea el programado; E4 aparta el siguiente cargo si cae en el horizonte y el cargo real cubre la ocurrencia (E3.5). |
| CA-M10-03 | Un build de depuración configurado con la llave pública de prueba acepta `fixtures/plantillas-firmadas/plantillas.json`, rechaza el archivo con un byte cambiado, rechaza una versión ≤ la activa y, sin red, sigue con las plantillas embebidas. |
| CA-M10-04 | El build de producción no contiene la llave de prueba de RFC 8032 (prueba automática). |
| CA-M10-05 | Con la semilla `e4-01`, el widget muestra "Hoy puedes $214 · 4 días", se actualiza ≤ 5 s después de registrar con la app abierta y "Ocultar montos" oculta las cifras. |
| CA-M10-06 | Para 5 preguntas guionadas sobre datos semilla, toda cifra de la respuesta aparece en un resultado de herramienta (verificación automática); una cifra inventada a propósito cae en la respuesta de plantilla. |

---

## M11 · Perfil de negocio

**Antes de empezar:** verificar la condición de `10 §1` con los datos de M0 y M7 y registrar el resultado en ESTADO. Si no se cumple, M11 queda "Saltado" y se pasa a M12.

**Entra:** `docs/10-NEGOCIO.md` §3–§5; migración `0004_negocio`; espacios y E4 por espacio; corte de caja (E7.2); E15 con `config/fiscal/2026.json` (`por_validar`); frases del negocio (NG01–NG08) y traducciones de `06 §3.1`; movimientos que cruzan espacios (`04 §2.4`); comisión de terminales; captura de terminales (`07 §5`, semilla `e-negocio`); reportes del mes; widget del negocio; plan Negocio con RevenueCat.

| ID | Criterio |
|---|---|
| CA-M11-01 | Con la semilla `e-negocio`, Hoy del negocio muestra "Puedes retirar hasta $15,900", compromisos $20,000 e impuestos $4,100 con "próximo pago $900 el lun 19 oct" (E4-10, E15-02, E15-09); el espacio personal no cambia. |
| CA-M11-02 | Pasan E7-20 a E7-23; en la app, con la semilla `e-negocio` (caja esperada $2,000), un corte con $4,700 propone "Vendiste $2,700 en efectivo" y al confirmar registra el caso 28 de `04 §4`. |
| CA-M11-03 | Pasan los vectores E15; la pantalla de impuestos reproduce E15-09 ($3,200 de octubre) y, después de N-20, muestra $3,212. |
| CA-M11-04 | "Ya lo pagué" registra `pago_impuestos` (caso 27) y E4 deja de apartar ese periodo. |
| CA-M11-05 | NG01–NG08 cumplen los umbrales de `06 §8`; "le fié 150 a doña Mari" crea `venta_credito`, "doña Mari me pagó" crea `cobro_cliente`, "saqué 3 mil de la caja para mí" crea `retiro_dueno` (caso 26): L personal sube $3,000 y L del negocio baja $3,000; y "la renta del local son 8 mil cada día 5" crea un programado con `espacio = negocio` que aparta E4 del negocio y no el personal. |
| CA-M11-06 | Con `e-negocio`, N-20 registra una venta de $580 y una comisión de $20.30 en la terminal (caso 30) y N-21 una `transferencia_pendiente`; a las 24 h la pregunta propone "Banorte del negocio ••7730". Los saldos finales coinciden con `esperado.saldos_finales` de la semilla. |
| CA-M11-07 | Ningún valor fiscal está escrito en `packages/` ni en `apps/` (prueba que busca `8333333`, `20833333`, `350000000` y `1600` fuera de `config/` y de las pruebas); la configuración se valida con Zod y, mientras su estado sea `por_validar`, la pantalla muestra "parámetros sin validar". |
| CA-M11-08 | Sin el plan Negocio, el espacio se puede crear y llenar, pero "Puedes retirar", impuestos, corte de caja, reportes y paquete muestran el paywall; ningún dato se bloquea. |
| CA-M11-09 | Los casos 24 a 30 de `04 §4` producen los asientos documentados; el caso 29 deja `activo:transito` en 0 y el gasto personal entra a E8; E9-50 y E9-51 pasan. Con el sueldo del dueño programado y dictado ("me cayó mi sueldo, 8,000 en BBVA"), las dos capturas del depósito desde la cuenta del negocio dejan, en cualquier orden de llegada, un solo `retiro_dueno` que cubre la ocurrencia: L personal sube $8,000 una sola vez. |
| CA-M11-10 | Bloqueante de publicación: un build de producción no muestra el espacio negocio mientras `config/fiscal/2026.json` esté `por_validar` (bandera de función; `08 §5`). |
| CA-M11-11 | "El predial del local son 4 mil el 31 de enero" crea un compromiso `otros_impuestos` del negocio; con el reloj inyectado del 5 de enero de 2027, E4 del negocio lo aparta (el 11 de octubre todavía no: está fuera del horizonte de 30 días); "pagué el ISR desde Banorte" siempre muestra la confirmación con el periodo más antiguo sin pagar; "pago 3 mil de impuestos cada mes" no crea programado y explica que E15 ya aparta el ISR y el IVA; pagar el predial es un `gasto` que no marca ningún periodo de E15. |

---

## M12 · Deducciones personales y paquete para el contador

**Entra:** `packages/fiscal` (E13.1) y E13.2–E13.3 en `core`; migración `0005_cfdi`; importar XML o ZIP por la hoja de compartir y el selector de archivos; pantalla de deducciones con alumno, nivel y lentes; aviso preventivo de efectivo; paquete para el contador (`10 §6`) si hay negocio.

**Bloqueante externo:** un contador público valida `config/fiscal/2026.json` (deducciones y RESICO). Sin esa validación el hito puede cerrarse con el criterio CA-M12-06 como pendiente aceptado, pero M13 no.

| ID | Criterio |
|---|---|
| CA-M12-01 | Pasan los vectores E13 (lectura de los 9 CFDI de `fixtures/cfdi/`, incluido el rechazo del 3.3; `decimal_a_centavos`; E13-10, E13-11 y E13-12, factura PPD pagada después; `E13.isr_por_tarifa`; E13-20 a E13-22). |
| CA-M12-02 | Importar `fixtures/cfdi` como ZIP por la hoja de compartir: 8 importados y 1 rechazado con mensaje; reimportar no duplica (UUID). |
| CA-M12-03 | Con `ajuste.perfil_fiscal` = RFC `PEPJ800101AB1` e ingresos de $300,000, y los CFDI y etiquetas de E13-10, la pantalla muestra $25,900 deducibles y cada exclusión con su motivo en lenguaje llano; al confirmar el pago del PPD por transferencia, $30,900 (E13-12). |
| CA-M12-04 | Registrar "consulta médica de 800 en efectivo" muestra el aviso preventivo de `02 §24`. |
| CA-M12-05 | El paquete de octubre 2026 con la semilla `e-negocio` contiene los archivos de `10 §6`; los CSV tienen BOM UTF-8 y exactamente las columnas de `10 §6`, en ese orden; `resumen.pdf` se genera; no hay tráfico de red durante la generación (prueba). Si M11 se saltó, este criterio es "no aplica". |
| CA-M12-06 | La validación del contador queda registrada en ESTADO (nombre, cédula profesional, fecha, archivo validado). Pendiente de verificación manual hasta entonces. |

---

## M13 · Lanzamiento público

**Entra:** checklist `08 §7.2`; ficha de Play (título, descripción, capturas, video); revisión legal final; pase de rendimiento y accesibilidad; ayuda en la app (preguntas frecuentes de la beta y correo de contacto); despliegue escalonado en producción; tablero de métricas.

| ID | Criterio |
|---|---|
| CA-M13-01 | Checklist `08 §7.2` completo. |
| CA-M13-02 | RNF-01, RNF-08, RNF-09 y RNF-11 medidos y dentro de meta, con resultados en ESTADO. |
| CA-M13-03 | Publicación en producción con despliegue escalonado (10 % → 100 %) y notas de versión; detener el despliegue se probó en la pista interna. |
| CA-M13-04 | Ayuda en la app con las 10 preguntas más frecuentes de la beta y correo de contacto. |
| CA-M13-05 | Tablero con las métricas de `01 §10` funcionando con datos reales. |

---

## M14 · iPhone (v2)

**Spike previo (≤ 2 días):** S8 de `01 §13` en un iPhone real (`07 §7`).

**Entra:** build de iOS con EAS; `modules/intents-ios` (App Intent `RegistrarMovimiento`) con config plugin; onboarding de iOS (`02 §25`); adaptador de Foundation Models como nivel 1 donde exista; etiquetas de privacidad de App Store; TestFlight.

| ID | Criterio |
|---|---|
| CA-M14-01 | El spike documenta en ESTADO qué campos entrega la automatización "Transacción" en la versión vigente de iOS. |
| CA-M14-02 | Un pago real con Apple Pay crea una captura `apple_pay` y el gasto en la tarjeta asociada ≤ 10 s después de que corre la automatización. |
| CA-M14-03 | Los flujos E2E de v1 (salvo la captura de Android) pasan en el simulador de iOS con Maestro. |
| CA-M14-04 | El adaptador de Foundation Models se evalúa con el golden set; se usa solo si cumple los umbrales de `06 §8` en los casos que responde; si no, se usa la nube. Reporte en ESTADO. |
| CA-M14-05 | TestFlight con ≥ 10 probadores y etiquetas de privacidad completas. |

---

## M15 · Estados de cuenta en PDF (v2)

**Spike previo (≤ 1 día):** biblioteca de extracción de texto de PDF en Android (`07 §8`).

**Entra:** recibir el PDF por la hoja de compartir; extracción de texto en el teléfono; analizadores de ≥ 3 bancos probados con PDF **sintéticos** generados en el repositorio (`fixtures/pdf/`, se crean en este hito); conciliación y alta de faltantes con E9.3 (`02 §26`).

| ID | Criterio |
|---|---|
| CA-M15-01 | Los PDF sintéticos de 3 bancos producen exactamente el JSON esperado (periodo, corte, límite, saldo al corte, PNGI, movimientos, MSI). |
| CA-M15-02 | Un estado con 42 movimientos de los que 39 ya existen agrega exactamente 3 y propone una conciliación si el saldo difiere. |
| CA-M15-03 | Ningún contenido del PDF sale del teléfono (prueba de red); un PDF escaneado muestra "No puedo leer PDFs escaneados". |

---

## M16 · Gastos compartidos en pareja (v2)

**Entra:** `packages/sincronizacion` (E17) con XChaCha20-Poly1305; intercambio de llave por QR (la llave y un código de unión de un solo uso viajan en el QR); tablas `eventos_compartidos`, `grupos_compartidos` y `miembros_compartidos` con RLS por pertenencia al grupo y endpoints `/compartido/*` (`03 §5.10`, `03 §6`); migración `0006_compartido`; E12.2 en la app; pantallas de `02 §27`.

| ID | Criterio |
|---|---|
| CA-M16-01 | Pasan los vectores `E12.reparto_pareja` y `E12.balance_pareja` (incluido E12-21, pagos para saldar). |
| CA-M16-02 | Prueba de propiedades: cualquier orden de llegada, con duplicados, de los mismos eventos produce el mismo saldo. |
| CA-M16-03 | En dos emuladores, A crea el grupo y B escanea el QR; con los gastos de E12-20, ambos ven "A le debe a B $1,600.01". |
| CA-M16-04 | El servidor solo guarda texto cifrado (inspección de la tabla); una tercera cuenta no puede leer ni publicar en el grupo (403). |
| CA-M16-05 | Salir del grupo lo cierra sin dejar saldos distintos: A publica un evento y sale antes de que B lo descargue; B lo descarga después del cierre, ve "Ana cerró el grupo compartido" y los dos quedan con el mismo saldo. Un evento que B publicó antes del cierre le llega a A antes de que A borre la llave. Después, publicar responde 403 `grupo_cerrado` a los dos; un evento de B creado sin conexión se anula en su libro con aviso; la llave ya no está en el almacén seguro de A; un grupo nuevo entre las mismas personas usa una llave distinta. |
| CA-M16-06 | Lo que le debes a tu pareja entra en `deudas_personas` de E4; el caso 31 de `04 §4` produce los asientos documentados; restaurar un respaldo recupera la llave del grupo (E16); restaurar desde archivo en otro teléfono (sesión nueva, `no_miembro`) o sin la llave ofrece "Volver a vincular", que funciona con un QR nuevo emitido por la otra persona (`/compartido/codigo`), y el teléfono anterior deja de tener acceso. |

---

## Después de M16

Ideas registradas, sin plan: portal para contadores con varios clientes (requiere servidor con datos financieros: nuevo ADR y análisis legal), emisión de facturas mediante un PAC, varios negocios por usuario, código de contador con descuento, modelo en el dispositivo para Android cuando exista uno del sistema.
