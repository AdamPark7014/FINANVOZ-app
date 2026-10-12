import { Pressable, Switch, View } from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN } from '../tokens';
import { Texto } from './Texto';

export interface InterruptorProps {
  etiqueta: string;
  /** Explica el efecto: "Lo que le debes no cuenta como libre". */
  descripcion?: string;
  valor: boolean;
  alCambiar: (valor: boolean) => void;
  deshabilitado?: boolean;
  testID?: string;
}

/** Fila completa tocable con etiqueta; el estado se anuncia como activado o desactivado. */
export function Interruptor({
  etiqueta,
  descripcion,
  valor,
  alCambiar,
  deshabilitado = false,
  testID,
}: InterruptorProps) {
  const { c } = useTema();
  return (
    <Pressable
      testID={testID}
      onPress={() => alCambiar(!valor)}
      disabled={deshabilitado}
      accessibilityRole="switch"
      accessibilityLabel={etiquetaHablada(etiqueta)}
      accessibilityHint={descripcion}
      accessibilityState={{ checked: valor, disabled: deshabilitado }}
      style={{
        minHeight: OBJETIVO_TACTIL_MIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingVertical: espacio.s,
      }}
    >
      <View style={{ flex: 1, gap: espacio.xxs }}>
        <Texto variante="cuerpo">{etiqueta}</Texto>
        {descripcion ? (
          <Texto variante="secundario" tono="secundario">
            {descripcion}
          </Texto>
        ) : null}
      </View>
      <Switch
        value={valor}
        onValueChange={alCambiar}
        disabled={deshabilitado}
        // La fila ya expone el control; el Switch no se anuncia por separado.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ true: c.acento, false: c.borde }}
        thumbColor={c.superficie}
      />
    </Pressable>
  );
}
