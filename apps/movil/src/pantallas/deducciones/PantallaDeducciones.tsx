import { useEffect, useRef, useState } from 'react';
import type { Centavos } from '@cartera/core';
import { View } from 'react-native';
import {
  asignarAlumnoNivel,
  asignarBeneficiarioLentes,
  confirmarPagoFactura,
  FORMAS_PAGO_CONFIRMADO,
  guardarPerfilFiscal,
  importarCfdi,
  marcarFacturaCancelada,
  marcarLentes,
  ocultarFacturaImportada,
  obtenerDeducciones,
  recuperarFactura,
  type ArchivoCfdi,
  type FacturaVista,
  type FormaPagoConfirmado,
  type PerfilFiscal,
  type ResultadoImportacion,
  type VistaDeducciones,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, Interruptor, Pantalla, Tarjeta, Texto } from '../../ui';
import { Chips, MensajeError } from '../onboarding/componentes';
import { PuertaPlus } from '../plan/CandadoPlus';
import { mensajeError } from '../principal/textos';
import type { ArchivosFacturas } from './archivos';
import {
  AYUDA_BASE_GRAVABLE,
  BTN_CAMBIAR_PERFIL,
  BTN_CANCELADA_SAT,
  BTN_GUARDAR_ALUMNO_NIVEL,
  BTN_IMPORTAR_FACTURAS,
  BTN_NO_CANCELADA_SAT,
  BTN_OCULTAR_FACTURA,
  BTN_RECUPERAR_FACTURA,
  BTN_VER_DEDUCCIONES,
  BTN_YA_LA_PAGUE,
  DESCRIPCION_PUERTA_PLUS,
  ERROR_INGRESOS,
  ERROR_RFC,
  EJEMPLO_RFC,
  ETIQUETA_BENEFICIARIO_LENTES,
  ETIQUETA_CANCELAR,
  ETIQUETA_COLEGIATURA_DE_QUIEN,
  ETIQUETA_FORMA_PAGO,
  ETIQUETA_GUARDAR,
  ETIQUETA_IMPORTACION_LISTO,
  ETIQUETA_INGRESOS_BRUTOS,
  ETIQUETA_LENTES,
  ETIQUETA_NIVEL,
  ETIQUETA_NO_DEDUCIBLES,
  ETIQUETA_RFC,
  ETIQUETA_BASE_GRAVABLE,
  ETIQUETA_VOLVER,
  PISTA_VOLVER,
  ESTADO_DEDUCIBLE,
  ETIQUETA_LEYENDA_ESTIMACION,
  LEYENDA_ESTIMACION,
  MENSAJE_IMPORTAR_ERROR,
  PEDIR_PERFIL,
  PERFIL_EN_TELEFONO,
  TITULO_FACTURAS_OCULTAS,
  TITULO_IMPORTAR_COMPARTIDAS,
  TITULO_PUERTA_PLUS,
  TITULO_TUS_FACTURAS,
  TEXTO_FACTURAS_OCULTAS,
  TEXTO_FACTURAS_VACIO,
  TEXTO_IMPORTAR_LEYENDO,
  TEXTO_IMPORTAR_VACIO,
  tituloPantallaDeducciones,
  DESC_LENTES,
} from './textos';
/**
 * Personal → Deducciones (`02 §24`, RF-FIS-01…03, Plus): importar facturas, pedir el perfil fiscal la primera vez,
 * "Llevas $25,900 deducibles en 2026 (estimación)" por tipo, lo que no es deducible con su motivo, el ISR que
 * podrías ahorrar y, por factura, alumno y nivel de las colegiaturas, lentes y "Ya la pagué". Mientras los
 * parámetros del año no estén validados por un contador, solo lista las facturas y lo dice.
 */
export function PantallaDeducciones({
  alVolver,
  archivos,
}: {
  alVolver: () => void;
  archivos: ArchivosFacturas;
}) {
  return (
    <PuertaPlus
      funcion="deducciones"
      titulo={TITULO_PUERTA_PLUS}
      descripcion={DESCRIPCION_PUERTA_PLUS}
      alVolver={alVolver}
    >
      <Deducciones alVolver={alVolver} archivos={archivos} />
    </PuertaPlus>
  );
}

function Deducciones({ alVolver, archivos }: { alVolver: () => void; archivos: ArchivosFacturas }) {
  const { ctx, refrescar } = useSesion();
  const [ejercicio, setEjercicio] = useState<number | null>(null);
  // `useVista` relee con este cierre en cada `refrescar()`; al elegir otro año se refresca.
  const v = useVista((c) => obtenerDeducciones(c, ejercicio ?? undefined));
  const [editando, setEditando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const importar = () => {
    setError(null);
    setImportando(true);
    archivos
      .elegir()
      .then((elegidos) => {
        if (!elegidos) return;
        setResultado(importarCfdi(ctx, elegidos));
        refrescar();
      })
      .catch(() => setError(MENSAJE_IMPORTAR_ERROR))
      .finally(() => setImportando(false));
  };

  const pedirPerfil = v.estado === 'sin_perfil' || editando;
  return (
    <Pantalla testID="pantalla-deducciones" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="deducciones-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
      />
      <Texto
        variante="titulo"
        testID="deducciones-titulo-pantalla"
        accessibilityRole="header"
      >
        {tituloPantallaDeducciones(v.ejercicio)}
      </Texto>
      {v.ejercicios.length > 1 ? (
        <Chips
          opciones={v.ejercicios.map((a) => ({ valor: a, etiqueta: String(a) }))}
          valor={v.ejercicio}
          alCambiar={(a) => {
            setEjercicio(a);
            refrescar();
          }}
          testID="deducciones-anio"
        />
      ) : null}

      {pedirPerfil ? (
        <FormularioPerfil
          inicial={v.estado === 'sin_perfil' ? null : v.perfil}
          alGuardar={() => {
            setEditando(false);
            refrescar();
          }}
          {...(v.estado === 'sin_perfil' ? {} : { alCancelar: () => setEditando(false) })}
        />
      ) : null}

      {v.estado === 'listo' ? <Estimacion v={v} /> : null}
      {v.estado === 'sin_parametros' ? (
        <Tarjeta testID="deducciones-sin-parametros">
          <Texto variante="cuerpo">{v.mensaje}</Texto>
        </Tarjeta>
      ) : null}

      <Boton
        testID="deducciones-importar"
        etiqueta={BTN_IMPORTAR_FACTURAS}
        variante="secundario"
        cargando={importando}
        alPresionar={importar}
      />
      <MensajeError texto={error} />
      {resultado ? <ResultadoImportacionTarjeta r={resultado} alCerrar={() => setResultado(null)} /> : null}

      <Texto variante="subtitulo" testID="deducciones-tus-facturas">
        {TITULO_TUS_FACTURAS}
      </Texto>
      {v.facturas.length === 0 ? (
        <Texto
          variante="cuerpo"
          tono="secundario"
          testID="deducciones-sin-facturas"
          accessibilityRole="text"
          accessibilityLabel={TEXTO_FACTURAS_VACIO}
        >
          {TEXTO_FACTURAS_VACIO}
        </Texto>
      ) : null}
      {v.facturas.map((f) => (
        <FilaFactura key={f.uuid} f={f} v={v} />
      ))}

      {v.ocultas.length > 0 ? (
        <View style={{ gap: espacio.s }}>
          <Texto variante="subtitulo" testID="deducciones-ocultas-titulo">
            {TITULO_FACTURAS_OCULTAS}
          </Texto>
          <Texto variante="secundario" tono="secundario" testID="deducciones-ocultas-ayuda">
            {TEXTO_FACTURAS_OCULTAS}
          </Texto>
          {v.ocultas.map((f) => (
            <FilaFacturaOculta key={f.uuid} f={f} />
          ))}
        </View>
      ) : null}

      {v.estado !== 'sin_perfil' && !editando ? (
        <Boton
          testID="deducciones-editar-perfil"
          etiqueta={BTN_CAMBIAR_PERFIL}
          variante="texto"
          ancho="contenido"
          alPresionar={() => setEditando(true)}
        />
      ) : null}
      {v.estado === 'listo' || v.estado === 'sin_parametros' ? <AvisoFiscalEstimacion /> : null}
    </Pantalla>
  );
}

/** `08 §1`: estimación, no dictamen ni declaración ante el SAT. */
function AvisoFiscalEstimacion() {
  return (
    <Texto
      variante="pequeno"
      tono="secundario"
      testID="deducciones-leyenda"
      accessibilityRole="text"
      accessibilityLabel={ETIQUETA_LEYENDA_ESTIMACION}
    >
      {LEYENDA_ESTIMACION}
    </Texto>
  );
}

function Estimacion({ v }: { v: Extract<VistaDeducciones, { estado: 'listo' }> }) {
  return (
    <Tarjeta testID="deducciones-estimacion">
      <Texto variante="subtitulo" testID="deducciones-titulo" accessibilityLiveRegion="polite">
        {v.titulo}
      </Texto>
      {v.porTipo.map((t) => (
        <Texto key={t.uso} variante="cuerpo" testID={`deducciones-tipo-${t.uso}`}>
          {t.texto}
        </Texto>
      ))}
      {v.textoTope ? (
        <Texto variante="secundario" tono="secundario" testID="deducciones-tope">
          {v.textoTope}
        </Texto>
      ) : null}
      <Texto variante="cuerpoFuerte" testID="deducciones-ahorro">
        {v.textoAhorro}
      </Texto>
      {v.noDeducibles.length > 0 ? (
        <View style={{ gap: espacio.xs }} testID="deducciones-no-deducibles">
          <Texto variante="etiqueta" testID="deducciones-no-deducibles-titulo">
            {ETIQUETA_NO_DEDUCIBLES}
          </Texto>
          {v.noDeducibles.map((f) => (
            <Texto key={f.uuid} variante="secundario" testID={`no-deducible-${f.uuid}`}>
              {`${f.emisor} · ${f.textoTotal}: ${f.textoMotivo ?? ''}`}
            </Texto>
          ))}
        </View>
      ) : null}
    </Tarjeta>
  );
}

function FormularioPerfil({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial: PerfilFiscal | null;
  alGuardar: () => void;
  alCancelar?: () => void;
}) {
  const { ctx } = useSesion();
  const [rfc, setRfc] = useState(inicial?.rfc ?? '');
  const [ingresos, setIngresos] = useState<Centavos | null>(inicial?.ingresos ?? null);
  const [base, setBase] = useState<Centavos | null>(inicial?.base_gravable ?? null);
  const [error, setError] = useState<string | null>(null);
  const guardar = () => {
    if (ingresos === null) {
      setError(ERROR_INGRESOS);
      return;
    }
    try {
      guardarPerfilFiscal(ctx, { rfc, ingresos, baseGravable: base });
      setError(null);
      alGuardar();
    } catch (e) {
      setError((e as { codigo?: string }).codigo === 'rfc_invalido' ? ERROR_RFC : mensajeError(e));
    }
  };
  return (
    <Tarjeta testID="deducciones-perfil">
      <Texto variante="cuerpo" testID="perfil-pedir">
        {PEDIR_PERFIL}
      </Texto>
      <Texto variante="secundario" tono="secundario" testID="perfil-solo-telefono">
        {PERFIL_EN_TELEFONO}
      </Texto>
      <CampoTexto
        etiqueta={ETIQUETA_RFC}
        valor={rfc}
        alCambiar={setRfc}
        ejemplo={EJEMPLO_RFC}
        nativo={{ autoCapitalize: 'characters', autoCorrect: false }}
        testID="perfil-rfc"
      />
      <CampoMonto
        etiqueta={ETIQUETA_INGRESOS_BRUTOS}
        valorInicial={inicial?.ingresos ?? null}
        alCambiar={setIngresos}
        testID="perfil-ingresos"
      />
      <CampoMonto
        etiqueta={ETIQUETA_BASE_GRAVABLE}
        ayuda={AYUDA_BASE_GRAVABLE}
        valorInicial={inicial?.base_gravable ?? null}
        alCambiar={setBase}
        testID="perfil-base"
      />
      <MensajeError texto={error} />
      <Boton etiqueta={ETIQUETA_GUARDAR} alPresionar={guardar} testID="perfil-guardar" />
      {alCancelar ? (
        <Boton
          etiqueta={ETIQUETA_CANCELAR}
          variante="texto"
          alPresionar={alCancelar}
          testID="perfil-cancelar"
        />
      ) : null}
    </Tarjeta>
  );
}

/** "Importé 8 facturas; 1 no es versión 4.0" y, por archivo que no entró, qué pasó. */
export function ResultadoImportacionTarjeta({
  r,
  alCerrar,
}: {
  r: ResultadoImportacion;
  alCerrar?: () => void;
}) {
  return (
    <Tarjeta testID="importacion-resultado">
      <Texto variante="cuerpoFuerte" testID="importacion-resumen" accessibilityLiveRegion="polite">
        {r.resumen}
      </Texto>
      {r.rechazadas.map((x, i) => (
        <Texto key={`${x.archivo}-${i}`} variante="secundario" testID={`importacion-rechazo-${i}`}>
          {`${x.archivo}: ${x.texto}`}
        </Texto>
      ))}
      {alCerrar ? (
        <Boton
          etiqueta={ETIQUETA_IMPORTACION_LISTO}
          variante="texto"
          ancho="contenido"
          alPresionar={alCerrar}
          testID="importacion-listo"
        />
      ) : null}
    </Tarjeta>
  );
}

function FilaFactura({ f, v }: { f: FacturaVista; v: VistaDeducciones }) {
  const { ctx, refrescar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [alumno, setAlumno] = useState(f.alumno ?? '');
  const [nivel, setNivel] = useState<string | null>(f.nivel);
  const [pagando, setPagando] = useState(false);
  const hacer = (accion: () => void) => {
    try {
      accion();
      setError(null);
      refrescar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  const niveles = v.estado === 'listo' ? v.niveles : [];
  const id = `factura-${f.uuid}`;
  const estado =
    f.estado === 'deducible'
      ? ESTADO_DEDUCIBLE
      : f.estado === 'no_deducible'
        ? `No deducible: ${f.textoMotivo}`
        : null;
  return (
    <Tarjeta testID={id}>
      <View style={{ gap: espacio.xxs }}>
        <Texto variante="cuerpoFuerte">{f.emisor}</Texto>
        <Texto variante="secundario" tono="secundario">
          {[f.textoFecha, f.textoTotal, f.tipo].filter(Boolean).join(' · ')}
        </Texto>
        {estado ? (
          <Texto variante="secundario" testID={`${id}-estado`}>
            {estado}
          </Texto>
        ) : null}
      </View>

      {f.pideAlumnoNivel && niveles.length > 0 ? (
        <View style={{ gap: espacio.xs }}>
          <CampoTexto
            etiqueta={ETIQUETA_COLEGIATURA_DE_QUIEN}
            valor={alumno}
            alCambiar={setAlumno}
            testID={`${id}-alumno`}
          />
          <Chips
            etiqueta={ETIQUETA_NIVEL}
            opciones={niveles}
            valor={nivel}
            alCambiar={setNivel}
            testID={`${id}-nivel`}
          />
          <Boton
            etiqueta={BTN_GUARDAR_ALUMNO_NIVEL}
            variante="secundario"
            deshabilitado={alumno.trim() === '' || nivel === null}
            alPresionar={() => nivel && hacer(() => asignarAlumnoNivel(ctx, f.uuid, alumno, nivel))}
            testID={`${id}-guardar-alumno`}
          />
        </View>
      ) : null}

      {f.ofreceLentes && v.estado !== 'sin_perfil' ? (
        <View style={{ gap: espacio.xs }}>
          <Interruptor
            etiqueta={ETIQUETA_LENTES}
            descripcion={DESC_LENTES}
            valor={f.lentes}
            alCambiar={(valor) => hacer(() => marcarLentes(ctx, f.uuid, valor))}
            testID={`${id}-lentes`}
          />
          {f.lentes && v.beneficiariosLentes.length > 0 ? (
            <Chips
              etiqueta={ETIQUETA_BENEFICIARIO_LENTES}
              opciones={v.beneficiariosLentes}
              valor={f.beneficiarioLentes}
              alCambiar={(ben) => hacer(() => asignarBeneficiarioLentes(ctx, f.uuid, ben))}
              testID={`${id}-beneficiario`}
            />
          ) : null}
        </View>
      ) : null}

      {f.enPagos && f.pagoConfirmado === null && !pagando ? (
        <Boton
          etiqueta={BTN_YA_LA_PAGUE}
          variante="secundario"
          alPresionar={() => setPagando(true)}
          testID={`${id}-ya-la-pague`}
        />
      ) : null}
      {f.enPagos && pagando ? (
        <Chips<FormaPagoConfirmado>
          etiqueta={ETIQUETA_FORMA_PAGO}
          opciones={FORMAS_PAGO_CONFIRMADO}
          valor={f.pagoConfirmado}
          alCambiar={(forma) =>
            hacer(() => {
              confirmarPagoFactura(ctx, f.uuid, forma);
              setPagando(false);
            })
          }
          testID={`${id}-forma`}
        />
      ) : null}
      {f.pagoConfirmado ? (
        <Texto variante="secundario" tono="secundario" testID={`${id}-pagada`}>
          {`Pagada con ${FORMAS_PAGO_CONFIRMADO.find((x) => x.valor === f.pagoConfirmado)?.etiqueta.toLowerCase() ?? ''}`}
        </Texto>
      ) : null}
      {v.estado !== 'sin_perfil' ? (
        <View style={{ gap: espacio.xxs }}>
          <Boton
            etiqueta={f.marcadaCancelada ? BTN_NO_CANCELADA_SAT : BTN_CANCELADA_SAT}
            variante="texto"
            ancho="contenido"
            alPresionar={() => hacer(() => marcarFacturaCancelada(ctx, f.uuid, !f.marcadaCancelada))}
            testID={`${id}-cancelada`}
          />
          <Boton
            etiqueta={BTN_OCULTAR_FACTURA}
            variante="texto"
            ancho="contenido"
            alPresionar={() => hacer(() => ocultarFacturaImportada(ctx, f.uuid))}
            testID={`${id}-ocultar`}
          />
        </View>
      ) : null}
      <MensajeError texto={error} />
    </Tarjeta>
  );
}

function FilaFacturaOculta({ f }: { f: FacturaVista }) {
  const { ctx, refrescar } = useSesion();
  const id = `factura-oculta-${f.uuid}`;
  return (
    <Tarjeta testID={id}>
      <Texto variante="cuerpoFuerte">{f.emisor}</Texto>
      <Texto variante="secundario" tono="secundario">
        {[f.textoFecha, f.textoTotal].filter(Boolean).join(' · ')}
      </Texto>
      <Boton
        etiqueta={BTN_RECUPERAR_FACTURA}
        variante="secundario"
        alPresionar={() => {
          recuperarFactura(ctx, f.uuid);
          refrescar();
        }}
        testID={`${id}-recuperar`}
      />
    </Tarjeta>
  );
}

/**
 * Lo que llegó por la hoja de compartir (`app/expo-sharing.tsx`): lee los archivos, los importa una vez y muestra
 * el resultado. Importar es de todos los planes (son datos); la estimación es de Plus.
 */
export function ImportarCompartidas({
  leer,
  alVerDeducciones,
}: {
  leer: () => Promise<ArchivoCfdi[]>;
  alVerDeducciones: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [estado, setEstado] = useState<
    { tipo: 'leyendo' } | { tipo: 'listo'; r: ResultadoImportacion } | { tipo: 'error' } | { tipo: 'vacio' }
  >({ tipo: 'leyendo' });
  const iniciado = useRef(false);
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    leer()
      .then((archivos) => {
        if (archivos.length === 0) {
          setEstado({ tipo: 'vacio' });
          return;
        }
        setEstado({ tipo: 'listo', r: importarCfdi(ctx, archivos) });
        refrescar();
      })
      .catch(() => setEstado({ tipo: 'error' }));
  }, [ctx, leer, refrescar]);
  return (
    <Pantalla testID="importar-compartidas" bordes={['top', 'left', 'right', 'bottom']}>
      <Texto variante="titulo" testID="importar-titulo">
        {TITULO_IMPORTAR_COMPARTIDAS}
      </Texto>
      {estado.tipo === 'leyendo' ? (
        <Texto
          variante="cuerpo"
          tono="secundario"
          testID="importar-leyendo"
          accessibilityLiveRegion="polite"
        >
          {TEXTO_IMPORTAR_LEYENDO}
        </Texto>
      ) : null}
      {estado.tipo === 'listo' ? <ResultadoImportacionTarjeta r={estado.r} /> : null}
      {estado.tipo === 'error' ? <MensajeError texto={MENSAJE_IMPORTAR_ERROR} /> : null}
      {estado.tipo === 'vacio' ? (
        <Texto
          variante="cuerpo"
          tono="secundario"
          testID="importar-vacio"
          accessibilityRole="text"
          accessibilityLabel={TEXTO_IMPORTAR_VACIO}
        >
          {TEXTO_IMPORTAR_VACIO}
        </Texto>
      ) : null}
      {estado.tipo !== 'leyendo' ? (
        <>
          <Boton
            etiqueta={BTN_VER_DEDUCCIONES}
            alPresionar={alVerDeducciones}
            testID="importar-ver-deducciones"
          />
          <AvisoFiscalEstimacion />
        </>
      ) : null}
    </Pantalla>
  );
}
