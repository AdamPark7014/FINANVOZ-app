import { View, type ColorValue } from 'react-native';
import { IconoPestana as IconoPestanaPrincipal } from '../principal/IconoPestana';
import { barraPestanas } from '../../ui';

/** Tamaño del ícono de pestaña. */
const T = barraPestanas.tamanoIcono;

/**
 * Íconos de las cuatro pestañas (Ola 7 §2): Asistente (burbuja con barras de voz), Movimientos, Cuentas y Tú
 * (persona). Dibujados con vistas y decorativos: la etiqueta visible distingue cada pestaña (02-UX §15).
 */
export function IconoPestana({
  ruta,
  color,
}: {
  ruta: 'hoy' | 'movimientos' | 'cuentas' | 'tu';
  color: ColorValue;
}) {
  if (ruta === 'movimientos' || ruta === 'cuentas')
    return <IconoPestanaPrincipal ruta={ruta} color={color} />;
  const contenido =
    ruta === 'hoy' ? (
      <View style={{ alignItems: 'flex-start' }}>
        <View
          style={{
            width: T - 4,
            height: T - 8,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: color,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 2,
            paddingBottom: 3,
          }}
        >
          {[4, 7, 10].map((alto) => (
            <View key={alto} style={{ width: 2, height: alto, borderRadius: 1, backgroundColor: color }} />
          ))}
        </View>
        <View
          style={{
            width: 6,
            height: 4,
            marginLeft: 3,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: color,
          }}
        />
      </View>
    ) : (
      <View style={{ alignItems: 'center', gap: 2 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: color }} />
        <View
          style={{
            width: T - 8,
            height: 8,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderWidth: 2,
            borderBottomWidth: 0,
            borderColor: color,
          }}
        />
      </View>
    );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: T, height: T, alignItems: 'center', justifyContent: 'center' }}
    >
      {contenido}
    </View>
  );
}
