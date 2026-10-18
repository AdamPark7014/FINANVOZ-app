import { useState } from 'react';
import { View } from 'react-native';
import { ErrorDominio } from '@cartera/core';
import {
  formatearCelular,
  formatearClabe,
  guardarDatosCobro,
  leerDatosCobro,
  type DatosCobro,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Texto } from '../../ui';
import { mensajeError } from '../principal/textos';
import {
  AYUDA_DATOS_COBRO,
  ETIQUETA_CANCELAR,
  ETIQUETA_CELULAR_COBRO,
  ETIQUETA_CLABE_COBRO,
  MENSAJES_DATOS_COBRO,
  PISTA_CANCELAR_DATOS_COBRO,
  PISTA_GUARDAR_DATOS_COBRO,
} from './textos';

/**
 * Datos para cobrar (`02 §17`): celular para DiMo y CLABE. Se capturan una vez (en Ajustes o la primera vez que
 * cobras) y viven solo en el teléfono.
 */
export function FormularioDatosCobro({
  alGuardar,
  alCancelar,
  etiquetaGuardar = 'Guardar',
  pistaGuardar = PISTA_GUARDAR_DATOS_COBRO,
}: {
  alGuardar: (datos: DatosCobro) => void;
  alCancelar?: () => void;
  etiquetaGuardar?: string;
  pistaGuardar?: string;
}) {
  const { ctx, refrescar } = useSesion();
  const [inicial] = useState(() => leerDatosCobro(ctx));
  const [celular, setCelular] = useState(inicial?.celular ? formatearCelular(inicial.celular) : '');
  const [clabe, setClabe] = useState(inicial?.clabe ? formatearClabe(inicial.clabe) : '');
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    try {
      const datos = guardarDatosCobro(ctx, { celular, clabe });
      setError(null);
      refrescar();
      alGuardar(datos);
    } catch (e) {
      setError(
        e instanceof ErrorDominio ? (MENSAJES_DATOS_COBRO[e.codigo] ?? mensajeError(e)) : mensajeError(e),
      );
    }
  };

  return (
    <View style={{ gap: espacio.m }} testID="formulario-datos-cobro">
      <Texto variante="secundario" tono="secundario">
        {AYUDA_DATOS_COBRO}
      </Texto>
      <CampoTexto
        etiqueta={ETIQUETA_CELULAR_COBRO}
        valor={celular}
        alCambiar={setCelular}
        ejemplo="22 1234 5678"
        teclado="phone-pad"
        testID="campo-celular-cobro"
      />
      <CampoTexto
        etiqueta={ETIQUETA_CLABE_COBRO}
        valor={clabe}
        alCambiar={setClabe}
        ejemplo="18 dígitos"
        teclado="number-pad"
        testID="campo-clabe-cobro"
      />
      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="error-datos-cobro"
        >
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={etiquetaGuardar}
        alPresionar={guardar}
        pista={pistaGuardar}
        testID="boton-guardar-datos-cobro"
      />
      {alCancelar ? (
        <Boton
          etiqueta={ETIQUETA_CANCELAR}
          variante="texto"
          alPresionar={alCancelar}
          pista={PISTA_CANCELAR_DATOS_COBRO}
          testID="boton-cancelar-datos-cobro"
        />
      ) : null}
    </View>
  );
}
