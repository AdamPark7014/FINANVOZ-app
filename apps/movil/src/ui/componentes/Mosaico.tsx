import { View } from 'react-native';
import { useTema } from '../tema';
import { coloresCategoria, familiaDeCategoria, type FamiliaCategoria } from '../tokens';
import { Icono, iconoDeCategoria, type NombreIcono } from './Iconos';

/**
 * El mosaico de color de una categoría (dirección B+, D0): cuadro claro con el ícono oscuro de su familia (en oscuro,
 * al revés). Va en cada fila de movimiento, en la tarjeta de registro y en lo pendiente. Decorativo: el nombre de la
 * categoría siempre va en texto o en la etiqueta del renglón.
 */
export function Mosaico({
  slug = null,
  familia,
  icono,
  tamano = 40,
  testID,
}: {
  /** Slug de la categoría (`04 §2.3`): decide la familia y el ícono. */
  slug?: string | null;
  /** Familia explícita (p. ej. el crédito en violeta, `salidas`). */
  familia?: FamiliaCategoria;
  icono?: NombreIcono;
  tamano?: number;
  testID?: string;
}) {
  const { esquema } = useTema();
  const p = coloresCategoria[esquema][familia ?? familiaDeCategoria(slug)];
  return (
    <View
      {...(testID ? { testID } : {})}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: Math.round(tamano * 0.35),
        backgroundColor: p.mosaico,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icono nombre={icono ?? iconoDeCategoria(slug)} color={p.icono} tamano={Math.round(tamano * 0.5)} />
    </View>
  );
}
