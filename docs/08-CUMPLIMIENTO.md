# 08 · Cumplimiento, privacidad y tiendas

> Este documento orienta la implementación; **no es asesoría legal**. Antes de publicar la app, un abogado con práctica en protección de datos en México revisa el aviso de privacidad y los flujos de consentimiento (M7, y otra vez en M13 con respaldo, negocio y fiscal). Los parámetros fiscales los valida un contador público (`10 §5`).

## 1. Qué es y qué no es Cartera

| Es | No es |
|---|---|
| Herramienta de registro y análisis de finanzas personales y de pequeños negocios de personas físicas, que procesa datos que el usuario le da o que llegan a su teléfono | Institución financiera, ITF (Ley Fintech), asesor de inversiones, intermediario de pagos ni despacho contable |
| Estimaciones con el historial del usuario (dinero libre, probabilidad, impuestos a apartar, deducciones) | Garantía, recomendación de productos financieros, declaración de impuestos ni dictamen fiscal |

La app **no mueve dinero**, no ofrece crédito, no recomienda valores, no conecta cuentas con credenciales bancarias, no emite facturas (CFDI) ni presenta declaraciones. Cualquier cambio de ese alcance requiere análisis regulatorio previo.

Textos fijos:

- Acerca de y "¿Me alcanza?": "Cartera no es una institución financiera ni asesor de inversiones. Las cifras son estimaciones con la información que registras y no garantizan resultados."
- Impuestos del negocio y deducciones: "Estimación para apartar dinero y preparar tu declaración. No sustituye a tu contador ni presenta declaraciones ante el SAT."

## 2. Protección de datos (LFPDPPP 2025)

- Ley Federal de Protección de Datos Personales en Posesión de los Particulares publicada en el DOF el 20 de marzo de 2025 (abroga la de 2010). Autoridad: Secretaría Anticorrupción y Buen Gobierno.
- **Datos financieros o patrimoniales requieren consentimiento expreso.** Implementación (RF-PRI-01): pantalla O2 con casilla **no** marcada + botón "Aceptar y continuar"; sin aceptar no se guarda ningún dato.
- **Evidencia del consentimiento:** registro local `{version_aviso, hash_aviso, aceptado_en}` y copia mínima en Supabase `{usuario_anonimo, version_aviso, aceptado_en}` para poder demostrarlo.
- **Aviso de privacidad** (integral en la web y en la app; simplificado en O2). Contenido mínimo:
  - Identidad y domicilio del responsable: NEW ENGINEERING EXPERTISE AND RESOURCE ADVANCEMENT S.A. DE C.V. (NEXARA), Ignacio Allende 512 local 2, Santiago Momoxpan, San Pedro Cholula, Puebla, C.P. 72775; contacto gerencia@nexara.com.mx.
  - Datos tratados: identificadores de la app, datos financieros y patrimoniales que el usuario captura, texto de notificaciones de apps bancarias elegidas (procesado en el teléfono), frases enviadas para interpretar; desde M9, correo de la cuenta de respaldo; desde M12, CFDI que el usuario importa.
  - Finalidades primarias (prestar el servicio) y secundarias (estadísticas de uso, mejora del intérprete) con mecanismo para negarse a las secundarias.
  - Remisiones a encargados: proveedor de LLM (procesamiento efímero de frases), Supabase (autenticación, cuotas, respaldos cifrados y, en v2, eventos compartidos cifrados), RevenueCat (suscripciones), Sentry (errores depurados), PostHog (analítica opcional). Señalar que algunos procesan en el extranjero.
  - Medios para ejercer derechos ARCO y revocar el consentimiento; procedimiento para cambios del aviso.
- **Derechos ARCO en la app:** acceso = exportar (**siempre disponible y gratis**, también después de cancelar Plus); rectificación = editar; cancelación = borrar todo (destrucción de la llave, `04 §6`) y, si existe, borrar la cuenta de respaldo con sus archivos; oposición = apagar analítica, captura y respaldo automático. Además, correo de contacto para solicitudes formales, atendidas en los plazos de la ley.
- **Medidas de seguridad:** cifrado en reposo, mínimo privilegio, inventario de datos (este documento + `03 §8`), registro de incidentes y procedimiento de notificación de vulneraciones.

### 2.1 Lista de espera de M0

- Datos: correo y tres respuestas (¿Android o iPhone?, ¿tu banco te avisa cada compra?, ¿cuánto pagarías al mes?) más "¿Para qué lo usarías? Personal / Mi negocio o freelance / Soy contador".
- La calculadora calcula en el navegador: los montos que escribe el usuario **no se envían** (CA-M0-07).
- Aviso breve junto al formulario con: responsable (nombre o razón social, domicilio, correo), finalidad (avisar del lanzamiento, invitar a la beta y entender qué necesita la gente), encargados (Supabase; Brevo si se exporta la lista para campañas), cómo darse de baja (enlace en cada correo y correo de contacto) y enlace al aviso integral.
- Casilla de consentimiento no marcada; se guarda `{correo, respuestas, version_aviso, aceptado_en}`.

### 2.2 Respaldo en la nube (M9)

- Opcional. Requiere crear una cuenta con correo y código. El servidor guarda el correo y archivos cifrados que **no puede abrir**: la contraseña nunca sale del teléfono ni se guarda; en el teléfono queda solo la llave derivada, en el almacén seguro, para cifrar los respaldos automáticos (E16).
- El aviso lo dice en términos simples: "Guardamos tu respaldo cifrado. Ni nosotros podemos leerlo. Si olvidas tu contraseña, no se puede recuperar."
- Borrar la cuenta de respaldo elimina sus archivos del almacenamiento en ≤ 30 días (incluidas copias de seguridad del proveedor, según su política).

### 2.3 Datos de terceros

- **Contactos** (personas a quienes prestas o que te deben) y **clientes** del negocio: solo nombre y alias que el usuario escribe; viven en el teléfono.
- **CFDI importados:** contienen RFC y nombre de emisores (médicos, escuelas, proveedores). Se guardan cifrados en el teléfono y solo salen en el paquete que el usuario comparte con su contador (`10 §6`).
- **Gastos compartidos (v2):** cada integrante acepta el grupo escaneando el QR; ve solo los gastos del grupo, nunca el libro personal del otro.

## 3. Google Play

### 3.1 Divulgación destacada antes del acceso a notificaciones (RF-PRI-02)

Se muestra dentro de la app, antes de abrir el ajuste del sistema, en una pantalla dedicada:

> **Registrar tus compras automáticamente**
> Cartera puede leer las notificaciones de las apps de banco que elijas para registrar tus compras, retiros y transferencias sin que tengas que anotarlas.
> Solo leemos las apps que marques. Las demás notificaciones se ignoran en tu teléfono y no se guardan.
> El contenido se procesa en tu teléfono y no se envía a nuestros servidores.
> Puedes desactivarlo cuando quieras en Ajustes.
> [Activar] [Ahora no]

Grabar un video corto de este flujo (desde Hoy hasta la captura de un movimiento) para la revisión de Play. Con negocio activo, la misma pantalla menciona "y de tu terminal de cobro".

### 3.2 Seguridad de los datos (Data safety), borrador

| Dato | ¿Sale del teléfono? | Declaración |
|---|---|---|
| Movimientos, saldos, cuentas | No (salvo dentro del respaldo cifrado opcional) | No recopilado (procesado en el dispositivo) |
| Texto de notificaciones bancarias | No | No recopilado |
| Frases dictadas o escritas para interpretar | Sí, al proxy y al proveedor de LLM | Información financiera · recopilada · procesada de forma efímera · no compartida (encargados) · necesaria para la función |
| Respaldo en la nube (M9) | Sí, cifrado de extremo a extremo y opcional | Posición conservadora: Información financiera · recopilada · opcional · cifrada en tránsito; confirmar con la guía vigente de Play si los datos cifrados de extremo a extremo deben declararse |
| Correo de la cuenta de respaldo (M9) | Sí, opcional | Información personal · correo · recopilado · funcionalidad de la app |
| Identificador anónimo de la app | Sí | Identificadores · recopilado · funcionalidad y cuenta |
| Registros de fallos depurados | Sí | Diagnóstico · recopilado |
| Interacción con la app (opt-in) | Sí | Actividad en la app · recopilado · opcional |
| Compras de suscripción | Sí (tienda, RevenueCat) | Historial de compras · recopilado |

Cifrado en tránsito: sí. Solicitud de eliminación: sí (borrar todo + contacto + borrar cuenta de respaldo).

### 3.3 Declaraciones en Play Console

- **Funciones financieras:** completar la declaración indicando gestión de finanzas personales (presupuesto y registro de gastos), sin movimiento de dinero, crédito ni inversiones.
- **Permisos:** el acceso a notificaciones no tiene formulario propio, pero requiere la divulgación de §3.1 y una política de privacidad publicada en la ficha y dentro de la app.
- **Suscripciones:** precio, periodo, prueba gratuita y forma de cancelar visibles antes de comprar.
- **Widget (M10):** muestra montos en la pantalla de inicio; trae la opción "ocultar montos" encendida si el bloqueo biométrico está activo.
- Nivel de API objetivo: el que exija Play al momento de publicar.

## 4. Apple App Store (M14)

Etiquetas de privacidad equivalentes a §3.2; directrices 5.1.1 (recopilación y almacenamiento de datos) y 3.1 (compras dentro de la app y suscripciones). La automatización de Atajos la crea el usuario; la app solo la explica y expone el App Intent.

## 5. Fiscal: negocio, deducciones y contador (M11–M12)

- La app **estima**: impuestos a apartar (E15) y deducciones personales (E13). No presenta declaraciones, no emite CFDI (eso exige un proveedor de certificación, PAC), no guarda e.firma, contraseña del SAT ni CSD.
- Parámetros por ejercicio en `config/fiscal/<año>.json` con `estado: "por_validar"` hasta que un contador público los revise; su firma (nombre, cédula y fecha) queda en `docs/ESTADO.md` → Decisiones. Sin esa validación, la pantalla de impuestos muestra "parámetros sin validar" y no se publica en producción.
- El paquete para el contador lo genera y comparte el usuario; la app no lo envía a nadie.

## 6. Marca

"Cartera" es provisional y genérico. Antes de diseñar marca: búsqueda en IMPI (clases 9 y 36), en Google Play y App Store, y disponibilidad de dominio. Tener dos alternativas listas.

## 7. Checklists

### 7.1 Beta cerrada (M7)

- [ ] Aviso de privacidad integral publicado (web) y accesible en la app; simplificado en O2
- [ ] Revisión legal del aviso y del flujo de consentimiento
- [ ] Evidencia de consentimiento guardada localmente y en servidor
- [ ] Divulgación destacada implementada y video grabado
- [ ] Data safety y declaración de funciones financieras completas
- [ ] Exportar y borrar todo probados en dispositivo
- [ ] Prueba automática: ningún evento de analítica ni reporte de error contiene montos, comercios, alias o texto
- [ ] Llaves de proveedores solo en el servidor; binario revisado con `strings` en busca de secretos
- [ ] Proveedor de LLM configurado sin entrenamiento con datos y con retención mínima
- [ ] Checklist OWASP MASVS L1 revisado
- [ ] Términos de servicio con el texto de §1

### 7.2 Lanzamiento público (M13)

- [ ] Todo lo de §7.1 vigente con las funciones de M8–M12
- [ ] Aviso actualizado con respaldo en la nube (§2.2), CFDI y datos de terceros (§2.3); revisión legal
- [ ] `config/fiscal/2026.json` (y el del ejercicio siguiente, si aplica) validado por contador público
- [ ] Textos fijos de §1 en impuestos y deducciones
- [ ] Borrado de cuenta de respaldo probado de punta a punta
- [ ] Llave privada de plantillas fuera del repositorio; prueba de rotación de llave hecha
- [ ] Data safety actualizado (respaldo, correo, widget)
- [ ] Checklist OWASP MASVS L1 repetido

## 8. Fuentes

- LFPDPPP 2025, autoridad y consentimiento expreso para datos financieros: [Greenberg Traurig](https://www.gtlaw.com/es/insights/2025/3/nueva-ley-general-proteccion-de-datos), [BBVA Research](https://bbvaresearch.com/wp-content/uploads/2025/04/20250410-Mexico-Regulacion-Financiera-_-Marzo-2025.pdf), [KYC Systems](https://kyc-systems.com/blog/lfpdppp)
- Google Play, divulgación destacada: [Ayuda de Play Console](https://support.google.com/googleplay/android-developer/answer/11150561)
- Google Play, declaración de funciones financieras obligatoria: [aviso de políticas de Google Play](https://notifications.google.com/g/vib/ADa0GC9h7B3mdk-pSoWfqJeMtrF9_GppKT5xZsa-ctckfbM1XJ-hrK5x_KEXiE2rPfx5BFWTHeOsUNszSFuqGzkKauRCUX3GwEKKxEEELv9VusOxUcJCsygyM8Fxo1Fw3CAO_byFHtXgTK7t7w)
- RESICO personas físicas, tabla mensual y límite de $3.5 millones (LISR art. 113-E): [Compendio SDV](https://sdv.com.mx/compendio/ley-isr/articulo-113-e/), [SatFácil](https://www.satfacil.com.mx/blog/regimen-simplificado-confianza-resico-guia-2026)
- Deducciones personales y UMA 2026 (fuente secundaria con inconsistencias señaladas en `10 §5`): [Siempre al día](https://siemprealdia.co/mexico/fiscal/deducciones-personales-que-pueden-aplicar-las-personas-fisicas-sat/)
- Retenciones a vendedores en plataformas digitales en 2026: [El Contribuyente](https://www.elcontribuyente.mx/2025/11/en-2026-vender-en-plataformas-digitales-sera-mas-caro-habra-nuevas-retenciones/)

Consultadas el 11 de octubre de 2026.
