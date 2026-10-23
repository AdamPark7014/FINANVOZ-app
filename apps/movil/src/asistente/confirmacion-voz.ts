import { useCallback, useEffect, useRef } from 'react';
import {
  leerConfirmacion as leerConfirmacionNlu,
  type CambioConfirmacion,
  type ContextoConfirmacion,
} from '@cartera/nlu';
import { obtenerConfirmarPorVoz } from '../servicios/preferencias';
import { useVista } from '../sesion/ProveedorSesion';
import { useMicrofono, type MotorDictado } from '../voz';

/**
 * Confirmar una tarjeta «Entendí» hablando (Ola 7 §4): «sí», «dale», «correcto» → confirmar; «no», «cancela» →
 * cambiar; «no, fue con la Nu» / «eran 40» / «ponle comida» / «fue ayer» → cambiar esas filas. La lectura es la del
 * nivel 0 (`@cartera/nlu`, `pasos/confirmacion.ts`, golden `fixtures/nlu/golden-confirmacion.jsonl`); ante la duda,
 * `null` y la tarjeta espera el toque. Lo dictado nunca va a logs (regla 9).
 */
export type { CambioConfirmacion, ContextoConfirmacion };

export type LecturaConfirmacion =
  | { readonly tipo: 'si' }
  | { readonly tipo: 'no' }
  /**
   * Corrige algo. `cambios`: las filas y valores leídos (vacío si la corrección no es de una fila de la tarjeta,
   * p. ej. «no, cada semana» en el onboarding). `texto`: lo dicho sin el «no» / «sí, pero» del principio, para
   * volver a interpretarlo con el lector del paso.
   */
  | { readonly tipo: 'cambio'; readonly texto: string; readonly cambios: readonly CambioConfirmacion[] }
  | null;

/** «no», «nel», «ah no», «sí, pero», «pero», «mejor», «más bien» al principio, con su puntuación. */
const ENTRADA =
  /^\s*(?:(?:ah\s+)?(?:no|nel|nop)\b[\s,.;:]*)?(?:s[ií][\s,]+pero\b|pero\b|mejor\b|m[aá]s\s+bien\b)?[\s,.;:]*/i;
/** Arranques de una corrección («no, …», «fue …», «con …», «ponle …») aunque el resto no se lea como fila. */
const PARECE_CAMBIO =
  /^\s*(?:(?:ah\s+)?(?:no|nel|nop)\b|s[ií][\s,]+pero\b|pero\b|mejor\b|m[aá]s\s+bien\b|fue\b|fueron\b|era\b|eran\b|es\b|son\b|con\b|en\b|pon(?:le|lo|la)?\b|c[aá]mbia(?:lo|la|le)?\b|l[oa]\s+pagu[eé]\b)/i;

function sinEntrada(texto: string): string {
  return texto
    .replace(ENTRADA, '')
    .replace(/[.!?¡¿]+$/, '')
    .trim();
}

/**
 * Sí, no o cambio. `contexto` (el de `servicios/registrar.contextoInterprete` más `filas` y `movimiento` de la
 * tarjeta) deja leer cuentas por alias y fechas; sin él solo se leen tipos genéricos de cuenta, montos y categorías.
 */
export function leerConfirmacion(texto: string, contexto: ContextoConfirmacion = {}): LecturaConfirmacion {
  const lectura = leerConfirmacionNlu(texto, contexto);
  if (lectura?.tipo === 'cambio')
    return { tipo: 'cambio', texto: sinEntrada(texto), cambios: lectura.cambios };
  if (lectura) return lectura;
  // Parece corrección pero no se lee como fila («no, cada semana», «fue con la Coppel»): sin cambios, con el texto
  // para quien tenga más contexto (el lector del paso en el onboarding, los chips de una fila). Nunca confirma.
  const resto = sinEntrada(texto);
  return PARECE_CAMBIO.test(texto) && resto !== '' ? { tipo: 'cambio', texto: resto, cambios: [] } : null;
}

/** Un turno de escucha dura a lo más esto; si no oye nada, la tarjeta se queda esperando el toque. */
export const LIMITE_CONFIRMACION_MS = 6000;

export interface OpcionesConfirmacionPorVoz {
  /** La tarjeta «Entendí» está a la vista, vino de un registro dictado y espera respuesta. */
  activo: boolean;
  alSi: () => void;
  alNo: () => void;
  /** Cambios legibles a filas de la tarjeta («no, fue con la Nu», «eran 40»). */
  alCambio: (cambio: { texto: string; cambios: readonly CambioConfirmacion[] }) => void;
  /** Se oyó algo que no es sí, no ni un cambio de fila. Por omisión no pasa nada: la tarjeta espera el toque. */
  alOtro?: (texto: string) => void;
  /** Cuentas, fecha, filas y movimiento de la tarjeta para leer los cambios. */
  contexto?: ContextoConfirmacion;
  /** Al cambiar (p. ej. la versión de la propuesta tras aplicar un cambio) vuelve a escuchar un turno. */
  clave?: string | number;
  /** Reconocedor explícito (pruebas). */
  motor?: MotorDictado;
  limiteMs?: number;
}

export interface ConfirmacionPorVoz {
  /** Escuchando la respuesta: la tarjeta puede mostrarlo («Te escucho…»). */
  escuchando: boolean;
  /** Lo que va oyendo; solo a la vista. */
  parcial: string;
  /** La persona tocó algo: deja de escuchar sin hacer nada. */
  cancelar: () => void;
}

/**
 * Tras un registro dictado con tarjeta «Entendí», escucha **un** turno de hasta 6 s y llama la acción que
 * corresponde. Respeta Ajustes › Voz «Confirmar por voz»; no escucha si el teléfono no tiene dictado. Se cancela
 * con `cancelar()` (la pantalla lo llama en cuanto la persona toca algo), al pasar `activo` a `false` o al
 * desmontarse; un turno cancelado no hace nada aunque llegue un resultado tarde. Requiere `ProveedorSesion`.
 */
export function useConfirmacionPorVoz(o: OpcionesConfirmacionPorVoz): ConfirmacionPorVoz {
  const { activa: interruptor } = useVista(obtenerConfirmarPorVoz);
  const limite = o.limiteMs ?? LIMITE_CONFIRMACION_MS;
  const opciones = useRef(o);
  useEffect(() => {
    opciones.current = o;
  });
  /** El turno en curso ya contestó o se canceló: nada más que hacer. */
  const cerrado = useRef(true);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarTemporizador = useCallback(() => {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = null;
  }, []);

  const alTerminar = useCallback(
    (texto: string) => {
      if (cerrado.current) return;
      cerrado.current = true;
      limpiarTemporizador();
      const { alSi, alNo, alCambio, alOtro, contexto } = opciones.current;
      const lectura = leerConfirmacion(texto, contexto);
      if (lectura?.tipo === 'si') alSi();
      else if (lectura?.tipo === 'no') alNo();
      else if (lectura?.tipo === 'cambio' && lectura.cambios.length > 0)
        alCambio({ texto: lectura.texto, cambios: lectura.cambios });
      else alOtro?.(texto);
    },
    [limpiarTemporizador],
  );

  const microfono = useMicrofono({ alTerminar, ...(o.motor ? { motor: o.motor } : {}) });
  const { disponible, iniciar, cancelar: cancelarMicrofono } = microfono;

  const cancelar = useCallback(() => {
    limpiarTemporizador();
    if (cerrado.current) return;
    cerrado.current = true;
    cancelarMicrofono();
  }, [cancelarMicrofono, limpiarTemporizador]);

  const escuchar = o.activo && interruptor && disponible;
  useEffect(() => {
    if (!escuchar) return;
    cerrado.current = false;
    // Si se canceló mientras se pedía el permiso, el dictado arranca después: se descarta en cuanto empieza.
    void iniciar().then(() => {
      if (cerrado.current) cancelarMicrofono();
    });
    temporizador.current = setTimeout(cancelar, limite);
    return cancelar;
  }, [escuchar, o.clave, limite, iniciar, cancelar, cancelarMicrofono]);

  return { escuchando: microfono.escuchando, parcial: microfono.parcial, cancelar };
}
