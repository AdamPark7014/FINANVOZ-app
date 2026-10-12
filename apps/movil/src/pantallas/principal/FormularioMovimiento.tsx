import { useState } from 'react';
import { View } from 'react-native';
import type { Centavos } from '@cartera/core';
import {
  crearPersona,
  listarCategorias,
  listarCuentas,
  listarPersonas,
  registrarMovimiento,
  type EntradaMovimiento,
} from '../../servicios';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, formatearCentavos, Texto } from '../../ui';
import { GrupoChips, type OpcionChip } from './Chip';
import { MENSAJE_ERROR_GENERAL, NOMBRE_TIPO, type TipoMovimiento } from './textos';
import { useAvisoRegistro } from './useAvisoRegistro';

const TIPOS: readonly TipoMovimiento[] = [
  'gasto',
  'ingreso',
  'transferencia',
  'retiro_efectivo',
  'pago_tarjeta',
  'prestamo_otorgado',
  'prestamo_recibido',
  'cobro_prestamo',
  'pago_prestamo',
];

type Cuenta = { id: string; nombre: string; clase: 'efectivo' | 'liquida' | 'tarjeta' };

/** Qué cuentas pide cada tipo y con qué pregunta (sin vocabulario contable). */
const CAMPOS: Record<
  TipoMovimiento,
  {
    origen?: { pregunta: string; clases: readonly Cuenta['clase'][] };
    destino?: { pregunta: string; clases: readonly Cuenta['clase'][] };
    persona?: string;
    categoria?: 'gasto' | 'ingreso';
  }
> = {
  gasto: {
    categoria: 'gasto',
    origen: { pregunta: '¿Con qué pagaste?', clases: ['efectivo', 'liquida', 'tarjeta'] },
  },
  ingreso: {
    categoria: 'ingreso',
    destino: { pregunta: '¿A dónde llegó?', clases: ['efectivo', 'liquida'] },
  },
  transferencia: {
    origen: { pregunta: '¿De qué cuenta sale?', clases: ['efectivo', 'liquida'] },
    destino: { pregunta: '¿A qué cuenta llega?', clases: ['efectivo', 'liquida'] },
  },
  retiro_efectivo: {
    origen: { pregunta: '¿De dónde lo sacaste?', clases: ['liquida', 'tarjeta'] },
    destino: { pregunta: '¿Dónde lo traes?', clases: ['efectivo'] },
  },
  pago_tarjeta: {
    origen: { pregunta: '¿Con qué pagaste?', clases: ['efectivo', 'liquida'] },
    destino: { pregunta: '¿Qué tarjeta pagaste?', clases: ['tarjeta'] },
  },
  prestamo_otorgado: {
    persona: '¿A quién le prestaste?',
    origen: { pregunta: '¿De dónde salió?', clases: ['efectivo', 'liquida'] },
  },
  prestamo_recibido: {
    persona: '¿Quién te prestó?',
    destino: { pregunta: '¿A dónde llegó?', clases: ['efectivo', 'liquida'] },
  },
  cobro_prestamo: {
    persona: '¿Quién te pagó?',
    destino: { pregunta: '¿A dónde llegó?', clases: ['efectivo', 'liquida'] },
  },
  pago_prestamo: {
    persona: '¿A quién le pagaste?',
    origen: { pregunta: '¿De dónde salió?', clases: ['efectivo', 'liquida'] },
  },
};

/**
 * Formulario de movimiento (02-UX §1.1: la última vía, después de captura y dictado) para los tipos que origina
 * el usuario en M2. Al guardar aparece el aviso con "Deshacer".
 */
export function FormularioMovimiento({ alGuardar }: { alGuardar?: () => void }) {
  const { ctx, refrescar } = useSesion();
  const registrarEvento = useAnalitica();
  const avisarRegistro = useAvisoRegistro();
  const vistaCuentas = useVista(listarCuentas);
  const personas = useVista(listarPersonas);
  const categoriasGasto = useVista((c) => listarCategorias(c, 'gasto'));
  const categoriasIngreso = useVista((c) => listarCategorias(c, 'ingreso'));

  const [tipo, setTipo] = useState<TipoMovimiento>('gasto');
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [nuevaPersona, setNuevaPersona] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [clave, setClave] = useState(0);

  const cuentas: Cuenta[] = [
    ...vistaCuentas.tienes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      clase: c.subtipo === 'efectivo' ? ('efectivo' as const) : ('liquida' as const),
    })),
    ...vistaCuentas.debes
      .filter((d) => d.tipo === 'tarjeta')
      .map((d) => ({ id: d.id, nombre: d.nombre, clase: 'tarjeta' as const })),
  ];
  const campos = CAMPOS[tipo];
  const opciones = (clases: readonly Cuenta['clase'][]): OpcionChip<string>[] =>
    cuentas.filter((c) => clases.includes(c.clase)).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
  const categorias =
    campos.categoria === 'gasto' ? categoriasGasto : campos.categoria === 'ingreso' ? categoriasIngreso : [];
  const origenEsTarjeta = cuentas.find((c) => c.id === origenId)?.clase === 'tarjeta';

  const cambiarTipo = (t: TipoMovimiento) => {
    setTipo(t);
    setCategoria(null);
    setOrigenId(null);
    setDestinoId(null);
    setError(null);
  };

  const faltante = (): string | null => {
    if (monto === null || monto <= 0) return 'Escribe un monto mayor a $0.';
    if (campos.categoria && !categoria) return 'Elige una categoría.';
    if (campos.persona && !personaId) return 'Elige a la persona.';
    if (campos.origen && !origenId) return campos.origen.pregunta;
    if (campos.destino && !destinoId) return campos.destino.pregunta;
    if (origenId && origenId === destinoId) return 'Elige dos cuentas distintas.';
    return null;
  };
  const pendiente = faltante();

  const guardar = () => {
    setIntentado(true);
    if (pendiente || monto === null) return;
    const entrada = {
      tipo,
      monto,
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      ...(campos.categoria && categoria ? { categoria } : {}),
      ...(campos.persona && personaId ? { personaId } : {}),
      ...(campos.origen && origenId ? { origenId } : {}),
      ...(campos.destino && destinoId ? { destinoId } : {}),
    } as EntradaMovimiento;
    try {
      const r = registrarMovimiento(ctx, entrada, { origen: 'manual' });
      registrarEvento({
        nombre: 'movimiento_registrado',
        propiedades: { origen: 'formulario', pregunto: false, espacio: 'personal' },
      });
      const nombre = descripcion.trim() || NOMBRE_TIPO[tipo];
      avisarRegistro(`Registré: ${nombre} ${formatearCentavos(monto)}`, r.deshacer);
      setMonto(null);
      setDescripcion('');
      setIntentado(false);
      setClave((k) => k + 1);
      alGuardar?.();
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };

  const agregarPersona = () => {
    const nombre = nuevaPersona.trim();
    if (nombre === '') return;
    try {
      const id = crearPersona(ctx, { nombre });
      setNuevaPersona('');
      setPersonaId(id);
      refrescar();
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };

  return (
    <View style={{ gap: espacio.l }} testID="formulario-movimiento">
      <View style={{ gap: espacio.xs }}>
        <Texto variante="etiqueta">¿Qué pasó?</Texto>
        <GrupoChips
          opciones={TIPOS.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO[t] }))}
          valor={tipo}
          alCambiar={cambiarTipo}
          prefijoTestID="tipo"
        />
      </View>
      <CampoMonto
        key={`monto-${clave}`}
        etiqueta="¿Cuánto?"
        alCambiar={setMonto}
        error={intentado && (monto === null || monto <= 0) ? 'Escribe un monto mayor a $0.' : null}
        testID="campo-monto"
      />
      <CampoTexto
        etiqueta="¿En qué? (opcional)"
        valor={descripcion}
        alCambiar={setDescripcion}
        ejemplo="tacos"
        testID="campo-descripcion"
      />
      {campos.categoria ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="etiqueta">Categoría</Texto>
          <GrupoChips
            opciones={categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }))}
            valor={categoria}
            alCambiar={setCategoria}
            prefijoTestID="categoria"
          />
        </View>
      ) : null}
      {campos.persona ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="etiqueta">{campos.persona}</Texto>
          <GrupoChips
            opciones={personas.map((p) => ({ valor: p.cuentaId, etiqueta: p.nombre }))}
            valor={personaId}
            alCambiar={setPersonaId}
            prefijoTestID="persona"
          />
          <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <CampoTexto
                etiqueta="Agregar persona"
                valor={nuevaPersona}
                alCambiar={setNuevaPersona}
                ejemplo="Mi jefa"
                alEnviar={agregarPersona}
                testID="campo-nueva-persona"
              />
            </View>
            <Boton
              etiqueta="Agregar"
              variante="secundario"
              ancho="contenido"
              alPresionar={agregarPersona}
              deshabilitado={nuevaPersona.trim() === ''}
              testID="boton-agregar-persona"
            />
          </View>
        </View>
      ) : null}
      {campos.origen ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="etiqueta">{campos.origen.pregunta}</Texto>
          <GrupoChips
            opciones={opciones(campos.origen.clases)}
            valor={origenId}
            alCambiar={setOrigenId}
            prefijoTestID="origen"
          />
        </View>
      ) : null}
      {tipo === 'retiro_efectivo' && origenEsTarjeta ? (
        <Texto variante="secundario" tono="faltante">
          Sacar efectivo con tarjeta de crédito suele cobrar comisión e intereses desde el primer día.
        </Texto>
      ) : null}
      {campos.destino ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="etiqueta">{campos.destino.pregunta}</Texto>
          <GrupoChips
            opciones={opciones(campos.destino.clases)}
            valor={destinoId}
            alCambiar={setDestinoId}
            prefijoTestID="destino"
          />
        </View>
      ) : null}
      {intentado && pendiente ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {pendiente}
        </Texto>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar" alPresionar={guardar} testID="boton-guardar-movimiento" />
    </View>
  );
}
