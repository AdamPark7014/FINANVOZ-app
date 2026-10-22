import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { AppState, Linking, View } from 'react-native';
import { Boton, espacio, Texto } from '../../ui';
import {
  BTN_ABRIR_AJUSTES,
  BTN_CANCELAR,
  BTN_PERMITIR_CAMARA,
  ETIQUETA_VISTA_CAMARA,
  INSTRUCCION_ESCANER_QR,
  INSTRUCCION_PERMISO_CAMARA,
  PISTA_ABRIR_AJUSTES_CAMARA,
  PISTA_CANCELAR_ESCANER,
  PISTA_PERMISO_CAMARA,
  PISTA_VISTA_CAMARA,
  TEXTO_CAMARA_BLOQUEADA,
} from './textos';

/**
 * Escáner del QR de tu pareja (E17, `02 §27`) con la cámara trasera. Solo lee códigos QR y entrega el texto una
 * vez; no toma fotos ni guarda nada. Sin permiso explica para qué es y lo pide; si ya lo negaste y el sistema no
 * deja volver a preguntar (iPhone), lleva a Ajustes y, al regresar, revisa otra vez.
 */
export function EscanerQr({
  alLeer,
  alCancelar,
}: {
  alLeer: (texto: string) => void;
  alCancelar: () => void;
}) {
  const [permiso, pedirPermiso, revisarPermiso] = useCameraPermissions();
  const leido = useRef(false);
  // `canAskAgain === false`: el diálogo ya no sale (iOS tras negarlo una vez); solo queda Ajustes.
  const bloqueada = permiso !== null && !permiso.granted && permiso.canAskAgain === false;

  // Al volver de Ajustes se relee el permiso para mostrar la cámara sin salir del flujo.
  useEffect(() => {
    if (!bloqueada) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisarPermiso().catch(() => {});
    });
    return () => sub.remove();
  }, [bloqueada, revisarPermiso]);

  return (
    <View style={{ gap: espacio.m }} testID="escaner-qr">
      {permiso?.granted ? (
        <>
          <Texto variante="cuerpo" importantForAccessibility="no">
            {INSTRUCCION_ESCANER_QR}
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
              accessibilityLabel={ETIQUETA_VISTA_CAMARA}
              accessibilityHint={PISTA_VISTA_CAMARA}
            />
          </View>
        </>
      ) : bloqueada ? (
        <>
          <Texto variante="cuerpo" testID="escaner-bloqueada">
            {TEXTO_CAMARA_BLOQUEADA}
          </Texto>
          <Boton
            testID="escaner-abrir-ajustes"
            etiqueta={BTN_ABRIR_AJUSTES}
            pista={PISTA_ABRIR_AJUSTES_CAMARA}
            alPresionar={() => {
              Linking.openSettings().catch(() => {});
            }}
          />
        </>
      ) : (
        <>
          <Texto variante="cuerpo" importantForAccessibility="no">
            {INSTRUCCION_PERMISO_CAMARA}
          </Texto>
          <Boton
            testID="escaner-permiso"
            etiqueta={BTN_PERMITIR_CAMARA}
            etiquetaAccesible={INSTRUCCION_PERMISO_CAMARA}
            pista={PISTA_PERMISO_CAMARA}
            alPresionar={() => {
              pedirPermiso().catch(() => {});
            }}
          />
        </>
      )}
      <Boton
        testID="escaner-cancelar"
        etiqueta={BTN_CANCELAR}
        variante="texto"
        pista={PISTA_CANCELAR_ESCANER}
        alPresionar={alCancelar}
      />
    </View>
  );
}
