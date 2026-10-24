# Deep research — competencia finanzas personales / voz (2026-10-24)

Ángulos: oficial, prensa, terreno (Reddit/reseñas), contrario (quejas), regulatorio MX.  
Regla: un dato duro con una sola fuente = “sin confirmar”.

## Respuesta corta

El mercado no pierde por falta de apps: pierde porque **la captura falla**, **el método exige trabajo**, **México no cabe en productos US**, y **la voz sin libro es juguete**. FinanVoz ya apunta al hueco defendible del PRD §6: captura por notificaciones (sin claves del banco) + MSI/quincena/efectivo + “hoy puedes” + libro serio detrás de UI trivial. Dominar no es “hacerlo todo (facturar, planeta, web ERP)”: es **ser imbatible en ese combo en México** y no repetir los errores que mataron o desgastaron a Mint, YNAB, Monarch sync, Fintonic MX y los trackers de voz.

## Hallazgos

### 1. Qué venden (mapas)

| Familia | Ejemplos | Promesa | Lo que suelen omitir |
|---|---|---|---|
| Presupuesto método | YNAB | Asigna cada peso | Curva de aprendizaje, entrada manual, poca localización MX |
| Dashboard sync | Mint†, Monarch, Copilot | Todo tu dinero en un lugar | Sync frágil; costo de agregadores; poco MX |
| “Ahorra por ti” | Rocket Money | Cancela suscripciones / negocia facturas | Confianza, cobros por “ahorros”, cobertura incompleta |
| Voz / chat IA | MonAi, Say, Jackito, WalletGPT | Habla y queda registrado | Libro débil, MSI/tarjetas/efectivo, captura bancaria MX |
| Agregador LATAM | Fintonic (salida MX), Spendee, Wallet | Bancos conectados | Cobertura MX rota o limitada; confianza en claves |
| PDF / estados | Finma, Finthy, Finamate | Sube el PDF | No es tiempo real; trabajo mensual |
| Contabilidad / ERP MX | Contalink, Bind, Contpaqi | CFDI, SAT, facturar | Pensado para despacho/empresa, no para “mezclo mi dinero” |
| Banco / neo | BBVA, Nu, Klar | Gastos de *ese* banco | Otras cuentas, efectivo, MSI cruzado, “hoy puedes” |

† Mint cerró ~ene 2024 (Intuit → Credit Karma). Fuente primaria: [Monarch / Val Agostino, 2023-11-07](https://www.monarch.com/blog/mint-shutting-down).

Competencia ya listada en `docs/01-PRD.md` §6 (Jackito, MonAi, Finvot, Fintonic, YNAB/Monarch/Copilot, Contpaqi/Bind). Este spike **no sustituye** esa tabla; la alimenta con quejas verificables.

### 2. De qué se quejan los usuarios (terreno)

**YNAB (2024–2025, r/ynab)**  
- Demasiado trabajo / curva alta (“Why is YNAB so hard?”, abr 2025).  
- Entrada manual tediosa cuando el banco no importa.  
- UX “over-engineered” (splits, credit category, cambios sin roadmap).  
- Precio (~100 €/año citado por usuarios EU, feb 2025) vs sensación de poco avance.  
Fuente: hilos Reddit citados en búsqueda (p. ej. [1khytct](https://www.reddit.com/r/ynab/comments/1khytct/), [1im0ohx](https://www.reddit.com/r/ynab/comments/1im0ohx/), [1jqgwig](https://www.reddit.com/r/ynab/comments/1jqgwig/)).

**Monarch / sync US (2024)**  
- Conexiones que se caen a diario; balances “actualizados” que mienten; transacciones faltantes.  
- Blame a Plaid/MX/Finicity; usuarios comparan y ven que otro cliente del mismo aggregator no pierde datos.  
Fuente: r/MonarchMoney ([1brjou6](https://www.reddit.com/r/MonarchMoney/comments/1brjou6/), [1g37pc2](https://www.reddit.com/r/MonarchMoney/comments/1g37pc2/)).

**Mint — lección de negocio (primaria)**  
- Agregar cuentas cuesta caro; modelo gratis + referidos **desalineaba** incentivos y no cubría costos.  
- Free PF app “no es negocio viable” (Agostino / Monarch, 2023-11-07).  
- WSJ (sin confirmar número exacto de “graveyard”): ayudar a gastar menos es un negocio duro.  
Fuente primaria: [monarch.com/blog/mint-shutting-down](https://www.monarch.com/blog/mint-shutting-down). Sacra/CNBC refuerzan migración y decepción con Credit Karma (prensa).

**Rocket Money / Truebill**  
- No cancela todo lo que anuncia; pide más credenciales.  
- Quejas de cobro por “negociación” cuando la factura subió o el usuario no percibió ahorro.  
- Desconfianza por acceso amplio a cuentas + cobros automáticos.  
Fuente: Reddit (p. ej. [1etym9v](https://www.reddit.com/r/atrioc/comments/1etym9v/), [1bh3x4h](https://www.reddit.com/r/mintuit/comments/1bh3x4h/)) — tratar como anecdótico, patrón repetido.

**México — agregación**  
- r/MexicoFinanciero (feb 2025): **casi no hay** app fiable que integre bancos MX; Fintonic se desconectaba / bancos faltantes; miedo a dar claves.  
- Fintonic México: reportes de saldos incorrectos (feb 2025, fintechfuturo); artículos 2026 afirman que **ya no opera** en MX (sitio caído / App Store ES) — **sin comunicado oficial de fecha** (asesoresinversion.com lo admite).  
- Alternativas citadas: Spendee (algunos bancos), Wallet (pocos), Finma/PDF, Excel.  
Fuente: [r/MexicoFinanciero 1iuffwc](https://www.reddit.com/r/MexicoFinanciero/comments/1iuffwc/).

**Voz-first (MonAi, Say)**  
- MonAi: voz intermitente, IA 403, sync familia rota, números mal parseados, “demasiado básica” para cuentas serias (App Store / agregadores de reviews 2025–2026).  
- Say (Play): bugs críticos, duplicados/faltantes, política de retención vaga, paywall agresivo (reseñas jul–ago 2026).  
Patrón: **voz sin libro fiable = abandono**.

**Contabilidad MX (Contalink terreno)**  
- Precios oficiales Start ~$590+IVA / PRO ~$790+IVA por usuario/mes (FAQ Contalink, sin fecha en extracto).  
- Reseñas mixtas 2025: automatización CFDI alabada; también “72 h en bajar facturas”, errores, soporte lento, “reseñas de empleados”.  
Fuente: [contalink.com/preguntas](https://www.contalink.com/preguntas) (primaria precios); Google/Exa reviews (terreno, sesgo posible).

**MSI México (dolor real, no de app)**  
- Acumular MSI pequeños, pagar mínimo, falsos MSI con sobreprecio, ignorar corte.  
- Regla práctica citada (Nu / prensa jul 2026): mensualidades ≤ ~30 % del ingreso libre — **guía, no norma**.  
Fuente: El Imparcial / Condusef / Santander educación (prensa + banco). Ninguna app global US modela MSI MX como ciudadano de primera.

### 3. Regulatorio MX (por qué sync “estilo Plaid” no es el atajo)

- Ley Fintech art. 76: open finance (datos abiertos / agregados / transaccionales con consentimiento).  
- Chambers Fintech 2026 MX: a ene 2026 **solo datos abiertos** plenamente operativos; reglas secundarias de datos transaccionales/agregados **pendientes** (prensa especializada).  
- Belvo/Finerio existen vía acuerdos; no sustituyen un régimen completo.  
Implicación producto: **depender de open banking MX hoy es apostar a un piso incompleto**. Captura por notificación (PRD: sin password del banco) esquiva ese cuello y el rechazo cultural a entregar claves.

### 4. Cómo FinanVoz ya corrige errores ajenos (mapa → PRD)

| Error de la industria | Cómo lo evita FinanVoz (spec / código) |
|---|---|
| Sync que miente / se cae | Notificaciones nativas + plantillas; sin Plaid como base |
| Pedir clave del banco | Explícitamente fuera de alcance (`01` §7) |
| Enseñar un método (YNAB) | Una respuesta: «Hoy puedes» + probabilidad |
| Voz que inventa cifras | LLM interpreta; `core` calcula; centavos enteros |
| Dashboard sin efectivo | Arqueo / corte de caja |
| Ignorar MSI / cortes / PNGI | Motores E* + calculadora M0 |
| Mezcla personal/negocio sin impuestos | M11 “puedes retirar” / apartados |
| Gratis + ads / referidos tóxicos | Suscripción Plus alineada (lección Mint) |
| Rocket-style “te ahorramos y cobramos” | No negociar facturas de terceros |
| ERP que asusta al dueño de tiendita | No emitir facturas ni declaraciones en v1 |
| Datos en nube como producto | Local + cifrado; privacidad en logs |

### 5. Plusvalía dominante (moat), sin inventar alcance

**Defensa dura (difícil de copiar en 12 meses)**  
1. **Plantillas de notificación MX** mantenidas (bancos cambian copy; quien no actualiza muere).  
2. **Libro de doble partida** + anulación/espejo + vectores/`oraculo` como contrato.  
3. **Motores deterministas** (MSI, libre, horizonte) — no “el chat dijo $X”.  
4. **Modelo mental mexicano**: quincena, MSI, efectivo, tandas, DiMo — no portar YNAB.  
5. **Confianza**: no claves bancarias, no ads de productos financieros, suscripción clara.

**Defensa media (hay que ganársela en el mercado)**  
6. Voz que cierra el loop (captura → confirma → Hoy) con <3 gestos.  
7. Onboarding que no pide presupuesto perfecto el día 1.  
8. Paquete al contador (M12) sin convertir la app en Contalink.  
9. Respaldo / cambio de teléfono sin drama (M9).

**No es moat (y distrae)**  
- “Facturar por voz” / presentar declaraciones → fuera de alcance hasta decisión + legal.  
- “Todo el planeta” → diluye MSI/plantillas/SAT.  
- Web ERP completo → pelear contra Contalink/Bind en su cancha.  
- Open banking forzado ahora → mismo cementerio que Fintonic/Monarch sync.

### 6. Checklist “errores ajenos corregidos en el primer arranque” (producto)

Para que el primer usuario sienta el plus desde el día 1:

1. **Cero claves de banco** en onboarding (solo permiso de notificaciones + voz).  
2. **Un número grande**: Hoy puedes — no 12 gráficas.  
3. **Primera captura automática** en <24 h o mensaje claro de qué banco falta.  
4. **Tarjeta/MSI** preguntados en lenguaje humano (“¿a meses?”), no “categoría CREDIT”.  
5. **Efectivo** no es ciudadano de segunda (arqueo guiado).  
6. **Confirmar por voz** lo ambiguo; nunca silent-wrong.  
7. **Sesgo conservador** si faltan datos (regla PRD: contar de más lo que se debe).  
8. **Suscripción sin dark patterns** (nada de cobros por “ahorros” ajenos).  
9. **Privacidad visible**: qué se sube al proxy (texto NLU) y qué nunca.  
10. **Salida digna**: export/respaldo desde el principio (no rehén tipo Mint).

## Contradicciones y huecos

- **Fintonic salida MX**: evidencia de tienda/sitio vs ausencia de comunicado oficial con fecha.  
- **Open finance MX**: Ley vs realidad operativa 2026 — Chambers dice secundarias pendientes; verificar con abogado antes de cualquier pivot a Belvo/APIs.  
- **Cuota de mercado** de YNAB/Monarch/Copilot en México: **no encontrada** con dos fuentes; asumir baja cobertura local.  
- Reseñas Contalink: polarizadas; posible sesgo.  
- Apps voz (MonAi/Say): ratings altos mezclados con 1★ de fiabilidad — el NPS de “bonito” ≠ retención.

## Qué verificar antes de decidir (no lo resuelve la web)

1. Adam en TestFlight/Play: ¿la voz + captura cubren un día real sin formularios?  
2. Cobertura real de plantillas vs los bancos del usuario (spike S1–S2).  
3. Si M11/M12 se validan con freelancers: ¿el paquete al contador basta o piden emitir CFDI? (cambia legal).  
4. Precio Plus vs willingness-to-pay MX (no copiar $100 USD/año a ciegas).  
5. Abogado: open banking / notificación / CFDI import vs emitir.

## Fuentes

**Primarias**  
- [Monarch — Mint shutting down (2023-11-07)](https://www.monarch.com/blog/mint-shutting-down)  
- [Contalink FAQ precios](https://www.contalink.com/preguntas)  
- [Ley Fintech art. 76](https://leyes-mx.com/ley_para_regular_las_instituciones_de_tecnologia_financiera/76.htm)  
- `docs/01-PRD.md` §5–§7 (producto)

**Prensa / especializada**  
- Sacra — Why Mint failed  
- CNBC — Mint shutdown users disappointed (2023-11)  
- Chambers — Fintech 2026 Mexico trends  
- El Imparcial — MSI errores / falsos MSI (2025–2026)  
- Santander MX — educación MSI

**Terreno**  
- Reddit: r/ynab, r/MonarchMoney, r/MexicoFinanciero, r/atrioc, r/mintuit, r/budget  
- App Store / Play reseñas MonAi, Say  
- fintechfuturo / asesoresinversion — Fintonic MX

**Interno**  
- PRD §6 diferenciación; UX voz; M0–M16 roadmap.
