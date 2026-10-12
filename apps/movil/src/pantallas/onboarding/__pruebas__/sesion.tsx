/**
 * Sesión real para pruebas de pantallas con jest-expo: la misma base (migraciones, catálogo, libro) sobre
 * better-sqlite3 en memoria, reloj fijo e ids secuenciales. Equivale a `servicios/__pruebas__/base.ts`
 * (que usa `import.meta`, no disponible en jest).
 */
import type { ReactNode } from 'react';
import type { PlainDate } from '@cartera/core';
import { abrirBaseCifrada } from '../../../db/abrir';
import { almacenEnMemoria } from '../../../db/llave';
import { aleatorioNode, puertoNode } from '../../../db/node';
import { crearContexto, crearGeneradorSecuencial, relojFijo, type Contexto } from '../../../servicios';
import { ProveedorControlApp, type ControlApp } from '../../../sesion/ControlApp';
import { ProveedorSesion } from '../../../sesion/ProveedorSesion';

export interface SesionPrueba {
  readonly ctx: Contexto;
  readonly control: ControlApp & { borrarTodo: jest.Mock };
  readonly cerrar: () => void;
  /** Envoltura para `render`/`renderRouter`. */
  readonly Envoltura: (props: { children: ReactNode }) => ReactNode;
}

export function crearSesionPrueba(hoy: PlainDate = '2026-10-11'): SesionPrueba {
  const base = abrirBaseCifrada({
    puerto: puertoNode(),
    almacen: almacenEnMemoria(),
    aleatorio: aleatorioNode,
  });
  const ctx = crearContexto({ db: base.db, reloj: relojFijo(hoy), generarId: crearGeneradorSecuencial() });
  const control = { borrarTodo: jest.fn(async () => {}) };
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <ProveedorControlApp control={control}>
      <ProveedorSesion ctx={ctx}>{children}</ProveedorSesion>
    </ProveedorControlApp>
  );
  return { ctx, control, cerrar: () => base.cerrar(), Envoltura };
}
