import { useRef } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { dockVoz, Icono, orbe, useTema } from '../../ui';
import {
  ETIQUETA_ESCUCHANDO,
  PISTA_ESCUCHANDO,
  PISTA_HABLAR,
  TEXTO_HABLAR,
  type BotonHablar,
} from '../../voz';
import { AnilloEscucha } from './movimiento';

/** Lo que hay que deslizar el dedo, en pt, para cancelar al soltar (D2). */
export const UMBRAL_DESLIZAR = 64;

/** Dónde está el dedo; las pruebas a veces disparan el toque sin evento. */
function posicion(e: GestureResponderEvent | undefined): { x: number; y: number } | null {
  const n = e?.nativeEvent;
  return n && typeof n.pageX === 'number' && typeof n.pageY === 'number' ? { x: n.pageX, y: n.pageY } : null;
}

/**
 * El micrófono del dock de voz (dirección B): círculo menta de 68 pt con un anillo suave, al centro del dock pino.
 * Toca o mantén (`useBotonHablar`), acción «activar» de VoiceOver/TalkBack y etiqueta hablada que cambia al
 * escuchar. Escuchando cambia de forma (anillo que late y cuadro de terminar), no solo de color (`02 §15`); sin
 * movimiento si se pidió «Reducir movimiento».
 */
export function MicrofonoAsistente({
  escuchando,
  boton,
  tamano = dockVoz.microfono,
  testID = 'boton-hablar',
  etiqueta = TEXTO_HABLAR,
  pista = PISTA_HABLAR,
  alManteniendo,
}: {
  escuchando: boolean;
  boton: BotonHablar;
  tamano?: number;
  testID?: string;
  /** Nombre para el lector mientras no escucha. */
  etiqueta?: string;
  pista?: string;
  /** El dedo está (o ya no) sobre el micrófono: «Te escucho» dice «Suelta para registrar» (D2). */
  alManteniendo?: (manteniendo: boolean) => void;
}) {
  const { c, esquema } = useTema();
  // D2: «desliza para cancelar». Si el dedo se va lejos del micrófono, al salir se descarta lo dicho.
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const anillo = dockVoz.anillo;
  const total = tamano + anillo * 2;
  return (
    <View style={{ width: total, height: total, alignItems: 'center', justifyContent: 'center' }}>
      <AnilloEscucha activo={escuchando} tamano={total} color={c.microfono} />
      <Pressable
        testID={testID}
        onPressIn={(e?: GestureResponderEvent) => {
          inicio.current = posicion(e);
          alManteniendo?.(true);
          boton.alPresionarDentro();
        }}
        onPressOut={(e?: GestureResponderEvent) => {
          alManteniendo?.(false);
          const desde = inicio.current;
          const hasta = posicion(e);
          inicio.current = null;
          const lejos =
            desde !== null &&
            hasta !== null &&
            Math.hypot(hasta.x - desde.x, hasta.y - desde.y) > UMBRAL_DESLIZAR;
          if (lejos) boton.alDeslizarFuera();
          else boton.alSoltar();
        }}
        pressRetentionOffset={{
          top: UMBRAL_DESLIZAR,
          bottom: UMBRAL_DESLIZAR,
          left: UMBRAL_DESLIZAR,
          right: UMBRAL_DESLIZAR,
        }}
        accessibilityActions={boton.accionesAccesibles}
        onAccessibilityAction={boton.alAccionAccesible}
        accessibilityRole="button"
        accessibilityLabel={escuchando ? ETIQUETA_ESCUCHANDO : etiqueta}
        accessibilityHint={escuchando ? PISTA_ESCUCHANDO : pista}
        accessibilityState={{ busy: escuchando }}
        style={({ pressed }) => ({
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          backgroundColor: c.microfono,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          shadowColor: orbe.sombraMicrofono,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: esquema === 'oscuro' ? 0 : 0.28,
          shadowRadius: 14,
          elevation: esquema === 'oscuro' ? 0 : 6,
        })}
      >
        <Svg
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
          width={tamano}
          height={tamano}
          viewBox="0 0 100 100"
        >
          <Defs>
            <RadialGradient id="luz" cx="35%" cy="28%" r="80%">
              <Stop offset="0" stopColor={orbe.luz} />
              <Stop offset="0.58" stopColor={orbe.nucleo} />
              <Stop offset="1" stopColor={orbe.profundo} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#luz)" />
        </Svg>
        {escuchando ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: tamano / 3.6,
              height: tamano / 3.6,
              borderRadius: 4,
              backgroundColor: c.sobreMicrofono,
            }}
          />
        ) : (
          <Icono nombre="microfono" color={c.sobreMicrofono} tamano={tamano * 0.44} grosor={2.1} />
        )}
      </Pressable>
    </View>
  );
}
