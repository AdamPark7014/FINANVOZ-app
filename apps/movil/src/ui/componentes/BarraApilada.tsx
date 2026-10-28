import { View } from 'react-native';
import { espacio } from '../tokens';

export interface ParteBarra {
  readonly clave: string;
  /** Lo que mide la parte (centavos); las partes en cero o negativas no se dibujan. */
  readonly valor: number;
  readonly color: string;
}

/** Ancho mínimo de una parte que sí existe, para que una cifra chica no desaparezca. */
const MINIMO = 6;

/**
 * Barra apilada de la dirección B+ (D1, D4, D5): las partes una tras otra, cada una con su color, separadas por un
 * hueco y con las puntas redondas. Es decorativa: quien la usa pone al lado una leyenda con el nombre y la cifra de
 * cada parte (el color nunca va solo, `02 §15`). Solo reparte el ancho: las cifras ya vienen calculadas.
 */
export function BarraApilada({
  partes,
  alto = 14,
  testID,
}: {
  partes: readonly ParteBarra[];
  alto?: number;
  testID?: string;
}) {
  const visibles = partes.filter((p) => p.valor > 0);
  return (
    <View
      {...(testID ? { testID } : {})}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', height: alto, gap: espacio.xs - 1 }}
    >
      {visibles.map((p) => (
        <View
          key={p.clave}
          {...(testID ? { testID: `${testID}-${p.clave}` } : {})}
          style={{
            flexGrow: p.valor,
            flexShrink: 1,
            flexBasis: 0,
            minWidth: MINIMO,
            height: alto,
            borderRadius: Math.min(5, alto / 2),
            backgroundColor: p.color,
          }}
        />
      ))}
    </View>
  );
}
