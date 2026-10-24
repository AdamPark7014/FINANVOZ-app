import { useState } from 'react';
import { View } from 'react-native';
import { compararFechas, diferenciaDias, sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import {
  aplicarCorreccion,
  AVISO_DEDUCIBLE_EFECTIVO,
  crearPersona,
  etiquetaDiaMes,
  etiquetaFecha,
  listarCategorias,
  listarCuentas,
  listarPersonas,
  registrarMovimiento,
  type CambiosResueltos,
  type EntradaMovimiento,
  type MovimientoVista,
} from '../../servicios';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, formatearCentavos, Texto } from '../../ui';
import { FormularioCuentaDividida } from '../personas/FormularioCuentaDividida';
import { mensajeCuentaDividida, PISTA_AGREGAR_PERSONA } from '../personas/textos';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE, type OpcionChip } from './Chip';
import {
  AVISO_RETIRO_EFECTIVO_TARJETA,
  BTN_AGREGAR_PERSONA,
  BTN_CANCELAR_CORRECCION,
  BTN_GUARDAR_CAMBIOS,
  BTN_GUARDAR_MOVIMIENTO,
  CAMPOS_FORMULARIO_MOVIMIENTO,
  ERROR_FECHA_FUTURA,
  ETIQUETA_ELEGIR_DIA,
  ETIQUETA_FECHA,
  BTN_VER_DIAS_ANTERIORES,
  PISTA_VER_DIAS_ANTERIORES,
  MENSAJE_SIN_CAMBIOS,
  OPCIONES_FECHA,
  PISTA_GUARDAR_CAMBIOS,
  PISTA_GUARDAR_MOVIMIENTO,
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
  type OpcionFecha,
  type TipoFormulario,
  type TipoMovimiento,
} from './formularioMovimiento-textos';
import { useAnuncio } from './ProveedorAvisos';
import { encabezadoFecha, mensajeCorregido, mensajeError, NOMBRE_TIPO } from './textos';
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

/** Días que se ofrecen como chips al elegir la fecha: hoy y los seis anteriores. */
const DIAS_ELEGIBLES = 7;
/** «Ver días anteriores» suma de 14 en 14 hasta ~3 meses atrás (sin escribir fechas a mano). */
const DIAS_MAS = 14;
const DIAS_MAXIMOS = 91;

/**
 * Lo que ya se dijo, para abrir el formulario lleno (R2 de la Ola 7, «Cambiar» en la tarjeta «Entendí»). Nada se
 * guarda hasta tocar «Guardar».
 */
export interface PrellenadoMovimiento {
  readonly tipo?: TipoMovimiento;
  readonly monto?: Centavos;
  readonly descripcion?: string;
  /** La cuenta de la que salió (gasto, pagos, préstamo otorgado) o a la que llegó (ingreso, cobros). */
  readonly cuentaId?: string;
  /** Con dos cuentas (pago de tarjeta, transferencia, retiro): a la que llegó. */
  readonly destinoId?: string;
  /** Slug de la categoría. */
  readonly categoria?: string;
  readonly fecha?: PlainDate;
}

/** Lo que guardó el formulario, para quien lo abrió (el asistente muestra el turno «Registré…» con Deshacer). */
export interface MovimientoGuardado {
  /** «Registré: Luz $450». */
  readonly mensaje: string;
  readonly deshacer: string;
  readonly transaccionId: string;
}

/** Cuentas que se llenan con lo dicho según los campos del tipo. */
function cuentasPrellenadas(
  tipo: TipoMovimiento,
  p: PrellenadoMovimiento | undefined,
): { origenId: string | null; destinoId: string | null } {
  if (!p) return { origenId: null, destinoId: null };
  const campos = CAMPOS_FORMULARIO_MOVIMIENTO[tipo];
  if (campos.origen) {
    return { origenId: p.cuentaId ?? null, destinoId: campos.destino ? (p.destinoId ?? null) : null };
  }
  return { origenId: null, destinoId: campos.destino ? (p.cuentaId ?? p.destinoId ?? null) : null };
}

type Cuenta = { id: string; nombre: string; clase: 'efectivo' | 'liquida' | 'tarjeta' };

const TIPOS_CORREGIBLES = new Set<string>(Object.keys(CAMPOS_FORMULARIO_MOVIMIENTO));

/**
 * Se puede corregir desde el formulario un movimiento de los tipos que origina la persona (los de este formulario).
 * Cuenta dividida, tandas, compras a meses y ajustes de efectivo tienen su propia pantalla.
 */
export function esCorregible(m: MovimientoVista): m is MovimientoVista & { tipo: TipoMovimiento } {
  return TIPOS_CORREGIBLES.has(m.tipo);
}

/**
 * Formulario de movimiento (02-UX §1.1: la última vía, después de captura y dictado) para los tipos que origina
 * el usuario. Al guardar aparece el aviso con "Deshacer". Con `corregir` abre ese movimiento con sus datos y, al
 * guardar, lo reemplaza por la versión corregida (`aplicarCorreccion`: anula y registra, regla 2): se cambian monto,
 * descripción, fecha, categoría y la cuenta de la que salió; el tipo, la persona y la cuenta a la que llegó no.
 */
export function FormularioMovimiento({
  alGuardar,
  alVerMovimiento,
  corregir,
  alCorregido,
  alCancelar,
  prellenado,
  alRegistrado,
}: {
  alGuardar?: () => void;
  alVerMovimiento?: (transaccionId: string) => void;
  /** Movimiento a corregir (detalle de Movimientos, `02 §10`). */
  corregir?: MovimientoVista & { tipo: TipoMovimiento };
  /** Tras corregir: id de la versión nueva (para dejar su detalle abierto). */
  alCorregido?: (transaccionId: string) => void;
  /** "Cancelar" en modo corregir. */
  alCancelar?: () => void;
  /** Lo que ya se dijo (R2): tipo, monto, descripción, cuenta, categoría y fecha. */
  prellenado?: PrellenadoMovimiento;
  /**
   * Quien abrió el formulario muestra el registro (el asistente, con Deshacer en su turno): sin esto sale el aviso
   * inferior de siempre.
   */
  alRegistrado?: (g: MovimientoGuardado) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const registrarEvento = useAnalitica();
  const avisarRegistro = useAvisoRegistro(alVerMovimiento);
  const vistaCuentas = useVista(listarCuentas);
  const personas = useVista(listarPersonas);
  const categoriasGasto = useVista((c) => listarCategorias(c, 'gasto'));
  const categoriasIngreso = useVista((c) => listarCategorias(c, 'ingreso'));
  const hoy = ctx.reloj.hoy();
  const ayer = sumarDias(hoy, -1);

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
  const categoriasDe = (t: TipoMovimiento) => {
    const c = CAMPOS_FORMULARIO_MOVIMIENTO[t].categoria;
    return c === 'gasto' ? categoriasGasto : c === 'ingreso' ? categoriasIngreso : [];
  };
  // Lo que ya tiene el movimiento a corregir: la vista trae nombres, se buscan su categoría y sus cuentas.
  const [inicial] = useState(() => {
    if (!corregir) return null;
    const campos = CAMPOS_FORMULARIO_MOVIMIENTO[corregir.tipo];
    const porNombre = (nombre: string | undefined) => cuentas.find((c) => c.nombre === nombre)?.id ?? null;
    return {
      categoria: categoriasDe(corregir.tipo).find((c) => c.nombre === corregir.categoria)?.slug ?? null,
      // Un gasto por asignar no tiene cuenta propia: queda sin elegir hasta que la persona escoja una.
      origenId: campos.origen ? porNombre(corregir.saleDe[0]) : null,
      destinoId: porNombre(corregir.llegaA[0]),
      descripcion: corregir.descripcion ?? '',
    };
  });

  const [tipoElegido, setTipo] = useState<TipoFormulario>(corregir?.tipo ?? prellenado?.tipo ?? 'gasto');
  const tipo: TipoMovimiento = tipoElegido === 'cuenta_dividida' ? 'gasto' : tipoElegido;
  const [cuentasDichas] = useState(() => cuentasPrellenadas(tipo, corregir ? undefined : prellenado));
  const montoInicial = corregir?.monto ?? prellenado?.monto ?? null;
  const [monto, setMonto] = useState<Centavos | null>(montoInicial);
  const [descripcion, setDescripcion] = useState(
    inicial?.descripcion ?? (corregir ? '' : (prellenado?.descripcion ?? '')),
  );
  const [categoria, setCategoria] = useState<string | null>(
    inicial?.categoria ?? (corregir ? null : (prellenado?.categoria ?? null)),
  );
  const [origenId, setOrigenId] = useState<string | null>(inicial?.origenId ?? cuentasDichas.origenId);
  const [destinoId, setDestinoId] = useState<string | null>(cuentasDichas.destinoId);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [nuevaPersona, setNuevaPersona] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [clave, setClave] = useState(0);

  // Fecha (`02 §5.3`): "Hoy · Ayer · Elegir"; Elegir ofrece los últimos 7 días y «Ver días anteriores» (de 14 en 14,
  // hasta ~3 meses). Antes había un campo «Otra fecha (AAAA-MM-DD)» para escribir a mano: se quitó (auditoría 23-10).
  const fechaDicha = prellenado?.fecha && compararFechas(prellenado.fecha, hoy) <= 0 ? prellenado.fecha : hoy;
  const fechaInicial = corregir?.fecha ?? fechaDicha;
  const [fecha, setFecha] = useState<PlainDate>(fechaInicial);
  const [eligiendoFecha, setEligiendoFecha] = useState(fechaInicial !== hoy && fechaInicial !== ayer);
  // Una fecha vieja (al corregir) se ve desde el principio entre los días.
  const [diasVisibles, setDiasVisibles] = useState(() =>
    Math.max(DIAS_ELEGIBLES, Math.min(diferenciaDias(fechaInicial, hoy) + 1, DIAS_MAXIMOS)),
  );
  const dias = Array.from({ length: diasVisibles }, (_, i) => sumarDias(hoy, -i));
  const opcionFecha: OpcionFecha = eligiendoFecha ? 'elegir' : fecha === hoy ? 'hoy' : 'ayer';

  const campos = CAMPOS_FORMULARIO_MOVIMIENTO[tipo];
  const opciones = (clases: readonly Cuenta['clase'][]): OpcionChip<string>[] =>
    cuentas.filter((c) => clases.includes(c.clase)).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
  const categorias = categoriasDe(tipo);
  const origenEsTarjeta = cuentas.find((c) => c.id === origenId)?.clase === 'tarjeta';

  const cambiarTipo = (t: TipoFormulario) => {
    setTipo(t);
    setCategoria(null);
    setOrigenId(null);
    setDestinoId(null);
    setError(null);
  };

  const elegirOpcionFecha = (o: OpcionFecha) => {
    if (o === 'elegir') return setEligiendoFecha(true);
    setEligiendoFecha(false);
    setFecha(o === 'hoy' ? hoy : ayer);
  };

  const faltante = (): string | null => {
    if (monto === null || monto <= 0) return ERROR_MONTO_CERO;
    if (campos.categoria && !categoria) return ERROR_ELEGIR_CATEGORIA;
    if (compararFechas(fecha, hoy) > 0) return ERROR_FECHA_FUTURA;
    if (corregir) {
      // Solo la cuenta de la que salió se puede cambiar; no puede ser a la que llegó.
      if (origenId && origenId === inicial?.destinoId) return ERROR_CUENTAS_DISTINTAS;
      return null;
    }
    if (campos.persona && !personaId) return ERROR_ELEGIR_PERSONA;
    if (campos.origen && !origenId) return campos.origen.pregunta;
    if (campos.destino && !destinoId) return campos.destino.pregunta;
    if (origenId && origenId === destinoId) return ERROR_CUENTAS_DISTINTAS;
    return null;
  };
  const pendiente = faltante();
  // VoiceOver: lo que falta y los errores se anuncian como en TalkBack (región viva).
  useAnuncio(intentado ? pendiente : null);
  useAnuncio(error);

  const guardarCorreccion = (m: MovimientoVista, montoNuevo: Centavos) => {
    const descripcionNueva = descripcion.trim();
    const cambios: CambiosResueltos = {
      ...(montoNuevo !== m.monto ? { monto: montoNuevo } : {}),
      ...(fecha !== m.fecha ? { fecha } : {}),
      ...(campos.categoria && categoria && categoria !== inicial?.categoria ? { categoria } : {}),
      ...(campos.origen && origenId && origenId !== inicial?.origenId ? { origenId } : {}),
      ...(descripcionNueva !== '' && descripcionNueva !== (m.descripcion ?? '')
        ? { descripcion: descripcionNueva }
        : {}),
    };
    if (Object.keys(cambios).length === 0) return setError(MENSAJE_SIN_CAMBIOS);
    try {
      const r = aplicarCorreccion(ctx, m.id, cambios, { origen: 'manual', registrarEvento });
      avisarRegistro(mensajeCorregido(r.antes, r.despues), {
        deshacer: r.deshacer,
        transaccionId: r.despues.transaccionId,
      });
      alCorregido?.(r.despues.transaccionId);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const guardar = () => {
    setIntentado(true);
    setError(null);
    if (pendiente || monto === null) return;
    if (corregir) return guardarCorreccion(corregir, monto);
    const entrada = {
      tipo,
      monto,
      ...(fecha !== hoy ? { fecha } : {}),
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
      const cuando = fecha !== hoy ? ` · ${etiquetaDiaMes(fecha)}` : '';
      const registrado = `Registré: ${nombre} ${formatearCentavos(monto)}${cuando}`;
      const mensaje = r.avisoDeducible ? `${registrado}. ${AVISO_DEDUCIBLE_EFECTIVO}` : registrado;
      if (alRegistrado) {
        refrescar();
        alRegistrado({ mensaje, deshacer: r.deshacer, transaccionId: r.transaccionId });
      } else {
        avisarRegistro(mensaje, { deshacer: r.deshacer, transaccionId: r.transaccionId });
      }
      setMonto(null);
      setDescripcion('');
      setFecha(hoy);
      setEligiendoFecha(false);
      setDiasVisibles(DIAS_ELEGIBLES);
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
    <View style={{ gap: espacio.xl }} testID={corregir ? 'formulario-corregir' : 'formulario-movimiento'}>
      {corregir ? null : (
        <View style={{ gap: espacio.s }}>
          <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
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
      )}
      {tipoElegido === 'cuenta_dividida' ? (
        <FormularioCuentaDividida
          key={`division-${clave}`}
          alGuardar={(r) => {
            registrarEvento({
              nombre: 'movimiento_registrado',
              propiedades: { origen: 'formulario', pregunto: false, espacio: 'personal' },
            });
            avisarRegistro(mensajeCuentaDividida(r.descripcion, r.total, r.registro.reparto.porCobrarTotal), {
              deshacer: r.deshacer,
              transaccionId: r.registro.transaccionId,
            });
            setClave((k) => k + 1);
            alGuardar?.();
          }}
        />
      ) : (
        camposDelTipo()
      )}
    </View>
  );

  function campoFecha() {
    return (
      <View style={{ gap: espacio.s }}>
        <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
          {ETIQUETA_FECHA}
        </Texto>
        <GrupoChips
          opciones={(Object.keys(OPCIONES_FECHA) as OpcionFecha[]).map((o) => ({
            valor: o,
            etiqueta: OPCIONES_FECHA[o],
          }))}
          valor={opcionFecha}
          alCambiar={elegirOpcionFecha}
          prefijoTestID="fecha"
          etiqueta={ETIQUETA_FECHA}
        />
        {eligiendoFecha ? (
          <>
            <GrupoChips
              opciones={dias.map((f) => ({
                valor: f,
                etiqueta: encabezadoFecha(etiquetaFecha(f), etiquetaDiaMes(f)),
              }))}
              valor={dias.includes(fecha) ? fecha : null}
              alCambiar={setFecha}
              prefijoTestID="dia"
              etiqueta={ETIQUETA_ELEGIR_DIA}
            />
            {diasVisibles < DIAS_MAXIMOS ? (
              <Boton
                etiqueta={BTN_VER_DIAS_ANTERIORES}
                variante="texto"
                ancho="contenido"
                pista={PISTA_VER_DIAS_ANTERIORES}
                alPresionar={() => setDiasVisibles((n) => Math.min(n + DIAS_MAS, DIAS_MAXIMOS))}
                testID="fecha-dias-anteriores"
              />
            ) : null}
          </>
        ) : null}
      </View>
    );
  }

  function camposDelTipo() {
    return (
      <>
        <CampoMonto
          key={`monto-${clave}`}
          etiqueta={ETIQUETA_MONTO}
          valorInicial={clave === 0 ? montoInicial : null}
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
        {campoFecha()}
        {campos.categoria ? (
          <View style={{ gap: espacio.s }}>
            <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
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
        {campos.persona && !corregir ? (
          <View style={{ gap: espacio.s }}>
            <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
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
                pista={PISTA_AGREGAR_PERSONA}
                testID="boton-agregar-persona"
              />
            </View>
          </View>
        ) : null}
        {campos.origen ? (
          <View style={{ gap: espacio.s }}>
            <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
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
        {campos.destino && !corregir ? (
          <View style={{ gap: espacio.s }}>
            <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
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
          <Texto
            variante="secundario"
            tono="faltante"
            accessibilityLiveRegion="polite"
            testID="formulario-pendiente"
          >
            {pendiente}
          </Texto>
        ) : null}
        {error ? (
          <Texto
            variante="secundario"
            tono="faltante"
            accessibilityLiveRegion="polite"
            testID="formulario-error"
          >
            {error}
          </Texto>
        ) : null}
        <Boton
          etiqueta={corregir ? BTN_GUARDAR_CAMBIOS : BTN_GUARDAR_MOVIMIENTO}
          alPresionar={guardar}
          pista={corregir ? PISTA_GUARDAR_CAMBIOS : PISTA_GUARDAR_MOVIMIENTO}
          testID={corregir ? 'boton-guardar-correccion' : 'boton-guardar-movimiento'}
        />
        {corregir && alCancelar ? (
          <Boton
            etiqueta={BTN_CANCELAR_CORRECCION}
            variante="texto"
            alPresionar={alCancelar}
            testID="boton-cancelar-correccion"
          />
        ) : null}
      </>
    );
  }
}
