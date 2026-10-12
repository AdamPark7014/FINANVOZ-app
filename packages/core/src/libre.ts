import { exigirCentavos, type Centavos } from './dinero';
import { diferenciaDias, maxFecha, partes, sumarDias, type PlainDate } from './fecha';

/** Tarjeta de crédito vista por E4: solo su modo, saldo revolvente y, si está en plan, sus pagos. */
export interface TarjetaLibre {
  id: string;
  modo: 'totalero' | 'plan';
  /** Negativo = saldo a favor (no crea dinero libre). */
  saldo_revolvente: Centavos;
  pagos_planeados?: readonly { fecha: PlainDate; monto: Centavos }[];
}

/** Cuota MSI aún no facturada (la calcula E6; aquí es una entrada plana). */
export interface CuotaMsiLibre {
  plan: string;
  fecha_limite: PlainDate;
  monto: Centavos;
}

/** Deuda con una persona (subtipos persona, cliente y pareja; las tandas no). */
export interface DeudaPersonaLibre {
  contraparte: string;
  monto: Centavos;
  apartar: boolean;
}

/** E4 · Entrada por espacio (`04 §2.4`). */
export interface EntradaLibre {
  hoy: PlainDate;
  /** `fin_efectivo` de E3.3 (en el espacio negocio, `hoy + 30`). */
  fin_horizonte: PlainDate;
  /** L · liquidez (`04 §2.2`); puede ser negativa. */
  liquidez: Centavos;
  /** C · colchón. */
  colchon: Centavos;
  /** Ocurrencias de egreso pendientes (no tarjetas), incluidas las vencidas sin cubrir. */
  compromisos: readonly { concepto: string; fecha: PlainDate; monto: Centavos }[];
  tarjetas: readonly TarjetaLibre[];
  cuotas_msi_no_facturadas: readonly CuotaMsiLibre[];
  deudas_personas?: readonly DeudaPersonaLibre[];
  /** Solo espacio negocio: Σ E15 no pagado (meses vencidos + mes en curso). */
  impuestos_estimados?: Centavos;
}

export interface DesgloseReservado {
  compromisos: Centavos;
  tarjetas_saldo_completo: Centavos;
  tarjetas_pagos_planeados: Centavos;
  cuotas_msi: Centavos;
  deudas_personas: Centavos;
  impuestos: Centavos;
}

export interface ResultadoLibre {
  dias: number;
  reservado: Centavos;
  desglose: DesgloseReservado;
  libre: Centavos;
  hoy_puedes_centavos: Centavos;
  hoy_puedes_pesos_mostrados: number;
  faltante: Centavos;
}

const SIN_MINIMO = { minimo: Number.MIN_SAFE_INTEGER };

function sumar(montos: Iterable<Centavos>, campo: string): Centavos {
  let total = 0;
  for (const m of montos) total += exigirCentavos(m, campo);
  return exigirCentavos(total, campo);
}

/** E4: dinero libre y "hoy puedes gastar". `libre = L − C − R`. */
export function dineroLibre(e: EntradaLibre): ResultadoLibre {
  partes(e.hoy);
  partes(e.fin_horizonte);
  const liquidez = exigirCentavos(e.liquidez, 'liquidez', SIN_MINIMO);
  const colchon = exigirCentavos(e.colchon, 'colchon');

  const finEf = maxFecha(e.fin_horizonte, sumarDias(e.hoy, 1));
  const dias = diferenciaDias(e.hoy, finEf);
  // Incluye vencidos no pagados: todo lo anterior al fin del horizonte.
  const enH = (f: PlainDate) => {
    partes(f);
    return f < finEf;
  };

  const compromisos = sumar(
    e.compromisos.filter((c) => enH(c.fecha)).map((c) => c.monto),
    'compromisos.monto',
  );

  let tarjetasSaldoCompleto = 0;
  let tarjetasPagosPlaneados = 0;
  for (const t of e.tarjetas) {
    const saldo = exigirCentavos(t.saldo_revolvente, 'saldo_revolvente', SIN_MINIMO);
    if (t.modo === 'plan' && t.pagos_planeados && t.pagos_planeados.length > 0) {
      tarjetasPagosPlaneados += sumar(
        t.pagos_planeados.filter((p) => enH(p.fecha)).map((p) => p.monto),
        'pagos_planeados.monto',
      );
    } else {
      // Totalera, o en plan sin pagos planeados (conservador). Un saldo a favor no crea libre.
      tarjetasSaldoCompleto += Math.max(0, saldo);
    }
  }

  const cuotasMsi = sumar(
    e.cuotas_msi_no_facturadas.filter((c) => enH(c.fecha_limite)).map((c) => c.monto),
    'cuotas_msi.monto',
  );
  const deudasPersonas = sumar(
    (e.deudas_personas ?? []).filter((d) => d.apartar).map((d) => d.monto),
    'deudas_personas.monto',
  );
  // Completos aunque venzan después del horizonte: ya no es dinero del dueño.
  const impuestos = Math.max(
    0,
    exigirCentavos(e.impuestos_estimados ?? 0, 'impuestos_estimados', SIN_MINIMO),
  );

  const desglose: DesgloseReservado = {
    compromisos,
    tarjetas_saldo_completo: tarjetasSaldoCompleto,
    tarjetas_pagos_planeados: tarjetasPagosPlaneados,
    cuotas_msi: cuotasMsi,
    deudas_personas: deudasPersonas,
    impuestos,
  };
  const reservado = exigirCentavos(
    compromisos + tarjetasSaldoCompleto + tarjetasPagosPlaneados + cuotasMsi + deudasPersonas + impuestos,
    'reservado',
  );
  const libre = exigirCentavos(liquidez - colchon - reservado, 'libre', SIN_MINIMO);
  const hoyPuedes = libre > 0 ? Math.floor(libre / dias) : 0;
  return {
    dias,
    reservado,
    desglose,
    libre,
    hoy_puedes_centavos: hoyPuedes,
    hoy_puedes_pesos_mostrados: Math.floor(hoyPuedes / 100),
    faltante: libre < 0 ? -libre : 0,
  };
}

/** E4 · Espacio negocio: "Puedes retirar hasta" = `max(0, libre)`. */
export function puedesRetirar(resultado: ResultadoLibre): Centavos {
  return Math.max(0, resultado.libre);
}
