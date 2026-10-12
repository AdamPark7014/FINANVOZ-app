import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { View } from 'react-native';
import { Boton, espacio, Texto } from '../../ui';

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
          <Texto variante="cuerpo">
            Apunta la cámara al código QR que aparece en el teléfono de tu pareja.
          </Texto>
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
              accessibilityLabel="Vista de la cámara para escanear el código"
            />
          </View>
        </>
      ) : (
        <>
          <Texto variante="cuerpo">
            Para unirte necesito la cámara: solo la uso para leer el código QR de tu pareja, sin tomar fotos.
          </Texto>
          <Boton
            testID="escaner-permiso"
            etiqueta="Permitir la cámara"
            alPresionar={() => {
              pedirPermiso().catch(() => {});
            }}
          />
        </>
      )}
      <Boton testID="escaner-cancelar" etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} />
    </View>
  );
}
