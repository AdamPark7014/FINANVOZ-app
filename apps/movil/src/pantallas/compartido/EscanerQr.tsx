import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { View } from 'react-native';
import { Boton, espacio, Texto } from '../../ui';
import {
  BTN_CANCELAR,
  BTN_PERMITIR_CAMARA,
  ETIQUETA_VISTA_CAMARA,
  INSTRUCCION_ESCANER_QR,
  INSTRUCCION_PERMISO_CAMARA,
  PISTA_CANCELAR_ESCANER,
  PISTA_PERMISO_CAMARA,
} from './textos';

/**
 * Escáner del QR de tu pareja (E17, `02 §27`) con la cámara trasera. Solo lee códigos QR y entrega el texto una
 * vez; no toma fotos ni guarda nada. Sin permiso explica para qué es y lo pide.
 */
export function EscanerQr({
  alLeer,
  alCancelar,
}: {
  alLeer: (texto: string) => void;
  alCancelar: () => void;
}) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const leido = useRef(false);
  return (
    <View style={{ gap: espacio.m }} testID="escaner-qr">
      {permiso?.granted ? (
        <>
          <Texto variante="cuerpo">{INSTRUCCION_ESCANER_QR}</Texto>
          <View style={{ height: 280, borderRadius: espacio.m, overflow: 'hidden' }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(r) => {
                if (leido.current) return;
                leido.current = true;
                alLeer(r.data);
              }}
              accessibilityLabel={ETIQUETA_VISTA_CAMARA}
            />
          </View>
        </>
      ) : (
        <>
          <Texto variante="cuerpo">{INSTRUCCION_PERMISO_CAMARA}</Texto>
          <Boton
            testID="escaner-permiso"
            etiqueta={BTN_PERMITIR_CAMARA}
            alPresionar={() => {
              pedirPermiso().catch(() => {});
            }}
          />
        </>
      )}
      <Boton testID="escaner-cancelar" etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alCancelar} />
    </View>
  );
}
