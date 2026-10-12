import type { PlainDate } from '@cartera/core';
import {
  contextoMinimo,
  type ClienteNube,
  type ClienteTurno,
  type ContextoInterprete,
  type CuentaApp,
} from '@cartera/nlu';
import { cuentasPropias } from './catalogo';
import type { Contexto } from './contexto';
import { listarOcurrencias } from './ocurrencias';
import { proximoPago } from './onboarding';
import { contactosInterprete } from './personas';
import { ingresoPrincipal } from './programados';

/** Estado de la red (puerto). En el teléfono lo implementa `nube/conectividad` con expo-network. */
export interface Conectividad {
  enLinea(): Promise<boolean>;
  /** Llama a `f` cada vez que el teléfono vuelve a tener internet. Devuelve la función para dejar de oír. */
  alReconectar(f: () => void): () => void;
}

/**
 * Nivel 2 del intérprete (`06 §1`): el cliente del proxy y la conectividad. `null` cuando la app no tiene
 * configurado Supabase: todo lo que el nivel 0 no cubre queda "por interpretar".
 */
export interface NivelNube {
  readonly cliente: ClienteNube;
  /** Modo explicar (`POST /llm/turno`, M10); sin él, la app no responde preguntas abiertas. */
  readonly turno?: ClienteTurno;
  readonly conectividad: Conectividad;
  /** Id del usuario anónimo de Supabase (para asociarle las compras de Plus, M7); `null` sin sesión. */
  readonly usuarioId?: () => Promise<string | null>;
}

const TIPO_CONTEXTO: Partial<Record<string, CuentaApp['tipo']>> = {
  efectivo: 'efectivo',
  debito: 'debito',
  billetera: 'billetera',
  tarjeta_credito: 'credito',
};

/**
 * Contexto mínimo para el proxy (`06 §4`) a la fecha de la frase: cuentas del espacio personal (sin ahorro, como
 * el resolutor), alias de contactos y fechas del ingreso. `contextoMinimo` descarta ids, saldos y dígitos.
 */
export function contextoNube(ctx: Contexto, fecha: PlainDate): ContextoInterprete {
  const cuentas: CuentaApp[] = [];
  for (const c of cuentasPropias(ctx)) {
    const tipo = TIPO_CONTEXTO[c.subtipo];
    if (tipo) cuentas.push({ tipo, nombre: c.nombre, alias: c.alias, espacio: 'personal' });
  }
  const ingreso = ingresoPrincipal(ctx);
  const recibidos = ingreso
    ? listarOcurrencias(ctx, { programadoId: ingreso.id })
        .map((o) => o.fecha)
        .filter((f) => f <= fecha)
    : [];
  return contextoMinimo({
    hoy: fecha,
    espacios: ['personal'],
    cuentas,
    contactos: contactosInterprete(ctx),
    ultimoIngreso: recibidos[recibidos.length - 1] ?? null,
    proximoIngreso: ingreso ? proximoPago(ingreso.regla, fecha) : null,
  });
}
