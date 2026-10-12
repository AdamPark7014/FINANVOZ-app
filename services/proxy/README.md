# services/proxy

Supabase: Edge Functions (Deno) y migraciones. Las llaves de proveedores viven solo aquí, como variables del proyecto de Supabase (regla 8).

## M0 · `lista-espera`

1. Crea el proyecto en Supabase (región más cercana a México) e instala la CLI: `npm i -g supabase`.
2. `cd services/proxy && supabase link --project-ref <ref>`
3. `supabase db push` aplica `supabase/migrations/`.
4. Secretos de la función:
   ```
   supabase secrets set LISTA_ESPERA_SAL=<64 caracteres aleatorios> CALCULADORA_ORIGEN=https://finanvoz.com
   ```
5. `supabase functions deploy lista-espera --no-verify-jwt` (la llama la web pública sin sesión).
6. La URL queda en `https://<ref>.supabase.co/functions/v1/lista-espera`: ponla en `VITE_LISTA_ESPERA_URL` del despliegue de la calculadora.

Ver la respuesta a "¿para qué lo usarías?": `select * from lista_espera_resumen;` en el editor SQL.

## M3 · `nlu-interpretar` (`POST /nlu/interpretar`)

El endpoint `POST /nlu/interpretar` de `docs/03-ARQUITECTURA.md §6` es la Edge Function **`nlu-interpretar`** (Supabase nombra las funciones sin `/`): `https://<ref>.supabase.co/functions/v1/nlu-interpretar`. Toda la lógica está en `supabase/functions/_shared/nlu/` y se prueba con Vitest en Node (`pnpm test`); `nlu-interpretar/index.ts` solo conecta Supabase y los proveedores.

| Archivo | Qué hace |
|---|---|
| `_shared/nlu/contrato.ts` | Valida `{texto, contexto_min, version_esquema}` (texto ≤ 500 caracteres, cuerpo ≤ 16 KB, contexto de `06 §4` sin claves extra) y define los códigos de error |
| `_shared/nlu/prompt.ts` | Prompt de `06 §10`: sistema fijo y cacheable (reglas, catálogo, 6 ejemplos propios) y turno del usuario con el contexto y `<frase>` |
| `_shared/nlu/proveedores.ts` | Adaptadores de Anthropic (Messages API, `output_config.format` o herramienta), OpenAI (Chat Completions, `json_schema` estricto) y Google (Gemini, `responseJsonSchema`) |
| `_shared/nlu/interpretar.ts` | 8 s por llamada; ante 5xx, 429, red o tiempo, un intento con el alterno; Zod; un reintento con el error; luego `aclarar/no_entendi` |
| `_shared/nlu/manejador.ts` | JWT → cuerpo → cupo → interpretación → respuesta; registra solo metadatos |
| `_shared/nlu/registro.ts` | Línea JSON con hash de usuario, endpoint, código, estado, proveedor, modelo, tokens, latencia y llamadas |
| `_shared/nlu/limites.ts` | Límites por plan (reflejo de la función SQL) |
| `_shared/esquema-proveedor.json`, `_shared/nlu/esquema.generado.ts` | **Generados** desde `packages/nlu` (`pnpm --filter @cartera/nlu generar:proveedor`); una prueba falla si están desactualizados |
| `migrations/20261013000000_nlu_uso.sql` | `derechos`, conteos y `consumir_interpretacion` / `devolver_interpretacion` (atómicas) |

### Contrato

Petición (con `Authorization: Bearer <JWT de Supabase>`, sesión anónima o de correo):

```json
{ "texto": "me eché unos tacos de 80 con la Nu", "contexto_min": { "fecha_referencia": "2026-10-11", "dia_semana": "domingo", "espacios": ["personal"], "cuentas": [{ "tipo": "credito", "alias": ["nu"] }] }, "version_esquema": 1 }
```

Respuesta 200: `{ "interpretacion", "proveedor", "modelo", "tokens_entrada", "tokens_salida", "latencia_ms" }`. La `interpretacion` ya pasó por Zod; si el modelo no la produjo válida en dos intentos, es `{ "intencion": "aclarar", "motivo": "no_entendi", … }`.

Errores, siempre `{ "error": "<código>" }`:

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `solicitud_invalida` | Cuerpo que no es JSON, demasiado grande o fuera del contrato (incluye claves extra en `contexto_min`) |
| 401 | `no_autorizado` | Sin JWT o JWT inválido. Si el gateway de Supabase rechaza antes, su 401 tiene otro cuerpo: el cliente debe fijarse en el estado |
| 405 | `metodo` | Método distinto de POST |
| 429 | `limite_diario`, `limite_mensual`, `tope_global` | Gratis 20/día y 30/mes; Plus 60/día y 300/mes; tope global diario |
| 502 | `proveedor_fallo` | Fallaron el principal y el alterno (o el principal con un 4xx) |
| 503 | `sin_configurar` | Faltan secretos |
| 504 | `tiempo_agotado` | El último intento pasó de 8 s |
| 500 | `error_interno` | Inesperado (no se registra el mensaje) |

Con 502 o 504 la interpretación se devuelve al cupo del usuario (no al tope global: la llamada pudo costar).

### Desplegar

1. `supabase db push` aplica `20261013000000_nlu_uso.sql`.
2. En Authentication → Sign In / Providers, activa **Anonymous sign-ins** (la app crea la sesión en el primer arranque).
3. Secretos (solo en el proyecto de Supabase, regla 8):
   ```
   supabase secrets set \
     NLU_PROVEEDORES=anthropic,openai \
     ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GOOGLE_API_KEY=... \
     NLU_TOPE_GLOBAL_DIARIO=2000 \
     NLU_SAL_USUARIO=<64 caracteres aleatorios>
   ```
   | Variable | Obligatoria | Uso |
   |---|---|---|
   | `NLU_PROVEEDORES` | No (`anthropic,openai`) | Principal y alterno, separados por coma (`anthropic`, `openai`, `google`) |
   | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` | Las de los proveedores elegidos | Un proveedor sin llave se omite |
   | `NLU_MODELO_ANTHROPIC`, `NLU_MODELO_OPENAI`, `NLU_MODELO_GOOGLE` | No (`claude-haiku-5-5`, `gpt-5-mini`, `gemini-2.5-flash`) | Cambiar de modelo sin tocar la app (`06 §11`) |
   | `NLU_ANTHROPIC_MODO` | No (`json_schema`) | `herramienta` usa `tools[].input_schema` si la salida estructurada rechaza el esquema |
   | `NLU_TOPE_GLOBAL_DIARIO` | Sí | Interpretaciones por día de todos los usuarios; al llegar, 429 `tope_global` |
   | `NLU_SAL_USUARIO` | Sí | Sal del hash de usuario en los registros |
4. `supabase functions deploy nlu-interpretar` (con la verificación de JWT del gateway activa; no uses `--no-verify-jwt`). El mapa de importaciones está en `nlu-interpretar/deno.json`.
5. Prueba de humo con una sesión anónima: `curl -X POST https://<ref>.supabase.co/functions/v1/nlu-interpretar -H "Authorization: Bearer <access_token>" -H 'content-type: application/json' -d '{"texto":"uber 120","contexto_min":{"fecha_referencia":"2026-10-12","espacios":["personal"],"cuentas":[]},"version_esquema":1}'`. Sin el encabezado debe responder 401.

Desde M7 el plan lo actualiza el webhook de RevenueCat (sección siguiente). Para probar sin tienda: `insert into derechos (usuario_id, plan) values ('<uuid>', 'plus') on conflict (usuario_id) do update set plan = excluded.plan;`.

Registros: en Logs → Edge Functions cada petición deja una línea JSON solo con metadatos (nunca el texto, montos, alias ni el cuerpo del proveedor). Alerta del tope global: filtra `codigo = tope_global`. Uso diario total: `select * from nlu_uso_resumen;`.

### Benchmark y elección de modelo (CA-M3-01, CA-M3-06)

Lo corre Adam con sus llaves, en su máquina (las llaves nunca entran al repositorio):

1. Contrato con el proveedor real (`06 §10.1` punto 3), 3 frases por proveedor: `ANTHROPIC_API_KEY=... pnpm eval:nlu --nivel nube --proveedor anthropic --limite 3` (igual con `openai` + `OPENAI_API_KEY` y `google` + `GOOGLE_API_KEY`). Si Anthropic rechaza el esquema, repite con `NLU_ANTHROPIC_MODO=herramienta`. Para usar otro modelo: `--modelo <id>`.
2. Golden set completo y grabación, por proveedor: `ANTHROPIC_API_KEY=... pnpm eval:nlu --nivel nube --proveedor anthropic --grabar` → `fixtures/nlu/grabaciones/anthropic/claude-haiku-5-5.jsonl`.
3. Confirma los precios de `config/nlu/precios.json` y corre `pnpm eval:nlu --offline`: imprime el reporte de cada modelo grabado.
4. Elige el de menor costo por caso completo correcto que cumpla todos los umbrales y p95 < 5 s (`06 §11`); registra el reporte y la decisión en `docs/ESTADO.md` (Reportes del intérprete y Decisiones), pon ese proveedor primero en `NLU_PROVEEDORES` y haz commit de las grabaciones.

Contra el proxy (local con `supabase functions serve nlu-interpretar` o desplegado): `NLU_PROXY_URL=<url> NLU_PROXY_JWT=<access_token> pnpm eval:nlu --nivel nube --proveedor anthropic --limite 3`. Consume el cupo de ese usuario (Gratis: 20 al día), así que el benchmark completo se corre directo contra el proveedor.

Hasta que existan las grabaciones, CA-M3-01 y CA-M3-06 quedan pendientes; `pnpm eval:nlu --offline` ya corre en CI y avisa "sin grabaciones".

## M7 · `webhooks-revenuecat` (`POST /webhooks/revenuecat`)

RevenueCat avisa cada compra, renovación, cancelación y vencimiento; la función actualiza `derechos` y el cupo del intérprete lo aplica en la siguiente frase (Gratis 30 al mes, Plus 300). La lógica está en `supabase/functions/_shared/revenuecat/` (Vitest + PGlite).

| Archivo | Qué hace |
|---|---|
| `_shared/revenuecat/evento.ts` | Traduce el evento: compra, renovación, cancelación (Plus hasta que vence), problema de cobro y extensión → `plus` con `vigente_hasta`; `EXPIRATION` → `gratis`; `TRANSFER` → mueve el derecho; lo demás se ignora. Solo el derecho `plus` y solo ids que son usuarios de Supabase (uuid) |
| `_shared/revenuecat/manejador.ts` | `Authorization: Bearer <secreto>` en tiempo constante → cuerpo ≤ 64 KB → evento → base. Registra solo `tipo:resultado` |
| `migrations/20261015000000_revenuecat.sql` | `derechos.en_prueba` y `evento_ms`, `revenuecat_eventos` (idempotencia) y `aplicar_derecho_revenuecat` / `transferir_derecho_revenuecat` (atómicas; un evento viejo no pisa uno nuevo) |

Respuestas: 200 `{ "resultado": "aplicado" | "duplicado" | "antiguo" | "sin_usuario" | "ignorado" }`; 401 `no_autorizado`; 400 `solicitud_invalida`; 405 `metodo`; 503 `sin_configurar`; 500 `error_interno` (RevenueCat reintenta).

### Desplegar

1. `supabase db push` aplica `20261015000000_revenuecat.sql`.
2. `supabase secrets set REVENUECAT_WEBHOOK_SECRET=<64 caracteres aleatorios>` (mínimo 32).
3. `supabase functions deploy webhooks-revenuecat --no-verify-jwt` (RevenueCat no tiene sesión; la protege el secreto).
4. En RevenueCat → Project settings → Integrations → Webhooks: URL `https://<ref>.supabase.co/functions/v1/webhooks-revenuecat`, encabezado de autorización `Bearer <el mismo secreto>`, ambientes producción y sandbox (los probadores con licencia de Play compran en sandbox). "Send test event" debe responder 200 `ignorado`.
5. En RevenueCat el derecho (Entitlement) se llama **`plus`** y agrupa los productos mensual y anual con la prueba de 14 días configurada en Play Console.
6. La app se identifica en RevenueCat con el id de su sesión anónima de Supabase, así el evento llega al mismo `usuario_id` que usa el intérprete.

## M7 · Evidencia del consentimiento

`migrations/20261020000100_consentimiento.sql` crea `consentimiento (usuario_id, version_aviso, aceptado_en, recibido_en)` (`08 §2`). No hay función: la app inserta con PostgREST (`POST /rest/v1/consentimiento`, llave `anon` + JWT de la sesión anónima). La RLS solo deja insertar la evidencia propia (`usuario_id` lo pone `auth.uid()`); nadie con la llave `anon` puede leerla, cambiarla ni borrarla. Se aplica con `supabase db push`. Para consultarla (por ejemplo, ante una solicitud ARCO): `select * from consentimiento where usuario_id = '<uuid>';` en el editor SQL. La prueba con PGlite está en `functions/_shared/consentimiento.test.ts`.

## M9 · `respaldo` (`POST /respaldo/url`, `GET /respaldo/lista`, `DELETE /respaldo/cuenta`)

Respaldo en la nube (`docs/03-ARQUITECTURA.md §5.7`, `08 §2.2`). El servidor solo guarda blobs `.cartera` cifrados en el teléfono (E16) que **no puede abrir**: no hay tabla de metadatos ni se lee el contenido. Una sola Edge Function, **`respaldo`**, con tres rutas: `https://<ref>.supabase.co/functions/v1/respaldo/url|lista|cuenta`. La lógica está en `supabase/functions/_shared/respaldo/manejador.ts` (Vitest con Storage en memoria); `respaldo/index.ts` solo conecta Supabase.

| Archivo | Qué hace |
|---|---|
| `migrations/20261101000000_respaldo.sql` | Bucket privado `respaldos` (12.5 MB por archivo, `application/octet-stream`) y RLS en `storage.objects`: leer, subir y borrar solo bajo `<auth.uid()>/` y solo con sesión de correo (`is_anonymous = false`); subir solo con el nombre `AAAAMMDDTHHMMSSZ-v<n>.cartera`; sin UPDATE |
| `_shared/respaldo/manejador.ts` | JWT → sesión de correo → ruta. Nombres, retención (4 más recientes), URLs firmadas y borrado de la cuenta. Registra solo `endpoint` y `operacion:resultado` |
| `_shared/respaldo/rls.test.ts` | La migración real en PGlite: una cuenta no lista, baja, sube ni borra lo de otra; una sesión anónima no toca el bucket (CA-M9-05) |
| `_shared/respaldo/contrato-cliente.test.ts` | El cliente de la app (`apps/movil/src/nube/respaldo-nube.ts`) contra el manejador |

### Contrato

Siempre con `Authorization: Bearer <JWT de una sesión de correo>`; con la sesión anónima responde 403 `sin_correo`.

| Ruta | Entrada | Respuesta 200 |
|---|---|---|
| `POST /respaldo/url` | `{"operacion":"subir","version":1}` | `{nombre, url, tamano_maximo}`: el servidor pone el nombre (`20261012T153000Z-v1.cartera`, hora UTC del servidor) bajo `<usuario>/`; la app hace `PUT` de los bytes a `url` (firmada por Supabase, vale 2 h, no sobrescribe). Antes de firmar poda a 4 |
| `POST /respaldo/url` | `{"operacion":"bajar","nombre":"20261012T153000Z-v1.cartera"}` | `{nombre, url}`: URL firmada de 5 min para `GET`. Un nombre que no está en la lista del usuario es 404 |
| `GET /respaldo/lista` | — | `{respaldos: [{nombre, tamano, creado_en, version}]}`, el más reciente primero; deja solo los 4 más recientes (la app la llama después de subir) |
| `DELETE /respaldo/cuenta` | — | `{resultado: "borrada"}`: borra **todos** los archivos de `<usuario>/` y, solo si no queda ninguno, el usuario de Auth (su correo; `derechos`, `consentimiento` y conteos se van en cascada). Si algo falla responde 500 y la app reintenta |

Errores `{ "error": "<código>" }`: 400 `solicitud_invalida`, 401 `no_autorizado`, 403 `sin_correo`, 404 `no_encontrado` o `ruta`, 405 `metodo`, 409 `ocupado` (otro respaldo del mismo segundo), 503 `sin_configurar`, 500 `error_interno`.

### Cuenta de respaldo (Supabase Auth)

La app no crea otro usuario: **vincula** el correo al usuario anónimo que ya tiene (`apps/movil/src/nube/cuenta-respaldo.ts`): `PUT /auth/v1/user {email}` con su JWT manda el código y `POST /auth/v1/verify {type:"email_change"}` lo confirma; el `usuario_id` no cambia, así que conserva Plus, cupo y consentimiento. En un teléfono nuevo (o si el correo ya tiene cuenta) Auth responde `email_exists` y la app **entra** con `POST /auth/v1/otp {create_user:false}` + `verify {type:"email"}` al usuario original.

### Desplegar

1. `supabase db push` aplica `20261101000000_respaldo.sql` (crea el bucket y las políticas). En Storage debe aparecer `respaldos` como privado.
2. Authentication → Sign In / Providers → **Email**: activo, con "Confirm email" activo. Deja **Anonymous sign-ins** activo (M3).
3. Authentication → Emails → SMTP: configura un SMTP propio (el integrado de Supabase manda muy pocos correos por hora y no es para producción). En Rate Limits, sube "emails per hour" a lo que permita el SMTP.
4. Authentication → Emails → Templates. Los dos llevan el código (`{{ .Token }}`), no el enlace:
   - **Change Email Address** (vincular). Asunto: `Tu código para activar el respaldo: {{ .Token }}`. Cuerpo:
     ```html
     <p>Tu código para activar el respaldo en la nube es:</p>
     <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
     <p>Escríbelo en la app. Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>
     ```
   - **Magic Link** (entrar en otro teléfono). Asunto: `Tu código para restaurar tu respaldo: {{ .Token }}`. Mismo cuerpo con "para entrar a tu respaldo".
   En Authentication → Providers → Email: "Email OTP Length" = 6 y "Email OTP Expiration" = 600 s.
5. `supabase functions deploy respaldo` (con la verificación de JWT del gateway activa; no uses `--no-verify-jwt`). No necesita secretos propios: usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que inyecta Supabase.
6. Prueba de humo: con el `access_token` de una sesión anónima, `curl https://<ref>.supabase.co/functions/v1/respaldo/lista -H "Authorization: Bearer <token>"` responde 403 `sin_correo`; sin el encabezado, 401. Con el token de una sesión de correo responde `{"respaldos":[]}`.

Registros: en Logs → Edge Functions cada petición deja `{"usuario_hash":null,"endpoint":"/respaldo/lista","codigo":"lista:ok","estado_http":200}`: nunca el usuario, el correo, nombres de archivo, URLs ni tamaños.

Solicitud ARCO o baja manual de una cuenta: usa `DELETE /respaldo/cuenta` con su sesión o, desde el panel, borra primero la carpeta `respaldos/<usuario>/` en Storage y después el usuario en Authentication (borrar solo el usuario deja sus archivos).

## M10 · `llm-turno` (`POST /llm/turno`)

Modo explicar (`docs/06-NLU.md §6`, `02 §22`): un turno **sin estado** de un bucle de herramientas. El teléfono manda la pregunta, las llamadas que pidió el modelo y los resultados **agregados** de sus herramientas de solo lectura (las ejecuta contra su libro); el proxy agrega el sistema fijo (`_shared/llm/prompt.ts`) y responde con las llamadas que pide el modelo o con su texto. Las cifras del texto las valida el teléfono: si alguna no aparece en un resultado de herramienta, muestra la respuesta en plantilla (regla 4). La lógica está en `supabase/functions/_shared/llm/` (Vitest); `llm-turno/index.ts` solo conecta Supabase y los proveedores.

| Archivo | Qué hace |
|---|---|
| `_shared/llm/contrato.ts` | Valida `{mensajes, herramientas}`: una sola pregunta (≤ 500 caracteres) al inicio, después solo llamadas del asistente y sus resultados (cada resultado responde a una llamada pendiente), ≤ 3 resultados, ≤ 12 herramientas, cuerpo ≤ 32 KB, sin claves extra |
| `_shared/llm/proveedores.ts` | Adaptadores con herramientas nativas: Anthropic (`tool_use`/`tool_result`), OpenAI (`tool_calls`, `store: false`) y Google (`functionCall`/`functionResponse`, sin razonamiento). Con 3 resultados ya no ofrece herramientas (`tool_choice` none) |
| `_shared/llm/turno.ts` | 8 s por llamada; ante 5xx, 429, red o tiempo, un intento con el alterno |
| `_shared/llm/manejador.ts` | JWT → cuerpo → cupo (`consumir_turno_llm`) → turno → respuesta; registra solo metadatos (código `herramientas` o `respuesta`) |
| `migrations/20261110000000_llm_turno.sql` | `consumir_turno_llm`: solo Plus o Negocio vigente (`solo_plus` en Gratis, sin consumir); cada turno cuenta una interpretación del mismo cupo que `/nlu/interpretar` |

### Contrato

Petición (con `Authorization: Bearer <JWT>`):

```json
{
  "mensajes": [
    { "rol": "usuario", "texto": "¿por qué no me alcanzó la quincena pasada?" },
    { "rol": "asistente", "llamadas": [{ "id": "toolu_1", "nombre": "comparar_periodos", "argumentos": {} }] },
    { "rol": "herramienta", "id": "toolu_1", "nombre": "comparar_periodos", "resultado": "{\"texto\":\"Vas $350 arriba…\"}" }
  ],
  "herramientas": [{ "nombre": "comparar_periodos", "descripcion": "…", "parametros": { "type": "object", "properties": {} } }]
}
```

Respuesta 200: `{ "salida": { "tipo": "herramientas", "llamadas": [{ "id", "nombre", "argumentos" }] } | { "tipo": "respuesta", "texto" }, "proveedor", "modelo", "tokens_entrada", "tokens_salida", "latencia_ms" }`.

Errores `{ "error": "<código>" }`: los de `/nlu/interpretar` más **403 `solo_plus`** (Gratis o Plus vencido). Con 502 o 504 el turno se devuelve al cupo.

### Desplegar

1. `supabase db push` aplica `20261110000000_llm_turno.sql`.
2. Usa los mismos secretos que `nlu-interpretar` (`NLU_PROVEEDORES`, llaves, `NLU_TOPE_GLOBAL_DIARIO`, `NLU_SAL_USUARIO`). Opcional: `LLM_MODELO_ANTHROPIC` / `LLM_MODELO_OPENAI` / `LLM_MODELO_GOOGLE` para usar en el modo explicar un modelo distinto del intérprete (si faltan, usa `NLU_MODELO_*` y después los de `06 §11`).
3. `supabase functions deploy llm-turno` (con la verificación de JWT del gateway activa).
4. Prueba de humo: con la sesión anónima de un usuario Gratis, `curl -X POST https://<ref>.supabase.co/functions/v1/llm-turno -H "Authorization: Bearer <token>" -H 'content-type: application/json' -d '{"mensajes":[{"rol":"usuario","texto":"¿en qué gasto más?"}],"herramientas":[{"nombre":"mayores_gastos","descripcion":"Top de gastos","parametros":{"type":"object","properties":{}}}]}'` responde 403 `solo_plus`; con un usuario en `derechos` como `plus`, 200 con `salida.tipo = "herramientas"`.

Registros: `{"endpoint":"/llm/turno","codigo":"herramientas"|"respuesta"|<error>, …}` con hash de usuario, proveedor, modelo, tokens, latencia y llamadas; nunca la pregunta, argumentos, resultados ni el texto del modelo.
