# Cartera — guía para Claude Code

App móvil de finanzas personales y de pequeños negocios de personas físicas para México (Android primero, iPhone en v2). Captura pagos digitales desde notificaciones bancarias, concilia efectivo con arqueos, entiende tarjetas, cortes y meses sin intereses, separa el dinero del negocio y dice cada día cuánto puedes gastar y con qué probabilidad llegas a la quincena.

## Fuente de verdad

| Tema | Documento |
|---|---|
| Producto y requisitos (RF-*, RNF-*), planes | `docs/01-PRD.md` |
| Pantallas, flujos y redacción | `docs/02-UX.md` |
| Arquitectura, stack y ADR | `docs/03-ARQUITECTURA.md` |
| Esquema SQL, migraciones y asientos por caso | `docs/04-DATOS.md` |
| Motores de cálculo E1–E17 | `docs/05-MOTORES.md` |
| Intérprete de lenguaje | `docs/06-NLU.md` |
| Captura (notificaciones, plantillas, Apple Pay, PDF) | `docs/07-CAPTURA.md` |
| Privacidad, tiendas, fiscal y legal | `docs/08-CUMPLIMIENTO.md` |
| Hitos M0–M16 y criterios de aceptación | `docs/09-ROADMAP.md` |
| Perfil de negocio y contador | `docs/10-NEGOCIO.md` |
| Progreso, decisiones y pendientes | `docs/ESTADO.md` |
| Vectores, golden set, semillas, CFDI, respaldos | `fixtures/` (ver `fixtures/README.md`) |

Lee solo las secciones que necesita la tarea. Si el código y la especificación difieren, gana la especificación salvo que registres la discrepancia en `docs/ESTADO.md` y la corrijas en el mismo commit.

## Stack

pnpm workspaces · TypeScript estricto (`strict`, `noUncheckedIndexedAccess`) · Expo + Expo Router + Hermes (builds de desarrollo) · `expo-sqlite` con SQLCipher + Drizzle · Zod · Vitest + fast-check · jest-expo · Maestro · Supabase (Auth, Edge Functions en Deno, Storage) · RevenueCat · Sentry.

```
apps/movil               app Expo (Android primero)
apps/calculadora         web pública del hito M0
packages/core            motores puros: sin React, sin Expo, sin I/O, sin reloj
packages/datos           esquema Drizzle, migraciones, repositorio del libro
packages/nlu             esquema Zod, reglas, resolutor, cliente del proxy, eval
packages/fiscal          lectura de CFDI (M12)
packages/respaldo        formato .cartera con criptografía inyectada (M9)
packages/sincronizacion  eventos compartidos cifrados (M16)
modules/captura-android  Expo Module en Kotlin + config plugin
modules/intents-ios      App Intent para Atajos (M14)
services/proxy           Supabase Edge Functions
scripts/                 oraculo.mjs, firmar-plantillas.mjs
config/fiscal/           parámetros fiscales por ejercicio (validados por contador)
```

## Comandos (los de pnpm existen a partir de M0/M1)

```
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm eval:nlu --nivel reglas | --nivel nube --proveedor X | --offline
node scripts/oraculo.mjs --verificar          # el oráculo y los vectores coinciden (Linux, macOS y Windows)
node scripts/oraculo.mjs --escribir           # regenera vectores.json (solo con cambio de especificación registrado)
pnpm --filter movil android
pnpm --filter movil semilla e4-01             # solo builds de desarrollo
```

## Reglas no negociables

1. **Dinero en centavos enteros** (`Centavos`). Nunca `number` con decimales para dinero. El formato `$1,500.00` solo existe en la UI.
2. **Libro inmutable.** Nada de `UPDATE`/`DELETE` de asientos. Corregir = anular (transacción espejo) + registrar el reemplazo.
3. **Toda transacción suma cero** y toda escritura financiera pasa por `Libro.registrar()` dentro de una transacción SQLite.
4. **El LLM interpreta, no calcula.** Ninguna cifra mostrada sale del modelo; sale de `packages/core`.
5. **Motores puros y deterministas.** Reciben `hoy` y `semilla`; nunca llaman `Date.now()` ni `Math.random()`.
6. **Fechas civiles** como `'YYYY-MM-DD'` con las utilidades de `core/fecha`. No uses `Date` para lógica de negocio.
7. **Los vectores de `fixtures/` son el contrato.** Si no los reproduces, el error es tuyo, salvo que demuestres un error en el vector, lo corrijas en `oraculo.py`, regeneres y lo registres en ESTADO. Nunca edites `vectores.json` a mano.
8. **Cero secretos en la app ni en el repositorio.** Las llaves de proveedores viven solo en `services/proxy` (variables de Supabase); la llave privada de plantillas, fuera del repositorio.
9. **Privacidad en logs.** Ningún monto, comercio, alias, nombre, RFC o texto dictado o de notificación en logs, analítica o reportes de error.
10. **Captura Android:** toda notificación de una app no autorizada se descarta en código nativo sin persistirse.
11. **Copy de UI** en español de México, tuteo, sin tecnicismos contables (`docs/02-UX.md §14`).
12. **Ante la duda, contar de más lo que se debe.** Ningún dato faltante puede inflar el dinero libre.
13. **Ningún valor fiscal en código.** Tasas, topes, UMA y días de pago viven en `config/fiscal/<año>.json`.

## Forma de trabajo

- Trabaja por hitos con `/hito <id>` (M0–M16). No adelantes alcance de hitos futuros.
- `docs/ESTADO.md` es la memoria entre sesiones: actualízalo al planear, al decidir y al cerrar cada criterio.
- En motores: primero las pruebas con los vectores (un caso por `id`), después la implementación.
- Antes de cada commit corre `/verificar`.
- Ante una ambigüedad: toma la opción más conservadora para el usuario, regístrala en `docs/ESTADO.md` → Decisiones y continúa. No inventes requisitos.
- Esquema de base: solo con migración nueva numerada; nunca edites una aplicada.
- Dependencias: prefiere Expo SDK y la plataforma; justifica cada dependencia nueva en el commit.
- Ramas `hito/m<n>-<nombre>`; commits pequeños estilo Conventional Commits con descripción en español: `feat(core): agrega E4 dinero libre`.
- Windows: usa `node scripts/oraculo.mjs` (encuentra `py -3`, `python` o `python3`); el repositorio fuerza finales de línea LF (`.gitattributes`).

## Convenciones de código

- Identificadores de dominio en español sin acentos, como en `docs/` (`distribuirMayorResiduo`, `Libro.registrar`, `horizonte`); utilidades genéricas pueden ir en inglés.
- Pruebas junto al código (`*.test.ts`); los vectores se cargan de `fixtures/` por `id`, nunca se copian.
- Errores de dominio tipados (`ErrorDominio` con `codigo`); nada de `throw "texto"`.
- Componentes de UI sin lógica de negocio: reciben datos ya calculados por `servicios/`.
