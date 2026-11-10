import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducirMovimiento } from '../movimiento';
import { Orbe } from './Orbe';

/** Esfera menta iluminada arriba a la izquierda; su borde ondula y crece con la voz (`nivel`, 0 a 1). */
const SKSL = `
uniform float2 res;
uniform float t;
uniform float nivel;

half4 main(float2 p) {
  float2 uv = (p - 0.5 * res) / (0.5 * res.x);
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float borde = 0.72 + 0.10 * nivel
    + (0.006 + 0.020 * nivel) * sin(a * 3.0 + t * 1.4)
    + (0.004 + 0.014 * nivel) * sin(a * 5.0 - t * 2.1);
  float cuerpo = smoothstep(borde + 0.006, borde - 0.006, r);
  float halo = smoothstep(1.0, borde, r) * (0.12 + 0.28 * nivel) * (1.0 - cuerpo);
  float2 q = uv / borde;
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  float3 n = normalize(float3(q, z + 0.001));
  float luz = max(dot(n, normalize(float3(-0.45, -0.6, 0.66))), 0.0);
  float3 col = mix(float3(0.16, 0.62, 0.47), float3(0.71, 0.96, 0.86), luz);
  col += pow(luz, 18.0) * 0.18;
  float3 salida = col * cuerpo + float3(0.369, 0.878, 0.69) * halo;
  return half4(half3(salida), half(cuerpo + halo));
}
`;

const EFECTO = Skia.RuntimeEffect.Make(SKSL);

/**
 * El orbe de «Te escucho», dibujado por la GPU con Skia: respira solo y crece con el volumen si el reconocedor lo da.
 * Decorativo. Con «Reducir movimiento» se queda quieto; si el efecto no compila en el teléfono, cae al `Orbe` normal.
 */
export function OrbeVivo({
  tamano,
  suscribirVolumen,
  testID = 'orbe-vivo',
}: {
  tamano: number;
  suscribirVolumen: ((alNivel: (nivel: number) => void) => () => void) | null;
  testID?: string;
}) {
  const reducir = useReducirMovimiento();
  const t = useSharedValue(0.4);
  const nivel = useSharedValue(0.1);
  useFrameCallback((cuadro) => {
    'worklet';
    t.value = (cuadro.timeSinceFirstFrame ?? 0) / 1000;
  }, !reducir);
  useEffect(() => {
    if (!suscribirVolumen || reducir) return;
    return suscribirVolumen((n) => {
      nivel.value = withTiming(n, { duration: 90 });
    });
  }, [suscribirVolumen, reducir, nivel]);
  const uniforms = useDerivedValue(() => ({ res: [tamano, tamano], t: t.value, nivel: nivel.value }));
  if (!EFECTO) return <Orbe tamano={tamano} estado="escuchando" testID={testID} />;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: tamano, height: tamano }}
    >
      <Canvas style={{ width: tamano, height: tamano }}>
        <Fill>
          <Shader source={EFECTO} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}
