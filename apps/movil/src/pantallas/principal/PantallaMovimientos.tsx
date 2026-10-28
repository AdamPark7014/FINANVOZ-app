import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import {
  anularMovimiento,
  descartarPorInterpretar,
  etiquetaDiaMes,
  historialMovimiento,
  listarMovimientos,
  listarPorInterpretar,
  listarTarjetas,
  marcarExtraordinaria,
  mensajeError,
  pasarAMeses,
  totalesDelMes,
  type FiltroMovimientos,
  type MovimientoVista,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  FUENTE,
  Boton,
  CampoTexto,
  Cifra,
  espacio,
  etiquetaHablada,
  cifraEnPalabras,
  formatearCentavos,
  Icono,
  Mosaico,
  Pantalla,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { PorRevisarCapturas } from '../captura/PorRevisarCapturas';
import { leerEntero } from '../onboarding/ingreso';
import { capitalizar } from '../onboarding/pagos-fijos';
import { mensajeCompraMsi } from '../tarjetas/textos';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from './Chip';
import { EstadoVacio } from './EstadoVacio';
import { esCorregible, FormularioMovimiento } from './FormularioMovimiento';
import { useAnuncio, useMostrarAviso } from './ProveedorAvisos';
import { mostrarDespuesDeCerrar, useAvisoRegistro } from './useAvisoRegistro';
import {
  BTN_BORRAR_MOVIMIENTO,
  CHIPS_MOVIMIENTOS,
  ETIQUETA_CHIP_MOVIMIENTOS,
  ETIQUETA_FILTRAR_MOVIMIENTOS,
  FILTRO_DE_CHIP,
  type ChipMovimientos,
  BTN_CERRAR_DETALLE,
  BTN_CONFIRMAR_BORRAR_MOVIMIENTO,
  BTN_CORREGIR_MOVIMIENTO,
  BTN_REGISTRAR_PRIMER_MOVIMIENTO,
  ETIQUETA_CERRAR_DETALLE,
  PISTA_CORREGIR_MOVIMIENTO,
  PISTA_VACIO_MOVIMIENTOS,
  NOMBRE_ORIGEN,
  nombreTipoLibro,
  resumenMovimiento,
  PREGUNTA_PASAR_A_MESES,
  etiquetaEncabezadoDiaConTotales,
  resumenDiaMovimientos,
  etiquetaFiltroMovimientosActivo,
  etiquetaIntroPorRevisar,
  etiquetaVacioMovimientos,
  TEXTO_MOVIMIENTOS_FILTRO_ACTIVO,
  TEXTO_MOVIMIENTOS_FILTRO_VACIO,
  TEXTO_MOVIMIENTOS_VACIO,
  TEXTO_POR_REVISAR,
  EJEMPLO_BUSCAR_MOVIMIENTOS,
  ETIQUETA_BUSCAR_MOVIMIENTOS,
  TEXTO_BUSQUEDA_VACIA,
  etiquetaDiaLista,
  etiquetaPorRevisarResumen,
  partesTotalesMes,
  PISTA_ABRIR_POR_REVISAR,
  PISTA_CERRAR_POR_REVISAR,
  textoPorRevisarResumen,
  totalDiaVisible,
  TITULO_POR_REVISAR,
  MENSAJE_ANULADO_MOVIMIENTO,
  PISTA_ANULAR_MOVIMIENTO,
  PISTA_CONFIRMAR_ANULAR_MOVIMIENTO,
  PISTA_DESCARTAR_FRASE,
  PISTA_MOSTRAR_DETALLE_MOVIMIENTO,
  PISTA_OCULTAR_DETALLE_MOVIMIENTO,
  PISTA_REGISTRAR_MOVIMIENTO,
  PISTA_REVISAR_FRASE,
  PISTA_VER_TODOS_MOVIMIENTOS,
  TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO,
  etiquetaConfirmarAnularMovimiento,
} from './textos';

const INSIGNIA: Record<MovimientoVista['insignias'][number], string> = {
  automatico: 'automático',
  estimado: 'estimado',
  por_asignar: 'por asignar',
  corregido: 'corregido',
};

/** Movimientos (02-UX §10): por revisar arriba, luego agrupados por día; tocar uno muestra el detalle. */
export function PantallaMovimientos({
  alRegistrar,
  alRevisar,
  filtro = null,
  alQuitarFiltro,
  alAbrirPersona,
  detalleInicial = null,
  buscando = false,
  espacioInferior = 0,
}: {
  alRegistrar: () => void;
  /** «Buscar» del dock (dirección B): muestra el campo de búsqueda arriba de la lista. */
  buscando?: boolean;
  /** Lo que tapa el dock al pie: la lista deja ese espacio para que lo último se pueda leer. */
  espacioInferior?: number;
  /** Abre Registrar con una frase que la nube ya entendió pero necesita confirmación. */
  alRevisar?: (fraseId: string) => void;
  /** "Ver movimientos" de una consulta (`06 §6`): solo los movimientos que suman en la respuesta. */
  filtro?: FiltroMovimientos | null;
  alQuitarFiltro?: () => void;
  /** Detalle del movimiento → persona (`02 §17`, pendiente 34). */
  alAbrirPersona?: (personaId: string) => void;
  /** Id de transacción a expandir al entrar (p. ej. desde el aviso "Registré…"). */
  detalleInicial?: string | null;
}) {
  const { ctx, version, refrescar } = useSesion();
  // Chips de la maqueta aprobada (Ola 7 §5): Todos · Gastos · Ingresos · Efectivo · Tarjetas. Se suman al filtro de
  // una consulta («Ver movimientos») si lo hay.
  const [chip, setChip] = useState<ChipMovimientos>('todos');
  const [busqueda, setBusqueda] = useState('');
  // B4: la frase por revisar es un renglón que se abre; sus botones viven adentro.
  const [revisarAbierto, setRevisarAbierto] = useState(false);
  const totales = useVista(totalesDelMes);
  const hoy = useVista((c) => c.reloj.hoy());
  const { c } = useTema();
  const texto = buscando ? busqueda.trim() : '';
  const conTarjetas = useVista((c) => listarTarjetas(c).length > 0);
  const chips = CHIPS_MOVIMIENTOS.filter((c) => c !== 'tarjetas' || conTarjetas);
  const filtroEfectivo: FiltroMovimientos = {
    ...(filtro ?? {}),
    ...FILTRO_DE_CHIP[chip],
    ...(texto !== '' ? { texto } : {}),
  };
  const claveFiltro = JSON.stringify(filtroEfectivo);
  const dias = useMemo(
    () => listarMovimientos(ctx, filtroEfectivo),
    // `claveFiltro` resume el filtro; `version` relee tras cada escritura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, version, claveFiltro],
  );
  const hayMovimientos = useVista((c) => listarMovimientos(c, { limite: 1 }).length > 0);
  const porRevisar = useVista(listarPorInterpretar);
  // Compras cargadas a una tarjeta de crédito: las únicas que se pueden pasar a meses (02-UX §10).
  const conTarjeta = useVista(
    (ctx) =>
      new Set(
        listarTarjetas(ctx).flatMap((t) =>
          listarMovimientos(ctx, { cuentaId: t.id })
            .flatMap((d) => d.movimientos)
            .filter((m) => m.tipo === 'gasto')
            .map((m) => m.id),
        ),
      ),
  );
  const mostrar = useMostrarAviso();
  const [abierto, setAbierto] = useState<string | null>(detalleInicial);
  // Al llegar otro detalle por la ruta, se abre (ajuste en render, sin efecto).
  const [detallePrevio, setDetallePrevio] = useState(detalleInicial);
  if (detalleInicial !== detallePrevio) {
    setDetallePrevio(detalleInicial);
    if (detalleInicial) setAbierto(detalleInicial);
  }
  // VoiceOver: el aviso de filtro activo se anuncia como en TalkBack (región viva).
  useAnuncio(filtro ? TEXTO_MOVIMIENTOS_FILTRO_ACTIVO : null);

  const secciones = useMemo(
    () =>
      dias.map((d) => ({
        fecha: d.fecha,
        etiqueta: d.etiqueta,
        visible: etiquetaDiaLista(d.fecha, hoy),
        total: totalDiaVisible(
          d.salieron > 0 ? formatearCentavos(d.salieron) : null,
          d.entraron > 0 ? formatearCentavos(d.entraron) : null,
        ),
        resumen: resumenDiaMovimientos(
          d.salieron > 0 ? formatearCentavos(d.salieron) : null,
          d.entraron > 0 ? formatearCentavos(d.entraron) : null,
        ),
        data: [...d.movimientos],
      })),
    [dias, hoy],
  );

  const encabezadoLista = (
    <View style={{ gap: espacio.l, paddingBottom: espacio.s }}>
      {/* B4: lo que salió y entró en el mes, en una frase (Registrar vive en el dock: Escribir o el micrófono). */}
      <Text
        testID="movimientos-titulo"
        accessibilityRole="header"
        accessibilityLabel={etiquetaHablada(partesTotalesMes(totales).join(''))}
        style={{
          fontFamily: FUENTE,
          fontSize: 24,
          lineHeight: 32,
          fontWeight: '600',
          color: c.texto,
          paddingHorizontal: espacio.s,
        }}
      >
        {partesTotalesMes(totales).map((parte, i) =>
          i % 2 === 1 ? (
            <Text key={i} style={{ fontFamily: FUENTE, fontWeight: '800' }}>
              {parte}
            </Text>
          ) : (
            parte
          ),
        )}
      </Text>

      {porRevisar.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="por-revisar">
          <Pressable
            testID="por-revisar-resumen"
            onPress={() => setRevisarAbierto((a) => !a)}
            accessibilityRole="button"
            accessibilityLabel={etiquetaPorRevisarResumen(porRevisar.length, porRevisar[0]?.texto ?? '')}
            accessibilityHint={revisarAbierto ? PISTA_CERRAR_POR_REVISAR : PISTA_ABRIR_POR_REVISAR}
            accessibilityState={{ expanded: revisarAbierto }}
            style={({ pressed }) => ({
              minHeight: 64,
              borderRadius: 22,
              backgroundColor: pressed ? c.superficieAlterna : c.superficie,
              borderWidth: 1,
              borderColor: c.borde,
              flexDirection: 'row',
              alignItems: 'center',
              gap: espacio.m,
              paddingHorizontal: espacio.l,
              paddingVertical: espacio.s,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: c.atencion,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="alerta" color={c.sobreAtencion} grosor={2} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={{
                  fontFamily: FUENTE,
                  fontSize: 16,
                  lineHeight: 22,
                  fontWeight: '700',
                  color: c.texto,
                }}
              >
                {textoPorRevisarResumen(porRevisar.length)}
              </Text>
              <Text style={{ fontFamily: FUENTE, fontSize: 14, lineHeight: 20, color: c.textoSecundario }}>
                {`«${porRevisar[0]?.texto ?? ''}»`}
              </Text>
            </View>
            <View style={{ transform: [{ rotate: revisarAbierto ? '90deg' : '0deg' }] }}>
              <Icono nombre="chevronDerecha" color={c.textoSecundario} tamano={18} grosor={2.4} />
            </View>
          </Pressable>
          {revisarAbierto ? (
            <>
              <Texto
                variante="etiqueta"
                tono="secundario"
                testID="movimientos-por-revisar-titulo"
                accessibilityRole="header"
              >
                {TITULO_POR_REVISAR}
              </Texto>
              <Texto
                variante="secundario"
                tono="secundario"
                testID="movimientos-por-revisar-intro"
                accessibilityLabel={etiquetaIntroPorRevisar()}
              >
                {TEXTO_POR_REVISAR}
              </Texto>
            </>
          ) : null}
          {(revisarAbierto ? porRevisar : []).map((f) => (
            <Tarjeta key={f.id} testID={`por-revisar-${f.id}`}>
              <Texto variante="cuerpo">{`«${f.texto}»`}</Texto>
              <Texto variante="secundario" tono="secundario">
                {`${etiquetaDiaMes(f.fecha)} · ${f.origen === 'voz' ? 'dictado' : 'escrito'}${
                  f.estado === 'revisar' ? ' · necesita que la revises' : ''
                }`}
              </Texto>
              {f.estado === 'revisar' && alRevisar ? (
                <Boton
                  etiqueta="Revisar"
                  variante="secundario"
                  ancho="contenido"
                  alPresionar={() => alRevisar(f.id)}
                  pista={PISTA_REVISAR_FRASE}
                  testID={`revisar-${f.id}`}
                />
              ) : alRegistrar ? (
                <Boton
                  etiqueta="Llenar los datos"
                  variante="secundario"
                  ancho="contenido"
                  alPresionar={alRegistrar}
                  pista={PISTA_REGISTRAR_MOVIMIENTO}
                  testID={`llenar-${f.id}`}
                />
              ) : null}
              <Boton
                etiqueta="Descartar"
                variante="texto"
                ancho="contenido"
                pista={PISTA_DESCARTAR_FRASE}
                alPresionar={() => {
                  try {
                    descartarPorInterpretar(ctx, f.id);
                    refrescar();
                  } catch (e) {
                    mostrar({ mensaje: mensajeError(e) });
                  }
                }}
                testID={`descartar-${f.id}`}
              />
            </Tarjeta>
          ))}
        </View>
      ) : null}

      <PorRevisarCapturas alRegistrar={alRegistrar} />

      {buscando ? (
        <CampoTexto
          etiqueta={ETIQUETA_BUSCAR_MOVIMIENTOS}
          valor={busqueda}
          alCambiar={setBusqueda}
          ejemplo={EJEMPLO_BUSCAR_MOVIMIENTOS}
          autoFocus
          nativo={{ returnKeyType: 'search', autoCorrect: false }}
          testID="campo-buscar-movimientos"
        />
      ) : null}

      {hayMovimientos ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: espacio.xs }}
          testID="movimientos-chips"
        >
          <GrupoChips
            opciones={chips.map((ch) => ({ valor: ch, etiqueta: ETIQUETA_CHIP_MOVIMIENTOS[ch] }))}
            valor={chip}
            alCambiar={setChip}
            prefijoTestID="movimientos-chip"
            etiqueta={ETIQUETA_FILTRAR_MOVIMIENTOS}
          />
        </ScrollView>
      ) : null}

      {filtro ? (
        <Tarjeta testID="movimientos-filtro">
          <Texto
            variante="secundario"
            accessibilityLabel={etiquetaFiltroMovimientosActivo()}
            accessibilityLiveRegion="polite"
          >
            {TEXTO_MOVIMIENTOS_FILTRO_ACTIVO}
          </Texto>
          {alQuitarFiltro ? (
            <Boton
              etiqueta="Ver todos"
              variante="texto"
              ancho="contenido"
              alPresionar={alQuitarFiltro}
              pista={PISTA_VER_TODOS_MOVIMIENTOS}
              testID="boton-quitar-filtro"
            />
          ) : null}
        </Tarjeta>
      ) : null}

      {dias.length === 0 ? (
        <EstadoVacio
          testID="movimientos-vacio"
          texto={
            texto !== ''
              ? TEXTO_BUSQUEDA_VACIA
              : filtro || chip !== 'todos'
                ? TEXTO_MOVIMIENTOS_FILTRO_VACIO
                : TEXTO_MOVIMIENTOS_VACIO
          }
          etiquetaAccesible={etiquetaVacioMovimientos(filtro != null || chip !== 'todos' || texto !== '')}
          {...(filtro || chip !== 'todos' || texto !== '' ? {} : { pistaCta: PISTA_VACIO_MOVIMIENTOS })}
        />
      ) : null}
      {dias.length === 0 && chip !== 'todos' ? (
        <Boton
          etiqueta="Ver todos"
          variante="texto"
          ancho="contenido"
          alPresionar={() => setChip('todos')}
          pista={PISTA_VER_TODOS_MOVIMIENTOS}
          testID="movimientos-chip-ver-todos"
        />
      ) : null}
      {dias.length === 0 && !filtro && chip === 'todos' && texto === '' ? (
        <Boton
          etiqueta={BTN_REGISTRAR_PRIMER_MOVIMIENTO}
          variante="secundario"
          alPresionar={alRegistrar}
          pista={PISTA_REGISTRAR_MOVIMIENTO}
          testID="boton-registrar-primer-movimiento"
        />
      ) : null}
    </View>
  );

  return (
    <Pantalla
      testID="pantalla-movimientos"
      // Arriba manda la navegación de la dirección B (ya cubre la barra de estado); abajo, el dock.
      bordes={['left', 'right']}
      desplazable={false}
      contenidoStyle={{ gap: espacio.xl, flex: 1, paddingBottom: 0, paddingTop: espacio.m }}
    >
      <SectionList
        testID="movimientos-section-list"
        accessibilityRole="list"
        sections={secciones}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: espacio.xxxl + espacioInferior }}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={encabezadoLista}
        renderSectionHeader={({ section }) => (
          // B4: cada día es una tarjeta; su encabezado (el día y lo que salió) es la parte de arriba.
          <View
            style={{
              marginTop: espacio.m + 2,
              backgroundColor: c.superficie,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: c.borde,
              paddingHorizontal: espacio.l,
              paddingTop: espacio.xs,
            }}
          >
            <View
              style={{
                minHeight: 40,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: espacio.s,
              }}
            >
              <Text
                accessibilityRole="header"
                accessibilityLabel={etiquetaEncabezadoDiaConTotales(section.etiqueta, section.resumen)}
                testID={`movimientos-dia-${section.fecha}`}
                style={{
                  fontFamily: FUENTE,
                  flexShrink: 1,
                  fontSize: 15,
                  lineHeight: 20,
                  fontWeight: '700',
                  color: c.texto,
                }}
              >
                {section.visible}
              </Text>
              {section.total ? (
                <Text
                  testID={`movimientos-dia-total-${section.fecha}`}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={{
                    fontFamily: FUENTE,
                    fontSize: 15,
                    lineHeight: 20,
                    fontWeight: '600',
                    color: c.textoSecundario,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {section.total}
                </Text>
              ) : null}
            </View>
            <View
              accessibilityRole="list"
              testID={`movimientos-lista-${section.fecha}`}
              accessible
              accessibilityLabel={`Lista del ${section.etiqueta}`}
            />
          </View>
        )}
        renderItem={({ item: m, index, section }) => (
          <View
            role="listitem"
            testID={`movimiento-fila-${m.id}`}
            style={{
              backgroundColor: c.superficie,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: c.borde,
              paddingHorizontal: espacio.l,
              ...(index === section.data.length - 1
                ? {
                    borderBottomWidth: 1,
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: 24,
                    paddingBottom: espacio.xs,
                  }
                : null),
            }}
          >
            {index > 0 ? (
              <View style={{ height: 1, backgroundColor: c.superficieAlterna, marginLeft: 52 }} />
            ) : null}
            <FilaMovimiento
              m={m}
              abierto={abierto === m.id}
              aMeses={conTarjeta.has(m.id)}
              {...(alAbrirPersona ? { alAbrirPersona } : {})}
              alAbrirDetalle={(id) => setAbierto(id)}
              alTocar={() => setAbierto((a) => (a === m.id ? null : m.id))}
              alCerrar={() => setAbierto(null)}
              alAnular={() => {
                try {
                  anularMovimiento(ctx, m.id);
                  setAbierto(null);
                  refrescar();
                  mostrar({ mensaje: MENSAJE_ANULADO_MOVIMIENTO });
                } catch (e) {
                  mostrar({ mensaje: mensajeError(e) });
                }
              }}
              alExtraordinario={() => {
                const marcar = !m.extraordinaria;
                try {
                  marcarExtraordinaria(ctx, m.id, marcar);
                  refrescar();
                  mostrar({
                    mensaje: marcar
                      ? 'Listo: no lo uso para estimar tus gastos de cada día.'
                      : 'Listo: vuelvo a contarlo para estimar tus gastos de cada día.',
                    accion: {
                      etiqueta: 'Deshacer',
                      alPresionar: () => {
                        try {
                          marcarExtraordinaria(ctx, m.id, !marcar);
                          refrescar();
                        } catch (e) {
                          mostrarDespuesDeCerrar(mostrar, mensajeError(e));
                        }
                      },
                    },
                  });
                } catch (e) {
                  mostrar({ mensaje: mensajeError(e) });
                }
              }}
            />
          </View>
        )}
      />
    </Pantalla>
  );
}

/** Sin la sombra de `Tarjeta`: la fila vive dentro de la tarjeta del día. */
const SIN_SOMBRA = { shadowOpacity: 0, elevation: 0 } as const;

/** Con mayúscula inicial, como en la tarjeta del asistente: «coca 25» se registra como «coca» y aquí dice «Coca». */
function titulo(m: MovimientoVista): string {
  return capitalizar(m.descripcion ?? m.comercio ?? m.categoria ?? nombreTipoLibro(m.tipo));
}

const MESES_COMUNES = ['3', '6', '9', '12', '18', '24'] as const;

/** "Pasar a meses" (CA-M4-09): cuántos meses y Guardar; el cargo se reemplaza por la compra a meses. */
function PasarAMeses({
  m,
  alTerminar,
  alAbrirDetalle,
}: {
  m: MovimientoVista;
  alTerminar: () => void;
  alAbrirDetalle: (transaccionId: string) => void;
}) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro(alAbrirDetalle);
  const [meses, setMeses] = useState<string | null>(null);
  const [otro, setOtro] = useState('');
  const [error, setError] = useState<string | null>(null);
  useAnuncio(error);
  const guardar = () => {
    const n = meses !== null ? Number(meses) : leerEntero(otro, 2, 48);
    if (n === null) return setError('Elige los meses, de 2 a 48.');
    try {
      const r = pasarAMeses(ctx, m.id, n);
      avisarRegistro(mensajeCompraMsi(r), { deshacer: r.deshacer, transaccionId: r.transaccionId });
      alTerminar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  return (
    <View style={{ gap: espacio.s }} testID={`pasar-a-meses-${m.id}`}>
      <Texto variante="cuerpo" {...OCULTAR_ETIQUETA_VISIBLE}>
        {PREGUNTA_PASAR_A_MESES}
      </Texto>
      <GrupoChips
        opciones={MESES_COMUNES.map((n) => ({ valor: n, etiqueta: `${n} meses` }))}
        valor={meses}
        alCambiar={(n) => {
          setMeses(n);
          setOtro('');
        }}
        prefijoTestID="meses"
        etiqueta={PREGUNTA_PASAR_A_MESES}
      />
      <CampoTexto
        testID="meses-otro"
        etiqueta="Otro número de meses"
        teclado="number-pad"
        valor={otro}
        alCambiar={(t) => {
          setOtro(t);
          setMeses(null);
        }}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Pasar a meses" alPresionar={guardar} testID="boton-confirmar-meses" />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alTerminar} />
    </View>
  );
}

function FilaMovimiento({
  m,
  abierto,
  aMeses,
  alTocar,
  alCerrar,
  alAnular,
  alExtraordinario,
  alAbrirPersona,
  alAbrirDetalle,
}: {
  m: MovimientoVista;
  abierto: boolean;
  aMeses: boolean;
  alTocar: () => void;
  alCerrar: () => void;
  alAnular: () => void;
  alExtraordinario: () => void;
  alAbrirPersona?: (personaId: string) => void;
  alAbrirDetalle: (transaccionId: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pasando, setPasando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  // VoiceOver: la pregunta de borrar se anuncia como en TalkBack (`accessibilityRole="alert"`).
  useAnuncio(abierto && confirmando ? TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO : null);
  const { c } = useTema();
  const centavos = m.sentido === 'salida' ? -m.monto : m.monto;
  const cuenta = m.sentido === 'entrada' ? m.llegaA[0] : (m.saleDe[0] ?? m.llegaA[0]);
  const subtitulo = [m.categoria, cuenta, ...m.insignias.map((i) => INSIGNIA[i])].filter(Boolean).join(' · ');
  const etiquetaAccesible = etiquetaHablada(
    [titulo(m), subtitulo, cifraEnPalabras(centavos)].filter(Boolean).join(', '),
  );
  const ocupado = pasando || confirmando || corrigiendo;
  const encabezado = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        minHeight: 60,
        paddingVertical: espacio.s,
      }}
    >
      {/* B+ (D5): el mosaico de color de la categoría. */}
      <Mosaico slug={m.categoriaSlug} testID={`mosaico-${m.id}`} />
      <View style={{ flex: 1, gap: 1 }}>
        <Texto variante="cuerpoFuerte" style={{ lineHeight: 22 }}>
          {titulo(m)}
        </Texto>
        {subtitulo ? (
          <Texto variante="secundario" tono="secundario" style={{ lineHeight: 20 }}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      <Cifra centavos={centavos} testID={`monto-${m.id}`} />
    </View>
  );
  return (
    <Tarjeta
      testID={`movimiento-${m.id}`}
      alPresionar={alTocar}
      accionesAnidadas={abierto}
      expandida={abierto}
      etiquetaAccesible={etiquetaAccesible}
      pista={abierto ? PISTA_OCULTAR_DETALLE_MOVIMIENTO : PISTA_MOSTRAR_DETALLE_MOVIMIENTO}
      // B4: la fila va dentro de la tarjeta del día, sin su propia caja.
      style={{ backgroundColor: 'transparent', borderWidth: 0, padding: 0, ...SIN_SOMBRA }}
    >
      {abierto ? (
        // Con el detalle abierto, el fondo de la tarjeta queda detrás del texto: el encabezado también la cierra.
        <Pressable
          testID={`encabezado-${m.id}`}
          onPress={alTocar}
          accessibilityRole="button"
          accessibilityLabel={etiquetaAccesible}
          accessibilityHint={PISTA_OCULTAR_DETALLE_MOVIMIENTO}
          accessibilityState={{ expanded: true }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {encabezado}
          </View>
        </Pressable>
      ) : (
        encabezado
      )}
      {abierto ? (
        <View
          style={{
            gap: espacio.s,
            marginTop: espacio.xs,
            paddingTop: espacio.m,
            borderTopWidth: 1,
            borderTopColor: c.borde,
          }}
          testID={`detalle-${m.id}`}
        >
          {m.saleDe.length > 0 ? (
            <Texto variante="secundario">{`Salió de: ${m.saleDe.join(', ')}`}</Texto>
          ) : null}
          {m.llegaA.length > 0 ? (
            <Texto variante="secundario">{`Llegó a: ${m.llegaA.join(', ')}`}</Texto>
          ) : null}
          {alAbrirPersona
            ? m.personas.map((p) => (
                <Boton
                  key={p.id}
                  etiqueta={`Ver ${p.nombre}`}
                  variante="texto"
                  ancho="contenido"
                  alPresionar={() => alAbrirPersona(p.id)}
                  testID={`movimiento-persona-${m.id}-${p.id}`}
                />
              ))
            : null}
          {m.categoria ? <Texto variante="secundario">{`Categoría: ${m.categoria}`}</Texto> : null}
          {m.reemplazaA ? <Historial id={m.id} /> : null}
          <Texto variante="secundario" tono="secundario">
            {`${NOMBRE_ORIGEN[m.origen] ?? 'Registrado'} · ${etiquetaDiaMes(m.fecha)}`}
          </Texto>
          {pasando ? (
            <PasarAMeses m={m} alTerminar={() => setPasando(false)} alAbrirDetalle={alAbrirDetalle} />
          ) : null}
          {corrigiendo && esCorregible(m) ? (
            <FormularioMovimiento
              corregir={m}
              alCorregido={(nuevoId) => {
                setCorrigiendo(false);
                // La versión corregida reemplaza a esta: su detalle queda abierto con el historial.
                alAbrirDetalle(nuevoId);
              }}
              alCancelar={() => setCorrigiendo(false)}
            />
          ) : null}
          {esCorregible(m) && !ocupado ? (
            <Boton
              etiqueta={BTN_CORREGIR_MOVIMIENTO}
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setCorrigiendo(true)}
              pista={PISTA_CORREGIR_MOVIMIENTO}
              testID="boton-corregir"
            />
          ) : null}
          {aMeses && !ocupado ? (
            <Boton
              etiqueta="Pasar a meses"
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setPasando(true)}
              testID="boton-pasar-a-meses"
            />
          ) : null}
          {m.tipo === 'gasto' && m.extraordinaria ? (
            <Texto variante="secundario" tono="secundario" testID="nota-extraordinario">
              Lo marcaste como extraordinario
            </Texto>
          ) : null}
          {m.tipo === 'gasto' && !ocupado ? (
            m.extraordinaria ? (
              <Boton
                etiqueta="Volver a contarlo"
                variante="texto"
                ancho="contenido"
                pista="Lo vuelvo a usar para estimar si llegas a tu próximo ingreso"
                alPresionar={alExtraordinario}
                testID="boton-volver-a-contar"
              />
            ) : (
              <Boton
                etiqueta="Fue algo extraordinario"
                variante="texto"
                ancho="contenido"
                pista="No lo uso para estimar si llegas a tu próximo ingreso"
                alPresionar={alExtraordinario}
                testID="boton-extraordinario"
              />
            )
          ) : null}
          {pasando || corrigiendo ? null : confirmando ? (
            <View style={{ gap: espacio.s }} testID={`confirmar-anular-${m.id}`}>
              <Texto
                variante="cuerpo"
                testID={`texto-confirmar-anular-${m.id}`}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                accessibilityLabel={etiquetaConfirmarAnularMovimiento()}
              >
                {TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO}
              </Texto>
              <Boton
                etiqueta={BTN_CONFIRMAR_BORRAR_MOVIMIENTO}
                alPresionar={alAnular}
                pista={PISTA_CONFIRMAR_ANULAR_MOVIMIENTO}
                testID="boton-confirmar-anular"
              />
              <Boton etiqueta="Cancelar" variante="texto" alPresionar={() => setConfirmando(false)} />
            </View>
          ) : (
            <Boton
              etiqueta={BTN_BORRAR_MOVIMIENTO}
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setConfirmando(true)}
              pista={PISTA_ANULAR_MOVIMIENTO}
              testID="boton-anular"
            />
          )}
          {ocupado ? null : (
            <Boton
              etiqueta={BTN_CERRAR_DETALLE}
              etiquetaAccesible={ETIQUETA_CERRAR_DETALLE}
              pista={PISTA_OCULTAR_DETALLE_MOVIMIENTO}
              variante="texto"
              ancho="contenido"
              alPresionar={alCerrar}
              testID={`cerrar-detalle-${m.id}`}
            />
          )}
        </View>
      ) : null}
    </Tarjeta>
  );
}

/** Historial de un movimiento corregido (CA-M3-03): cómo estaba antes de cada cambio. */
function Historial({ id }: { id: string }) {
  const versiones = useVista((ctx) => historialMovimiento(ctx, id));
  if (versiones.length === 0) return null;
  return (
    <View style={{ gap: espacio.xs }} testID={`historial-${id}`}>
      <Texto variante="secundario" tono="secundario">
        Lo corregiste. Antes:
      </Texto>
      {versiones.map((v) => (
        <Texto key={v.transaccionId} variante="secundario" tono="secundario">
          {`${resumenMovimiento(v)} · ${etiquetaDiaMes(v.fecha)}`}
        </Texto>
      ))}
    </View>
  );
}
