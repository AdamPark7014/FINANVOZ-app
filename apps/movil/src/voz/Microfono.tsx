import { View } from 'react-native';

/** Ícono de micrófono dibujado con vistas (sin dependencias de íconos). */
export function Microfono({ color, escala = 1 }: { color: string; escala?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: 'center', transform: [{ scale: escala }] }}
    >
      <View style={{ width: 10, height: 15, borderRadius: 5, backgroundColor: color }} />
      <View
        style={{
          width: 16,
          height: 8,
          marginTop: -4,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      <View style={{ width: 2, height: 3, backgroundColor: color }} />
    </View>
  );
}
