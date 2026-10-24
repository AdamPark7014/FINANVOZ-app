# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- Flota + greps: **no hay oleada UI de padding pendiente** (solo `gap: 4` decorativo en IndicadorVoz/IconoPestana). Sin TODO/FIXME reales. Sin onboarding que pida clave de banco.
- **Oleada día-1 (research → copy):** O1 + divulgación captura + tip O6 dejan explícito voz y **cero clave/usuario de banco**.
- Inventario: el resto de “perfecto” está en **externos** (teléfono, M0 dominio, legal, proxy Hetzner, contador fiscal) — ver `docs/ESTADO.md` pendientes; no se cierra con más aire en pantallas.

## A medias

- Validación en TestFlight 4 / Play 2.
- Proxy Hetzner; M0 (dominio, lista, aviso); revisión legal; `config/fiscal` contador.

## Siguiente

1. Adam en teléfono: loop voz + captura + Hoy.
2. Externos M0/M13 (no otra pasada de UI).
3. Solo más código si el teléfono revela un bug concreto.

## No tocar

- Solo `main`. Facturar / planeta / open banking con password sin spec. Credenciales fuera del repo.

## Estimación rápida

Código UI/voz ~cerrado para v1. Perfecto de producto = validación real + tienda, no más oleadas de padding.
