# @cartera/respaldo

E16 · Respaldo cifrado (M9): formato `.cartera`, scrypt + AES-256-GCM sobre la exportación JSON (`docs/04-DATOS.md §6`, `docs/05-MOTORES.md §E16`). Sin SQLite ni red; la app exporta e importa en `apps/movil/src/respaldo/`.

> **Tip `.cartera`:** el archivo empieza con `CARTERA1`, luego el encabezado JSON canónico (≤ 4 KiB) y el cuerpo `AES-256-GCM(gzip(JSON)) ‖ etiqueta`. El encabezado completo es el **AAD**: un byte alterado ahí o en el cifrado falla igual que una contraseña equivocada (`respaldo_corrupto_o_contrasena_incorrecta` — no se distinguen a propósito). Los parámetros scrypt del encabezado se validan **antes** de derivar (encabezados inválidos no gastan scrypt); inyecta `CriptoRespaldo` (pruebas: `@cartera/respaldo/node`; teléfono: spike quick-crypto). Vectores: `fixtures/respaldo/kat.json`, `E16.kdf`.
