# 01 · PRD — Cartera (nombre provisional)

| | |
|---|---|
| Producto | App móvil de finanzas personales y de pequeños negocios de personas físicas, para México |
| Estudio | ZYNORA TEK |
| Responsable de producto | Adam del Pozo |
| Versión del documento | 2.0 · 11 de octubre de 2026 |
| Estado | Aprobado para implementación: v1 completa en Android (M0–M13) y v2 especificada (M14–M16) |
| Documentos hermanos | UX `02` · Arquitectura `03` · Datos `04` · Motores `05` · Lenguaje `06` · Captura `07` · Cumplimiento `08` · Hitos `09` · Negocio `10` |

---

## 1. Resumen

Cartera responde cada mañana una sola pregunta: **¿cuánto puedo gastar hoy sin que truene mi quincena?** La pregunta tiene respuesta porque la app ya tiene tus movimientos: los pagos digitales se capturan solos de las notificaciones del banco (Android), el efectivo se concilia con un arqueo de 3 segundos cada pocos días y lo demás se dicta en español de México. Detrás hay un libro contable de doble partida que entiende tarjetas, cortes, meses sin intereses, préstamos entre personas y tandas, y un simulador que convierte tu historial en una probabilidad honesta.

Para quien tiene un negocio propio (tiendita, freelance, RESICO), la misma app separa el dinero del negocio del personal y responde la pregunta equivalente: **¿cuánto puedo sacar del negocio para mí sin quedarme sin para impuestos y proveedores?**

## 2. Términos

| Término | Significado |
|---|---|
| Horizonte | Días desde hoy hasta tu próximo ingreso que todavía no llega (normalmente la quincena). Si hoy es día de pago y no ha llegado, o si se retrasó, se cuentan 2 días de margen (`05 §E3.3`). |
| Libre | Dinero líquido menos colchón, compromisos del horizonte, deuda de tarjetas que pagas completa y lo que debes a personas. Fórmula exacta en `05 §E4`. |
| Hoy puedes | Libre ÷ días del horizonte, redondeado hacia abajo. |
| Probabilidad de llegar | Fracción de 10,000 simulaciones con tu propio historial en las que llegas al próximo ingreso sin tocar el colchón (`05 §E8`). |
| Captura | Un dato de pago que llegó solo (notificación, Apple Pay, estado de cuenta). |
| Arqueo | Decirle a la app cuánto efectivo traes; la diferencia contra lo esperado se convierte en gastos estimados (`05 §E7`). |
| Espacio | Conjunto separado de cuentas y cifras: `personal` y, si lo activas, `negocio` (`10 §2`). |
| Puedes retirar | En el negocio: el dinero libre que puedes sacar para ti sin dejarlo corto en los próximos 30 días (`05 §E4`). |
| Impuestos apartados | ISR e IVA estimados de lo ya cobrado que todavía no se pagan (`05 §E15`). |
| PNGI | Pago para no generar intereses de una tarjeta. |
| MSI | Meses sin intereses. |
| CFDI | Factura electrónica mexicana (XML timbrado por el SAT). |

## 3. Problema

1. **Anotar cansa y se abandona.** Todas las apps de registro manual dependen de que el usuario capture cada gasto. Las que agregaron voz redujeron la fricción por registro, pero no el número de registros.
2. **El efectivo domina el gasto chico.** 85 % de las compras menores a $500 se pagan en efectivo (ENIF 2024). Es justo el gasto que nadie anota y ninguna app ve.
3. **Las finanzas reales son informales.** 41 % de la población guarda dinero en casa, 20 % participa en tandas y 13 % en cajas de ahorro (ENIF 2024). Ninguna app de presupuesto modela una tanda.
4. **El crédito engaña.** El saldo del banco no dice cuánto puedes gastar: faltan los cortes, los MSI que ya comprometiste y los pagos que vienen. Condusef recomienda que las deudas no pasen de 30 % del ingreso, pero nadie tiene ese número a la mano.
5. **La banca abierta no está disponible.** La Ley Fintech solo tiene reglas para datos abiertos; las de datos transaccionales siguen sin publicarse en 2026 y sin calendario. Conectarse a bancos depende de agregadores privados, con costo y cobertura parcial.
6. **El pequeño negocio mezcla todo.** El dueño de una tiendita o el freelance cobra en la misma cuenta en la que paga su súper; al llegar el día 17 no sabe cuánto de lo cobrado era del SAT.

## 4. Propuesta de valor

> "No anotas nada. La app se entera sola de tus pagos digitales, deduce lo que gastaste en efectivo y cada mañana te dice cuánto puedes gastar sin que truene tu quincena."

Principios de producto (deciden empates de diseño):

1. **Cero captura antes que captura rápida.** Lo que se puede detectar no se pregunta.
2. **Números con comprobante.** Toda cifra lleva a los movimientos que la producen. La IA interpreta lenguaje; nunca calcula.
3. **Honestidad sobre precisión.** Si faltan datos, se dice ("estimación inicial", "datos insuficientes", "parámetros sin validar"). Nada de números inventados.
4. **Ante la duda, contar de más lo que debes.** Un dato que falta nunca infla el dinero libre.
5. **Una pregunta a la vez.** Cuando hay que preguntar, una sola pregunta con opciones tocables.
6. **Sin culpa.** El lenguaje describe, no regaña.
7. **Tus datos son tuyos.** Local, cifrado, sin anuncios, sin venta de datos; exportar siempre es gratis.

## 5. Usuarios objetivo

**Primario: asalariado quincenal con Android**, 20–40 años, mezcla efectivo + débito + 1–3 tarjetas de crédito, tiene o tuvo MSI, recibe notificaciones push de su banco. Su trabajo por hacer: "llegar a la quincena sin sustos y saber si me puedo dar un gusto".

**Secundario (modo ingreso variable):** freelancer o comerciante con ingresos irregulares. Trabajo: "saber cuánto me dura lo que tengo".

**Negocio (M11):** persona física con negocio propio (RESICO, actividad empresarial o profesional, plataformas, comercio chico). Trabajo: "saber cuánto puedo sacar para mí y no llevarme sustos con el SAT". Se construye si la validación de `10 §1` lo justifica.

**Canal (M12):** contadores que atienden a esas personas reciben un paquete mensual ordenado.

**Fuera de alcance:** personas morales con empleados, inversionistas.

## 6. Competencia

| Producto | Qué hace (según su material público) | Lo que no encontré en su material público |
|---|---|---|
| Jackito | Agente financiero conversacional: registra gastos, suscripciones, deudas y metas por chat | Captura automática de notificaciones, arqueo de efectivo, probabilidad de llegar |
| MonAi, TalkieMoney, WalletGPT | Registro por voz con categorización y reportes; consultas en lenguaje natural | Captura automática, modelo de tarjetas/MSI, simulación |
| Finvot | Registra desde correos de notificación bancaria, Apple Pay y WhatsApp para efectivo | Arqueo, motor de MSI y cortes, simulación |
| Fintonic | Agregación bancaria, categorización y alertas | Efectivo, contexto mexicano de MSI y quincena |
| Apps bancarias | Gráficas de gasto de ese banco | Otras cuentas, efectivo, compromisos |
| Contpaqi, Aspel, Alegra, Bind (negocios) | Contabilidad, facturación y administración para empresas | Pensadas para empresas y contadores, no para el dueño de una tiendita que mezcla su dinero |
| YNAB, Monarch, Copilot (referencias globales) | Presupuesto por prioridades; crédito como débito diferido; clasificación rigurosa de transferencias; IA sobre datos reales | Disponibles en México con contexto local |

**Diferenciación defendible:** la combinación de (1) captura invisible con emparejamiento de transferencias, (2) arqueo de efectivo y corte de caja, (3) libro de doble partida con cortes, MSI, préstamos personales y tandas, (4) "hoy puedes" con probabilidad y escenarios, (5) separación personal/negocio con impuestos apartados, (6) arquitectura local y cifrada. Cada pieza suelta existe en alguna app; la combinación no la encontré. Lo difícil de copiar es el libro bien hecho, las plantillas de notificaciones mexicanas mantenidas y el historial de cada usuario.

## 7. Alcance

### v1 — Android (M0–M13)

**Base (M0–M7, beta cerrada):** calculadora pública de MSI · captura de notificaciones Android · registro por voz y texto · libro de doble partida · efectivo con arqueo · débito y billeteras · tarjetas con cortes, PNGI, recomendación, MSI (nuevos y existentes), pasar a meses y liquidar · compromisos programados · deudas con personas · "Hoy puedes" con probabilidad · "¿Me alcanza?" · consultas tipadas · onboarding con consentimiento · suscripción Plus.

**Completa (M8–M13, lanzamiento público):** tandas · cuentas divididas y cobros con celular (DiMo) o CLABE · respaldo cifrado y cambio de teléfono · detección de suscripciones · plantillas de notificación actualizables sin publicar la app · widget · modo explicar · perfil de negocio con impuestos apartados, corte de caja y "puedes retirar" · deducciones personales con CFDI y paquete para el contador · lanzamiento público.

### v2 (M14–M16)

iPhone (Apple Pay con Atajos, modelo en el dispositivo con Foundation Models) · estados de cuenta en PDF leídos en el teléfono · gastos compartidos en pareja con sincronización cifrada de extremo a extremo.

**Recomendación de salida:** abrir la beta al cerrar M7 y publicar en producción en cuanto pase M7 + M9 (respaldo); M8–M13 se entregan como actualizaciones. Esperar a tener todo retrasa el aprendizaje con usuarios reales.

### No objetivos (cualquier versión salvo decisión explícita)

Mover dinero (pagar, transferir, invertir) · asesoría de inversión · crédito o préstamos ofrecidos por la app · conexión bancaria con usuario y contraseña del banco · emitir facturas o presentar declaraciones · nómina, IMSS y contabilidad electrónica · personas morales con empleados · anuncios · WhatsApp como canal (los mensajes de servicio de la API se cobran desde el 1 de octubre de 2026; se usa la hoja nativa de compartir) · correo reenviado.

## 8. Requisitos funcionales

Prioridad: **P0** bloquea el cierre de su hito; **P1** deseable en ese hito. La columna Hito dice dónde se construye (`09`).

### Captura automática (CAP)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-CAP-01 | P0 | M5 | Con acceso a notificaciones concedido, convertir notificaciones de apps bancarias autorizadas en capturas interpretadas por plantilla (`07`). Con la app viva, el movimiento aparece en ≤ 5 s; si no, al siguiente arranque. |
| RF-CAP-02 | P0 | M5 | El usuario elige qué apps leer. Toda otra notificación se descarta en código nativo **sin persistirse**. |
| RF-CAP-03 | P0 | M5 | Asociar la captura a la cuenta por últimos 4 dígitos; si no existe, proponer crearla con un toque. |
| RF-CAP-04 | P0 | M5 | Deduplicar contra registros existentes (`05 §E9.3`) y emparejar transferencias propias (`05 §E9.4`), registrando cada captura al llegar (`07 §5`). |
| RF-CAP-05 | P0 | M5 | Categorizar: regla aprendida del usuario > catálogo semilla de comercios > sin categoría (se pregunta en la tarjeta). |
| RF-CAP-06 | P1 | M5 | Notificaciones no reconocidas: mostrarlas en "Por revisar" con su texto (guardado solo en el teléfono, 30 días, `04 §6`) para registrarlas a mano, y contar por banco cuántas hubo; solo el conteo, sin texto, puede salir en la analítica autorizada. |
| RF-CAP-07 | P1 | M5 | Detectar captura inactiva (sin eventos del servicio en 72 h con apps bancarias instaladas) y guiar para reactivarla. |
| RF-CAP-08 | P0 | M5 | Preguntar "¿Fue a meses?" en cargos capturados en tarjeta de crédito de $1,000 o más (`02 §6`). |

### Registro conversacional (REG)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-REG-01 | P0 | M2 | Mantener para hablar desde Hoy; transcripción en vivo es-MX; reconocimiento en el dispositivo cuando el teléfono lo soporte. |
| RF-REG-02 | P0 | M2 | Entrada de texto equivalente y formulario de movimiento para los tipos que origina el usuario. |
| RF-REG-03 | P0 | M2–M3 | Interpretar con el esquema de `06`, incluidos varios movimientos por frase y jerga de montos. |
| RF-REG-04 | P0 | M2 | Registro optimista con "Deshacer" (5 s) si la interpretación está completa, sin ambigüedad y el monto ≤ $5,000; si no, tarjeta de confirmación editable. |
| RF-REG-05 | P0 | M2 | Ante falta de monto o ambigüedad, una sola pregunta con opciones tocables. |
| RF-REG-06 | P0 | M3 | Corregir y anular por voz ("no, fue con la de crédito", "borra lo del cine", "la tele fue a 12 meses"). |
| RF-REG-07 | P0 | M2–M3 | Sin internet: las frases que cubre el nivel de reglas se registran; las demás quedan "por interpretar" y se procesan al reconectar. |
| RF-REG-08 | P1 | M3 | Aprender alias de cuentas y categorías de comercios a partir de correcciones (solo local). |

### Libro y cuentas (LIB)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-LIB-01 | P0 | M1 | Libro de doble partida inmutable en centavos con idempotencia (`05 §E2`, `04`). |
| RF-LIB-02 | P0 | M2 | Tipos de cuenta: efectivo, débito, billetera, ahorro, tarjeta de crédito, préstamo, persona. |
| RF-LIB-03 | P0 | M2 | Lista de movimientos con búsqueda y filtros (cuenta, categoría, fecha, origen); detalle con historial de cambios. |
| RF-LIB-04 | P0 | M2 | Cuentas puente "por asignar" (gastos sin método y entradas sin destino) con resolución automática (`04 §2.1`). |
| RF-LIB-05 | P0 | M2 | Exportar (JSON + CSV) y borrar todo. Exportar es gratis siempre, también después de cancelar Plus. |
| RF-LIB-06 | P0 | M2 | Deudas con personas en ambos sentidos; lo que debes se aparta del dinero libre salvo que indiques lo contrario (`05 §E4`). |

### Hoy (HOY)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-HOY-01 | P0 | M2 | "Hoy puedes gastar" (`05 §E4`), días al próximo ingreso y desglose tocable (líquido, reservado, colchón). |
| RF-HOY-02 | P0 | M6 | Probabilidad de llegar (`05 §E8`, K = 1) con ≥ 14 días de historial; etiqueta "estimación inicial" hasta 42 días. |
| RF-HOY-03 | P0 | M2 | Estados: datos insuficientes, libre negativo (muestra el faltante), día de pago sin depósito, ingreso retrasado, modo ingreso variable, sin ingreso configurado (`02 §4.2`). |
| RF-HOY-04 | P0 | M4 | Tarjeta del día: con qué tarjeta conviene pagar hoy (`05 §E5.2`). |
| RF-HOY-06 | P0 | M2 | Tarjetas de acción con prioridad (`02 §4.1`): compromiso vencido sin cubrir ("¿Ya pagaste la luz?"), ingreso que no llegó, arqueo, preguntas de captura. |

### Tarjetas y MSI (TAR)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-TAR-01 | P0 | M2 · M4 | Configurar tarjeta en el onboarding y por formulario (M2) o por voz (M4): día de corte, día límite o días para pagar, límite de crédito, modo (totalero o plan) y saldo actual obligatorio (`02 §3.1`). |
| RF-TAR-02 | P0 | M4 | Por tarjeta: deuda total, PNGI del último corte, fecha límite, disponible, uso % y saldo a favor. |
| RF-TAR-03 | P0 | M4 | Cierre de periodo automático e idempotente al abrir la app, solo de cortes posteriores al alta (`05 §E5.3`). |
| RF-TAR-04 | P0 | M4 | MSI: alta por voz, calendario de cuotas, reclasificación en cada corte; compromiso mensual de los próximos 12 meses (Plus). |
| RF-TAR-05 | P0 | M4 | Avisos: día de corte y 3 días antes de la fecha límite con el PNGI. |
| RF-TAR-06 | P1 | M4 | Modo plan con pagos planeados y sugerencia avalancha (tasa más alta primero). |
| RF-TAR-07 | P0 | M4 | Pasar a meses una compra ya registrada y liquidar un plan por adelantado (`05 §E6.2`). |
| RF-TAR-08 | P0 | M2 · M4 | MSI que ya existían al registrar la tarjeta: mensualidad y mensualidades restantes, sin contarlos como gasto (`05 §E6.1`); se capturan en M2 y sus cuotas se procesan desde M4. |

### Efectivo (ARQ)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-ARQ-01 | P0 | M5 | Pedir arqueo según disparadores de `02 §7`; respuesta con un toque o por voz. |
| RF-ARQ-02 | P0 | M5 | Proponer gastos estimados editables; un sobrante nunca se registra sin confirmación. |
| RF-ARQ-03 | P0 | M5 | Antes de calcular la diferencia, preguntar si los gastos "por asignar" de más de 24 h se pagaron en efectivo (`05 §E7`). |

### Simulación y consultas (SIM, CON)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-SIM-01 | P0 | M6 | "¿Me alcanza?" con escenarios contado / esperar / MSI (`05 §E8.5`), recomendación y explicación con cifras. |
| RF-SIM-02 | P1 | M6 | Calibración local (`05 §E8.6`) visible en ajustes como "qué tan atinado ha sido". |
| RF-CON-01 | P0 | M7 | Consultas tipadas (`06 §6`) con respuesta en plantilla y botón "ver movimientos". |
| RF-CON-02 | P1 | M10 | Modo explicar: preguntas abiertas resueltas con herramientas de solo lectura (`06 §6`). |

### Compromisos, configuración, privacidad y cobro (PRG, CFG, PRI, PAG)

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-PRG-01 | P0 | M2 | Ingreso recurrente que define el horizonte: quincena 15/último, días fijos, mensual, semanal, catorcenal (`05 §E3`). |
| RF-PRG-02 | P0 | M2 · M4 | Egresos programados con ocurrencias, recibos de monto variable y compromisos de una sola vez; cobertura manual (M2) y automática (M4, `05 §E3.5`). |
| RF-PRG-03 | P1 | M2 | Modo ingreso variable: horizonte fijo de 30 días sin proyectar ingresos (`05 §E3.3`). |
| RF-PRG-04 | P1 | M3 | Configurar compromisos por voz ("la renta son 6,500 cada día primero"). |
| RF-CFG-01 | P0 | M2 | Onboarding completo en ≤ 4 minutos (`02 §3`). |
| RF-CFG-02 | P0 | M2 | Colchón configurable (sugerencia: 10 % del ingreso del periodo). |
| RF-CFG-03 | P0 | M2 | Bloqueo opcional con biometría o PIN del sistema; "ocultar en multitarea". |
| RF-PRI-01 | P0 | M2 | Consentimiento expreso para datos financieros antes de guardar el primer dato (`08`). |
| RF-PRI-02 | P0 | M5 | Divulgación destacada antes de abrir el ajuste de acceso a notificaciones (`08 §3.1`). |
| RF-PRI-03 | P0 | M7 | Centro de privacidad: qué sale del teléfono y a quién, exportar, borrar todo. |
| RF-PAG-01 | P0 | M7 · M11 | Planes Gratis y Plus (M7) y Negocio (M11), según §11, con prueba de 14 días, cobrados por la tienda; al terminar la prueba o cancelar, la cuenta vuelve a Gratis sin bloquear ni borrar datos. |

### Personas y tandas (PER) — M8

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-PER-01 | P0 | M8 | Cuenta dividida con participantes de tus contactos; tu parte es gasto y las demás quedan por cobrar (`05 §E12.1`). |
| RF-PER-02 | P0 | M8 | Cobrar: mensaje con monto, concepto y tus datos (celular para DiMo o CLABE) compartido con la hoja nativa. |
| RF-PER-03 | P1 | M8 | Recordatorio de cobro configurable por deuda. |
| RF-PER-04 | P0 | M8 | Tandas: crear, calendario, aportaciones como compromisos, cobro sin contarlo como ingreso, dinero en riesgo (`05 §E11`). |

### Respaldo (RES) — M9

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-RES-01 | P0 | M9 | Exportar e importar un respaldo `.cartera` cifrado con contraseña (`05 §E16`). |
| RF-RES-02 | P0 | M9 | Respaldo automático semanal en la nube, opcional, con cuenta de correo; el servidor no puede leerlo. |
| RF-RES-03 | P0 | M9 | Restaurar en un teléfono nuevo desde la nube o desde archivo, con comprobación de integridad. |
| RF-RES-04 | P1 | M9 | Aviso a los 14 días sin respaldo. |

### Inteligencia y mantenimiento (INT) — M10

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-INT-01 | P0 | M10 | Detectar suscripciones y cargos recurrentes; convertirlos en compromisos (`05 §E14`). |
| RF-INT-02 | P0 | M10 | Actualizar plantillas de notificaciones sin publicar la app, con firma verificada (`07 §3.1`). |
| RF-INT-03 | P1 | M10 | Widget de Android con "hoy puedes" y opción de ocultar montos. |

### Negocio (NEG) — M11

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-NEG-01 | P0 | M11 | Activar un espacio de negocio con sus cuentas, categorías y compromisos (`10 §3.1`). |
| RF-NEG-02 | P0 | M11 | "Puedes retirar hasta" del negocio (E4 del espacio negocio, 30 días). |
| RF-NEG-03 | P0 | M11 | Impuestos apartados por mes (RESICO o porcentaje) con fecha límite y "Ya lo pagué" (`05 §E15`). |
| RF-NEG-04 | P0 | M11 | Corte de caja que propone las ventas en efectivo no anotadas (`05 §E7.2`). |
| RF-NEG-05 | P0 | M11 | Fiado: ventas a crédito a clientes y su cobro. |
| RF-NEG-06 | P0 | M11 | Retiros y aportaciones del dueño entre espacios, sin contarlos como gasto ni ingreso. |
| RF-NEG-07 | P0 | M11 | Capturar cobros de terminales (con su comisión) y depósitos a cuentas del negocio (`07 §5`). |
| RF-NEG-08 | P1 | M11 | Reporte del mes: ventas, gastos, impuestos, retiros y utilidad. |

### Fiscal y contador (FIS) — M12

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-FIS-01 | P0 | M12 | Importar CFDI 4.0 (XML o ZIP) en el teléfono (`05 §E13.1`). |
| RF-FIS-02 | P0 | M12 | Estimar deducciones personales del año con sus topes y explicar las exclusiones (`05 §E13.2`). |
| RF-FIS-03 | P1 | M12 | Aviso preventivo al registrar gastos de salud en efectivo. |
| RF-FIS-04 | P0 | M12 | Paquete mensual para el contador (`10 §6`). |

### v2: iPhone, PDF y pareja (IOS, PDF, PAR) — M14–M16

| ID | Pri | Hito | Requisito |
|---|---|---|---|
| RF-IOS-01 | P0 | M14 | App para iPhone con todo lo de v1 salvo captura de notificaciones; registro de pagos con Apple Pay vía Atajos (`07 §7`). |
| RF-IOS-02 | P1 | M14 | Intérprete en el dispositivo con Foundation Models donde exista. |
| RF-PDF-01 | P0 | M15 | Leer estados de cuenta en PDF en el teléfono: completar movimientos y conciliar saldos (`07 §8`). |
| RF-PAR-01 | P0 | M16 | Grupo de gastos compartidos con otra persona creado por QR, cifrado de extremo a extremo (`05 §E17`). |
| RF-PAR-02 | P0 | M16 | Gastos compartidos con reparto 50/50 o proporcional y saldo "quién le debe a quién" (`05 §E12.2`). |

## 9. Requisitos no funcionales

| ID | Requisito | Medición |
|---|---|---|
| RNF-01 | Arranque en frío < 2 s; E4 < 50 ms; E8 (K = 1, N = 10 000) < 150 ms; registro por reglas < 300 ms desde fin de voz; nube p50 < 2.5 s y p95 < 5 s | Perfilado en teléfono de gama media de referencia (definir modelo en M2) |
| RNF-02 | Toda función de registro, saldos, "hoy puedes" y negocio opera sin internet | Pruebas en modo avión |
| RNF-03 | Cero descuadres: invariantes del libro en pruebas de propiedades y comprobación de integridad | CI + arranque en builds internos |
| RNF-04 | Lenguaje: umbrales del golden set (`06 §8`) | `pnpm eval:nlu` |
| RNF-05 | Ningún monto, comercio, nombre, RFC ni texto de notificación en logs, analítica o reportes de error | Revisión de código + prueba que inspecciona eventos |
| RNF-06 | Seguridad base OWASP MASVS L1; ningún secreto en el binario; proxy autenticado con límite por usuario | Checklist en M7 y M13 |
| RNF-07 | Costo variable ≤ $8 MXN por usuario Plus al mes y ≤ $1 por usuario gratis (incluye almacenamiento de respaldos) | Tablero de costos del proxy |
| RNF-08 | Accesibilidad: etiquetas TalkBack, texto al 200 % sin cortar cifras, contraste AA | Revisión manual en M7 y M13 |
| RNF-09 | Sesiones sin fallo ≥ 99.5 % | Sentry |
| RNF-10 | es-MX: montos `$1,500` (sin centavos si son .00) y `$1,099.90` (con centavos); fechas "jue 15 oct" | Pruebas de formato |
| RNF-11 | Respaldo: crear o restaurar uno con 50,000 asientos en < 30 s; derivar la llave en < 3 s | Teléfono de referencia (M9) |
| RNF-12 | Ningún parámetro fiscal en código: todos en `config/fiscal/<año>.json` validado | Revisión de código + prueba que busca tasas en `packages/` (M11) |

## 10. Métricas

**Métrica norte — usuarios al día (semanal):** usuarios activos en la semana con captura automática activa y un arqueo en los últimos 7 días (o sin movimientos de efectivo).

| Métrica | Meta |
|---|---|
| Activación: ve su primer "hoy puedes" en la primera sesión | ≥ 70 % (beta) |
| Movimientos que llegaron sin escribir (captura + arqueo) | ≥ 60 % (beta) |
| Correcciones por cada 100 registros | ≤ 8 (beta) |
| Retención D7 / D30 | ≥ 40 % / ≥ 25 % (beta) |
| Conversión a Plus a 30 días | ≥ 4 % (beta) |
| Calibración (Brier) | ≤ 0.20 (beta) |
| Costo variable por usuario | dentro de RNF-07 |
| Usuarios con respaldo activo a D30 | ≥ 50 % (después de M9) |
| Negocios con "puedes retirar" visto ≥ 3 días por semana | ≥ 60 % (después de M11) |

## 11. Monetización y economía unitaria

| Plan | Qué incluye | Precio (hipótesis) |
|---|---|---|
| **Gratis** | Todo lo que hace correcto el "hoy puedes": captura automática; registro por voz y texto (reglas ilimitadas + 30 interpretaciones en la nube al mes); cuentas y tarjetas ilimitadas con cortes, PNGI, MSI y avisos; compromisos; deudas con personas, tandas y cobros; arqueo; "hoy puedes"; suscripciones detectadas; widget; respaldo manual y automático; exportar y borrar | $0 |
| **Plus** | Probabilidad de llegar · "¿Me alcanza?" · tarjeta del día · calendario de MSI a 12 meses · consultas y modo explicar · deducciones personales (M12) · interpretaciones en la nube con uso justo (300/mes) | $69/mes o $599/año |
| **Negocio** (M11) | Plus + en el espacio negocio: "Puedes retirar" (también en su widget), impuestos apartados, corte de caja, reportes del mes y paquete para el contador. Sin el plan, el espacio negocio se crea y se llena igual; solo se ocultan esas funciones | A validar con M0 y M7; hipótesis inicial $149/mes |

Ningún dato se bloquea por plan: al terminar la prueba o cancelar, la cuenta vuelve a Gratis, todo sigue visible y editable, y solo se ocultan las funciones de la tabla.

Cálculo para Plus (vector `PRD_economia_unitaria`): el precio incluye IVA (16 %) y la tienda retiene 15 % (suscripciones en Google Play; programa de pequeñas empresas en Apple).

| | Mensual $69 | Anual $599 |
|---|---|---|
| Sin IVA | $59.48 | $516.38 |
| Neto después de tienda | $50.56 | $438.92 ($36.58/mes) |
| Costo variable objetivo | $8.00 | $8.00/mes |
| Margen de contribución | **$42.56/mes (61.68 %)** | **$28.58/mes (57.25 %)** |

Punto de equilibrio: con costos fijos de $F al mes se necesitan `F / 42.56` suscriptores mensuales (ejemplo: $3,000 → 71).

## 12. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Google Play restringe o rechaza el uso de acceso a notificaciones | Alto | Divulgación destacada + video para revisión; la captura es opcional y la app funciona sin ella; uso estrictamente limitado a apps bancarias elegidas |
| Los bancos cambian el formato de sus notificaciones | Medio | Plantillas versionadas, contador de no reconocidas, plantillas remotas firmadas (M10) |
| El sistema del fabricante detiene el servicio de notificaciones (ahorro de batería) | Medio | Detección de captura inactiva, guía por marca, `requestRebind` |
| El intérprete se equivoca | Medio | Golden set con umbrales, confirmación cuando hay duda, deshacer, correcciones por voz |
| El usuario no adopta el arqueo | Medio | Disparadores contextuales; "hoy puedes" marcado como "menos preciso" si el efectivo lleva > 7 días sin arqueo |
| Desconfianza por privacidad | Alto | Local y cifrado, centro de privacidad, sin anuncios, mensajes claros |
| Pérdida de datos al cambiar de teléfono | Alto | Exportación desde M2; respaldo cifrado automático en M9 |
| El usuario olvida la contraseña del respaldo | Medio | Advertencia explícita al crearla; exportación manual adicional; no hay recuperación por diseño |
| Una estimación fiscal equivocada | Alto | Parámetros validados por contador, leyendas de estimación, nada se declara desde la app (`08 §5`) |
| Regulatorio al ampliar alcance (pagos, agregación, facturación) | Alto | Fuera de alcance; revisión legal antes de cualquier cambio (`08`) |
| Alcance demasiado grande para el equipo (un desarrollador con agentes de IA, tiempo parcial) | Alto | Hitos pequeños con criterios de aceptación; M0 valida demanda; beta en M7; M11 condicionado a datos (`10 §1`) |

## 13. Supuestos a validar

| # | Supuesto | Cómo se valida | Cuándo |
|---|---|---|---|
| S1 | La mayoría de usuarios objetivo recibe notificación push del banco por cada compra con tarjeta | Pregunta en la lista de espera de M0 + telemetría de beta | M0, M7 |
| S2 | Los usuarios hacen ≥ 1 arqueo por semana | Beta | M7 |
| S3 | Hay disposición a pagar $69/mes | Pregunta de precio en M0; prueba de precio en beta abierta | M0, después de M7 |
| S4 | La probabilidad está calibrada con 14–42 días de historial | Brier en beta | M7 |
| S5 | El intérprete en la nube logra ≥ 90 % de registros completos correctos al costo objetivo | Benchmark del golden set | M3 |
| S6 | ≥ 20 % de la lista de espera tiene un negocio o trabaja por su cuenta | Pregunta "¿Para qué lo usarías?" en M0 | M0, decisión al cerrar M7 |
| S7 | Los contadores recomiendan una app que les entrega el paquete mensual ordenado | Entrevistas con 5 contadores con el paquete de ejemplo | M12 |
| S8 | La automatización de Apple Pay en Atajos entrega monto y comercio de forma confiable | Spike en iPhone real | M14 |

## 14. Fuentes

- ENIF 2024 (INEGI/CNBV), uso de efectivo: [Xataka México](https://www.xataka.com.mx/otros-1/crecen-pagos-digitales-85-compras-menores-a-500-pesos-mexico-siguen-efectivo)
- ENIF 2024, ahorro informal y tandas: [El Universal](https://www.eluniversal.com.mx/cartera/tandas-y-guardaditos-viejos-trucos-que-aun-dominan-el-ahorro-mexicano-encuesta-41-de-la-poblacion-guarda-dinero-en-casa/)
- Banca abierta en México: [Fiskil Open Finance Tracker](https://www.fiskil.com/es/open-finance-tracker/mexico), [Open Banking Tracker](https://openbankingtracker.com/blog/open-banking-in-mexico-eight-years-of-promise-still-waiting-on-the-regulations)
- Condusef, 30 % de deuda y 10 % en MSI: [El Imparcial](https://www.elimparcial.com/dinero/2026/02/04/cuanto-de-tu-sueldo-es-seguro-destinar-a-compras-a-meses-sin-intereses-esta-es-la-regla-para-no-endeudarte-de-mas/); 30 % del límite de la tarjeta: [Publimetro](https://www.publimetro.com.mx/noticias/2025/03/31/construye-tu-futuro-financiero-5-consejos-para-principiantes-en-tarjetas-de-credito/)
- WhatsApp Business, cobro de mensajes de servicio desde octubre de 2026: [Mercately](https://blog.mercately.com/?p=30248)
- DiMo y fecha límite del 14 de diciembre de 2026: [Ruptura360](https://ruptura360.mx/periodismo-de-servicio/banxico-nuevas-reglas-transferencias-bancarias-apps-2026/)
- Competidores: [Jackito](https://www.producthunt.com/products/jackito), [Finvot](https://apps.apple.com/mx/app/finvot/id6757373431), [MonAi](https://apps.apple.com/MX/app/id6447112647), [TalkieMoney](https://apps.apple.com/mx/app/talkiemoney/id6473291180)
- Buen Fin 2026 (13–17 de noviembre): [Emprendedor](https://emprendedor.com/buen-fin-2026-fechas-walmart-fin-irresistible-sams-bodega-aurrera/)
- Fuentes fiscales: `08 §8`.
