import type { Centavos } from '@cartera/core';
import type { PropuestaEntendi } from '../ui/entendi';

/**
 * Contratos del asistente (Ola 7, `docs/diseno/OLA-7-ASISTENTE.md` §3). Sin React ni servicios: la pantalla
 * (`pantallas/asistente`) pinta turnos; `asistente/registro.ts` los arma desde `ResultadoTexto`; los flujos
 * (`asistente/flujos`) hacen las preguntas de los formularios largos.
 */

export interface ChipRespuesta {
  readonly valor: string;
  readonly etiqueta: string;
}

/** Lo que la persona contesta a una pregunta del asistente. */
export type Respuesta =
  | { readonly tipo: 'chip'; readonly valor: string }
  | { readonly tipo: 'monto'; readonly centavos: Centavos; readonly aproximado: boolean }
  | { readonly tipo: 'texto'; readonly texto: string; readonly porVoz: boolean };

export interface AccionTurno {
  readonly etiqueta: string;
  readonly accion: () => void | Promise<void>;
  readonly testID?: string;
}

export type OrigenAviso =
  'tarjeta_accion' | 'observacion' | 'arqueo' | 'probabilidad' | 'por_revisar' | 'riesgo' | 'sin_pareja';

export type Turno =
  | { readonly id: string; readonly de: 'persona'; readonly texto: string; readonly porVoz: boolean }
  | {
      readonly id: string;
      readonly de: 'asistente';
      readonly clase: 'registro';
      /** «Registré Coca $25 · Antojos · Efectivo.» */
      readonly texto: string;
      readonly detalle?: string;
      /** «Tu día pasa de $220 a $214.» */
      readonly cambioDia?: string;
      readonly deshacer?: () => Promise<void> | void;
      readonly abrir?: () => void;
    }
  | {
      readonly id: string;
      readonly de: 'asistente';
      readonly clase: 'entendi';
      readonly propuesta: PropuestaEntendi;
    }
  | {
      readonly id: string;
      readonly de: 'asistente';
      readonly clase: 'pregunta';
      readonly texto: string;
      readonly ayuda?: string;
      readonly chips: readonly ChipRespuesta[];
      /** Con campo, además de los chips se puede contestar escribiendo o dictando. */
      readonly campo?: 'monto' | 'texto' | 'fecha';
      readonly admiteCero?: boolean;
      readonly responder: (r: Respuesta) => void;
    }
  | {
      readonly id: string;
      readonly de: 'asistente';
      readonly clase: 'aviso';
      readonly texto: string;
      readonly detalle?: string;
      readonly acciones: readonly AccionTurno[];
      readonly origen: OrigenAviso;
    }
  | {
      readonly id: string;
      readonly de: 'asistente';
      readonly clase: 'no_entendi';
      /** Lo que oyó o leyó, tal cual (nunca va a logs: regla 9). */
      readonly oido: string;
      readonly opciones: readonly ChipRespuesta[];
      readonly elegir: (valor: string) => void;
      readonly corregir: () => void;
    }
  | {
      readonly id: string;
      readonly de: 'asistente';
      readonly clase: 'texto';
      readonly texto: string;
      readonly verMovimientos?: () => void;
    };

export type TurnoAsistente = Extract<Turno, { de: 'asistente' }>;

/** Formularios largos convertidos en preguntas (§6). */
export type IdFlujo = 'tarjeta' | 'msi' | 'tanda' | 'cuenta_dividida' | 'arqueo' | 'pagar_tarjeta';

export interface PasoFlujo<E> {
  readonly id: string;
  readonly pregunta: (e: E) => string;
  readonly ayuda?: (e: E) => string;
  readonly campo?: 'monto' | 'texto' | 'fecha';
  readonly admiteCero?: boolean;
  readonly chips?: (e: E) => readonly ChipRespuesta[];
  /** Devuelve el estado nuevo o un error que se muestra en la misma pregunta. */
  readonly aplicar: (e: E, r: Respuesta) => E | { readonly error: string };
  /** Ya se dijo en la frase inicial: no se pregunta. */
  readonly omitirSi?: (e: E) => boolean;
}
