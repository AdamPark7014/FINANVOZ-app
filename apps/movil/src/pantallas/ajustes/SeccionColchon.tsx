import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { colchonSugerido, fijarColchon, obtenerAjustes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { ERROR_GUARDAR } from '../onboarding/componentes';

/**
 * Ajustes › Colchón (`02 §12`, RF-CFG-02): lo que no cuenta para lo que puedes gastar. Se guarda con el mismo
 * servicio que O7. Para quitarlo hay que escribir 0: un campo vacío no borra el colchón por accidente.
 */
export function SeccionColchon() {
  const { ctx, refrescar } = useSesion();
  const { colchon } = useVista(obtenerAjustes);
  const sugerido = useVista(colchonSugerido);
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const inicial = colchon > 0 ? colchon : sugerido > 0 ? sugerido : null;

  const abrir = () => {
    setMonto(inicial);
    setMensaje(null);
    setEditando(true);
  };

  const guardar = () => {
    if (monto === null) return;
    try {
      fijarColchon(ctx, monto);
    } catch {
      setMensaje({ texto: ERROR_GUARDAR, error: true });
      return;
    }
    refrescar();
    setEditando(false);
    setMensaje({
      texto:
        monto > 0
          ? `Listo: tu colchón ahora es ${formatearCentavos(monto)}.`
          : 'Listo: ya no apartas colchón.',
      error: false,
    });
  };

  return (
    <Tarjeta testID="ajustes-colchon">
      <Texto variante="subtitulo">Colchón</Texto>
      {editando ? (
        <>
          <CampoMonto
            testID="ajustes-colchon-monto"
            etiqueta="Tu colchón"
            valorInicial={inicial}
            ayuda={
              sugerido > 0
                ? `Te sugerimos ${formatearCentavos(sugerido)}: el 10 % de lo que te pagan. Escribe 0 si no quieres colchón.`
                : 'Escribe 0 si no quieres colchón.'
            }
            alCambiar={setMonto}
          />
          <Boton
            testID="ajustes-colchon-guardar"
            etiqueta="Guardar"
            deshabilitado={monto === null}
            alPresionar={guardar}
          />
          <Boton
            testID="ajustes-colchon-cancelar"
            variante="texto"
            ancho="contenido"
            etiqueta="Cancelar"
            alPresionar={() => setEditando(false)}
          />
        </>
      ) : (
        <>
          <Texto variante="secundario" tono="secundario" testID="ajustes-colchon-resumen">
            {colchon > 0
              ? `Apartas ${formatearCentavos(colchon)} que no cuentan para lo que puedes gastar.`
              : 'Sin colchón: todo tu dinero libre cuenta para lo que puedes gastar.'}
          </Texto>
          <Boton
            testID="ajustes-cambiar-colchon"
            variante="secundario"
            etiqueta={colchon > 0 ? 'Cambiar mi colchón' : 'Apartar un colchón'}
            alPresionar={abrir}
          />
        </>
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono={mensaje.error ? 'faltante' : 'acento'}
          accessibilityLiveRegion="polite"
          testID="ajustes-colchon-mensaje"
        >
          {mensaje.texto}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
