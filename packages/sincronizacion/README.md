# @cartera/sincronizacion

E17 · Gastos compartidos en pareja (`docs/05-MOTORES.md §E17`, M16): eventos con XChaCha20-Poly1305, fusión por `id`, QR de llave del grupo y entrada de E12.2. Sin red ni SQLite; la app publica y descarga en `apps/movil/src/servicios/compartido.ts`.

> **Tip cifrado:** en el servidor solo van en claro `grupo_id`, `id` y `autor`; el `blob` es `base64(nonce ‖ texto cifrado ‖ etiqueta)` del JSON `{tipo, creado_en, cuerpo}`. El AAD ata esos tres campos (`aadEvento` en `src/cifrado.ts`): si mueven el blob a otro grupo, id o autor, `descifrarFila` falla con `evento_ilegible`. Inyecta `CriptoSincronizacion` (pruebas y app: `@cartera/sincronizacion/noble`); nonce aleatorio en uso real, nonce fijo solo en vectores (`fixtures/sincronizacion/kat.json`).
