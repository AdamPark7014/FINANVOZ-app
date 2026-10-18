import { useState } from 'react';
import { View } from 'react-native';
import type { Centavos } from '@cartera/core';
import {
  AVISO_DEDUCIBLE_EFECTIVO,
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
import { FormularioCuentaDividida } from '../personas/FormularioCuentaDividida';
import { mensajeCuentaDividida } from '../personas/textos';
import { GrupoChips, type OpcionChip } from './Chip';
import {
  AVISO_RETIRO_EFECTIVO_TARJETA,
  BTN_AGREGAR_PERSONA,
  BTN_GUARDAR_MOVIMIENTO,
  CAMPOS_FORMULARIO_MOVIMIENTO,
  EJEMPLO_DESCRIPCION,
  EJEMPLO_NUEVA_PERSONA,
  ERROR_CUENTAS_DISTINTAS,
  ERROR_ELEGIR_CATEGORIA,
  ERROR_ELEGIR_PERSONA,
  ERROR_MONTO_CERO,
  ETIQUETA_AGREGAR_PERSONA,
  ETIQUETA_CATEGORIA,
  ETIQUETA_DESCRIPCION,
  ETIQUETA_MONTO,
  ETIQUETA_QUE_PASO,
  NOMBRE_TIPO_FORMULARIO,
  type TipoFormulario,
  type TipoMovimiento,
} from './formularioMovimiento-textos';
import { mensajeError, NOMBRE_TIPO } from './textos';
import { useAvisoRegistro } from './useAvisoRegistro';

const TIPOS: readonly TipoFormulario[] = [
  'gasto',
  'ingreso',
  'transferencia',
  'retiro_efectivo',
  'pago_tarjeta',
  'prestamo_otorgado',
  'prestamo_recibido',
  'cobro_prestamo',
  'pago_prestamo',
  'cuenta_dividida',
];

type Cuenta = { id: string; nombre: string; clase: 'efectivo' | 'liquida' | 'tarjeta' };

/**
 * Formulario de movimiento (02-UX §1.1: la última vía, después de captura y dictado) para los tipos que origina
 * el usuario en M2. Al guardar aparece el aviso con "Deshacer".
 */
export function FormularioMovimiento({
  alGuardar,
  alVerMovimiento,
}: {
  alGuardar?: () => void;
  alVerMovimiento?: (transaccionId: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const registrarEvento = useAnalitica();
  const avisarRegistro = useAvisoRegistro(alVerMovimiento);
  const vistaCuentas = useVista(listarCuentas);
  const personas = useVista(listarPersonas);
  const categoriasGasto = useVista((c) => listarCategorias(c, 'gasto'));
  const categoriasIngreso = useVista((c) => listarCategorias(c, 'ingreso'));

  const [tipoElegido, setTipo] = useState<TipoFormulario>('gasto');
  const tipo: TipoMovimiento = tipoElegido === 'cuenta_dividida' ? 'gasto' : tipoElegido;
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
  const campos = CAMPOS_FORMULARIO_MOVIMIENTO[tipo];
  const opciones = (clases: readonly Cuenta['clase'][]): OpcionChip<string>[] =>
    cuentas.filter((c) => clases.includes(c.clase)).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
  const categorias =
    campos.categoria === 'gasto' ? categoriasGasto : campos.categoria === 'ingreso' ? categoriasIngreso : [];
  const origenEsTarjeta = cuentas.find((c) => c.id === origenId)?.clase === 'tarjeta';

  const cambiarTipo = (t: TipoFormulario) => {
    setTipo(t);
    setCategoria(null);
    setOrigenId(null);
    setDestinoId(null);
    setError(null);
  };

  const faltante = (): string | null => {
    if (monto === null || monto <= 0) return ERROR_MONTO_CERO;
    if (campos.categoria && !categoria) return ERROR_ELEGIR_CATEGORIA;
    if (campos.persona && !personaId) return ERROR_ELEGIR_PERSONA;
    if (campos.origen && !origenId) return campos.origen.pregunta;
    if (campos.destino && !destinoId) return campos.destino.pregunta;
    if (origenId && origenId === destinoId) return ERROR_CUENTAS_DISTINTAS;
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
      const registrado = `Registré: ${nombre} ${formatearCentavos(monto)}`;
      avisarRegistro(r.avisoDeducible ? `${registrado}. ${AVISO_DEDUCIBLE_EFECTIVO}` : registrado, {
        deshacer: r.deshacer,
        transaccionId: r.transaccionId,
      });
      setMonto(null);
      setDescripcion('');
      setIntentado(false);
      setClave((k) => k + 1);
      alGuardar?.();
    } catch (e) {
      setError(mensajeError(e));
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
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <View style={{ gap: espacio.l }} testID="formulario-movimiento">
      <View style={{ gap: espacio.xs }}>
        <Texto
          variante="etiqueta"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {ETIQUETA_QUE_PASO}
        </Texto>
        <GrupoChips
          opciones={TIPOS.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO_FORMULARIO[t] }))}
          valor={tipoElegido}
          alCambiar={cambiarTipo}
          prefijoTestID="tipo"
          etiqueta={ETIQUETA_QUE_PASO}
        />
      </View>
      {tipoElegido === 'cuenta_dividida' ? (
        <FormularioCuentaDividida
          key={`division-${clave}`}
          alGuardar={(r) => {
            registrarEvento({
              nombre: 'movimiento_registrado',
              propiedades: { origen: 'formulario', pregunto: false, espacio: 'personal' },
            });
            avisarRegistro(
              mensajeCuentaDividida(r.descripcion, r.total, r.registro.reparto.porCobrarTotal),
              { deshacer: r.deshacer, transaccionId: r.registro.transaccionId },
            );
            setClave((k) => k + 1);
            alGuardar?.();
          }}
        />
      ) : (
        camposDelTipo()
      )}
    </View>
  );

  function camposDelTipo() {
    return (
      <>
        <CampoMonto
          key={`monto-${clave}`}
          etiqueta={ETIQUETA_MONTO}
          alCambiar={setMonto}
          error={intentado && (monto === null || monto <= 0) ? ERROR_MONTO_CERO : null}
          testID="campo-monto"
        />
        <CampoTexto
          etiqueta={ETIQUETA_DESCRIPCION}
          valor={descripcion}
          alCambiar={setDescripcion}
          ejemplo={EJEMPLO_DESCRIPCION}
          testID="campo-descripcion"
        />
        {campos.categoria ? (
          <View style={{ gap: espacio.xs }}>
            <Texto
              variante="etiqueta"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {ETIQUETA_CATEGORIA}
            </Texto>
            <GrupoChips
              opciones={categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }))}
              valor={categoria}
              alCambiar={setCategoria}
              prefijoTestID="categoria"
              etiqueta={ETIQUETA_CATEGORIA}
            />
          </View>
        ) : null}
        {campos.persona ? (
          <View style={{ gap: espacio.xs }}>
            <Texto
              variante="etiqueta"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {campos.persona}
            </Texto>
            <GrupoChips
              opciones={personas.map((p) => ({ valor: p.cuentaId, etiqueta: p.nombre }))}
              valor={personaId}
              alCambiar={setPersonaId}
              prefijoTestID="persona"
              etiqueta={campos.persona}
            />
            <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <CampoTexto
                  etiqueta={ETIQUETA_AGREGAR_PERSONA}
                  valor={nuevaPersona}
                  alCambiar={setNuevaPersona}
                  ejemplo={EJEMPLO_NUEVA_PERSONA}
                  alEnviar={agregarPersona}
                  testID="campo-nueva-persona"
                />
              </View>
              <Boton
                etiqueta={BTN_AGREGAR_PERSONA}
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
            <Texto
              variante="etiqueta"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {campos.origen.pregunta}
            </Texto>
            <GrupoChips
              opciones={opciones(campos.origen.clases)}
              valor={origenId}
              alCambiar={setOrigenId}
              prefijoTestID="origen"
              etiqueta={campos.origen.pregunta}
            />
          </View>
        ) : null}
        {tipo === 'retiro_efectivo' && origenEsTarjeta ? (
          <Texto variante="secundario" tono="faltante">
            {AVISO_RETIRO_EFECTIVO_TARJETA}
          </Texto>
        ) : null}
        {campos.destino ? (
          <View style={{ gap: espacio.xs }}>
            <Texto
              variante="etiqueta"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {campos.destino.pregunta}
            </Texto>
            <GrupoChips
              opciones={opciones(campos.destino.clases)}
              valor={destinoId}
              alCambiar={setDestinoId}
              prefijoTestID="destino"
              etiqueta={campos.destino.pregunta}
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
        <Boton
          etiqueta={BTN_GUARDAR_MOVIMIENTO}
          alPresionar={guardar}
          testID="boton-guardar-movimiento"
        />
      </>
    );
  }
}
