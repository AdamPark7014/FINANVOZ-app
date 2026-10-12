import { DIAS_PRUEBA, type EstadoTienda } from '../servicios';
import type { AdaptadorCompras, OfertaPlus, ResultadoCompra } from './tipos';

const DIA_MS = 86_400_000;
const PERIODO_MS: Record<OfertaPlus['periodo'], number> = { mensual: 30 * DIA_MS, anual: 365 * DIA_MS };

export interface TiendaEnMemoria extends AdaptadorCompras {
  /** La persona canceló en Google Play: sigue en Plus hasta el vencimiento. */
  cancelar(): void;
  /** Llegó el vencimiento (de la prueba o del periodo) sin renovar. */
  vencer(): void;
  /** Fija el resultado de la siguiente compra (pruebas). */
  siguienteCompra(r: Exclude<ResultadoCompra['tipo'], 'comprado'> | null): void;
  readonly usuario: string | null;
}

/**
 * Tienda en memoria: pruebas de la UI y builds de desarrollo sin llave de RevenueCat (la pantalla dice "compra
 * simulada"). Nunca cobra ni habla con Google Play.
 */
export function crearComprasEnMemoria(
  opciones: {
    ahora?: () => number;
    estado?: EstadoTienda;
    simulada?: boolean;
    precios?: [string, string];
  } = {},
): TiendaEnMemoria {
  const ahora = opciones.ahora ?? (() => Date.now());
  const [mensual, anual] = opciones.precios ?? ['$69.00', '$599.00'];
  let estado: EstadoTienda = opciones.estado ?? { plus: null };
  let pruebaUsada = estado.plus !== null;
  let forzado: Exclude<ResultadoCompra['tipo'], 'comprado'> | null = null;
  let usuario: string | null = null;
  const oyentes = new Set<(e: EstadoTienda) => void>();
  const cambiar = (e: EstadoTienda) => {
    estado = e;
    for (const f of oyentes) f(e);
  };

  return {
    simulada: opciones.simulada ?? true,
    get usuario() {
      return usuario;
    },
    async estado() {
      return estado;
    },
    async ofertas() {
      const dias = pruebaUsada ? null : DIAS_PRUEBA;
      return [
        { id: 'plus_mensual', periodo: 'mensual', precio: mensual, diasPrueba: dias },
        { id: 'plus_anual', periodo: 'anual', precio: anual, diasPrueba: dias },
      ];
    },
    async comprar(id) {
      if (forzado) {
        const tipo = forzado;
        forzado = null;
        return { tipo };
      }
      const periodo = id === 'plus_anual' ? 'anual' : id === 'plus_mensual' ? 'mensual' : null;
      if (!periodo) return { tipo: 'error' };
      const enPrueba = !pruebaUsada;
      pruebaUsada = true;
      cambiar({
        plus: {
          vigenteHasta: ahora() + (enPrueba ? DIAS_PRUEBA * DIA_MS : PERIODO_MS[periodo]),
          enPrueba,
          renovara: true,
        },
      });
      return { tipo: 'comprado', estado };
    },
    async restaurar() {
      return estado;
    },
    async identificar(id) {
      usuario = id;
    },
    alCambiar(f) {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    },
    async administrar() {},
    cancelar() {
      if (estado.plus) cambiar({ plus: { ...estado.plus, renovara: false } });
    },
    vencer() {
      cambiar({ plus: null });
    },
    siguienteCompra(r) {
      forzado = r;
    },
  };
}
