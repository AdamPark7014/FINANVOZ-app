import type { Centavos } from '@cartera/core';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { cifraEnPalabras, formatearCentavos, type ModoCifra } from '../formato';
import { useTema } from '../tema';
import { NUMEROS_TABULARES, tipo } from '../tokens';

export interface CifraProps {
  /** Monto ya calculado por `servicios/`, en centavos enteros. */
  centavos: Centavos;
  modo?: ModoCifra;
  tamano?: 'heroe' | 'grande' | 'cuerpo' | 'secundario';
  /** Solo para el faltante (02-UX §14); el texto alrededor debe decirlo también. */
  faltante?: boolean;
  /**
   * Frase que antecede a la cifra en la etiqueta de TalkBack:
   * "Hoy puedes gastar" → "Hoy puedes gastar doscientos catorce pesos".
   */
  contexto?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

const tamanos = {
  heroe: tipo.cifraHeroe,
  grande: tipo.cifraGrande,
  cuerpo: tipo.cuerpoFuerte,
  secundario: tipo.secundario,
} as const;

/**
 * Cifra de dinero: solo formato. Números tabulares, sin cortar líneas (al 200 % hace salto de
 * línea en vez de truncar) y etiqueta hablada en palabras.
 */
export function Cifra({
  centavos,
  modo = 'auto',
  tamano = 'cuerpo',
  faltante = false,
  contexto,
  style,
  testID,
}: CifraProps) {
  const { c } = useTema();
  const palabras = cifraEnPalabras(centavos, modo);
  return (
    <Text
      testID={testID}
      accessible
      accessibilityLabel={contexto ? `${contexto} ${palabras}` : palabras}
      style={[
        tamanos[tamano],
        { color: faltante ? c.faltante : c.texto, fontVariant: [...NUMEROS_TABULARES] },
        style,
      ]}
    >
      {formatearCentavos(centavos, modo)}
    </Text>
  );
}
