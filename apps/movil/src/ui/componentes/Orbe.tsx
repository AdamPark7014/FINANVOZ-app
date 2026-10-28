import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTema } from '../tema';
import { orbe } from '../tokens';
import { useCiclo, useRampa, useReducirMovimiento } from '../movimiento';

/**
 * `reposo`: respira (el halo crece de 1 a 1.22 en 3.2 s). `escuchando`: lanza ondas. `quieto`: sin movimiento (lo que
 * ya pasó en la conversación).
 */
export type EstadoOrbe = 'reposo' | 'escuchando' | 'quieto';

/** Ondas que salen del orbe al escuchar, escalonadas en un ciclo. */
const ONDAS = 3;

/**
 * El orbe (dirección B+ «Viva», D0): la cara del asistente. Un círculo menta con sombra interior abajo a la derecha y
 * un halo; va junto al saludo, antes de cada respuesta y grande en «Te escucho». Es decorativo (el lector no lo lee) y
 * con «Reducir movimiento» se queda quieto, sin ondas (`02 §15`).
 */
export function Orbe({
  tamano = 40,
  estado = 'reposo',
  testID = 'orbe',
}: {
  /** Diámetro del halo; el núcleo mide el 78 %. */
  tamano?: number;
  estado?: EstadoOrbe;
  testID?: string;
}) {
  const { esquema } = useTema();
  const reducir = useReducirMovimiento();
  const escuchando = estado === 'escuchando';
  const respiro = useCiclo(estado !== 'quieto', escuchando ? 1200 : orbe.cicloRespiroMs);
  const nucleo = Math.round(tamano * 0.78);
  const conOndas = escuchando && !reducir;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}
    >
      {conOndas ? (
        <View testID={`${testID}-ondas`} style={{ position: 'absolute', width: tamano, height: tamano }}>
          {Array.from({ length: ONDAS }, (_, i) => (
            <Onda key={i} tamano={tamano} retraso={(orbe.cicloOndaMs / ONDAS) * i} />
          ))}
        </View>
      ) : null}
      <Animated.View
        style={{
          position: 'absolute',
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          backgroundColor: orbe.halo,
          opacity: orbe.opacidadHalo[esquema],
          transform: [
            { scale: respiro.interpolate({ inputRange: [0, 1], outputRange: [1, orbe.escalaRespiro] }) },
          ],
        }}
      />
      <Svg width={nucleo} height={nucleo} viewBox="0 0 100 100">
        {/* La sombra es el círculo de abajo; el de arriba, corrido hacia arriba a la izquierda, deja la media luna. */}
        <Circle cx={50} cy={50} r={50} fill={orbe.sombra} />
        <Circle cx={44} cy={43} r={40.5} fill={orbe.nucleo} />
      </Svg>
    </View>
  );
}

function Onda({ tamano, retraso }: { tamano: number; retraso: number }) {
  const v = useRampa(true, orbe.cicloOndaMs, retraso);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        borderWidth: 2,
        borderColor: orbe.halo,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
      }}
    />
  );
}
