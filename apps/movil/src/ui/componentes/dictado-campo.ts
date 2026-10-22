import type { Centavos } from '@cartera/core';
import { createContext, useContext, type ComponentType } from 'react';

export interface PropsBotonDictarCampo {
  /** Etiqueta visible del campo: el botón se anuncia «Dictar <campo>». */
  etiquetaCampo: string;
  /** Transcripción final de lo dictado; nunca se registra (regla 9). */
  alOir: (transcripcion: string) => void;
  /** Lo que el campo muestra debajo mientras dicta («Te escucho…», sin permiso, error); `null` al terminar. */
  alAviso: (aviso: AvisoDictadoCampo | null) => void;
  testID?: string;
}

export interface AvisoDictadoCampo {
  texto: string;
  /** El micrófono está negado: el campo ofrece «Abrir ajustes». */
  sinPermiso: boolean;
}

export interface LecturaMontoDictado {
  monto: Centavos;
  aproximado: boolean;
}

/**
 * Lo que la app inyecta para dictar en los campos: el botón (micrófono nativo) y el intérprete del nivel 0. `ui/`
 * no importa módulos nativos ni el intérprete; sin proveedor (calculadora web, pruebas de ui) no hay micrófono.
 */
export interface DictadoCampos {
  BotonDictar: ComponentType<PropsBotonDictarCampo>;
  interpretarMonto: (texto: string) => LecturaMontoDictado | null;
}

export const ContextoDictadoCampos = createContext<DictadoCampos | null>(null);

export function useDictadoCampos(): DictadoCampos | null {
  return useContext(ContextoDictadoCampos);
}
