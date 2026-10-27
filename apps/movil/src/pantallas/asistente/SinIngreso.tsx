import { View } from 'react-native';
import type { VistaHoy } from '../../servicios';
import { Boton, espacio, Texto } from '../../ui';
import {
  BTN_CONFIGURAR_INGRESO_HOY,
  PISTA_CONFIGURAR_INGRESO_HOY,
  SUBTITULO_SIN_INGRESO,
  TITULO_SIN_INGRESO,
} from '../principal/textos';

/**
 * Sin ingreso configurado (`02 §4.2`): «Dime cada cuándo te pagan» con el botón a Ajustes › Ingreso, en lugar de la
 * cifra del día del reposo (dirección B). testID `hoy-sin-ingreso` y los suyos para Maestro y las pruebas.
 */
export function SinIngreso({
  vista,
  alConfigurarIngreso,
}: {
  vista: VistaHoy;
  alConfigurarIngreso: () => void;
}) {
  return (
    <View style={{ gap: espacio.s }} testID="hoy-sin-ingreso">
      <Texto variante="subtitulo" testID="hoy-sin-ingreso-titulo" style={{ fontSize: 30, lineHeight: 38 }}>
        {vista.mensaje ?? TITULO_SIN_INGRESO}
      </Texto>
      <Texto variante="cuerpo" tono="secundario" testID="hoy-sin-ingreso-subtitulo">
        {SUBTITULO_SIN_INGRESO}
      </Texto>
      <Boton
        etiqueta={BTN_CONFIGURAR_INGRESO_HOY}
        variante="secundario"
        alPresionar={alConfigurarIngreso}
        pista={PISTA_CONFIGURAR_INGRESO_HOY}
        testID="boton-configurar-ingreso"
      />
    </View>
  );
}
