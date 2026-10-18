import qrcode from 'qrcode-generator';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useMemo } from 'react';
import { View } from 'react-native';
import { ETIQUETA_ACCESIBILIDAD_QR_UNION } from './textos';

/** Módulos del QR (`true` = oscuro), con corrección de errores M. */
export function matrizQr(texto: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Tramos seguidos del mismo color en una fila: `[largo, oscuro]` (menos vistas que un módulo por vista). */
export function tramos(fila: readonly boolean[]): [number, boolean][] {
  const salida: [number, boolean][] = [];
  for (const m of fila) {
    const ultimo = salida.at(-1);
    if (ultimo && ultimo[1] === m) ultimo[0] += 1;
    else salida.push([1, m]);
  }
  return salida;
}

const LADO = 264;
const MARGEN = 4;
// Negro sobre blanco en los dos temas: un lector de QR necesita ese contraste.
const OSCURO = '#000000';
const CLARO = '#FFFFFF';

/**
 * Código QR con la llave del grupo y el código de unión (E17). Se dibuja con vistas (sin dependencias nativas) y,
 * mientras está en pantalla, se impiden capturas: la llave solo debe viajar al escanearlo en persona.
 */
export function CodigoQr({ texto, testID }: { texto: string; testID?: string }) {
  usePreventScreenCapture('finanvoz-qr-compartido');
  const matriz = useMemo(() => matrizQr(texto), [texto]);
  const celda = Math.max(2, Math.floor(LADO / (matriz.length + 2 * MARGEN)));
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={ETIQUETA_ACCESIBILIDAD_QR_UNION}
      style={{ alignSelf: 'center', backgroundColor: CLARO, padding: MARGEN * celda }}
    >
      {matriz.map((fila, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {tramos(fila).map(([largo, oscuro], i) => (
            <View
              key={i}
              style={{ width: largo * celda, height: celda, backgroundColor: oscuro ? OSCURO : CLARO }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
