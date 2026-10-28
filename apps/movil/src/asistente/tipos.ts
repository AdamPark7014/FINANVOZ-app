import type { Centavos, PlainDate } from '@cartera/core';
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
  /** Qué pasa al tocarla, para el lector. */
  readonly pista?: string;
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
      /**
       * La cifra del día antes y después, en pesos enteros como se ven (las de `cambioDia`), y lo que bajó o subió:
       * «Tu día $275 → $268» con la barra recortada y el «−$7» de la píldora (B+, D3). Solo presenta lo de `core`.
       */
      readonly dia?: CambioDia;
      readonly deshacer?: () => Promise<void> | void;
      readonly abrir?: () => void;
      /** Un solo movimiento simple: se pinta como la tarjeta de B2 (con sus chips de un toque). */
      readonly movimiento?: MovimientoRegistrado;
      readonly cambios?: readonly CambioRegistro[];
      /** «Si oí mal, solo dime «eran 30» o «fue con la Nu».» (solo bajo el último registro). */
      readonly pista?: string;
      /** Viene de corregir: «Listo, lo corregí.». */
      readonly corregido?: boolean;
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
      /** «¿Me alcanza?» contestado: se pinta como la tarjeta de B3. */
      readonly puedoGastar?: DatosPuedoGastar;
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

/** La cifra del día antes y después de registrar (centavos de pesos enteros, como se muestran) y su diferencia. */
export interface CambioDia {
  readonly antes: Centavos;
  readonly despues: Centavos;
  /** `despues − antes`: negativo si el día bajó. */
  readonly delta: Centavos;
}

/** Lo que se ve de un movimiento recién registrado en su tarjeta (tablero B2). Textos ya formateados. */
export interface MovimientoRegistrado {
  /** «Coca». */
  readonly descripcion: string;
  /** «$25» (gasto) o «+$13,000» (lo que entra). */
  readonly montoTexto: string;
  readonly categoria: string | null;
  /** Para el ícono de la categoría. */
  readonly categoriaSlug: string | null;
  readonly cuenta: string | null;
  /** Para el ícono del chip de la cuenta (B+, D3). */
  readonly cuentaClase?: 'efectivo' | 'liquida' | 'tarjeta' | null;
  /** «hoy», «ayer» o «vie 23». */
  readonly cuando: string;
  /** «Hoy, 9:41» (la hora solo si es de hoy) bajo el nombre (B+, D3). */
  readonly cuandoHora?: string;
}

/** Un chip de un toque de la tarjeta de registro (de C2): categoría, cuenta o día. */
export interface CambioRegistro {
  readonly clave: 'categoria' | 'cuenta' | 'dia';
  /** Lo que se ve en el chip: «Antojos», «Efectivo», «Hoy». */
  readonly actual: string;
  /** El valor de la opción vigente (slug, id de cuenta o fecha). */
  readonly valor: string;
  readonly opciones: readonly ChipRespuesta[];
  /** Corrige el movimiento con la opción elegida (anula y registra, regla 2) y rehace el turno. */
  readonly elegir: (valor: string) => void | Promise<void>;
}

/** «¿Me alcanza?» ya calculado para la tarjeta de B3 (cifras de `core`, regla 4). */
export interface DatosPuedoGastar {
  readonly precio: Centavos;
  /** «unos tenis»; `null` si no se dijo en qué. */
  readonly que: string | null;
  /** Lo que puedes gastar hoy sin comprarlo. */
  readonly antes: Centavos;
  /** Lo que podrías gastar al día si lo compras hoy de contado. */
  readonly despues: Centavos;
  readonly libreDespues: Centavos;
  readonly faltante: Centavos;
  readonly dias: number;
  readonly proximo: {
    readonly concepto: string;
    readonly etiqueta: string;
    readonly fecha: PlainDate;
  } | null;
  readonly tienes: { readonly monto: Centavos; readonly nombres: readonly string[] };
  readonly reservado: { readonly monto: Centavos; readonly nombres: readonly string[] };
  readonly colchon: Centavos;
}
