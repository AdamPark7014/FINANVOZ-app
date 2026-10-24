import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { fijarVozRespuesta, obtenerVozRespuesta } from '../../servicios';
import {
  fijarAjustesVoz,
  fijarConfirmarPorVoz,
  obtenerAjustesVoz,
  obtenerConfirmarPorVoz,
  VELOCIDADES_VOZ,
  type VelocidadVoz,
} from '../../servicios/preferencias';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Boton,
  espacio,
  GrupoChips,
  Interruptor,
  OBJETIVO_TACTIL_MIN,
  radio,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { cargarVoces, hayInternet } from '../../voz/catalogo';
import { IndicadorVoz } from '../../voz/IndicadorVoz';
import { configurarVoz, hablar, type FinHabla, type OpcionesHabla } from '../../voz/respuesta';
import { useHablando } from '../../voz/useVozAsistente';
import {
  claveVoz,
  elegirVoz,
  faltaVozMejorada,
  opcionesVoz,
  type OpcionVoz,
  type PlataformaVoz,
  type VozSistema,
} from '../../voz/voces';
import { plataformaActual } from './plataforma';
import { MENSAJE_NO_GUARDAR } from './textos';
import {
  CARGANDO_VOCES,
  DESC_CONTESTAR_EN_VOZ,
  DESC_SILENCIO_IOS,
  descVoz,
  ETIQUETA_CONTESTAR_EN_VOZ,
  ETIQUETA_ENTENDIDO,
  ETIQUETA_ESCUCHAR,
  ETIQUETA_SILENCIO_IOS,
  ETIQUETA_VELOCIDAD,
  ETIQUETA_VOZ,
  ETIQUETAS_VELOCIDAD,
  etiquetaEscucharVoz,
  FRASE_MUESTRA_VOZ,
  GUIA_VOZ_MEJORADA_IOS,
  GUIA_VOZ_MEJORADA_IOS_HABLADA,
  PISTA_ELEGIR_VOZ,
  PISTA_ESCUCHAR,
  pistaContestarEnVoz,
  SECCION_VOZ,
  SIN_VOCES,
  TITULO_GUIA_MEJORADA,
} from './voz-textos';

/** Redacción de «Confirmar por voz» (`02 §14`: tuteo, sin tecnicismos ni exclamaciones; Ola 7 §4). */
export const ETIQUETA_CONFIRMAR_POR_VOZ = 'Confirmar por voz';
export const DESC_CONFIRMAR_POR_VOZ =
  'Si dictas algo y te pregunto si lo registro, te escucho unos segundos: di «sí», «no» o qué cambio, como «fue con la Nu».';

/** De dónde salen las voces y quién habla (las pruebas pasan unas falsas). */
export interface FuentesVoz {
  readonly cargarVoces: (forzar?: boolean) => Promise<readonly VozSistema[]>;
  readonly hayInternet: () => Promise<boolean>;
  readonly hablar: (texto: string, o?: OpcionesHabla) => Promise<FinHabla>;
}

const FUENTES_TELEFONO: FuentesVoz = { cargarVoces, hayInternet, hablar };

const OPCIONES_VELOCIDAD = VELOCIDADES_VOZ.map((v) => ({ valor: v, etiqueta: ETIQUETAS_VELOCIDAD[v] }));

interface Catalogo {
  readonly voces: readonly VozSistema[];
  readonly enLinea: boolean;
}

/**
 * Ajustes → Voz: "Contestarte en voz" (encendido salvo con bloqueo biométrico) y, si está encendido, cómo suena:
 * las 3 mejores voces del teléfono con «Escuchar», la velocidad y, en iPhone, si habla en silencio. Al final,
 * "Confirmar por voz" en las tarjetas «Entendí» del asistente (encendido por omisión).
 */
export function SeccionVoz({ fuentes = FUENTES_TELEFONO }: { fuentes?: FuentesVoz }) {
  const { ctx, refrescar } = useSesion();
  const { activa } = useVista(obtenerVozRespuesta);
  const { activa: confirmar } = useVista(obtenerConfirmarPorVoz);
  const ajustes = useVista(obtenerAjustesVoz);
  const [error, setError] = useState(false);
  const plataforma: PlataformaVoz = plataformaActual();

  const guardar = (fijar: () => void) => {
    try {
      fijar();
      setError(false);
      refrescar();
    } catch {
      setError(true);
    }
  };

  // La voz de toda la app suena como aquí se elige, aunque la pantalla del asistente no se haya abierto.
  useEffect(() => {
    configurarVoz({ voz: ajustes.voz, velocidad: ajustes.velocidad, enSilencio: ajustes.enSilencio });
  }, [ajustes.voz, ajustes.velocidad, ajustes.enSilencio]);

  return (
    <Tarjeta testID="ajustes-voz">
      <Texto variante="subtitulo" testID="ajustes-voz-titulo" accessibilityRole="header">
        {SECCION_VOZ}
      </Texto>
      <View style={{ marginTop: espacio.s }}>
        <Interruptor
          testID="ajustes-voz-contestar"
          etiqueta={ETIQUETA_CONTESTAR_EN_VOZ}
          descripcion={DESC_CONTESTAR_EN_VOZ}
          pista={pistaContestarEnVoz()}
          valor={activa}
          alCambiar={(valor) => guardar(() => fijarVozRespuesta(ctx, valor))}
        />
        {activa ? (
          <ComoSuena
            fuentes={fuentes}
            plataforma={plataforma}
            vozGuardada={ajustes.voz}
            velocidad={ajustes.velocidad}
            enSilencio={ajustes.enSilencio}
            guiaVista={ajustes.guiaMejoradaVista}
            alElegirVoz={(voz) => guardar(() => fijarAjustesVoz(ctx, { voz }))}
            alCambiarVelocidad={(velocidad) => guardar(() => fijarAjustesVoz(ctx, { velocidad }))}
            alCambiarSilencio={(enSilencio) => guardar(() => fijarAjustesVoz(ctx, { enSilencio }))}
            alMostrarGuia={() => {
              try {
                fijarAjustesVoz(ctx, { guiaMejoradaVista: true });
              } catch {
                // Sin el aviso de privacidad aceptado no se guarda: la guía vuelve a salir la próxima vez.
              }
            }}
          />
        ) : null}
        <Interruptor
          testID="ajustes-voz-confirmar"
          etiqueta={ETIQUETA_CONFIRMAR_POR_VOZ}
          descripcion={DESC_CONFIRMAR_POR_VOZ}
          valor={confirmar}
          alCambiar={(valor) => guardar(() => fijarConfirmarPorVoz(ctx, valor))}
        />
      </View>
      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="ajustes-voz-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {MENSAJE_NO_GUARDAR}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

function ComoSuena({
  fuentes,
  plataforma,
  vozGuardada,
  velocidad,
  enSilencio,
  guiaVista,
  alElegirVoz,
  alCambiarVelocidad,
  alCambiarSilencio,
  alMostrarGuia,
}: {
  fuentes: FuentesVoz;
  plataforma: PlataformaVoz;
  vozGuardada: string | null;
  velocidad: VelocidadVoz;
  enSilencio: boolean;
  guiaVista: boolean;
  alElegirVoz: (voz: string) => void;
  alCambiarVelocidad: (v: VelocidadVoz) => void;
  alCambiarSilencio: (v: boolean) => void;
  alMostrarGuia: () => void;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  // Si ya se había mostrado al abrir esta pantalla, no vuelve a salir; si sale ahora, se queda hasta cerrarla.
  const [guiaVistaAntes] = useState(guiaVista);
  const [guiaCerrada, setGuiaCerrada] = useState(false);
  const [muestra, setMuestra] = useState<string | null>(null);
  const hablando = useHablando();

  useEffect(() => {
    let vivo = true;
    Promise.all([fuentes.cargarVoces(true), plataforma === 'android' ? fuentes.hayInternet() : false])
      .then(([voces, enLinea]) => {
        if (vivo) setCatalogo({ voces, enLinea });
      })
      .catch(() => {
        if (vivo) setCatalogo({ voces: [], enLinea: false });
      });
    return () => {
      vivo = false;
    };
  }, [fuentes, plataforma]);

  const condiciones = useMemo(
    () => ({ plataforma, enLinea: catalogo?.enLinea ?? false }),
    [plataforma, catalogo?.enLinea],
  );
  const opciones = useMemo(
    () => (catalogo ? opcionesVoz(catalogo.voces, condiciones) : []),
    [catalogo, condiciones],
  );
  const elegida = useMemo(() => {
    const v = catalogo ? elegirVoz(catalogo.voces, condiciones, vozGuardada) : null;
    return v ? claveVoz(v, plataforma) : null;
  }, [catalogo, condiciones, vozGuardada, plataforma]);

  // Una sola vez: en iPhone sin voz mejorada en español de México, cómo descargar «Paulina (mejorada)».
  const guia =
    catalogo !== null && !guiaVistaAntes && !guiaCerrada && faltaVozMejorada(catalogo.voces, plataforma);
  const marcarGuia = useRef(alMostrarGuia);
  useEffect(() => {
    marcarGuia.current = alMostrarGuia;
  });
  useEffect(() => {
    if (guia) marcarGuia.current();
  }, [guia]);

  const escuchar = (o: OpcionVoz) => {
    setMuestra(o.id);
    fuentes
      .hablar(FRASE_MUESTRA_VOZ, { voz: o.id, velocidad, forzar: true })
      .catch(() => 'error' as const)
      .finally(() => setMuestra((m) => (m === o.id ? null : m)));
  };

  return (
    <View testID="ajustes-voz-como-suena" style={{ gap: espacio.s, paddingVertical: espacio.s }}>
      <View style={{ gap: espacio.xs }}>
        <Texto variante="cuerpo" accessibilityRole="header">
          {ETIQUETA_VOZ}
        </Texto>
        <Texto variante="secundario" tono="secundario">
          {descVoz()}
        </Texto>
      </View>

      {catalogo === null ? (
        <Texto variante="secundario" tono="secundario" testID="ajustes-voz-cargando">
          {CARGANDO_VOCES}
        </Texto>
      ) : opciones.length === 0 ? (
        <Texto variante="secundario" tono="secundario" testID="ajustes-voz-sin-voces">
          {SIN_VOCES}
        </Texto>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel={ETIQUETA_VOZ} style={{ gap: espacio.s }}>
          {opciones.map((o, i) => (
            <FilaVoz
              key={o.id}
              indice={i}
              opcion={o}
              elegida={o.id === elegida}
              sonando={hablando && muestra === o.id}
              alElegir={() => alElegirVoz(o.id)}
              alEscuchar={() => escuchar(o)}
            />
          ))}
        </View>
      )}

      {guia ? <GuiaVozMejorada alCerrar={() => setGuiaCerrada(true)} /> : null}

      <GrupoChips
        etiqueta={ETIQUETA_VELOCIDAD}
        opciones={OPCIONES_VELOCIDAD}
        valor={velocidad}
        alCambiar={alCambiarVelocidad}
        prefijoTestID="ajustes-voz-velocidad"
      />

      {plataforma === 'ios' ? (
        <Interruptor
          testID="ajustes-voz-silencio"
          etiqueta={ETIQUETA_SILENCIO_IOS}
          descripcion={DESC_SILENCIO_IOS}
          valor={enSilencio}
          alCambiar={alCambiarSilencio}
        />
      ) : null}
    </View>
  );
}

function FilaVoz({
  indice,
  opcion,
  elegida,
  sonando,
  alElegir,
  alEscuchar,
}: {
  indice: number;
  opcion: OpcionVoz;
  elegida: boolean;
  sonando: boolean;
  alElegir: () => void;
  alEscuchar: () => void;
}) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
      <Pressable
        testID={`ajustes-voz-opcion-${indice}`}
        onPress={alElegir}
        accessibilityRole="radio"
        accessibilityLabel={`${opcion.etiqueta}, ${opcion.descripcion}`}
        accessibilityHint={PISTA_ELEGIR_VOZ}
        accessibilityState={{ selected: elegida, checked: elegida }}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: OBJETIVO_TACTIL_MIN,
          justifyContent: 'center',
          paddingHorizontal: espacio.m,
          paddingVertical: espacio.s,
          borderRadius: radio.m,
          borderWidth: elegida ? 2 : 1,
          borderColor: elegida ? c.acentoTexto : c.bordeControl,
          backgroundColor: elegida || pressed ? c.superficieAlterna : c.superficie,
        })}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Texto variante="cuerpo" tono={elegida ? 'acento' : 'normal'}>
            {elegida ? `✓ ${opcion.etiqueta}` : opcion.etiqueta}
          </Texto>
          <Texto variante="secundario" tono="secundario">
            {opcion.descripcion}
          </Texto>
        </View>
      </Pressable>
      {sonando ? <IndicadorVoz activo alto={24} testID={`ajustes-voz-sonando-${indice}`} /> : null}
      <Boton
        testID={`ajustes-voz-escuchar-${indice}`}
        etiqueta={ETIQUETA_ESCUCHAR}
        etiquetaAccesible={etiquetaEscucharVoz(opcion.etiqueta)}
        pista={PISTA_ESCUCHAR}
        variante="secundario"
        ancho="contenido"
        alPresionar={alEscuchar}
      />
    </View>
  );
}

function GuiaVozMejorada({ alCerrar }: { alCerrar: () => void }) {
  const { c } = useTema();
  return (
    <View
      testID="ajustes-voz-guia"
      style={{
        gap: espacio.s,
        padding: espacio.m,
        borderRadius: radio.m,
        borderWidth: 1,
        borderColor: c.bordeControl,
        backgroundColor: c.superficieAlterna,
      }}
    >
      <Texto variante="cuerpo" accessibilityRole="header">
        {TITULO_GUIA_MEJORADA}
      </Texto>
      <Texto variante="secundario" accessibilityLabel={GUIA_VOZ_MEJORADA_IOS_HABLADA}>
        {GUIA_VOZ_MEJORADA_IOS}
      </Texto>
      <Boton
        testID="ajustes-voz-guia-cerrar"
        etiqueta={ETIQUETA_ENTENDIDO}
        variante="texto"
        ancho="contenido"
        alPresionar={alCerrar}
      />
    </View>
  );
}
