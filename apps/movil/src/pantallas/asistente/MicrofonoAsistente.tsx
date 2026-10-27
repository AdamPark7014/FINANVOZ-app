import { Pressable, View } from 'react-native';
import { dockVoz, Icono, useTema } from '../../ui';
import {
  ETIQUETA_ESCUCHANDO,
  PISTA_ESCUCHANDO,
  PISTA_HABLAR,
  TEXTO_HABLAR,
  type BotonHablar,
} from '../../voz';
import { AnilloEscucha } from './movimiento';

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
}: {
  escuchando: boolean;
  boton: BotonHablar;
  tamano?: number;
  testID?: string;
  /** Nombre para el lector mientras no escucha. */
  etiqueta?: string;
  pista?: string;
}) {
  const { c, esquema } = useTema();
  const anillo = dockVoz.anillo;
  const total = tamano + anillo * 2;
  return (
    <View style={{ width: total, height: total, alignItems: 'center', justifyContent: 'center' }}>
      {/* Anillo de 6 pt de la menta al 22 % (18 % en oscuro), como en el tablero B1. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: total,
          height: total,
          borderRadius: total / 2,
          backgroundColor: c.microfono,
          opacity: esquema === 'oscuro' ? 0.18 : 0.22,
        }}
      />
      <AnilloEscucha activo={escuchando} tamano={total} color={c.microfono} />
      <Pressable
        testID={testID}
        onPressIn={boton.alPresionarDentro}
        onPressOut={boton.alSoltar}
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
        })}
      >
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
