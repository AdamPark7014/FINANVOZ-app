# 07 · Captura automática

## 1. Fuentes por versión

| Fuente | Hito | Mecanismo |
|---|---|---|
| Notificaciones de apps bancarias (Android) | M5 | `NotificationListenerService` en un Expo Module propio |
| Voz y texto | M2–M3 | `06` |
| Arqueo de efectivo y corte de caja | M5 · M11 | `05 §E7`, `§E7.2` |
| Plantillas actualizables sin publicar la app | M10 | JSON firmado con Ed25519 (§3.1) |
| Terminales de cobro del negocio | M11 | Las mismas notificaciones, con plantillas de tipo `cobro_recibido` (§5) |
| CFDI (XML) que el usuario importa | M12 | Hoja de compartir o selector de archivos → `packages/fiscal` (`05 §E13`) |
| Apple Pay en iPhone | M14 (v2) | Automatización "Transacción" de Wallet en Atajos → App Intent de la app (§7) |
| Estados de cuenta en PDF | M15 (v2) | El usuario comparte el PDF con la app; se lee en el teléfono (§8) |
| Correo reenviado | No planeado | Obligaría a que un servidor reciba y procese correos con datos financieros; contradice ADR-001 |

## 2. Módulo nativo `modules/captura-android`

### 2.1 Manifiesto (lo inyecta el config plugin)

```xml
<service
    android:name=".captura.CapturaListenerService"
    android:label="@string/captura_nombre_servicio"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="true">
  <intent-filter>
    <action android:name="android.service.notification.NotificationListenerService" />
  </intent-filter>
</service>
<queries>
  <!-- un <package android:name="…"/> por cada paquete de banco conocido (de captura.bancos.json) -->
</queries>
```

Para saber qué apps bancarias están instaladas se declaran paquetes concretos en `<queries>`. **No** usar `QUERY_ALL_PACKAGES` (permiso restringido en Google Play).

### 2.2 Servicio (Kotlin)

- `onListenerConnected`: guarda el instante de conexión.
- `onNotificationPosted(sbn)`:
  1. Si `sbn.packageName` no está en la lista blanca → `return` **sin leer nada más** (RF-CAP-02).
  2. Ignora resúmenes de grupo (`FLAG_GROUP_SUMMARY`) y notificaciones `ongoing`.
  3. Extrae `EXTRA_TITLE`, `EXTRA_BIG_TEXT` (o `EXTRA_TEXT` si no hay), `sbn.key`, `sbn.tag`, `sbn.postTime` y `notification.when`.
  4. Agrega una línea JSON a `noBackupFilesDir/captura/cola.jsonl` (almacenamiento privado excluido de respaldos).
  5. Si hay oyentes JS, emite el evento `notificacion`.
- La lista blanca vive en `SharedPreferences` privadas y solo contiene nombres de paquete.

### 2.3 API del módulo (TypeScript)

```ts
estadoPermiso(): Promise<'concedido' | 'denegado'>;
abrirAjustePermiso(): void;                        // ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS (o la lista general)
appsInstaladas(candidatos: string[]): Promise<string[]>;
fijarListaBlanca(paquetes: string[]): Promise<void>;
leerCola(): Promise<NotificacionCruda[]>;           // {clave, etiqueta, paquete, titulo, texto, publicada_en, cuando}
confirmarCola(hastaClave: string): Promise<void>;   // borra lo ya ingerido
solicitarReconexion(): void;                        // requestRebind
ultimoEvento(): Promise<number | null>;             // detección de captura inactiva (RF-CAP-07)
addListener('notificacion', (n: NotificacionCruda) => void): Subscription;
```

### 2.4 Procesamiento

- Con la app abierta: el evento dispara la ingesta (≤ 5 s, RF-CAP-01).
- Sin la app abierta: la cola se procesa al arrancar y en la tarea de `expo-background-task`; al terminar se publica un aviso local agrupado ("3 movimientos nuevos").
- La ingesta es idempotente: `huella = SHA-256(paquete | clave | cuando | titulo | texto)` en hexadecimal (con `expo-crypto`), con índice único (`04 §3`). `clave` = `sbn.key`; `cuando` = `notification.when` si es mayor que 0, si no `postTime`.
  - La misma notificación leída dos veces (al reconectar el servicio o al reprocesar la cola) tiene la misma clave y el mismo `cuando`: se descarta.
  - Dos compras reales idénticas (dos cafés de $65 en el mismo minuto) llegan con `cuando` distinto: se registran las dos. Un esquema por minuto o sin `cuando` las fundiría y perdería dinero real.
  - Si un banco vuelve a publicar el mismo aviso con `cuando` nuevo, aparece un duplicado: cuenta de más (lado seguro) y el usuario lo anula. Si ocurre con un banco concreto, se documenta en su plantilla.
  - No usar un hash de 32 bits: con años de capturas, una colisión descartaría un movimiento real.

### 2.5 Particularidades de Android que afectan pruebas y soporte

| Tema | Efecto | Qué hacer |
|---|---|---|
| Ajustes restringidos (Android 13+) | En apps instaladas fuera de Play, el interruptor de acceso a notificaciones aparece bloqueado | Probadores con APK: Información de la app → ⋮ → "Permitir ajustes restringidos". Con la pista interna de Play no ocurre |
| Notificaciones sensibles (Android 15) | El sistema oculta a los listeners el contenido de notificaciones con códigos de verificación | No se necesitan; si una de banco llega oculta, cae en `no_reconocida` |
| Ahorro de batería de fabricantes | Samsung, Xiaomi, Huawei y otros pueden desconectar el servicio | Detección de captura inactiva + guía por marca + `requestRebind` |
| Pruebas | Se necesitan notificaciones controladas | `adb shell cmd notification post -S bigtext -t '<título>' <banco_id> '<texto>'` publica desde `com.android.shell` con la etiqueta (`sbn.tag`) `<banco_id>`. Solo los builds de depuración aceptan `com.android.shell` y tratan la notificación como si viniera del primer paquete del banco con ese `id` (`banco_a`, `banco_b`, `billetera_c`). Escapa `$` según tu shell |

## 3. Motor de plantillas (`packages/core/src/captura/`)

Formato: `fixtures/notificaciones/plantillas.ejemplo.json`.

```ts
interface Plantilla {
  id: string;                 // banco.evento.vN
  banco: string;
  tipo: 'cargo' | 'retiro' | 'transferencia_enviada' | 'transferencia_recibida'
      | 'pago_recibido_tarjeta' | 'devolucion' | 'cobro_recibido' | 'ignorar';
  campo: 'texto' | 'titulo' | 'titulo+texto';   // titulo+texto = `${titulo} | ${texto}`
  patron: string;             // RegExp de JS con grupos nombrados: monto, comercio, ultimos4, contraparte, destino4
  flags?: string;             // por defecto 'iu'
}
```

Algoritmo: paquete → banco; plantillas del banco **en orden**; la primera que coincide gana; sin coincidencia → `no_reconocida`.

`parsearMonto(s)`: quita `$`, espacios y `MXN`; quita comas; parte en `.`; `entero·100 + decimales` rellenados a 2 dígitos. Aritmética entera; error si el formato no es válido.

`destino4`: últimos 4 de la cuenta que **recibe** (por ejemplo, la liquidación de una terminal de cobro a tu banco). Sirve para sugerir la cuenta propia en la pregunta de las 24 h; no evita la pareja de E9.4.

Verificación: los 12 ejemplos de `fixtures/notificaciones/ejemplos.jsonl` y los 2 de `negocio.ejemplos.jsonl` pasan con el motor de expresiones regulares de JavaScript.

Las plantillas se versionan (`.v1`, `.v2`); una nueva versión se agrega **antes** de la anterior para que gane.

### 3.1 Plantillas remotas firmadas (M10)

Los bancos cambian sus textos sin avisar; publicar la app cada vez es lento. Por eso las plantillas pueden llegar sin actualizar la app:

- **Archivo:** `plantillas.json` con `{version, emitido_en, version_minima_app, bancos, plantillas}` (mismo formato de §3; `advertencia` es opcional y se ignora) y su firma `plantillas.json.sig` (Ed25519 sobre los **bytes exactos** del archivo, en base64). Las plantillas embebidas en la app tienen `version: 1`; un archivo remoto se acepta solo con una versión mayor. Se publican en un bucket público de Supabase Storage.
- **Llaves:** la app trae embebida una lista `{id, llave_publica_hex}`; la firma se acepta si verifica con alguna. Rotar = publicar una app con la llave nueva antes de firmar con ella. La llave privada vive fuera del repositorio y de la app; `scripts/firmar-plantillas.mjs` firma con `CARTERA_PLANTILLAS_LLAVE_PRIVADA_HEX`.
- **Actualización:** una vez al día (al abrir la app o en la tarea diaria) se descarga con `If-None-Match`. Se acepta solo si la firma verifica, `version` es mayor que la activa y `version_minima_app` ≤ versión de la app. Se guarda en la tabla `plantilla_remota` (`04 §3.2`); las embebidas siguen como respaldo y una remota gana sobre la embebida del mismo `id` de banco.
- **Fallo:** firma inválida, JSON inválido o una plantilla que no compila como RegExp → se descarta el archivo completo, se conserva lo anterior y se registra el evento sin contenido.
- **Pruebas:** `fixtures/plantillas-firmadas/` (firma con la llave **pública** de prueba del vector 1 de RFC 8032; `kat.json` trae ese vector y el SHA-256 del archivo). Cambiar un solo byte del archivo debe hacer fallar la verificación.

## 4. Descubrimiento de formatos reales (M5)

Las plantillas de `fixtures/` son **sintéticas**. Las reales se escriben así:

1. Build interno con **modo diagnóstico** (oculto en Ajustes → Captura, inexistente en producción): guarda en el teléfono, sin enviar nada, los textos de notificaciones de los paquetes autorizados.
2. El desarrollador y probadores que consientan generan notificaciones reales (compra, retiro, SPEI enviada y recibida, pago de tarjeta, devolución) en sus bancos.
3. Exportan con la hoja de compartir; se anonimizan (comercio, nombres, últimos 4 → valores ficticios) antes de entrar al repositorio como ejemplos.
4. Por cada evento se escribe una plantilla y su ejemplo; la prueba de plantillas debe pasar.

Bancos prioritarios a cubrir (confirmar nombres de paquete en dispositivos reales con `adb shell pm list packages`): BBVA México, Banorte, Santander, Banamex, HSBC, Scotiabank, Banco Azteca, BanCoppel, Nu, Hey Banco, Mercado Pago, Spin by OXXO, Klar, Stori. Meta de M5: los 6 más usados por los probadores de la beta.

## 5. De captura a movimiento

Cada captura interpretada pasa por estos pasos, en orden, dentro de una transacción SQLite:

1. **Cuenta:** por últimos 4; si la plantilla no los trae, la única cuenta de esa institución. Si no existe, la captura queda en espera y se propone crear la cuenta (RF-CAP-03).
2. **Pareja de transferencia** (solo `transferencia_enviada`, `transferencia_recibida` y `pago_recibido_tarjeta`): se corre E9.4 contra las capturas sin pareja de las últimas 24 h. Si hay pareja:
   - **Una sola transacción final** (`transferencia`, `pago_tarjeta` o, entre espacios, `retiro_dueno` / `aportacion_dueno`, con la descomposición de `04 §2.4` cuando hace falta) **reemplaza** lo ya registrado de la otra mitad y, si la captura que llega se fusiona (E9.3) con un movimiento dictado, también ese movimiento. Así "me cayó mi sueldo, 8,000 en BBVA" más el depósito que viene de la cuenta del negocio quedan como un solo `retiro_dueno`, llegue primero la mitad que llegue (E9-50, E9-51). Si **cualquiera** de las dos mitades tiene una pregunta de E9.3 pendiente con un movimiento dictado (por ejemplo, dictaste $8,000 y llegaron $7,850), llegue primero o después, el par espera la respuesta: la entrada queda en espera sin registrarse y la salida queda como `transferencia_pendiente` (o en espera, si la pregunta es suya y el dictado ya la cuenta). La tarjeta de E9.3 pregunta "¿Es tu sueldo?": "Sí" → una sola transacción final que reemplaza lo pendiente y el dictado; "No" → la transacción final, y el dictado se queda. Mientras tanto nada cuenta dos veces ni infla el dinero libre.
   - La transacción final pasa al paso 5 si es un `pago_tarjeta` (cubre el pago planeado de esa tarjeta, `04 §5`) o un `retiro_dueno` (su entrada personal puede cubrir el sueldo del dueño; si ya lo cubría, se conserva, E9.4). Después termina el proceso.
3. **Duplicado** (E9.3) contra movimientos vigentes del mismo sentido registrados sin captura (voz, texto, manual), incluidos los de cuentas puente: `fusionar` → se vincula (y si estaba en cuenta puente, se reemplaza con la cuenta real); `preguntar` → tarjeta de pregunta; `nuevo` → paso 4.
4. **Registro** según el tipo (tabla).
5. **Ocurrencias:** el movimiento resultante se compara con las ocurrencias pendientes (E3.5).

| Tipo de captura | Registro (paso 4) |
|---|---|
| `cargo` | Crédito → `gasto` contra la tarjeta; débito o billetera → `gasto` contra esa cuenta. Categoría por §6. Un cargo en tarjeta de crédito de $1,000 o más se marca `por_revisar` con el chip "¿Fue a meses?" (`02 §6`, pasar a meses). |
| `retiro` | `retiro_efectivo` de la cuenta a efectivo. Con tarjeta de crédito: disposición, con advertencia. |
| `transferencia_enviada` | `transferencia_pendiente` contra `activo:transito` (`04 §4`, caso 15). Sin pareja en 24 h → "¿A quién le mandaste $X?" (caso 18). |
| `pago_recibido_tarjeta` | `transferencia_pendiente` desde `activo:transito` (caso 17). Sin pareja en 24 h → "¿De dónde salió el pago?" (caso 19). |
| `transferencia_recibida` | En orden: (a) la contraparte se parece a un contacto que te debe (`similitud` de E9.2 ≥ 0.85 entre nombres normalizados con E9.1) y el monto no pasa de lo que te debe → `cobro_prestamo` (con `por_revisar` si no es el monto exacto); (b) E3.5 dice `cubrir` para una ocurrencia de ingreso → `ingreso` con la categoría del programado y la ocurrencia cubierta; (c) si no → `ingreso` `otros_ingresos` con `por_revisar`. Si después aparece la salida propia, E9.4 lo reemplaza por una transferencia y la ocurrencia vuelve a pendiente. |
| `devolucion` | Busca el cargo original (mismo comercio normalizado, monto ≥ devolución, últimos 60 días) → `reembolso` contra la categoría de ese gasto; si no lo encuentra → `reembolso` contra `ingreso:reembolso` (`04 §4`, caso 21). |
| `ignorar` | `captura.estado = descartada`. |
| sin plantilla | `captura.estado = no_reconocida`: aparece en "Por revisar" con su texto para registrarla a mano y suma al contador del banco (RF-CAP-06). |
| `cobro_recibido` (M11) | `ingreso` con categoría `ventas` por el monto **bruto** en la cuenta de la terminal (espacio negocio) y, si la cuenta tiene `comision_bp`, un `gasto` `comisiones_intereses` por `redondear(monto·comision_bp / 10000)` contra la misma cuenta (`04 §4`, caso 30). Así el saldo de la terminal es lo que de verdad te van a depositar. Una terminal es una cuenta `billetera` del negocio con `comision_bp` no nulo, y al darla de alta su comisión (con IVA) es **obligatoria**: con "No la sé" se guarda `comision_bp = 500` (5 %, alta a propósito para no inflar el saldo, regla 12 de `CLAUDE.md`), el id de la cuenta entra a `comisiones_por_confirmar` de `ajuste.negocio` (`04 §3`) y Por revisar muestra "Confirma la comisión de tu terminal" (Es correcta · Cambiar) hasta que el usuario elija; cualquiera de las dos la saca de la lista. **Corregir saldo** en una terminal no registra una `conciliacion`: un faltante es `gasto` `comisiones_intereses` del negocio contra la terminal y un sobrante, `reembolso` contra esa misma categoría (`04 §3.1`). |

**Espacio negocio (M11).** La captura respeta el espacio de la cuenta: una entrada a una cuenta del negocio que no empata con nada se registra como `ingreso` `ventas` del negocio con `por_revisar` (en vez de `otros_ingresos` personal), y un cargo en una cuenta del negocio usa las categorías del negocio. La liquidación de una terminal a tu banco (`transferencia_enviada` con `destino4`) es una transferencia entre cuentas del negocio: se registra pendiente como cualquier salida (E9.4) y, si en 24 h no llega el depósito del banco, la pregunta propone la cuenta propia que termina en `destino4`. Recorrido: `fixtures/escenarios/e-negocio.json`.

El texto crudo de **toda** captura se guarda solo en el teléfono, en la base cifrada, y se borra a los 30 días (`04 §6`). Lo único que puede salir del teléfono es el contador de no reconocidas por banco, sin texto, y solo con la analítica autorizada (`03 §8`).

Recorrido completo con resultados esperados por notificación: `fixtures/escenarios/e-captura.json`.

## 6. Categorización automática

Orden: (1) `regla_comercio` del usuario; (2) catálogo semilla por **coincidencia del prefijo de tokens más largo** sobre el comercio normalizado (E9.1); (3) sin categoría → la tarjeta pregunta y aprende.

Catálogo semilla (`packages/core/src/captura/comercios_mx.json`):

| Prefijo normalizado | Categoría |
|---|---|
| OXXO GAS, PEMEX, G500, SHELL, MOBIL, BP | `gasolina` |
| OXXO, SEVEN ELEVEN, 7 ELEVEN, CIRCLE K, STARBUCKS | `antojos` |
| WALMART, WAL MART, BODEGA AURRERA, SORIANA, CHEDRAUI, LA COMER, HEB, CITY MARKET, COSTCO, SAMS | `super` |
| UBER EATS, DIDI FOOD, RAPPI | `comida_fuera` |
| UBER, DIDI, CABIFY, METROBUS | `transporte` |
| NETFLIX, SPOTIFY, DISNEY, MAX, PRIME VIDEO, YOUTUBE, ICLOUD | `suscripciones` |
| CFE, TELMEX, IZZI, TOTALPLAY, MEGACABLE, TELCEL | `servicios` |
| FARMACIAS GUADALAJARA, FARMACIA DEL AHORRO, BENAVIDES, SAN PABLO, SIMILARES | `salud` |
| CINEPOLIS, CINEMEX | `entretenimiento` |
| HOME DEPOT | `hogar` |

"Más largo gana": `OXXO GAS` → gasolina aunque `OXXO` → antojos; `UBER EATS` → comida aunque `UBER` → transporte. Pruebas obligatorias para esos dos pares.

## 7. iPhone (M14, v2)

iOS no permite leer notificaciones de otras apps. La captura automática en iPhone se limita a lo que el sistema expone:

- **Apple Pay:** Atajos tiene la automatización personal "Transacción" (Wallet), que se dispara al pagar con una tarjeta de Wallet y entrega monto, comercio y nombre de la tarjeta. La app expone un App Intent `RegistrarMovimiento(monto, comercio, tarjeta)` (target nativo en Swift dentro de un Expo Module + config plugin). La app guía al usuario para crear la automatización (no se puede crear sola) y la marca como "ejecutar sin preguntar".
- El intent escribe una `captura` con `fuente = 'apple_pay'` y sigue los pasos de §5 (cuenta por el nombre de la tarjeta en Wallet, que el usuario asocia una vez).
- **Spike previo (≤ 2 días, resultado en ESTADO):** confirmar en un iPhone real qué campos entrega la automatización en la versión de iOS vigente, si el monto llega como número o texto con formato, y si funciona con la app cerrada.
- **Intérprete en el dispositivo (nivel 1):** Foundation Models (iOS 26+, dispositivos con Apple Intelligence) con salida guiada contra el mismo esquema; si no está disponible, se usa el nivel 2. Se evalúa con el golden set como cualquier proveedor (`06 §8`).
- Todo lo demás (libro, motores, voz, arqueo, respaldo) es el mismo código de Expo.

## 8. Estados de cuenta en PDF (M15, v2)

- El usuario comparte el PDF de su estado de cuenta con la app (hoja de compartir o selector de archivos). Nada se sube.
- Extracción de texto en el teléfono: PDFKit en iOS; en Android, una biblioteca nativa de extracción de texto (PDFium o PDFBox para Android), elegida en un spike. PDFs escaneados (imagen) no se soportan en v2.
- Un **analizador por banco** (como las plantillas de §3, pero sobre el texto del PDF) extrae: periodo, fecha de corte, fecha límite, saldo al corte, PNGI, pago mínimo, movimientos (fecha, descripción, monto) y saldos pendientes de MSI.
- Usos: (1) **conciliar** la tarjeta: comparar saldo al corte del PDF contra el del libro y proponer una `conciliacion` por la diferencia; (2) **completar** movimientos que la captura no vio, con E9.3 para no duplicar; (3) corregir el calendario de MSI con lo que dice el banco.
- Los analizadores se prueban con PDFs **sintéticos** generados en el repositorio; nunca se suben estados de cuenta reales al repositorio.
