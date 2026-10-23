import type { Centavos } from '@cartera/core';
import { createContext, useContext, type ComponentType } from 'react';

/**
 * Dictar en un campo (`CampoMonto`) o un paso completo («O dímelo»). `ui/` define el contrato y la redacción del
 * campo; `voz/` pone el micrófono (`BotonDictarCampo` sobre `useMicrofono`, un solo reconocedor para la app) y la
 * raíz inyecta el intérprete del nivel 0 con `ProveedorDictado`. `ui/` no importa `voz/` ni módulos nativos: sin
 * proveedor (calculadora web, pruebas de ui) no hay micrófono. Este archivo no importa `react-native` para que la
 * redacción se pruebe en Node.
 */

export interface PropsBotonDictarCampo {
  /** Etiqueta visible del campo: el micrófono se anuncia «Dictar en voz: <campo>», sin cifras. */
  etiquetaCampo: string;
  /** Transcripción final, una vez por dictado. Nunca se registra (regla 9). */
  alOir: (transcripcion: string) => void;
  /** Lo que el campo muestra mientras escucha o si el dictado falló; `null` cuando no hay nada que decir. */
  alAviso: (aviso: AvisoDictadoCampo | null) => void;
  /** `cifra` (por omisión): mensajes de un campo de dinero. `frase`: un paso completo («O dímelo»). */
  dicta?: 'cifra' | 'frase';
  testID?: string;
}

export interface AvisoDictadoCampo {
  /** «Te escucho…», «ocho mil» (lo que se va oyendo) o el error ya redactado. */
  texto: string;
  /** Escuchando: `texto` es la transcripción en vivo, solo a la vista (puede traer cifras a medias). */
  escuchando: boolean;
  /** Se negó el micrófono: el campo ofrece «Abrir Ajustes» (iOS no vuelve a preguntar). */
  sinPermiso: boolean;
}

/** Cifra dicha en centavos enteros y si se dio como aproximada («como 500»). */
export interface LecturaMontoDictado {
  centavos: Centavos;
  aproximado: boolean;
}

/**
 * Lee la cifra dicha en un campo de dinero: el `interpretarMonto` del nivel 0 (`@cartera/nlu`, sin red ni LLM).
 * `admiteCero`: $0 es respuesta válida («no debo nada»). `null` si no hay una cifra clara.
 */
export type LectorMontoDictado = (texto: string, o: { admiteCero: boolean }) => LecturaMontoDictado | null;

/** Lo que la app inyecta para dictar en los campos: el micrófono y el intérprete de cifras. */
export interface DictadoCampos {
  BotonDictar: ComponentType<PropsBotonDictarCampo>;
  interpretarMonto: LectorMontoDictado;
}

export const ContextoDictadoCampos = createContext<DictadoCampos | null>(null);

/** El dictado de la app, o `null` si no hay `ProveedorDictado` arriba (entonces no hay micrófono). */
export function useDictadoCampos(): DictadoCampos | null {
  return useContext(ContextoDictadoCampos);
}

// --- Redacción del campo de dinero (02-UX §5 y §14): tuteo, frases cortas ---

/** Con el permiso negado, iOS no vuelve a preguntar: solo queda ir a Ajustes. */
export const BTN_ABRIR_AJUSTES_DICTADO = 'Abrir Ajustes';
export const PISTA_ABRIR_AJUSTES_DICTADO = 'Abre los ajustes del teléfono para permitir el dictado.';

/** Pista del campo mientras se escucha: nunca lleva lo que se va oyendo (puede traer cifras a medias). */
export const PISTA_CAMPO_ESCUCHANDO = 'Te escucho. Cuando termines, escribo la cifra aquí.';

/** `monto` ya formateado para la UI (`$8,500`). */
export const mensajeMontoOido = (frase: string, monto: string) => `Oí «${frase}»: puse ${monto}.`;

/** Marcas de cifra aproximada que reconoce el intérprete (`06 §9.4`, `reglas/montos`). */
const MARCA_APROXIMADO = /\b(m[aá]s o menos|aproximadamente|aprox|como|unos|unas|y feria|y pico)\b/i;

/** «Como 500»: se escribe la cifra, pero se pide corregirla si se sabe la exacta. */
export const mensajeMontoAproximado = (frase: string) => {
  const marca = MARCA_APROXIMADO.exec(frase)?.[1] ?? frase;
  return `Dijiste «${marca}»: corrígelo si sabes la cifra exacta.`;
};

export const mensajeMontoNoEntendido = (frase: string) =>
  `No entendí la cifra en «${frase}». Dila otra vez o escríbela.`;
