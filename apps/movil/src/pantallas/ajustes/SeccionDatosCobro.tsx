import { useState } from 'react';
import { borrarDatosCobro, formatearCelular, formatearClabe, leerDatosCobro } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Tarjeta, Texto } from '../../ui';
import { FormularioDatosCobro } from '../personas/FormularioDatosCobro';

/** Ajustes → Datos para cobrar (`02 §17`): celular para DiMo y CLABE, solo en este teléfono. */
export function SeccionDatosCobro() {
  const { ctx, refrescar } = useSesion();
  const datos = useVista(leerDatosCobro);
  const [editando, setEditando] = useState(false);
  return (
    <Tarjeta testID="ajustes-datos-cobro">
      <Texto variante="subtitulo">Datos para cobrar</Texto>
      {editando ? (
        <FormularioDatosCobro alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      ) : (
        <>
          <Texto variante="secundario" tono="secundario" testID="datos-cobro-resumen">
            {datos
              ? [
                  datos.celular ? `Celular: ${formatearCelular(datos.celular)}` : null,
                  datos.clabe ? `CLABE: ${formatearClabe(datos.clabe)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Agrega tu celular o tu CLABE para mandarlos cuando cobras.'}
          </Texto>
          <Boton
            etiqueta={datos ? 'Cambiar' : 'Agregar'}
            variante="secundario"
            ancho="contenido"
            alPresionar={() => setEditando(true)}
            testID="boton-editar-datos-cobro"
          />
          {datos ? (
            <Boton
              etiqueta="Borrar mis datos para cobrar"
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
