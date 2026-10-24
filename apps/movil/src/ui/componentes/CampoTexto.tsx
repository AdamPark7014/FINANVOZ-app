import { useId, useState, type ReactNode } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  TextInput,
  View,
  type AccessibilityState,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN, radio, tipo } from '../tokens';
import { Boton } from './Boton';
import { Texto } from './Texto';

export interface CampoTextoProps {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  /** Ejemplo, no instrucción: «tacos 80 en efectivo». */
  ejemplo?: string;
  ayuda?: string;
  /**
   * La ayuda es un resultado que hay que anunciar (p. ej. lo que se oyó al dictar): en vez de ir solo en la
   * pista del campo, se lee como región viva. Quien la usa anuncia también en iPhone (`anunciar`).
   */
  ayudaViva?: boolean;
  /** Qué pasó + qué hacer (02-UX §14). */
  error?: string | null;
  teclado?: KeyboardTypeOptions;
  autoFocus?: boolean;
  alEnviar?: () => void;
  deshabilitado?: boolean;
  /** Sobrescribe la etiqueta de TalkBack (p. ej. campos de monto en pesos). */
  etiquetaAccesible?: string;
  /** Control a la derecha del campo (p. ej. el micrófono para dictar la cifra). */
  accesorio?: ReactNode;
  /** Acciones bajo la ayuda (p. ej. "Abrir Ajustes" cuando se negó el micrófono). */
  acciones?: ReactNode;
  /** Propiedades nativas adicionales (autocorrección, longitud máxima…). */
  nativo?: Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'accessibilityLabel'>;
  testID?: string;
}

/** Botón sobre el teclado numérico del iPhone, que no trae tecla para cerrarlo. */
export const TEXTO_CERRAR_TECLADO = 'Listo';
export const PISTA_CERRAR_TECLADO = 'Cierra el teclado.';

/** Teclados de iOS sin tecla de retorno: sin la barra "Listo" el teclado tapa los botones del pie. */
const TECLADOS_SIN_RETORNO: ReadonlySet<KeyboardTypeOptions> = new Set<KeyboardTypeOptions>([
  'decimal-pad',
  'number-pad',
  'numeric',
  'phone-pad',
]);

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  ejemplo,
  ayuda,
  ayudaViva = false,
  error,
  teclado = 'default',
  autoFocus,
  alEnviar,
  deshabilitado = false,
  etiquetaAccesible,
  accesorio,
  acciones,
  nativo,
  testID,
}: CampoTextoProps) {
  const { c } = useTema();
  const [enfocado, setEnfocado] = useState(false);
  // Id estable por campo: une el campo con su barra "Listo" (cada campo numérico trae la suya).
  const idBarra = `teclado-${useId()}`;
  const conBarraListo = Platform.OS === 'ios' && TECLADOS_SIN_RETORNO.has(teclado);
  const conError = Boolean(error);
  const campo = (
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
      editable={!deshabilitado}
      accessibilityLabel={etiquetaAccesible ?? etiquetaHablada(etiqueta)}
      accessibilityHint={error ?? ayuda}
      // `invalid` ya no está en el tipo de RN 0.86; se conserva para TalkBack y las pruebas.
      accessibilityState={{ invalid: conError, disabled: deshabilitado } as AccessibilityState}
      {...(conBarraListo ? { inputAccessoryViewID: idBarra } : {})}
      {...nativo}
      style={[
        tipo.cuerpo,
        {
          minHeight: OBJETIVO_TACTIL_MIN,
          color: deshabilitado ? c.textoDeshabilitado : c.texto,
          backgroundColor: c.superficie,
          borderRadius: radio.l,
          borderWidth: enfocado || conError ? 2 : 1,
          borderColor: conError ? c.faltante : enfocado ? c.foco : c.bordeControl,
          paddingHorizontal: espacio.l,
          paddingVertical: espacio.m,
        },
        accesorio ? { flex: 1 } : null,
      ]}
    />
  );
  // La ayuda normal va solo en la pista del campo (sin duplicarla al lector); la viva se lee al aparecer.
  const ayudaVisible = ayuda ? (
    <Texto
      variante="secundario"
      tono="secundario"
      {...(ayudaViva
        ? { accessibilityLiveRegion: 'polite' as const }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}
      {...(testID ? { testID: `${testID}-ayuda` } : {})}
    >
      {ayuda}
    </Texto>
  ) : null;
  return (
    <View style={{ gap: espacio.s }}>
      <Texto variante="etiqueta" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {etiqueta}
      </Texto>
      {accesorio ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          {campo}
          {accesorio}
        </View>
      ) : (
        campo
      )}
      {conError ? (
        <Texto
          variante="secundario"
          tono="faltante"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Texto>
      ) : null}
      {/* Con error, la ayuda normal se calla; un resultado que hay que anunciar (ayuda viva) se muestra igual. */}
      {!conError || ayudaViva ? ayudaVisible : null}
      {acciones ?? null}
      {conBarraListo ? (
        <InputAccessoryView nativeID={idBarra} backgroundColor={c.superficieAlterna}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: espacio.s,
              borderTopWidth: 1,
              borderTopColor: c.borde,
            }}
          >
            <Boton
              etiqueta={TEXTO_CERRAR_TECLADO}
              variante="texto"
              ancho="contenido"
              pista={PISTA_CERRAR_TECLADO}
              alPresionar={() => Keyboard.dismiss()}
              {...(testID ? { testID: `${testID}-listo` } : {})}
            />
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}
