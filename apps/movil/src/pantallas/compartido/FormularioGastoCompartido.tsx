import { useState } from 'react';
import type { Centavos } from '@cartera/core';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import { agregarGastoCompartido, listarCuentas } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta, Texto } from '../../ui';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { OPCIONES_CATEGORIA, OPCIONES_REPARTO } from './textos';

type Quien = 'yo' | 'otro';

/**
 * Agregar un gasto compartido (`02 §27`: "Súper 1,200, pagué yo, 60/40"): cuánto, en qué, quién pagó, cómo se
 * reparte y, si pagaste tú, con qué. Se guarda en tu libro al momento y se comparte en la siguiente sincronización.
 */
export function FormularioGastoCompartido({
  grupoId,
  nombrePareja,
  alGuardar,
  alCancelar,
}: {
  grupoId: string;
  nombrePareja: string;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const deps = useCompartido();
  const cuentas = useVista((c) => listarCuentas(c).tienes.filter((x) => x.subtipo !== 'ahorro'));
  const [total, setTotal] = useState<Centavos | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<string | null>('super');
  const [quien, setQuien] = useState<Quien | null>('yo');
  const [reparto, setReparto] = useState<number | null>(5000);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (total === null || total <= 0) return setError('Escribe cuánto fue el gasto.');
    if (categoria === null || quien === null || reparto === null)
      return setError('Elige en qué fue, quién pagó y cómo se reparte.');
    try {
      agregarGastoCompartido(ctx, deps, grupoId, {
        total,
        pagueYo: quien === 'yo',
        miParteBp: reparto,
        descripcion: descripcion.trim(),
        categoria,
        ...(quien === 'yo' && cuentaId ? { cuentaId } : {}),
      });
    } catch {
      return setError(ERROR_GUARDAR);
    }
    setError(null);
    alGuardar();
  };

  return (
    <Tarjeta testID="formulario-gasto-compartido">
      <Texto variante="subtitulo">Agregar gasto</Texto>
      <CampoMonto testID="compartido-total" etiqueta="¿Cuánto fue?" alCambiar={setTotal} />
      <CampoTexto
        testID="compartido-descripcion"
        etiqueta="¿Qué fue? (opcional)"
        valor={descripcion}
        alCambiar={setDescripcion}
        ejemplo="Súper"
      />
      <Chips
        testID="compartido-categoria"
        etiqueta="Categoría"
        opciones={OPCIONES_CATEGORIA}
        valor={categoria}
        alCambiar={setCategoria}
      />
      <Chips
        testID="compartido-quien"
        etiqueta="¿Quién pagó?"
        opciones={[
          { valor: 'yo', etiqueta: 'Pagué yo' },
          { valor: 'otro', etiqueta: `Pagó ${nombrePareja}` },
        ]}
        valor={quien}
        alCambiar={setQuien}
      />
      <Chips
        testID="compartido-reparto"
        etiqueta="¿Cómo se reparte?"
        opciones={OPCIONES_REPARTO}
        valor={reparto}
        alCambiar={setReparto}
      />
      {quien === 'yo' && cuentas.length > 0 ? (
        <Chips
          testID="compartido-cuenta"
          etiqueta="¿Con qué pagaste?"
          opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          valor={cuentaId}
          alCambiar={setCuentaId}
        />
      ) : null}
      <MensajeError texto={error} />
      <Boton testID="compartido-guardar" etiqueta="Guardar" alPresionar={guardar} />
      <Boton testID="compartido-cancelar" etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} />
    </Tarjeta>
  );
}
