# Estado del proyecto

> Lo mantiene Claude Code al ejecutar `/hito`. Es el registro de verdad de qué está hecho, cómo se verificó y qué se decidió. Si una sesión se interrumpe, se retoma desde aquí.

## Tablero

| Hito | Estado | Inicio | Cierre | Notas |
|---|---|---|---|---|
| M0 · Calculadora pública | En curso | 2026-10-12 | | Fecha comprometida: antes del 6 nov 2026. Código fusionado; falta publicar (pendientes 11 y 12). M1 avanza en paralelo porque lo que falta de M0 es solo externo |
| M1 · Núcleo | Cerrado | 2026-10-12 | 2026-10-12 | Todos los criterios verificados; PR #4 fusionado |
| M2 · App base sin conexión | En curso | 2026-10-12 | | Sobre main con M1 fusionado |
| M3 · Intérprete en la nube | Pendiente | | | |
| M4 · Tarjetas, MSI y compromisos | Pendiente | | | |
| M5 · Captura Android y arqueo | Pendiente | | | |
| M6 · Simulador y ¿Me alcanza? | Pendiente | | | |
| M7 · Beta cerrada | Pendiente | | | Al cerrar: decidir M11 (`10 §1`) |
| M8 · Personas y tandas | Pendiente | | | |
| M9 · Respaldo cifrado | Pendiente | | | Recomendado: publicar en producción al cerrar |
| M10 · Suscripciones, plantillas remotas, widget, explicar | Pendiente | | | |
| M11 · Perfil de negocio | Pendiente | | | Condicionado (`10 §1`) |
| M12 · Deducciones y paquete para el contador | Pendiente | | | Bloqueante externo: validación del contador |
| M13 · Lanzamiento público | Pendiente | | | |
| M14 · iPhone (v2) | Pendiente | | | |
| M15 · Estados de cuenta en PDF (v2) | Pendiente | | | |
| M16 · Gastos compartidos en pareja (v2) | Pendiente | | | |

Estados: Pendiente · En curso · Cerrado · Cerrado con pendientes aceptados · Saltado (con motivo).

## Decisiones

| Fecha | Hito | Decisión | Motivo | Docs afectados |
|---|---|---|---|---|
| 2026-10-11 | Especificación | Gramática del nivel 0 exige descripción conocida cuando no hay verbo | Una implementación de referencia contra el golden set encontró falsos positivos ("tengo 4,200 en BBVA" como gasto) | `06 §9` |
| 2026-10-11 | Especificación | "¿Me alcanza?" evalúa todos los escenarios en la misma ventana y con la misma semilla | Sin eso, MSI sale favorecido porque sus cuotas quedan fuera de la ventana | `05 §E8.5` |
| 2026-10-11 | Especificación | Revisión independiente de 20 hallazgos aplicada (vectores v2): horizonte hasta el ingreso no recibido y +3 días en día de pago o retraso; una sola regla de cobertura de ocurrencias (E3.5); historial de E8 sin movimientos que cubrieron ocurrencias y con arqueos repartidos; tránsito y cuentas puente conservadores; MSI existentes y cortes solo posteriores al alta; marcados antes del hueco en el arqueo; saldo a favor sin dinero libre; tarjeta en plan sin pagos reservada completa; deudas con personas apartadas; porcentajes "< 1 %" y "> 99 %"; huella con clave y `cuando` | Errores de cálculo y casos sin especificar encontrados por un revisor que no había visto el trabajo | `03` ADR-013 a 015, `04`, `05`, `07 §2.4` |
| 2026-10-11 | Especificación | Todos los datos son gratis; Plus vende análisis; exportar siempre gratis; al cancelar se vuelve a Gratis sin bloquear datos | Limitar tarjetas en Gratis volvía incorrecto el "hoy puedes" y retenía datos del usuario | `01 §11` |
| 2026-10-11 | Especificación | Esquema del intérprete con variantes por tipo de regla y de ajuste; golden set de 140 casos (C08, K06, K07, NG01–NG05, TK01, TK02, DD01) | Zod usa uniones discriminadas; el JSON Schema debe rechazar lo mismo | `06 §3`, `fixtures/nlu/` |
| 2026-10-11 | Especificación | El oráculo se verifica comparando JSON (`node scripts/oraculo.mjs --verificar`), no con `diff` de texto | `diff` y los finales de línea fallan en Windows | `CLAUDE.md`, `03 §11` |
| 2026-10-11 | Especificación | Plan completo: v1 = M0–M13, v2 = M14–M16; M11 condicionado a la validación de demanda | Pedido de Adam: dejar todo el plan ejecutable; la condición evita construir el negocio sin evidencia | `01 §7`, `09`, `10 §1` |
| 2026-10-11 | Especificación | El negocio es un espacio dentro del mismo libro (atributo de la cuenta), no otra base | Retiros del dueño como transferencias, un solo respaldo, cifras separadas | `03` ADR-016, `04 §2.4`, `10` |
| 2026-10-11 | Especificación | Parámetros fiscales en `config/fiscal/<año>.json` validados por contador; vectores con parámetros sintéticos (E13) y con la tabla de la LISR (E15) | Una fuente secundaria publicó una UMA anual 2026 inconsistente con su valor diario; ningún valor fiscal se toma sin validar | `03` ADR-019, `10 §5` |
| 2026-10-11 | Especificación | La skill de verificación se llama `/verificar` | Una skill de proyecto llamada `verify` reemplaza un comando integrado de Claude Code | `.claude/skills/`, `CLAUDE.md` |
| 2026-10-11 | Especificación | Segunda revisión independiente (25 hallazgos sobre M8–M16) aplicada: resolutor con alias en todos los espacios; descomposición de movimientos entre espacios y `retiro_dueno`/`aportacion_dueno` en E9.4 (E9-50); llave del respaldo automático derivada y guardada en el almacén seguro, lista blanca de parámetros y `maxmem`; forma de pago real de un PPD confirmado (E13-12); `redondear` definido y ajuste del CFF por impuesto (E15-10); seis cuentas de sistema por espacio; `programado.espacio` y `hasta` inclusivo; tanda que ya existía (E11-03); categorías exclusivas del negocio con `if/then` en el esquema; regla `anual` (E3-08, E3-09); `monto_anterior` y fórmula mensual en E14 (E14-03); perfil fiscal del usuario; comisión de terminales; contabilidad y pagos de pareja (E12-21); criterios de publicación en M9 y M11; plantillas firmadas con los campos de `07 §3.1`; golden set de 143 casos (NG06, NG07, K08) | Huecos de especificación que habrían obligado a adivinar en dinero, privacidad o seguridad | `04`, `05`, `06`, `07`, `09`, `10`, `fixtures/` |
| 2026-10-11 | Especificación | Re-verificación de la segunda revisión (23 hallazgos resueltos, 2 parciales y 7 nuevos, todos aplicados): el sueldo del dueño cubre su ocurrencia aunque la salida del negocio llegue primero (E9-51); comisión de terminal obligatoria (5 % si no se sabe) y "Corregir saldo" de una terminal registrado como comisión; préstamos y pagos con la pareja en los patrones de `04 §3.1`; `retiro_dueno` y `aportacion_dueno` con tarjeta de crédito; eventos compartidos con `evento_anulado`, blob `{tipo, creado_en, cuerpo}`, pertenencia con RLS y salida que cierra el grupo; llave de la base accesible con el teléfono bloqueado; `compromiso` con `espacio` y categorías exclusivas (NG08: golden set de 144 casos) y regla del negocio en el prompt; día del compromiso de una suscripción sin acotar; widget del negocio con el plan Negocio. Una verificación independiente de esas correcciones agregó: una pareja de E9.4 absorbe el movimiento dictado que representa el mismo dinero y un `pago_tarjeta` resultante pasa por E3.5; E3.5 dice qué movimientos cuentan (una transferencia propia nunca cubre la quincena); comisiones supuestas en `ajuste.negocio.comisiones_por_confirmar`; E17 con ids UUIDv4, traducción a la entrada de E12.2, "Volver a vincular" con `/compartido/codigo`, 403 desde las funciones con código (`no_miembro`, `grupo_cerrado`) y cierre que deja el mismo saldo a los dos (quien sale descarga hasta `cerrado_en` antes de borrar la llave); si cualquiera de las dos mitades de una pareja tiene una pregunta de E9.3 pendiente, el par espera la respuesta; `impuestos` es solo ISR e IVA (E15, sin compromiso propio) y la categoría nueva `otros_impuestos` (predial del local, nómina, licencias) es un gasto y compromiso normal; `pago_impuestos` marca el periodo indicado; todas las llaves del almacén seguro accesibles con el teléfono bloqueado | Un revisor revisó las correcciones y encontró casos que aún obligaban a adivinar en captura, privacidad, sincronización y el intérprete | `02`, `03`, `04`, `05`, `06`, `07`, `09`, `fixtures/nlu/` |
| 2026-10-12 | M0 | Nombre comercial: **Finanvoz**, elegido por Adam (`finanvoz.com` libre según RDAP de Verisign el 2026-10-12; otras opciones libres que se descartaron: Cifrali, Alcanzi). Repositorio en GitHub `FINANVOZ-app`; los identificadores del código siguen como "Cartera" | Suena profesional y dice que la app se maneja con la voz | `assets/marca/`, `apps/calculadora/src/config.ts` |
| 2026-10-12 | M0 | E10 rechaza `pagos_msi > pagos_deuda` con `ErrorDominio('msi_mayor_que_deuda')`; la calculadora pide corregirlo | Los MSI son parte del total de deudas; adivinar cuál de los dos está mal podría inflar la capacidad | `05 §E10` (sin cambio de fórmula) |
| 2026-10-12 | M0 | E10 devuelve además `rebasaRecomendacion` (algún tope se pasa, no solo se iguala) para elegir entre "ya rebasan la recomendación" (E10-03) y "ya estás justo en el tope" | CA-M0-03 pide el mensaje de rebase; con capacidad 0 exacta no sería cierto | `05 §E10` |
| 2026-10-12 | M0 | Límite por IP: 5 envíos por hora con una huella SHA-256 de la IP con sal secreta, borrada a las 24 h; campo trampa para bots; la lista se conserva hasta la baja o 12 meses después del lanzamiento | CA-M0-05 pide límite por IP sin guardar la IP; el aviso necesita decir cuánto se guardan los datos | `08 §2.1`, aviso en `apps/calculadora/src/Aviso.tsx` |
| 2026-10-12 | M0 | Despliegue estático en Cloudflare Pages con flujo manual que falla si faltan los datos del responsable (`verificar-publicacion`) | Adam comprará el dominio en Cloudflare; el bloqueo hace cumplir CA-M0-07 | `.github/workflows/publicar-calculadora.yml` |
| 2026-10-12 | M0 | Los datos del responsable y la URL de la lista de espera entran como variables `VITE_*` del despliegue, no en el código | Se pueden definir sin tocar el código y el aviso muestra "[pendiente de definir]" en desarrollo | `apps/calculadora/src/config.ts` |
| 2026-10-12 | M0 | Responsable del aviso: NEW ENGINEERING EXPERTISE AND RESOURCE ADVANCEMENT S.A. DE C.V. (NEXARA), con el domicilio y correo de su aviso oficial; los datos fiscales y legales los confirmó Adam | Adam lo eligió en el hilo del proyecto | `08 §2`, `apps/calculadora/src/responsable.json` |
| 2026-10-12 | M1 | E3.5 recibe la similitud de comercio (E9.2) inyectada; sin ella el comercio no coincide y el egreso sigue reservado (regla 12). Se cablea `(a,b)=>similitud(normalizarComercio(a),normalizarComercio(b))`; E3-36 se prueba con E9 real. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E3.3 sin próximo ingreso conocido: horizonte fijo de 30 días con estado `ingreso_variable` (la especificación no lo define y el oráculo falla). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E3.5 desempate final: índice menor; diferencias relativas comparadas con multiplicación cruzada entera. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E4 recibe tarjetas y MSI como entradas simples; `puedesRetirar(r)=max(0,libre)` para el negocio. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E4: liquidez, saldo_revolvente e impuestos_estimados pueden ser negativos (impuestos negativos = 0); el resto, centavos ≥ 0. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E7: saldo_contable puede ser negativo; efectivo_real, marcados e historial ≥ 0; categorías por monto desc y luego slug. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E11 recibe `proximasFechas` (E3.2) inyectado; las pruebas usan el E3 real. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E5.2: tarjetas con límite 0 se omiten; sin tarjeta totalera → `sin_credito_disponible` (como el oráculo). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E5: configuración exige exactamente uno de diasParaPagar/diaLimitePago, días 1–31; si no, `tarjeta_invalida`. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | E11 `yaCobro` = aportaciones ≥ turno. E12 `balancePareja`: los pagos de liquidación anulados tampoco cuentan. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Plantilla que coincide sin monto válido → `no_reconocida` sin plantilla (va a "Por revisar"). Paquete desconocido → `no_reconocida`, `banco: null`. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Se rechazan expresiones con banderas g o y; una plantilla inválida rechaza el archivo completo (`plantillas_invalidas`). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Prefijos del catálogo normalizados con E9.1 al cargar ("7 ELEVEN" → "ELEVEN"); "SAM'S CLUB" normaliza a "SAM CLUB" y no coincide con el prefijo SAMS (se dejó como dice la especificación). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `regla_comercio` del usuario: coincidencia exacta del comercio normalizado, antes del catálogo semilla. El catálogo solo da categorías personales (negocio en M11). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `elegirMovimiento` (sin vector): menor diferencia de días, luego mayor similitud, luego orden de registro. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `emparejarTransferencias` devuelve `pagoTarjeta` solo para parejas entre espacios (como el oráculo); quien llama filtra a 24 h. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Frase sin verbo: todas las palabras de la descripción deben estar en el diccionario (06 §9 pide al menos una); evita leer "vendí tacos 80" como gasto. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | El nivel 0 se rinde (null) con fecha relativa, palabra de pago, deuda o tanda, negocio, alias de cuenta o contacto/cliente; esos casos van al nivel nube. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Cuenta en la frase: alias exacto (con o sin "la") y todas las cuentas con ese alias del mismo tipo; pago de tarjeta exige que todas sean de crédito. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Palabras de dos categorías → sin categoría; entradas de dos palabras ganan ("youtube premium" = suscripción). Plurales no listados no coinciden. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Montos: máximo 2 decimales y 9 dígitos enteros; un solo número por frase; monto 0 solo en arqueo. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | "Me cayó la quincena" → ingreso sin cuenta ni categoría. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Zod rechaza fechas inexistentes (2026-02-30) que el JSON Schema acepta por patrón; una prueba documenta la diferencia. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `billetera` cuenta como débito en el resolutor (06 §5 paso 1). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Eval: alias comparados normalizados; participantes normalizados y sin orden; el reporte no imprime texto dictado ni montos. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | La reversa conserva la fecha de la original (I3 vale para todo `hasta`); su clave de idempotencia es `reversa:{id}` y hereda el origen. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `anular` se permite con cuentas archivadas; solo `registrar` las rechaza. `registrar` rechaza tipo `reversa`. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `transito` no es cuenta propia de `gasto` ni `pago_tarjeta` hasta M11. `ajuste_arqueo` exige `estimada = 1`. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `cuenta_dividida`: el centavo extra de un reparto desigual va a la parte del usuario (no infla lo que otros deben). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `saldo_inicial` y `conciliacion`: exactamente dos asientos contra la cuenta de capital correspondiente. `reembolso` solo acredita gastos o `ingreso:reembolso`. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | `reemplazar` con una clave ya usada por otra transacción → `clave_duplicada`. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Cuentas de sistema y categorías con ids fijos legibles (`sis:personal:<x>`, `cat:personal:<slug>`) en vez de UUIDv7, para insertarlas en la migración. | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |
| 2026-10-12 | M1 | Pasan a servicios (M2): marcar `plan_msi.estado = 'liquidado'` (caso 6e) y crear ocurrencias pasadas como `omitida` (caso 23b). | Hueco o ambigüedad de la especificación; se tomó la opción conservadora | `05`, `04`, `06`, `07` |

## Pendientes

| # | Origen | Descripción | Quién | Hito destino |
|---|---|---|---|---|
| 1 | Especificación | ~~Definir el responsable del aviso de privacidad~~ Resuelto el 2026-10-12: NEXARA (`apps/calculadora/src/responsable.json`) | Adam | Antes de publicar M0 |
| 2 | Especificación | Confirmar con usuarios reales si la primera cuota MSI se factura en el primer corte posterior (`meses_diferimiento = 0`) en cada banco | Beta | M4 |
| 3 | Especificación | Plantillas reales de notificaciones (las de `fixtures/` son sintéticas) | Adam + probadores | M5 |
| 4 | Especificación | Revisión legal del aviso de privacidad y del flujo de consentimiento | Abogado | M7 y M13 |
| 5 | Especificación | Búsqueda de marca "Finanvoz" en el IMPI y en las tiendas (el dominio ya se revisó) | Adam | Antes de M7 |
| 6 | Especificación | Validación de `config/fiscal/2026.json` (RESICO, día de pago, UMA, deducciones) por un contador público | Contador | M11–M12; bloquea M13 |
| 7 | Especificación | Elegir biblioteca de criptografía y medir scrypt `n = 2^17` en el teléfono de referencia | Claude Code (spike) | M9 |
| 8 | Especificación | Generar la llave privada de plantillas y guardarla fuera del repositorio; registrar aquí solo su llave pública | Adam | M10 |
| 9 | Especificación | Decidir si se construye M11 con los datos de M0 y M7 (`10 §1`) | Adam | Al cerrar M7 |
| 10 | Especificación | Cuentas de servicios: Supabase, Expo/EAS, Google Play Console, RevenueCat, Sentry, PostHog, proveedores de LLM; Apple Developer en M14 | Adam | Según el hito que los pida |
| 11 | M0 | Crear el proyecto de Supabase y desplegar `lista-espera` (pasos en `services/proxy/README.md`) | Adam | M0 |
| 12 | M0 | Comprar `finanvoz.com` en Cloudflare, crear el proyecto de Pages `finanvoz`, y en GitHub (entorno `produccion`) poner los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` y las variables `VITE_LISTA_ESPERA_URL` y `VITE_RESPONSABLE_*`; después correr "Publicar calculadora" | Adam | M0, antes del 6 nov |

## Verificación por hito

### M0

Plan: monorepo (pnpm, TS estricto, ESLint, Prettier, Vitest) → `packages/core` con E1.1 y E10 (pruebas con vectores primero) → `apps/calculadora` (Vite + React) → `services/proxy`: migración y Edge Function `lista-espera` → CI con oráculo y Lighthouse → despliegue manual en Cloudflare Pages. Bloqueantes externos: pendientes 1, 11 y 12.

| Criterio | Cómo se verificó | Resultado |
|---|---|---|
| CA-M0-01 | `pnpm test`: `packages/core/src/reparto.test.ts` (8 vectores E1-0x + propiedades con fast-check) y `capacidad.test.ts` (E10-01 a E10-04) | Cumple |
| CA-M0-02 | `apps/calculadora/src/Calculadora.test.tsx` · "CA-M0-02 · E10-01" | Cumple |
| CA-M0-03 | `Calculadora.test.tsx` · "CA-M0-03 · E10-03" | Cumple |
| CA-M0-04 | Lighthouse 12 móvil local: Rendimiento 98, Accesibilidad 100 (2026-10-12); CI lo exige ≥ 90 en cada PR | Cumple |
| CA-M0-05 | Cliente: `ListaEspera.test.tsx` (sin consentimiento y correo inválido no envían). Servidor: `services/proxy/.../lista-espera.test.ts` y límite de 5 por hora en `registrar_lista_espera` | Cumple en código; el límite en la base, pendiente de verificación manual al desplegar (6 envíos seguidos → el sexto responde 429) |
| CA-M0-06 | — | Pendiente: requiere pendientes 11 y 12 |
| CA-M0-07 | Responsable en `apps/calculadora/src/responsable.json` (NEXARA). Montos fuera de la red: `Calculadora.test.tsx` · "calcular no hace ninguna petición de red" y prueba con navegador (0 peticiones al llenar la calculadora). Aviso con finalidades, encargados y baja en `Aviso.tsx` | Cumple en código; falta revisar la pestaña de red en el sitio publicado |

### M1

Plan: E1 completo → en paralelo E3/E4/E7, E5/E6/E11/E12, E9 + plantillas + catálogo, E2 + `packages/datos`, `packages/nlu` → integración en `@cartera/core` → cobertura y CI.

| Criterio | Cómo se verificó | Resultado |
|---|---|---|
| CA-M1-01 | `pnpm test`: un `it` por id en `packages/core/src/*.test.ts` (E1, E3, E4, E5, E6, E7, E9, E11, E12) y `packages/nlu/src/resolutor.test.ts` (NLU_resolver: 16 + 6) | Cumple |
| CA-M1-02 | `packages/datos/src/libro.propiedades.test.ts`: I1–I5 con `numRuns: 1000` sobre el `Libro` real en SQLite | Cumple |
| CA-M1-03 | `packages/datos/src/migracion.test.ts`: 17 tablas, vista, 5 triggers; fallan UPDATE/DELETE de asiento, cambiar fecha o tipo, anular dos veces y anular una reversa | Cumple |
| CA-M1-04 | `packages/datos/src/casos.test.ts`: casos 1–23b con variantes; patrón incorrecto rechazado; `comprobarIntegridad()` vacío tras cada prueba | Cumple |
| CA-M1-05 | `pnpm eval:nlu --nivel reglas`: cobertura 16/16, precisión 17/17 (100 %) | Cumple |
| CA-M1-06 | `packages/nlu`: los 144 `esperado` validan con Zod y con `esquema.json` (ajv); 36 casos inválidos rechazados por ambos | Cumple |
| CA-M1-07 | `packages/core/src/captura/*.test.ts`: 12/12 ejemplos personales y 2/2 de negocio; OXXO GAS → gasolina, UBER EATS → comida_fuera | Cumple |
| CA-M1-08 | `pnpm cobertura:core`: líneas 96.4 % (CI exige ≥ 90 %) | Cumple |

<!-- Copiar la tabla para cada hito al iniciarlo, con una fila por criterio CA-Mx-NN. -->

## Mediciones

| Fecha | Teléfono de referencia | Métrica (RNF) | Valor |
|---|---|---|---|

## Reportes del intérprete

| Fecha | Nivel | Proveedor / modelo | Caso completo | Monto | Fecha | Cuenta | Categoría | p95 | Costo por caso correcto |
|---|---|---|---|---|---|---|---|---|---|
