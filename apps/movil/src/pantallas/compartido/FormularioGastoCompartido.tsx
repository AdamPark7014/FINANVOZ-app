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
import { Boton, CampoMonto, CampoTexto, etiquetaHablada, Tarjeta, Texto } from '../../ui';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import {
  AYUDA_PROPORCION,
  BTN_CANCELAR,
  BTN_GUARDAR,
  EJEMPLO_DESCRIPCION_GASTO,
  EJEMPLO_PROPORCION,
  ERROR_CAMPOS_GASTO,
  ERROR_MONTO_GASTO,
  ETIQUETA_CATEGORIA_GASTO,
  ETIQUETA_CON_QUE_PAGASTE,
  ETIQUETA_DESCRIPCION_GASTO,
  ETIQUETA_MONTO_GASTO,
  ETIQUETA_OTRA_PROPORCION,
  ETIQUETA_PAGUE_YO,
  ETIQUETA_QUIEN_PAGO,
  ETIQUETA_REPARTO,
  etiquetaPagoPareja,
  formatoProporcionReparto,
  OPCIONES_REPARTO,
  parsearProporcionReparto,
  PISTA_CANCELAR_GASTO,
  PISTA_GUARDAR_GASTO_COMPARTIDO,
  resumenGastoCompartido,
  TITULO_AGREGAR_GASTO,
  TITULO_REVISAR_GASTO,
} from './textos';

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
  const repartoInicial = prellenado?.miParteBp ?? 5000;
  const repartoEnChips = OPCIONES_REPARTO.some((o) => o.valor === repartoInicial);
  const [reparto, setReparto] = useState<number | null>(repartoInicial);
  const [otraProporcion, setOtraProporcion] = useState(
    prellenado && !repartoEnChips ? formatoProporcionReparto(repartoInicial) : '',
  );
  const [otraActiva, setOtraActiva] = useState(Boolean(prellenado && !repartoEnChips));
  const [errorProporcion, setErrorProporcion] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opcionesCategoria = categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }));
  if (prellenado && !opcionesCategoria.some((o) => o.valor === prellenado.categoria)) {
    const nombre = categorias.find((c) => c.slug === prellenado.categoria)?.nombre ?? prellenado.categoria;
    opcionesCategoria.unshift({ valor: prellenado.categoria, etiqueta: nombre });
  }

  const elegirRepartoChip = (bp: number) => {
    setOtraActiva(false);
    setOtraProporcion('');
    setErrorProporcion(null);
    setReparto(bp);
  };

  const cambiarOtraProporcion = (texto: string) => {
    setOtraActiva(true);
    setOtraProporcion(texto);
    const r = parsearProporcionReparto(texto);
    setErrorProporcion(r.ok ? null : texto.trim() === '' ? null : r.mensaje);
    setReparto(r.ok ? r.miParteBp : null);
  };

  const miParteBpAlGuardar = (): number | null => {
    if (otraActiva) {
      const r = parsearProporcionReparto(otraProporcion);
      if (!r.ok) {
        setErrorProporcion(r.mensaje);
        return null;
      }
      return r.miParteBp;
    }
    return reparto;
  };

  const repartoOtra = otraActiva ? parsearProporcionReparto(otraProporcion) : null;
  const miParteBpVista = repartoOtra?.ok ? repartoOtra.miParteBp : reparto;

  const guardar = () => {
    if (total === null || total <= 0) return setError(ERROR_MONTO_GASTO);
    const miParteBp = miParteBpAlGuardar();
    if (categoria === null || quien === null || miParteBp === null)
      return setError(ERROR_CAMPOS_GASTO);
    try {
      agregarGastoCompartido(ctx, deps, grupoId, {
        total,
        pagueYo: quien === 'yo',
        miParteBp,
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
      <Texto
        variante="subtitulo"
        testID="compartido-formulario-titulo"
        accessibilityRole="header"
      >
        {prellenado ? TITULO_REVISAR_GASTO : TITULO_AGREGAR_GASTO}
      </Texto>
      {prellenado && total !== null && total > 0 ? (
        <Texto
          variante="cuerpo"
          accessibilityLiveRegion="polite"
          importantForAccessibility="yes"
          testID="compartido-resumen"
          accessibilityLabel={etiquetaHablada(
            resumenGastoCompartido({
              descripcion: descripcion.trim(),
              total,
              pagueYo: quien === null ? null : quien === 'yo',
              miParteBp: miParteBpVista,
            }),
          )}
        >
          {resumenGastoCompartido({
            descripcion: descripcion.trim(),
            total,
            pagueYo: quien === null ? null : quien === 'yo',
            miParteBp: miParteBpVista,
          })}
        </Texto>
      ) : null}
      <CampoMonto
        testID="compartido-total"
        etiqueta={ETIQUETA_MONTO_GASTO}
        valorInicial={prellenado?.total ?? null}
        alCambiar={setTotal}
      />
      <CampoTexto
        testID="compartido-descripcion"
        etiqueta={ETIQUETA_DESCRIPCION_GASTO}
        valor={descripcion}
        alCambiar={setDescripcion}
        ejemplo={EJEMPLO_DESCRIPCION_GASTO}
      />
      <Chips
        testID="compartido-categoria"
        etiqueta={ETIQUETA_CATEGORIA_GASTO}
        opciones={opcionesCategoria}
        valor={categoria}
        alCambiar={setCategoria}
      />
      <Chips
        testID="compartido-quien"
        etiqueta={ETIQUETA_QUIEN_PAGO}
        opciones={[
          { valor: 'yo', etiqueta: ETIQUETA_PAGUE_YO },
          { valor: 'otro', etiqueta: etiquetaPagoPareja(nombrePareja) },
        ]}
        valor={quien}
        alCambiar={setQuien}
      />
      <Chips
        testID="compartido-reparto"
        etiqueta={ETIQUETA_REPARTO}
        opciones={OPCIONES_REPARTO}
        valor={otraActiva ? null : reparto}
        alCambiar={elegirRepartoChip}
      />
      <CampoTexto
        testID="compartido-reparto-otra"
        etiqueta={ETIQUETA_OTRA_PROPORCION}
        valor={otraProporcion}
        alCambiar={cambiarOtraProporcion}
        ejemplo={EJEMPLO_PROPORCION}
        ayuda={AYUDA_PROPORCION}
        error={errorProporcion}
      />
      {quien === 'yo' && cuentas.length > 0 ? (
        <Chips
          testID="compartido-cuenta"
          etiqueta={ETIQUETA_CON_QUE_PAGASTE}
          opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          valor={cuentaId}
          alCambiar={setCuentaId}
        />
      ) : null}
      <MensajeError texto={error} />
      <Boton
        testID="compartido-guardar"
        etiqueta={BTN_GUARDAR}
        pista={PISTA_GUARDAR_GASTO_COMPARTIDO}
        alPresionar={guardar}
      />
      <Boton
        testID="compartido-cancelar"
        etiqueta={BTN_CANCELAR}
        variante="texto"
        pista={PISTA_CANCELAR_GASTO}
        alPresionar={alCancelar}
      />
    </Tarjeta>
  );
}
