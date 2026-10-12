import { View, type ColorValue } from 'react-native';
import { barraPestanas } from '../../ui';

/**
 * Íconos de las pestañas dibujados con vistas (sin dependencia de fuentes de íconos). Son decorativos: la
 * etiqueta siempre visible es la que distingue cada pestaña (02-UX §15).
 */
export function IconoPestana({
  ruta,
  color,
}: {
  ruta: 'hoy' | 'movimientos' | 'cuentas';
  color: ColorValue;
}) {
  const t = barraPestanas.tamanoIcono;
  const contenido =
    ruta === 'hoy' ? (
      <View
        style={{
          width: t - 6,
          height: t - 6,
          borderRadius: t,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
    ) : ruta === 'movimientos' ? (
      <View style={{ gap: 4 }}>
        {[t - 6, t - 10, t - 6].map((ancho, i) => (
          <View key={i} style={{ width: ancho, height: 2, borderRadius: 1, backgroundColor: color }} />
        ))}
      </View>
    ) : (
      <View
        style={{
          width: t - 4,
          height: t - 8,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: color,
          justifyContent: 'center',
        }}
      >
        <View style={{ height: 2, backgroundColor: color, marginTop: -4 }} />
      </View>
    );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: t, height: t, alignItems: 'center', justifyContent: 'center' }}
    >
      {contenido}
    </View>
  );
}
