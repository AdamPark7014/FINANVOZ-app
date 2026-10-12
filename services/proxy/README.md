# services/proxy

Supabase: Edge Functions (Deno) y migraciones. Las llaves de proveedores viven solo aquí, como variables del proyecto de Supabase (regla 8).

## M0 · `lista-espera`

1. Crea el proyecto en Supabase (región más cercana a México) e instala la CLI: `npm i -g supabase`.
2. `cd services/proxy && supabase link --project-ref <ref>`
3. `supabase db push` aplica `supabase/migrations/`.
4. Secretos de la función:
   ```
   supabase secrets set LISTA_ESPERA_SAL=<64 caracteres aleatorios> CALCULADORA_ORIGEN=https://alcanzi.com
   ```
5. `supabase functions deploy lista-espera --no-verify-jwt` (la llama la web pública sin sesión).
6. La URL queda en `https://<ref>.supabase.co/functions/v1/lista-espera`: ponla en `VITE_LISTA_ESPERA_URL` del despliegue de la calculadora.

Ver la respuesta a "¿para qué lo usarías?": `select * from lista_espera_resumen;` en el editor SQL.
