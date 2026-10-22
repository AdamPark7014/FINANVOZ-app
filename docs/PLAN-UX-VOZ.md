# Plan de mejora: botones, intuitividad y voz (después de 1.0.0)

Fecha: 2026-10-22. Origen: Adam instaló 1.0.0 (3) en su iPhone por TestFlight y pidió: arreglar botones que no
funcionan, hacer la app más intuitiva y que todo registro de dinero se pueda hacer con voz. Este plan junta tres
auditorías de solo lectura (botones, intuitividad/iOS, voz). Las rutas son relativas a `apps/movil/` salvo `docs/` y
`packages/`.

Siguiente build: iOS 1.0.0 (4) y Android versionCode 2.

## Ola 1 · Lo que falla hoy en iPhone (correcciones, sin rediseño)

| # | Problema | Causa | Corrección |
|---|---|---|---|
| 1.1 | El teclado tapa el campo, «Registrar», «Continuar», «Guardar» | `Pantalla` sin `KeyboardAvoidingView` | `KeyboardAvoidingView` (iOS `padding`) + `keyboardDismissMode="interactive"` en `src/ui/componentes/Pantalla.tsx` |
| 1.2 | El teclado numérico de iOS no se puede cerrar | `decimal-pad`/`number-pad` sin tecla de retorno | Barra «Listo» (`InputAccessoryView`) en `CampoTexto` para teclados numéricos en iOS |
| 1.3 | Frases que no entiende el nivel 0 dicen «lo interpreto cuando tengas internet» aunque haya internet | La build no trae configuración de Supabase (`sin_nube`) | Texto propio para `sin_nube` que manda al formulario. Encender la nube cuando exista el proyecto de Supabase |
| 1.4 | «¿Me alcanza?», candado de probabilidad, Deducciones y «Conocer Plus» llevan a una pantalla sin acciones | En iPhone no hay compras | Ocultar esas entradas cuando `compras === null` |
| 1.5 | «Gastos compartidos» siempre termina en «no está activado» | Sin cliente de Supabase | Ocultar la entrada cuando no hay cliente |
| 1.6 | Un movimiento abierto no se cierra al tocar su texto | `Pressable` hermano debajo del contenido (`Tarjeta` con `accionesAnidadas`) | El `Pressable` envuelve al contenido |
| 1.7 | El bloqueo se activa en un iPhone sin código y deja fuera | No se revisa `disponible()` | Verificar y autenticar antes de guardar |
| 1.8 | Sin permiso de micrófono o cámara, el botón ya no hace nada | iOS no vuelve a preguntar | Botón «Abrir ajustes» (`Linking.openSettings`) |
| 1.9 | O6 (captura automática) se muestra en iPhone con textos de Android | Falta `Platform.OS` | Saltar O6 en iOS (`02 §25`), 6 pasos |
| 1.10 | «Volver» no hace nada si la pantalla se abrió en frío | `router.back()` sin historial | `canGoBack() ? back() : replace(...)` |
| 1.11 | Recordatorios de respaldo en la nube sin nube | `sincronizarAvisoRespaldo` sin revisar configuración | No avisar cuando `respaldo.nube === null` |
| 1.12 | «Guardar tarjeta» parece no hacer nada | Error de validación al fondo del formulario | Mostrar el error junto al botón |
| 1.13 | Botones deshabilitados sin razón visible | La pista solo va a VoiceOver | Mostrar la pista como texto bajo el botón deshabilitado |
| 1.14 | Ayuda, privacidad y bloqueo mencionan Android, Google Play, PIN o huella | Textos únicos | Variantes por plataforma (iPhone: código y Face ID, Ajustes de iPhone) |
| 1.15 | Avisos de la raíz tapan pestañas y el indicador de inicio | `bottom` fijo sin área segura | Usar `useSafeAreaInsets` y la altura real de la barra |

## Ola 2 · Voz en todo el dinero

1. **NLU (`packages/nlu/src/reglas/campos.ts`, nivel 0, determinista):** `interpretarMonto`, `interpretarIngresoDicho`,
   `interpretarSaldosDichos`, `interpretarPagosFijosDichos`, `interpretarTarjetaDicha`, sobre `leerMonto`/`leerRegla`
   existentes. Fuera de `PRODUCCIONES` para no mover el golden set (128/128). Spec: `06 §9.4` nuevo.
2. **Micrófono en cada `CampoMonto`** (26 campos) por contexto inyectado (`ContextoDictadoCampos`), sin tocar las
   llamadas: «Oí «mil quinientos» → $1,500» con «Deshacer»; nunca guarda solo; con `null` el campo no cambia.
   Un solo micrófono a la vez (`src/voz/microfono.ts`).
3. **Onboarding dictado («Dímelo»):** O3 «gano doce mil cada quincena», O4 «tengo 3 mil en BBVA y 500 en efectivo»
   (tarjeta «Entendí esto» editable, alta atómica), O5 «pago 4500 de renta cada mes» (día vacío si no se dijo),
   O7 por el micrófono del campo.
4. **Desde Hoy:** aplicar `ingreso_recurrente`, `saldo_cuenta` y `colchon` que el nivel 0 ya entiende, con tarjeta de
   confirmación. Hecho: colchón (con Deshacer), ingreso y saldo de cuenta (con tarjeta de confirmación).
5. Permiso al primer toque, «Abrir ajustes» si se niega, micrófono oculto si no hay reconocimiento, cero texto dictado
   en logs (regla 9). Pruebas: tabla + propiedad fast-check de montos en palabras, jest de `CampoMonto` con motor falso.

## Ola 3 · Más intuitiva (sigue `02 §16`; cada desvío se registra en ESTADO)

1. **Hoy con jerarquía:** cifra en un bloque destacado y tocable, desglose abierto en 4 filas, acciones antes que
   observaciones, Plus y «¿Me alcanza?» abajo. Hecho (el desglose sigue cerrado al abrir; tocar la cifra lo abre).
2. **Registrar como hoja modal** (`presentation: 'modal'`), con «Hablar · Escribir · Formulario» y fecha Hoy/Ayer.
3. **Barra de navegación nativa** (título grande y chevron en iOS), sin «Volver» dentro del contenido.
4. **«Agregar» en Cuentas** (débito, billetera, ahorro, pago fijo) fuera del onboarding: hoy en iPhone no se puede. Hecho.
5. **Íconos de sistema y vibración** (`expo-symbols`, `expo-haptics`).
6. **Ajustes como lista agrupada** con valor actual y ›. Grupos hechos y Captura oculta en iPhone; el formato de lista con › espera a la barra nativa.
7. **Movimientos:** `SectionList` por día con total, chips de filtro, detalle en hoja, botón en el vacío.
8. **Onboarding más corto:** barra de progreso, ‹ arriba, menos tips, «Más opciones» en O3/O5, tarjeta de primer uso
   en Hoy («Prueba decir «tacos 80 en efectivo»»).

## Ola 4 · Pruebas de UI en iPhone sin Mac

Maestro en GitHub Actions (constructores macOS) sobre `Finanvoz.app` del simulador (`ios.yml`): onboarding, registrar
por formulario, arqueo; capturas como artefacto.

## Lo que depende de Adam

- Proyecto de Supabase + llave de Claude (intérprete en la nube, respaldo y compartidos).
- Probar cada build en su iPhone y decir qué botón falla, si ve otro.
- Respaldar `Documents\LLAVES-ANDROID\FINANVOZ` fuera de la PC.
