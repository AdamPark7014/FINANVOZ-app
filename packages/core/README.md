# @cartera/core

E1–E12, E14 y E15 · Motores de cálculo puros (`docs/05-MOTORES.md`): sin React, Expo, I/O ni reloj. Dinero en `Centavos`, fechas civiles `'YYYY-MM-DD'`, libro inmutable. Vectores: `fixtures/motores/vectores.json` vía `oraculo.py`.

> **Tip motores puros:** cada función recibe **`hoy`** (`PlainDate`) como ancla del día; donde hay aleatoriedad controlada (p. ej. simulador E11), también **`semilla`** explícita. Nunca `Date.now()`, `new Date()` para lógica de negocio ni `Math.random()` — la app y las pruebas inyectan `hoy`/`semilla` para resultados deterministas y reproducibles con el oráculo. En `fixtures/motores/`, cada vector fija `hoy` (y `semilla` si aplica) por `id`.
