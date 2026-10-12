import { exigirCentavos, type Centavos, type PuntosBase } from './dinero';
import { ErrorDominio } from './errores';
import { distribuirMayorResiduo } from './reparto';

// ---------------------------------------------------------------------------
// E12.1 · Cuenta dividida
// ---------------------------------------------------------------------------

export interface CuentaDividida {
  /** Parte de quien pagó (índice 0): absorbe los centavos sobrantes. */
  readonly parteUsuario: Centavos;
  readonly partesOtros: readonly Centavos[];
  /** `total − parteUsuario`: va a `contraparte:<persona>`; no es ingreso. */
  readonly porCobrarTotal: Centavos;
}

/** E12.1 · `distribuirMayorResiduo(total, [1 × partes])`; el índice 0 es el usuario. */
export function dividirCuenta(total: Centavos, partes: number): CuentaDividida {
  exigirCentavos(total, 'total');
  if (!Number.isSafeInteger(partes) || partes < 1) {
    throw new ErrorDominio('partes_invalidas', 'partes debe ser un entero ≥ 1');
  }
  const [parteUsuario = 0, ...partesOtros] = distribuirMayorResiduo(
    total,
    Array.from({ length: partes }, () => 1),
  );
  return { parteUsuario, partesOtros, porCobrarTotal: total - parteUsuario };
}

// ---------------------------------------------------------------------------
// E12.2 · Gastos compartidos en pareja
// ---------------------------------------------------------------------------

export type MiembroPareja = 'a' | 'b';

export interface RepartoPareja {
  readonly parteA: Centavos;
  readonly parteB: Centavos;
}

/** E12.2 · `distribuirMayorResiduo(total, [p, 10000 − p])`; en empate de residuos A absorbe el centavo. */
export function repartoPareja(total: Centavos, proporcionABp: PuntosBase): RepartoPareja {
  exigirCentavos(total, 'total');
  if (!Number.isSafeInteger(proporcionABp) || proporcionABp < 0 || proporcionABp > 10000) {
    throw new ErrorDominio('proporcion_invalida', 'proporcionABp debe ser un entero de 0 a 10000');
  }
  const [parteA = 0, parteB = 0] = distribuirMayorResiduo(total, [proporcionABp, 10000 - proporcionABp]);
  return { parteA, parteB };
}

export interface GastoPareja {
  readonly id: string;
  readonly tipo: 'gasto';
  readonly total: Centavos;
  readonly pago: MiembroPareja;
  readonly proporcionABp: PuntosBase;
  readonly anulado?: boolean;
}

export interface PagoPareja {
  readonly id: string;
  readonly tipo: 'pago';
  readonly de: MiembroPareja;
  readonly monto: Centavos;
  readonly anulado?: boolean;
}

export type EventoPareja = GastoPareja | PagoPareja;

export interface BalancePareja {
  /** `> 0`: B le debe a A; `< 0`: A le debe a B. */
  readonly saldo: Centavos;
  readonly debe: MiembroPareja | null;
  readonly monto: Centavos;
}

/** E12.2 · Saldo entre la pareja con los eventos no anulados. */
export function balancePareja(eventos: readonly EventoPareja[]): BalancePareja {
  let saldo = 0;
  for (const e of eventos) {
    if (e.anulado) continue;
    if (e.tipo === 'pago') {
      const monto = exigirCentavos(e.monto, 'monto');
      saldo += e.de === 'a' ? monto : -monto;
      continue;
    }
    const { parteA, parteB } = repartoPareja(e.total, e.proporcionABp);
    saldo += e.pago === 'a' ? parteB : -parteA;
  }
  return { saldo, debe: saldo > 0 ? 'b' : saldo < 0 ? 'a' : null, monto: Math.abs(saldo) };
}
