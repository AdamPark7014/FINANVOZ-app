import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { formatearCentavos, leerPesos } from '../formato';
import { CampoTexto } from './CampoTexto';

export interface CampoMontoProps {
  etiqueta: string;
  /** Valor inicial en centavos; `null` = vacío. */
  valorInicial?: Centavos | null;
  /** Se llama en cada cambio con los centavos leídos, o `null` si está vacío o no es válido. */
  alCambiar: (centavos: Centavos | null) => void;
  ayuda?: string;
  /** Error del formulario (p. ej. "Escribe un monto mayor a $0"). */
  error?: string | null;
  autoFocus?: boolean;
  testID?: string;
}

export const ERROR_FORMATO_MONTO = 'No entendí ese monto. Escríbelo así: 1,500.50';

/**
 * Campo de pesos con teclado numérico; convierte a centavos enteros sin flotantes
 * (`leerPesos`). No valida reglas de negocio: eso lo decide quien lo usa.
 */
export function CampoMonto({
  etiqueta,
  valorInicial = null,
  alCambiar,
  ayuda,
  error,
  autoFocus,
  testID,
}: CampoMontoProps) {
  const [texto, setTexto] = useState(() =>
    valorInicial === null ? '' : formatearCentavos(valorInicial, 'auto').replace('$', ''),
  );
  const invalido = texto.trim() !== '' && leerPesos(texto) === null;
  return (
    <CampoTexto
      etiqueta={etiqueta}
      valor={texto}
      alCambiar={(nuevo) => {
        setTexto(nuevo);
        alCambiar(leerPesos(nuevo));
      }}
      ejemplo="0.00"
      teclado="decimal-pad"
      error={error ?? (invalido ? ERROR_FORMATO_MONTO : null)}
      {...(ayuda === undefined ? {} : { ayuda })}
      {...(autoFocus === undefined ? {} : { autoFocus })}
      {...(testID === undefined ? {} : { testID })}
    />
  );
}
