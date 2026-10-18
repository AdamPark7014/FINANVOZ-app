import { useState } from 'react';
import { useCaptura } from '../../captura/ProveedorCaptura';
import {
  desactivarCaptura,
  fijarModoAvisoCaptura,
  obtenerEstadoCaptura,
  type ModoAvisoCaptura,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Tarjeta, Texto } from '../../ui';
import { ActivarCaptura } from '../captura/ActivarCaptura';
import { GrupoChips, type OpcionChip } from '../principal/Chip';

const OPCIONES_AVISO: readonly OpcionChip<ModoAvisoCaptura>[] = [
  { valor: 'agrupados', etiqueta: 'Agrupados' },
  { valor: 'cada_uno', etiqueta: 'Cada uno' },
  { valor: 'nunca', etiqueta: 'Nunca' },
];

/**
 * Ajustes → Captura automática (`08 §3.1`: "Puedes desactivarlo cuando quieras en Ajustes"). Desactivar vacía
 * la lista blanca nativa: desde ese momento toda notificación se descarta sin guardarse (regla 10).
 */
export function SeccionCaptura() {
  const { ctx, refrescar } = useSesion();
  const { puente } = useCaptura();
  const estado = useVista(obtenerEstadoCaptura);
  const [activando, setActivando] = useState(false);
  return (
    <Tarjeta testID="ajustes-captura">
      <Texto variante="subtitulo">Captura automática</Texto>
      {activando ? (
        <ActivarCaptura testID="ajustes-captura" alTerminar={() => setActivando(false)} />
      ) : estado.activada ? (
        <>
          <Texto variante="cuerpo" testID="ajustes-captura-estado">
            {estado.apps.length === 1
              ? 'Activa: leo los avisos de 1 app de banco.'
              : `Activa: leo los avisos de ${estado.apps.length} apps de banco.`}
          </Texto>
          <Texto variante="etiqueta">Aviso al capturar</Texto>
          <Texto variante="secundario" tono="secundario">
            Te aviso en segundo plano cuando anoto un movimiento. Nunca lleva montos ni comercios.
          </Texto>
          <GrupoChips
            prefijoTestID="ajustes-captura-aviso"
            opciones={OPCIONES_AVISO}
            valor={estado.modoAviso}
            alCambiar={(modo) => {
              fijarModoAvisoCaptura(ctx, modo);
              refrescar();
            }}
          />
          <Boton
            etiqueta="Desactivar"
            variante="secundario"
            alPresionar={() => {
              desactivarCaptura(ctx);
              void puente?.fijarListaBlanca([]);
              refrescar();
            }}
            testID="ajustes-captura-desactivar"
            style={{ marginTop: espacio.s }}
          />
        </>
      ) : (
        <>
          <Texto variante="cuerpo" tono="secundario" testID="ajustes-captura-estado">
            {puente ? 'Apagada.' : 'No disponible en este teléfono.'}
          </Texto>
          {puente ? (
            <Boton
              etiqueta="Activar"
              variante="secundario"
              alPresionar={() => setActivando(true)}
              testID="ajustes-captura-activar"
            />
          ) : null}
        </>
      )}
    </Tarjeta>
  );
}
