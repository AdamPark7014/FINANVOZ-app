import type { Centavos } from '@cartera/core';
import type { VistaHoy } from './hoy';

/** Un tramo de la barra de tu dinero (B+, D1). `faltante` solo aparece cuando lo que tienes no alcanza. */
export interface TramoDinero {
  readonly clave: 'apartado' | 'colchon' | 'libre' | 'faltante';
  readonly centavos: Centavos;
}

/** La leyenda: lo que pide cada parte (el desglose de E4 tal cual) y, si no alcanza, lo que falta. */
export interface LeyendaDinero {
  readonly clave: 'apartado' | 'colchon' | 'libre' | 'faltante';
  readonly centavos: Centavos;
}

export interface BarraDinero {
  /** «De tus $5,249»: lo que tienes (L). */
  readonly total: Centavos;
  /** Lo que se dibuja: cada tramo a lo ancho. */
  readonly tramos: readonly TramoDinero[];
  readonly leyenda: readonly LeyendaDinero[];
}

/**
 * La barra de tu dinero (dirección B+, D1) con el desglose de E4 (`VistaHoy`, regla 4): L = apartado + colchón + libre.
 * Si lo apartado y el colchón pasan de lo que tienes (libre negativo), lo que tienes cubre primero lo apartado y
 * después el colchón, y el resto es el **faltante** de E4 (`VistaHoy.faltante`), que se pinta aparte para que nunca
 * parezca que el colchón cabe (regla 12). Sin I/O.
 */
export function barraDinero(
  v: Pick<VistaHoy, 'liquidez' | 'reservado' | 'colchon' | 'libre' | 'faltante'>,
): BarraDinero {
  if (v.libre >= 0) {
    return {
      total: v.liquidez,
      tramos: [
        { clave: 'apartado', centavos: v.reservado },
        { clave: 'colchon', centavos: v.colchon },
        { clave: 'libre', centavos: v.libre },
      ],
      leyenda: [
        { clave: 'apartado', centavos: v.reservado },
        { clave: 'colchon', centavos: v.colchon },
        { clave: 'libre', centavos: v.libre },
      ],
    };
  }
  const tienes = Math.max(0, v.liquidez);
  const apartadoCubierto = Math.min(v.reservado, tienes);
  const colchonCubierto = Math.min(v.colchon, tienes - apartadoCubierto);
  return {
    total: v.liquidez,
    tramos: [
      { clave: 'apartado', centavos: apartadoCubierto as Centavos },
      { clave: 'colchon', centavos: colchonCubierto as Centavos },
      { clave: 'faltante', centavos: v.faltante },
    ],
    leyenda: [
      { clave: 'apartado', centavos: v.reservado },
      { clave: 'colchon', centavos: v.colchon },
      { clave: 'faltante', centavos: v.faltante },
    ],
  };
}
