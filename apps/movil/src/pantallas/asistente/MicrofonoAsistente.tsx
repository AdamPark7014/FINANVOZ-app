import { Pressable, View } from 'react-native';
import { IconoMicrofono, sombra, useTema } from '../../ui';
import {
  ETIQUETA_ESCUCHANDO,
  PISTA_ESCUCHANDO,
  PISTA_HABLAR,
  TEXTO_HABLAR,
  type BotonHablar,
} from '../../voz';
import { AnilloEscucha } from './movimiento';

/**
 * El orbe del asistente (80 pt en la barra, ~136 en el estado vacío): toca o mantén (`useBotonHablar`), acción
 * «activar» de VoiceOver/TalkBack y etiqueta hablada que cambia al escuchar. Escuchando cambia de forma (anillo que
 * late y cuadro de terminar), no solo de color (`02 §15`); sin movimiento si se pidió «Reducir movimiento».
 */
export function MicrofonoAsistente({
  escuchando,
  boton,
  tamano = 80,
  testID = 'boton-hablar',
}: {
  escuchando: boolean;
  boton: BotonHablar;
  tamano?: number;
  testID?: string;
}) {
  const { c, esquema } = useTema();
  const halo = Math.round(tamano * 1.36);
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo suave del orbe (superficie alterna del tema: nunca blanco puro en oscuro). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: c.superficieAlterna,
          opacity: escuchando ? 1 : 0.75,
        }}
      />
      <AnilloEscucha activo={escuchando} tamano={tamano} />
      <Pressable
        testID={testID}
        onPressIn={boton.alPresionarDentro}
        onPressOut={boton.alSoltar}
        accessibilityActions={boton.accionesAccesibles}
        onAccessibilityAction={boton.alAccionAccesible}
        accessibilityRole="button"
        accessibilityLabel={escuchando ? ETIQUETA_ESCUCHANDO : TEXTO_HABLAR}
        accessibilityHint={escuchando ? PISTA_ESCUCHANDO : PISTA_HABLAR}
        accessibilityState={{ busy: escuchando }}
        style={({ pressed }) => ({
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          backgroundColor: c.acento,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          ...sombra.tarjeta[esquema],
        })}
      >
        {escuchando ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: tamano / 4, height: tamano / 4, borderRadius: 4, backgroundColor: c.sobreAcento }}
          />
        ) : (
          <View style={{ transform: [{ scale: tamano / 40 }] }}>
            <IconoMicrofono color={c.sobreAcento} />
          </View>
        )}
      </Pressable>
    </View>
  );
}
