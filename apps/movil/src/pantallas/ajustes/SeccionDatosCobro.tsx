import { useMemo, useState } from 'react';
import { borrarDatosCobro, formatearCelular, formatearClabe, leerDatosCobro } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { View } from 'react-native';
import { Boton, espacio, etiquetaFilaAjuste, FilaAjuste, Texto } from '../../ui';
import { FormularioDatosCobro } from '../personas/FormularioDatosCobro';
import {
  BTN_AGREGAR,
  BTN_BORRAR,
  BTN_CAMBIAR,
  lineaResumenCelular,
  lineaResumenClabe,
  PISTA_AGREGAR_DATOS_COBRO,
  PISTA_BORRAR_DATOS_COBRO,
  PISTA_CAMBIAR_DATOS_COBRO,
  RESUMEN_VACIO,
  SECCION_DATOS_COBRO,
} from './datos-cobro-textos';

/** Ajustes → Datos para cobrar (`02 §17`): celular para DiMo y CLABE, solo en este teléfono. */
export function SeccionDatosCobro() {
  const { ctx, refrescar } = useSesion();
  const datos = useVista(leerDatosCobro);
  const [editando, setEditando] = useState(false);

  const resumen = useMemo(() => {
    if (!datos) return RESUMEN_VACIO;
    return [
      datos.celular ? lineaResumenCelular(formatearCelular(datos.celular)) : null,
      datos.clabe ? lineaResumenClabe(formatearClabe(datos.clabe)) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [datos]);

  if (editando) {
    return (
      <View testID="ajustes-datos-cobro" style={{ padding: espacio.l, gap: espacio.m }}>
        <Texto variante="subtitulo" testID="ajustes-datos-cobro-titulo" accessibilityRole="header">
          {SECCION_DATOS_COBRO}
        </Texto>
        <FormularioDatosCobro alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      </View>
    );
  }

  // Cerrado es una fila de Ajustes (`PLAN-UX-VOZ` §3.6); tocarla abre el formulario aquí mismo.
  return (
    <View testID="ajustes-datos-cobro">
      <FilaAjuste
        icono="celular"
        familia="transporte"
        testID="boton-editar-datos-cobro"
        testIDTitulo="ajustes-datos-cobro-titulo"
        testIDValor="datos-cobro-resumen"
        tituloEsEncabezado
        titulo={SECCION_DATOS_COBRO}
        valor={resumen}
        pista={datos ? PISTA_CAMBIAR_DATOS_COBRO : PISTA_AGREGAR_DATOS_COBRO}
        etiquetaAccesible={etiquetaFilaAjuste(
          SECCION_DATOS_COBRO,
          resumen,
          datos ? BTN_CAMBIAR : BTN_AGREGAR,
        )}
        alPresionar={() => setEditando(true)}
      />
      {datos ? (
        <View style={{ paddingHorizontal: espacio.l, paddingBottom: espacio.s }}>
          <Boton
            etiqueta={BTN_BORRAR}
            pista={PISTA_BORRAR_DATOS_COBRO}
            variante="texto"
            ancho="contenido"
            alPresionar={() => {
              borrarDatosCobro(ctx);
              refrescar();
            }}
            testID="boton-borrar-datos-cobro"
          />
        </View>
      ) : null}
    </View>
  );
}
