import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  ConsultaMeAlcanza,
  deshacer,
  loCompre,
  meAlcanza,
  obtenerPreferenciasAvisos,
  type Contexto,
  type OpcionesBloques,
  type VistaEscenarioMeAlcanza,
  type VistaMeAlcanza,
} from '../../servicios';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { TEXTO_NO_ASESORIA } from '../privacidad/legales';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Barra, Boton, CampoMonto, CampoTexto, espacio, Pantalla, Tarjeta, Texto, useTema } from '../../ui';
import { useNotificaciones } from '../avisos/notificaciones';
import { MensajeError } from '../onboarding/componentes';
import { leerEntero } from '../onboarding/ingreso';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { mensajeError } from '../principal/textos';
import { mensajeCompraMsi } from '../tarjetas/textos';
import { avisoRecordatorio } from './recordatorio';
import {
  ACCESIBILIDAD_CERRAR,
  AYUDA_DATOS_INSUFICIENTES,
  etiquetaVacioDatosInsuficientes,
  BTN_CALCULAR,
  BTN_CAMBIAR_DATOS,
  BTN_CANCELAR,
  BTN_CERRAR,
  BTN_COMO_LO_CALCULE,
  BTN_DESHACER,
  BTN_HACER_OTRA_CUENTA,
  BTN_INTENTAR_DE_NUEVO,
  BTN_LISTO,
  BTN_LO_COMPRE,
  BTN_OCULTAR_COMO_LO_CALCULE,
  BTN_VER_MOVIMIENTOS,
  EJEMPLO_DESCRIPCION,
  ERROR_CALCULO,
  ERROR_MESES,
  ERROR_PRECIO,
  ERROR_RECORDATORIO,
  ETIQUETA_DESCRIPCION,
  ETIQUETA_MESES_MANUAL,
  ETIQUETA_MSI_OTRO,
  ETIQUETA_MSI_TU_DIME,
  ETIQUETA_OPCION_RECOMENDADA,
  ETIQUETA_PRECIO,
  ETIQUETA_PROGRESO,
  MENSAJE_AVISO_RECORDATORIO,
  MENSAJE_CANCELADO,
  MENSAJE_PERMISO_AVISOS,
  MENSAJE_SIN_AVISOS,
  PISTA_CALCULAR,
  PISTA_CANCELAR,
  PREGUNTA_MSI,
  SUFIJO_ACCESIBILIDAD_RECOMENDADA,
  TEXTO_CALCULANDO,
  TEXTO_PARCIAL_HORIZONTE,
  TEXTO_RECORDATORIO_PROGRAMADO,
  TEXTO_YA_LO_REGISTRE,
  TITULO,
  etiquetaChipMeses,
} from './textos';

/** El cálculo (por omisión `meAlcanza` de servicios); inyectable para pruebas con el resultado de un vector. */
export type CalcularMeAlcanza = (
  ctx: Contexto,
  consulta: ConsultaMeAlcanza,
  opciones: OpcionesBloques,
) => Promise<VistaMeAlcanza>;

type Estado =
  | { readonly tipo: 'formulario'; readonly aviso: string | null }
  | { readonly tipo: 'calculando'; readonly consulta: ConsultaMeAlcanza; readonly progresoBp: number }
  | { readonly tipo: 'listo'; readonly vista: VistaMeAlcanza }
  | { readonly tipo: 'error'; readonly consulta: ConsultaMeAlcanza };

const MESES = ['3', '6', '9', '12', '18', '24'] as const;
type OpcionMeses = 'sin' | (typeof MESES)[number] | 'otro';

/**
 * "¿Me alcanza?" (RF-SIM-01, `02 §9`): formulario (precio, qué es y meses), cálculo por bloques con progreso y
 * "Cancelar", y el resultado de servicios tal cual: escenarios con su porcentaje, la recomendación, notas,
 * "Cómo lo calculé", "Lo compré" por opción (con "Deshacer") y "Recuérdamelo" como aviso local. Aquí no se
 * calcula ninguna cifra.
 */
export function PantallaMeAlcanza({
  consultaInicial,
  alCerrar,
  alVerMovimientos,
  calcular = meAlcanza,
  bloques,
}: {
  /** La consulta dicha ("¿me alcanza para unos tenis de 1,500?"): se calcula al abrir. */
  consultaInicial?: ConsultaMeAlcanza;
  alCerrar: () => void;
  /** "Cómo lo calculé" → los movimientos que usé. */
  alVerMovimientos?: () => void;
  calcular?: CalcularMeAlcanza;
  /** Opciones del cálculo por bloques (pruebas: `ceder`, `tamanoBloque`). */
  bloques?: Omit<OpcionesBloques, 'senal' | 'alProgreso'>;
}) {
  const { ctx } = useSesion();
  const registrarEvento = useAnalitica();
  const [estado, setEstado] = useState<Estado>(
    consultaInicial
      ? { tipo: 'calculando', consulta: consultaInicial, progresoBp: 0 }
      : { tipo: 'formulario', aviso: null },
  );
  const [precio, setPrecio] = useState<number | null>(consultaInicial?.precio ?? null);
  const [descripcion, setDescripcion] = useState(consultaInicial?.descripcion ?? '');
  const [meses, setMeses] = useState<OpcionMeses>(() => {
    const m = consultaInicial?.meses;
    if (m === undefined) return 'sin';
    return (MESES as readonly string[]).includes(String(m)) ? (String(m) as OpcionMeses) : 'otro';
  });
  const [mesesOtro, setMesesOtro] = useState(
    consultaInicial?.meses !== undefined &&
      !(MESES as readonly string[]).includes(String(consultaInicial.meses))
      ? String(consultaInicial.meses)
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const senal = useRef<{ aborted: boolean } | null>(null);

  /** Corre el cálculo fuera del render (después de pintar "calculando") y cancela el anterior. */
  const lanzar = useCallback(
    (consulta: ConsultaMeAlcanza) => {
      if (senal.current) senal.current.aborted = true;
      const actual = { aborted: false };
      senal.current = actual;
      Promise.resolve()
        .then(() =>
          calcular(ctx, consulta, {
            ...bloques,
            senal: actual,
            alProgreso: (hechas, total) => {
              if (actual.aborted) return;
              setEstado({
                tipo: 'calculando',
                consulta,
                progresoBp: total > 0 ? Math.floor((hechas * 10000) / total) : 0,
              });
            },
          }),
        )
        .then((vista) => {
          if (actual.aborted) return;
          setEstado({ tipo: 'listo', vista });
          // Cuántos escenarios y el tipo recomendado; nunca el precio ni la descripción (`03 §8`).
          if (vista.estado === 'ok') {
            registrarEvento({
              nombre: 'simulacion_vista',
              propiedades: {
                escenarios: vista.escenarios.length,
                recomendado_tipo: vista.recomendado.tipo,
              },
            });
          }
        })
        .catch(() => {
          // Cancelado (la pantalla ya cambió) o fallido: sin detalle en logs (regla 9).
          if (!actual.aborted) setEstado({ tipo: 'error', consulta });
        });
    },
    [ctx, calcular, bloques, registrarEvento],
  );

  const iniciar = (consulta: ConsultaMeAlcanza) => {
    setEstado({ tipo: 'calculando', consulta, progresoBp: 0 });
    lanzar(consulta);
  };

  // La consulta dicha se calcula al abrir; al salir, el cálculo en curso se cancela.
  useEffect(() => {
    if (consultaInicial) lanzar(consultaInicial);
    return () => {
      if (senal.current) senal.current.aborted = true;
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelar = () => {
    if (senal.current) senal.current.aborted = true;
    setEstado({ tipo: 'formulario', aviso: MENSAJE_CANCELADO });
  };

  const enviar = () => {
    setError(null);
    const n = meses === 'sin' ? undefined : meses === 'otro' ? leerEntero(mesesOtro, 2, 48) : Number(meses);
    if (n === null) return setError(ERROR_MESES);
    const r = ConsultaMeAlcanza.safeParse({
      precio: precio ?? 0,
      ...(descripcion.trim() !== '' ? { descripcion: descripcion.trim() } : {}),
      ...(n !== undefined ? { meses: n } : {}),
    });
    if (!r.success || precio === null || precio <= 0) return setError(ERROR_PRECIO);
    iniciar(r.data);
  };

  return (
    <Pantalla testID="pantalla-me-alcanza">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Texto variante="titulo" testID="me-alcanza-encabezado">
          {TITULO}
        </Texto>
        <Boton
          etiqueta={BTN_CERRAR}
          variante="texto"
          ancho="contenido"
          alPresionar={alCerrar}
          etiquetaAccesible={ACCESIBILIDAD_CERRAR}
          testID="boton-cerrar-me-alcanza"
        />
      </View>

      {estado.tipo === 'formulario' ? (
        <View style={{ gap: espacio.m }} testID="me-alcanza-formulario">
          {estado.aviso ? (
            <Texto
              variante="secundario"
              tono="secundario"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              testID="me-alcanza-aviso"
            >
              {estado.aviso}
            </Texto>
          ) : null}
          <CampoMonto
            etiqueta={ETIQUETA_PRECIO}
            valorInicial={precio}
            alCambiar={setPrecio}
            testID="me-alcanza-precio"
          />
          <CampoTexto
            etiqueta={ETIQUETA_DESCRIPCION}
            valor={descripcion}
            alCambiar={setDescripcion}
            ejemplo={EJEMPLO_DESCRIPCION}
            testID="me-alcanza-descripcion"
          />
          <Texto variante="cuerpo" {...OCULTAR_ETIQUETA_VISIBLE}>
            {PREGUNTA_MSI}
          </Texto>
          <GrupoChips<OpcionMeses>
            opciones={[
              { valor: 'sin', etiqueta: ETIQUETA_MSI_TU_DIME },
              ...MESES.map((m) => ({ valor: m, etiqueta: etiquetaChipMeses(m) })),
              { valor: 'otro', etiqueta: ETIQUETA_MSI_OTRO },
            ]}
            valor={meses}
            alCambiar={setMeses}
            prefijoTestID="me-alcanza-meses"
            etiqueta={PREGUNTA_MSI}
          />
          {meses === 'otro' ? (
            <CampoTexto
              etiqueta={ETIQUETA_MESES_MANUAL}
              valor={mesesOtro}
              alCambiar={setMesesOtro}
              teclado="number-pad"
              testID="me-alcanza-meses-otro"
            />
          ) : null}
          <MensajeError texto={error} />
          <Boton
            etiqueta={BTN_CALCULAR}
            alPresionar={enviar}
            pista={PISTA_CALCULAR}
            testID="boton-calcular-me-alcanza"
          />
        </View>
      ) : null}

      {estado.tipo === 'calculando' ? (
        <View style={{ gap: espacio.m }} testID="me-alcanza-calculando" accessibilityLiveRegion="polite">
          <Texto variante="cuerpo">{TEXTO_CALCULANDO}</Texto>
          <Barra
            llenoBp={estado.progresoBp}
            etiquetaAccesible={ETIQUETA_PROGRESO}
            testID="me-alcanza-progreso"
          />
          <Boton
            etiqueta={BTN_CANCELAR}
            variante="secundario"
            alPresionar={cancelar}
            pista={PISTA_CANCELAR}
            testID="boton-cancelar-me-alcanza"
          />
        </View>
      ) : null}

      {estado.tipo === 'error' ? (
        <View style={{ gap: espacio.m }} testID="me-alcanza-fallo">
          <Texto
            variante="cuerpo"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="me-alcanza-error-calculo"
          >
            {ERROR_CALCULO}
          </Texto>
          <Boton
            etiqueta={BTN_INTENTAR_DE_NUEVO}
            alPresionar={() => iniciar(estado.consulta)}
            testID="boton-reintentar-me-alcanza"
          />
          <Boton
            etiqueta={BTN_CAMBIAR_DATOS}
            variante="texto"
            alPresionar={() => setEstado({ tipo: 'formulario', aviso: null })}
            testID="boton-cambiar-datos-me-alcanza"
          />
        </View>
      ) : null}

      {estado.tipo === 'listo' && estado.vista.estado === 'datos_insuficientes' ? (
        <View style={{ gap: espacio.m }} testID="me-alcanza-datos-insuficientes">
          <Texto variante="subtitulo">{estado.vista.titulo}</Texto>
          <Texto variante="cuerpo" testID="me-alcanza-mensaje">
            {estado.vista.mensaje}
          </Texto>
          <Texto
            variante="secundario"
            tono="secundario"
            testID="me-alcanza-datos-ayuda"
            accessibilityLabel={etiquetaVacioDatosInsuficientes()}
          >
            {AYUDA_DATOS_INSUFICIENTES}
          </Texto>
          <Boton
            etiqueta={BTN_LISTO}
            variante="secundario"
            alPresionar={alCerrar}
            testID="boton-listo-datos-insuficientes"
          />
        </View>
      ) : null}

      {estado.tipo === 'listo' && estado.vista.estado === 'ok' ? (
        <Resultado
          vista={estado.vista}
          {...(alVerMovimientos ? { alVerMovimientos } : {})}
          alOtraCuenta={() => setEstado({ tipo: 'formulario', aviso: null })}
        />
      ) : null}
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

function Resultado({
  vista,
  alVerMovimientos,
  alOtraCuenta,
}: {
  vista: Extract<VistaMeAlcanza, { estado: 'ok' }>;
  alVerMovimientos?: () => void;
  alOtraCuenta: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const notificaciones = useNotificaciones();
  const [verCalculo, setVerCalculo] = useState(false);
  const [comprado, setComprado] = useState<string | null>(null);
  const [recordado, setRecordado] = useState(false);
  const [mensajeRecordatorio, setMensajeRecordatorio] = useState<string | null>(null);

  const comprar = (e: VistaEscenarioMeAlcanza) => {
    if (e.escenario.tipo === 'base') return;
    try {
      const r = loCompre(ctx, {
        escenario: e.escenario,
        ...(vista.consulta.descripcion ? { descripcion: vista.consulta.descripcion } : {}),
      });
      setComprado(e.clave);
      refrescar();
      mostrar({
        mensaje: r.tipo === 'msi' ? mensajeCompraMsi(r.compra) : `Registré: ${vista.titulo} · por asignar`,
        accion: {
          etiqueta: BTN_DESHACER,
          alPresionar: () => {
            deshacer(ctx, r.deshacer);
            setComprado(null);
            refrescar();
          },
        },
      });
    } catch (e) {
      mostrar({ mensaje: mensajeError(e) });
    }
  };

  const recordar = async () => {
    const rec = vista.recordatorio;
    if (!rec) return;
    setMensajeRecordatorio(null);
    if (!notificaciones) return setMensajeRecordatorio(MENSAJE_SIN_AVISOS);
    try {
      let permiso = await notificaciones.permiso();
      if (permiso === 'sin_preguntar') permiso = await notificaciones.pedirPermiso();
      if (permiso !== 'concedido') return setMensajeRecordatorio(MENSAJE_PERMISO_AVISOS);
      await notificaciones.puerto.programar(
        avisoRecordatorio(rec.fecha, vista.consulta.descripcion, obtenerPreferenciasAvisos(ctx)),
      );
      setRecordado(true);
      mostrar({ mensaje: MENSAJE_AVISO_RECORDATORIO });
    } catch {
      setMensajeRecordatorio(ERROR_RECORDATORIO);
    }
  };

  return (
    <View style={{ gap: espacio.m }} testID="me-alcanza-resultado">
      <View style={{ gap: espacio.xs }}>
        <Texto variante="subtitulo" testID="me-alcanza-titulo">
          {vista.titulo}
        </Texto>
        <Texto variante="cuerpoFuerte" accessibilityLiveRegion="polite" testID="me-alcanza-frase">
          {vista.frase}
        </Texto>
        {vista.etiqueta ? (
          <Texto variante="secundario" tono="secundario" testID="me-alcanza-etiqueta">
            {vista.etiqueta}
          </Texto>
        ) : null}
      </View>

      {vista.escenarios.map((e) => (
        <FilaEscenario key={e.clave} e={e} comprado={comprado} alComprar={() => comprar(e)} />
      ))}

      {vista.notas.map((n) => (
        <Texto key={n.tipo} variante="secundario" tono="secundario" testID={`nota-${n.tipo}`}>
          {n.texto}
        </Texto>
      ))}
      {/* Texto fijo de `08 §1`. */}
      <Texto variante="secundario" tono="secundario" testID="me-alcanza-no-asesoria">
        {TEXTO_NO_ASESORIA}
      </Texto>

      <Boton
        etiqueta={verCalculo ? BTN_OCULTAR_COMO_LO_CALCULE : BTN_COMO_LO_CALCULE}
        variante="texto"
        ancho="contenido"
        alPresionar={() => setVerCalculo((v) => !v)}
        testID="boton-como-lo-calcule"
      />
      {verCalculo ? (
        <Tarjeta testID="como-lo-calcule">
          {vista.comoLoCalcule.lineas.map((l, i) => (
            <Texto key={i} variante="secundario">
              {l}
            </Texto>
          ))}
          {alVerMovimientos ? (
            <Boton
              etiqueta={BTN_VER_MOVIMIENTOS}
              variante="texto"
              ancho="contenido"
              alPresionar={alVerMovimientos}
              testID="boton-ver-movimientos-calculo"
            />
          ) : null}
        </Tarjeta>
      ) : null}

      {vista.recordatorio && !recordado ? (
        <Boton
          etiqueta={vista.recordatorio.texto}
          variante="secundario"
          alPresionar={() => void recordar()}
          testID="boton-recuerdamelo"
        />
      ) : null}
      {recordado ? (
        <Texto variante="secundario" tono="secundario" testID="recordatorio-programado">
          {TEXTO_RECORDATORIO_PROGRAMADO}
        </Texto>
      ) : null}
      {mensajeRecordatorio ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="recordatorio-mensaje"
        >
          {mensajeRecordatorio}
        </Texto>
      ) : null}
      <Boton
        etiqueta={BTN_HACER_OTRA_CUENTA}
        variante="texto"
        ancho="contenido"
        alPresionar={alOtraCuenta}
        testID="boton-otra-cuenta"
      />
    </View>
  );
}

function FilaEscenario({
  e,
  comprado,
  alComprar,
}: {
  e: VistaEscenarioMeAlcanza;
  comprado: string | null;
  alComprar: () => void;
}) {
  const { c } = useTema();
  return (
    <Tarjeta
      testID={`escenario-${e.tipo}`}
      style={e.recomendado ? { borderColor: c.acentoTexto, borderWidth: 2 } : null}
    >
      <View
        accessible
        accessibilityLabel={`${e.etiqueta}: ${e.porcentaje}${e.recomendado ? SUFIJO_ACCESIBILIDAD_RECOMENDADA : ''}`}
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
      >
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }} testID={`etiqueta-${e.tipo}`}>
          {e.etiqueta}
        </Texto>
        <Texto variante="cuerpoFuerte" testID={`porcentaje-${e.tipo}`}>
          {e.porcentaje}
        </Texto>
      </View>
      {e.recomendado ? (
        <Texto variante="etiqueta" tono="acento" testID={`recomendado-${e.tipo}`}>
          {ETIQUETA_OPCION_RECOMENDADA}
        </Texto>
      ) : null}
      {e.detalle ? (
        <Texto variante="secundario" tono="secundario">
          {e.detalle}
        </Texto>
      ) : null}
      {e.parcial ? (
        <Texto variante="secundario" tono="secundario">
          {TEXTO_PARCIAL_HORIZONTE}
        </Texto>
      ) : null}
      {e.tipo !== 'base' ? (
        comprado === e.clave ? (
          <Texto variante="secundario" tono="acento" testID={`comprado-${e.tipo}`}>
            {TEXTO_YA_LO_REGISTRE}
          </Texto>
        ) : comprado === null ? (
          <Boton
            etiqueta={BTN_LO_COMPRE}
            variante="secundario"
            ancho="contenido"
            pista={`Registra la compra: ${e.etiqueta}`}
            alPresionar={alComprar}
            testID={`lo-compre-${e.tipo}`}
          />
        ) : null
      ) : null}
    </Tarjeta>
  );
}
