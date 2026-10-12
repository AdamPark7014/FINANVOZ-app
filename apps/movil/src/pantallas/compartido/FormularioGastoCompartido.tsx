import { useState } from 'react';
import type { Centavos } from '@cartera/core';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import {
  agregarGastoCompartido,
  listarCategorias,
  listarCuentas,
  mensajeError,
  type PropuestaGastoCompartido,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta, Texto } from '../../ui';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { etiquetaReparto, OPCIONES_CATEGORIA, OPCIONES_REPARTO, resumenGastoCompartido } from './textos';

type Quien = 'yo' | 'otro';

/**
 * Agregar un gasto compartido (`02 §27`: "Súper 1,200, pagué yo, 60/40"): cuánto, en qué, quién pagó, cómo se
 * reparte y, si pagaste tú, con qué. Se guarda en tu libro al momento y se comparte en la siguiente sincronización.
 * Con `prellenado` confirma lo dictado: muestra el resumen y nada se guarda hasta "Guardar".
 */
export function FormularioGastoCompartido({
  grupoId,
  nombrePareja,
  prellenado,
  alGuardar,
  alCancelar,
}: {
  grupoId: string;
  nombrePareja: string;
  prellenado?: PropuestaGastoCompartido;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const deps = useCompartido();
  const cuentas = useVista((c) => listarCuentas(c).tienes.filter((x) => x.subtipo !== 'ahorro'));
  const categorias = useVista((c) => listarCategorias(c, 'gasto'));
  const [total, setTotal] = useState<Centavos | null>(prellenado?.total ?? null);
  const [descripcion, setDescripcion] = useState(prellenado?.descripcion ?? '');
  const [categoria, setCategoria] = useState<string | null>(prellenado?.categoria ?? 'super');
  const [quien, setQuien] = useState<Quien | null>(
    prellenado ? (prellenado.pagueYo === null ? null : prellenado.pagueYo ? 'yo' : 'otro') : 'yo',
  );
  const [reparto, setReparto] = useState<number | null>(prellenado?.miParteBp ?? 5000);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lo dictado puede traer una categoría o un reparto que no están entre los chips de siempre.
  const opcionesCategoria = [...OPCIONES_CATEGORIA];
  if (prellenado && !opcionesCategoria.some((o) => o.valor === prellenado.categoria)) {
    const nombre = categorias.find((c) => c.slug === prellenado.categoria)?.nombre ?? prellenado.categoria;
    opcionesCategoria.unshift({ valor: prellenado.categoria, etiqueta: nombre });
  }
  const opcionesReparto = [...OPCIONES_REPARTO];
  if (prellenado && !opcionesReparto.some((o) => o.valor === prellenado.miParteBp)) {
    opcionesReparto.push({ valor: prellenado.miParteBp, etiqueta: etiquetaReparto(prellenado.miParteBp) });
  }

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
        ...(prellenado ? { fecha: prellenado.fecha } : {}),
      });
    } catch (e) {
      return setError(mensajeError(e, ERROR_GUARDAR));
    }
    setError(null);
    alGuardar();
  };

  return (
    <Tarjeta testID="formulario-gasto-compartido">
      <Texto variante="subtitulo">{prellenado ? 'Revisa el gasto compartido' : 'Agregar gasto'}</Texto>
      {prellenado && total !== null && total > 0 ? (
        <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="compartido-resumen">
          {resumenGastoCompartido({
            descripcion: descripcion.trim(),
            total,
            pagueYo: quien === null ? null : quien === 'yo',
            miParteBp: reparto,
          })}
        </Texto>
      ) : null}
      <CampoMonto
        testID="compartido-total"
        etiqueta="¿Cuánto fue?"
        valorInicial={prellenado?.total ?? null}
        alCambiar={setTotal}
      />
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
        opciones={opcionesCategoria}
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
        opciones={opcionesReparto}
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
