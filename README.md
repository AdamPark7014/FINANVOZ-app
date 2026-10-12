# Cartera — especificación ejecutable para Claude Code

Especificación completa de una app de finanzas personales y de pequeños negocios para México: producto, experiencia, arquitectura, datos, 17 motores de cálculo con vectores de prueba, intérprete de lenguaje con golden set, captura de notificaciones, cumplimiento, perfil de negocio y un plan de 17 hitos (M0–M16) con criterios de aceptación. Claude Code la implementa hito por hito con `/hito`.

## Requisitos en tu computadora

| Herramienta | Para qué | Desde |
|---|---|---|
| Git | Repositorio y ramas por hito | M0 |
| Node.js LTS (22 o superior) y pnpm (`npm i -g pnpm`) | Monorepo, pruebas, scripts | M0 |
| Python 3.10 o superior (solo biblioteca estándar) | Oráculo de vectores (`node scripts/oraculo.mjs` lo encuentra solo; en Windows usa `py -3`) | M0 |
| Claude Code | Ejecutar los hitos | M0 |
| Android Studio con un emulador, JDK 17 y un teléfono Android con depuración USB | App móvil y captura | M2 y M5 |
| Cuentas: Supabase, Expo/EAS, Google Play Console, RevenueCat, Sentry, PostHog y un proveedor de LLM | Servicios | Según el hito que las pida |

## Cómo arrancar

1. Descomprime `cartera-proyecto.zip` donde guardes tus proyectos (ya trae el repositorio git con un primer commit) o, si partiste del archivo único `CARTERA-PROYECTO.md`, pídele a Claude que genere el repositorio con él (las instrucciones están al inicio de ese archivo).
2. Abre una terminal en la carpeta y ejecuta `claude`. Claude Code carga `CLAUDE.md`, los permisos de `.claude/settings.json` (te pedirá confiar en la carpeta) y las skills `/hito` y `/verificar`.
3. Primer mensaje:

   ```
   /hito M0
   ```

4. Claude Code lee el hito, escribe su plan en `docs/ESTADO.md` y te lo muestra; apruébalo o corrígelo.
5. Al cerrar el hito, revisa en `docs/ESTADO.md` los criterios verificados y los pasos manuales que te deje (por ejemplo, probar en tu teléfono).
6. Sigue con `/hito M1`, `/hito M2`… El orden y las dependencias están en `docs/09-ROADMAP.md`. Si una sesión se corta, vuelve a escribir `/hito <el mismo id>`: retoma desde ESTADO.

M0 (calculadora pública "¿Cuántos MSI aguantas?") tiene fecha comprometida: publicada antes del 6 de noviembre de 2026, una semana antes del Buen Fin. Antes de publicarla tienes que definir quién es el responsable del aviso de privacidad (`docs/ESTADO.md`, pendiente 1).

## Versiones

| Versión | Hitos | Qué trae |
|---|---|---|
| v1 base (beta cerrada) | M0–M7 | Calculadora, núcleo, app sin conexión, intérprete en la nube, tarjetas y MSI, captura Android y arqueo, simulador |
| v1 completa (lanzamiento público) | M8–M13 | Tandas y cobros, respaldo cifrado, suscripciones, plantillas remotas, widget, modo explicar, perfil de negocio, deducciones y paquete para el contador |
| v2 | M14–M16 | iPhone, estados de cuenta en PDF, gastos compartidos en pareja |

Recomendación: abrir la beta al cerrar M7 y publicar en producción al cerrar M9; lo demás sale como actualizaciones.

## Orden de lectura para personas

1. `docs/01-PRD.md` — qué se construye y por qué
2. `docs/02-UX.md` — qué ve el usuario
3. `docs/09-ROADMAP.md` — en qué orden y cómo se acepta
4. `docs/05-MOTORES.md` — cómo se calcula cada número
5. `docs/10-NEGOCIO.md` — perfil de negocio y contador
6. El resto según la tarea: `03` arquitectura, `04` datos, `06` lenguaje, `07` captura, `08` cumplimiento

## Contenido

```
CLAUDE.md                       reglas del repositorio para Claude Code
.claude/settings.json           permisos (pnpm, git sin push forzado, oráculo; .env bloqueado)
.claude/skills/hito/            /hito <id>: ejecuta un hito completo
.claude/skills/verificar/       /verificar: lint, tipos, pruebas, oráculo, eval
docs/01-PRD.md … 10-NEGOCIO.md  especificación
docs/ESTADO.md                  tablero, decisiones, pendientes, verificación
fixtures/motores/               oráculo de referencia (Python) y vectores.json (v3)
fixtures/nlu/                   contexto, esquema y golden set de 144 frases
fixtures/notificaciones/        plantillas y notificaciones sintéticas (personal y negocio)
fixtures/plantillas-firmadas/   plantillas firmadas con la llave pública de prueba de RFC 8032
fixtures/respaldo/              respaldo cifrado de ejemplo y su versión alterada
fixtures/cfdi/                  9 CFDI sintéticos
fixtures/escenarios/            estados de usuario para probar pantallas
scripts/                        oraculo.mjs (cualquier SO), firmar-plantillas.mjs
.env.example · .gitignore · .gitattributes
```

## Qué está verificado

- **Vectores de los motores (versión 3)** generados por un oráculo independiente en Python. El generador pseudoaleatorio (mulberry32) y el hash (FNV-1a) dan resultados idénticos bit a bit a JavaScript (Node 22). Las probabilidades simuladas coinciden con las analíticas (0.7509 contra 0.75; 0.7016 contra 0.70). `node scripts/oraculo.mjs --verificar` pasa.
- **Dos revisiones independientes:** revisores que no habían visto el trabajo encontraron 20 problemas en el núcleo (horizonte con depósitos adelantados, transferencias, MSI existentes, arqueo, redondeos, entre otros) y 25 en la extensión M8–M16 (resolutor de cuentas entre espacios, llave del respaldo automático, transferencias entre el negocio y lo personal, redondeos fiscales, entre otros). Todos están corregidos y registrados en `docs/ESTADO.md` → Decisiones. Después, cuatro rondas de verificación de esas correcciones cerraron los últimos casos (una transferencia del negocio que coincide con un sueldo dictado, el cierre de un grupo compartido, los impuestos del negocio que no son ISR ni IVA, entre otros).
- **Golden set:** los 144 casos validan contra `fixtures/nlu/esquema.json`, y casos inválidos se rechazan. La gramática del nivel de reglas, probada con una implementación de referencia: cobertura 16/16 y precisión 17/17.
- **Plantillas de notificaciones:** los 14 ejemplos (12 personales y 2 de negocio) pasan con el motor de expresiones regulares de JavaScript.
- **Criptografía:** el respaldo de ejemplo se descifra igual con Python (`cryptography`) y con Node; su versión alterada se rechaza. La firma de plantillas verifica con la llave de prueba y el vector 1 de RFC 8032.
- **Datos de mercado, regulación y fiscales** con fuentes en `docs/01-PRD.md §14` y `docs/08-CUMPLIMIENTO.md §8`, consultadas el 11 de octubre de 2026. Los valores fiscales no se usan sin validación de un contador.

## Qué requiere acción tuya

| Tema | Por qué | Cuándo |
|---|---|---|
| Responsable del aviso de privacidad | Nombre o razón social, domicilio y correo; sin eso M0 no se publica | Antes de publicar M0 |
| Formatos reales de notificaciones bancarias | Las plantillas incluidas son sintéticas | M5 (modo diagnóstico en tu teléfono) |
| Revisión legal del aviso de privacidad | Datos financieros requieren consentimiento expreso | M7 y M13 |
| Validación fiscal por un contador público | RESICO, UMA, deducciones y día de pago | M11–M12 (bloquea M13) |
| Marca "Cartera" | Nombre genérico y provisional | Antes de M7 |
| Llave privada de plantillas | Se genera una vez y se guarda fuera del repositorio | M10 |
| Precio Plus ($69/mes, $599/año) y Negocio | Hipótesis | M0 (lista de espera) y beta |
| Cuentas de servicios | Supabase, Expo/EAS, Google Play Console, RevenueCat, Sentry, PostHog, proveedor(es) de LLM; Apple Developer en M14 | Según el hito que los pida |
