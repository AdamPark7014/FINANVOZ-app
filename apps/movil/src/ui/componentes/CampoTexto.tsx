import { useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN, radio, tipo } from '../tokens';
import { Texto } from './Texto';

export interface CampoTextoProps {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  /** Ejemplo, no instrucción: «tacos 80 en efectivo». */
  ejemplo?: string;
  ayuda?: string;
  /** Qué pasó + qué hacer (02-UX §14). */
  error?: string | null;
  teclado?: KeyboardTypeOptions;
  autoFocus?: boolean;
  alEnviar?: () => void;
  /** Propiedades nativas adicionales (autocorrección, longitud máxima…). */
  nativo?: Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'accessibilityLabel'>;
  testID?: string;
}

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  ejemplo,
  ayuda,
  error,
  teclado = 'default',
  autoFocus,
  alEnviar,
  nativo,
  testID,
}: CampoTextoProps) {
  const { c } = useTema();
  const [enfocado, setEnfocado] = useState(false);
  const conError = Boolean(error);
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto
        variante="etiqueta"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {etiqueta}
      </Texto>
      <TextInput
        testID={testID}
        value={valor}
        onChangeText={alCambiar}
        placeholder={ejemplo}
        placeholderTextColor={c.textoSecundario}
        keyboardType={teclado}
        autoFocus={autoFocus}
        onSubmitEditing={alEnviar}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        accessibilityLabel={etiquetaHablada(etiqueta)}
        accessibilityHint={error ?? ayuda}
        {...nativo}
        style={[
          tipo.cuerpo,
          {
            minHeight: OBJETIVO_TACTIL_MIN,
            color: c.texto,
            backgroundColor: c.superficie,
            borderRadius: radio.m,
            borderWidth: enfocado || conError ? 2 : 1,
            borderColor: conError ? c.faltante : enfocado ? c.foco : c.bordeControl,
            paddingHorizontal: espacio.m,
            paddingVertical: espacio.s,
          },
        ]}
      />
      {conError ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto variante="secundario" tono="secundario">
          {ayuda}
        </Texto>
      ) : null}
    </View>
  );
}
