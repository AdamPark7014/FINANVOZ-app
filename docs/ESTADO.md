# Estado del proyecto

> Lo mantiene Claude Code al ejecutar `/hito`. Es el registro de verdad de qué está hecho, cómo se verificó y qué se decidió. Si una sesión se interrumpe, se retoma desde aquí.

## Tablero

| Hito | Estado | Inicio | Cierre | Notas |
|---|---|---|---|---|
| M0 · Calculadora pública | En curso | 2026-10-12 | | Fecha comprometida: antes del 6 nov 2026. Código listo; falta publicar (Pendientes 1, 11 y 12) |
| M1 · Núcleo | Pendiente | | | |
| M2 · App base sin conexión | Pendiente | | | |
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
| 2026-10-12 | M0 | Nombre comercial propuesto: **Alcanzi** (`alcanzi.com` libre según RDAP de Verisign el 2026-10-12); alternativas libres: Lanabla, Dímelana. El repositorio y los identificadores siguen como "Cartera" hasta que Adam confirme | Sale de "¿me alcanza?", la pregunta central de la app; sirve para personas, negocios y contadores | `assets/marca/`, `apps/calculadora/src/config.ts` |
| 2026-10-12 | M0 | E10 rechaza `pagos_msi > pagos_deuda` con `ErrorDominio('msi_mayor_que_deuda')`; la calculadora pide corregirlo | Los MSI son parte del total de deudas; adivinar cuál de los dos está mal podría inflar la capacidad | `05 §E10` (sin cambio de fórmula) |
| 2026-10-12 | M0 | E10 devuelve además `rebasaRecomendacion` (algún tope se pasa, no solo se iguala) para elegir entre "ya rebasan la recomendación" (E10-03) y "ya estás justo en el tope" | CA-M0-03 pide el mensaje de rebase; con capacidad 0 exacta no sería cierto | `05 §E10` |
| 2026-10-12 | M0 | Límite por IP: 5 envíos por hora con una huella SHA-256 de la IP con sal secreta, borrada a las 24 h; campo trampa para bots; la lista se conserva hasta la baja o 12 meses después del lanzamiento | CA-M0-05 pide límite por IP sin guardar la IP; el aviso necesita decir cuánto se guardan los datos | `08 §2.1`, aviso en `apps/calculadora/src/Aviso.tsx` |
| 2026-10-12 | M0 | Despliegue estático en Cloudflare Pages con flujo manual que falla si faltan los datos del responsable (`verificar-publicacion`) | Adam comprará el dominio en Cloudflare; el bloqueo hace cumplir CA-M0-07 | `.github/workflows/publicar-calculadora.yml` |
| 2026-10-12 | M0 | Los datos del responsable y la URL de la lista de espera entran como variables `VITE_*` del despliegue, no en el código | Se pueden definir sin tocar el código y el aviso muestra "[pendiente de definir]" en desarrollo | `apps/calculadora/src/config.ts` |

## Pendientes

| # | Origen | Descripción | Quién | Hito destino |
|---|---|---|---|---|
| 1 | Especificación | Definir el responsable del aviso de privacidad: persona física con actividad empresarial o persona moral de ZYNORA TEK, domicilio y correo de contacto | Adam | Antes de publicar M0 |
| 2 | Especificación | Confirmar con usuarios reales si la primera cuota MSI se factura en el primer corte posterior (`meses_diferimiento = 0`) en cada banco | Beta | M4 |
| 3 | Especificación | Plantillas reales de notificaciones (las de `fixtures/` son sintéticas) | Adam + probadores | M5 |
| 4 | Especificación | Revisión legal del aviso de privacidad y del flujo de consentimiento | Abogado | M7 y M13 |
| 5 | Especificación | Búsqueda de marca "Cartera" (IMPI, tiendas, dominio) | Adam | Antes de M7 |
| 6 | Especificación | Validación de `config/fiscal/2026.json` (RESICO, día de pago, UMA, deducciones) por un contador público | Contador | M11–M12; bloquea M13 |
| 7 | Especificación | Elegir biblioteca de criptografía y medir scrypt `n = 2^17` en el teléfono de referencia | Claude Code (spike) | M9 |
| 8 | Especificación | Generar la llave privada de plantillas y guardarla fuera del repositorio; registrar aquí solo su llave pública | Adam | M10 |
| 9 | Especificación | Decidir si se construye M11 con los datos de M0 y M7 (`10 §1`) | Adam | Al cerrar M7 |
| 10 | Especificación | Cuentas de servicios: Supabase, Expo/EAS, Google Play Console, RevenueCat, Sentry, PostHog, proveedores de LLM; Apple Developer en M14 | Adam | Según el hito que los pida |
| 11 | M0 | Crear el proyecto de Supabase y desplegar `lista-espera` (pasos en `services/proxy/README.md`) | Adam | M0 |
| 12 | M0 | Comprar `alcanzi.com` en Cloudflare, crear el proyecto de Pages `alcanzi`, y en GitHub (entorno `produccion`) poner los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` y las variables `VITE_LISTA_ESPERA_URL` y `VITE_RESPONSABLE_*`; después correr "Publicar calculadora" | Adam | M0, antes del 6 nov |

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
| CA-M0-06 | — | Pendiente: requiere pendientes 1, 11 y 12 |
| CA-M0-07 | Montos fuera de la red: `Calculadora.test.tsx` · "calcular no hace ninguna petición de red" y prueba con navegador (0 peticiones al llenar la calculadora). Aviso con finalidades, encargados y baja en `Aviso.tsx` | Pendiente: identidad del responsable (pendiente 1); el despliegue se bloquea sin ella |

<!-- Copiar la tabla para cada hito al iniciarlo, con una fila por criterio CA-Mx-NN. -->

## Mediciones

| Fecha | Teléfono de referencia | Métrica (RNF) | Valor |
|---|---|---|---|

## Reportes del intérprete

| Fecha | Nivel | Proveedor / modelo | Caso completo | Monto | Fecha | Cuenta | Categoría | p95 | Costo por caso correcto |
|---|---|---|---|---|---|---|---|---|---|
