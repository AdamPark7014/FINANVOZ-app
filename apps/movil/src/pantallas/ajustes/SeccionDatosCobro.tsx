import { useMemo, useState } from 'react';
import { borrarDatosCobro, formatearCelular, formatearClabe, leerDatosCobro } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Tarjeta, Texto } from '../../ui';
import { FormularioDatosCobro } from '../personas/FormularioDatosCobro';
import {
  BTN_AGREGAR,
  BTN_BORRAR,
  BTN_CAMBIAR,
  lineaResumenCelular,
  lineaResumenClabe,
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

  return (
    <Tarjeta testID="ajustes-datos-cobro">
      <Texto variante="subtitulo">{SECCION_DATOS_COBRO}</Texto>
      {editando ? (
        <FormularioDatosCobro alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      ) : (
        <>
          <Texto variante="secundario" tono="secundario" testID="datos-cobro-resumen">
            {resumen}
          </Texto>
          <Boton
            etiqueta={datos ? BTN_CAMBIAR : BTN_AGREGAR}
            variante="secundario"
            ancho="contenido"
            alPresionar={() => setEditando(true)}
            testID="boton-editar-datos-cobro"
          />
          {datos ? (
            <Boton
              etiqueta={BTN_BORRAR}
              variante="texto"
              ancho="contenido"
              alPresionar={() => {
                borrarDatosCobro(ctx);
                refrescar();
              }}
              testID="boton-borrar-datos-cobro"
            />
          ) : null}
        </>
      )}
    </Tarjeta>
  );
}
