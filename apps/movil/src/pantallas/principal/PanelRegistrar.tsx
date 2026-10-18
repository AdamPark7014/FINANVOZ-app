import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import {
  AVISO_DEDUCIBLE_EFECTIVO,
  contarEsperandoConexion,
  descartarPorInterpretar,
  explicar,
  mensajeError,
  obtenerPlan,
  registrarTexto,
  registrarTextoLocal,
  revisarPorInterpretar,
  bucketLatencia,
  type ConsultaMeAlcanza,
  type FiltroMovimientos,
  type OrigenDictado,
  type RespuestaConsulta,
  type ResultadoTexto,
} from '../../servicios';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Boton,
  CampoTexto,
  espacio,
  OBJETIVO_TACTIL_MIN,
  radio,
  Tarjeta,
  Texto,
  tipo,
  useTema,
} from '../../ui';
import {
  ETIQUETA_ESCUCHANDO,
  MENSAJES_DICTADO,
  mensajeEstoOi,
  PISTA_ESCUCHANDO,
  PISTA_HABLAR,
  TEXTO_HABLAR,
  TEXTO_TE_ESCUCHO,
  TEXTO_TERMINAR,
  useBotonHablar,
  useDictado,
  type MotorDictado,
} from '../../voz';
import { TarjetaConfirmarCompartido } from '../compartido/TarjetaConfirmarCompartido';
import { MENSAJE_COMPARTIDO_GUARDADO, MENSAJE_SIN_PAREJA } from '../compartido/textos';
import { mensajeLimite } from '../plan/textos';
import { FormularioCuentaDividida } from '../personas/FormularioCuentaDividida';
import { mensajeCuentaDividida, TITULO_CONFIRMAR_DIVISION } from '../personas/textos';
import { FormularioTanda } from '../tandas/FormularioTanda';
import { mensajeAportacion, mensajeCobro } from '../tandas/textos';
import { FormularioTarjetaNueva } from '../tarjetas/FormularioTarjetaNueva';
import { TarjetaConfirmarMsi } from '../tarjetas/TarjetaConfirmarMsi';
import { mensajeCompraMsi, mensajeTarjetaConfigurada } from '../tarjetas/textos';
import { TarjetaConfirmarTanda } from './TarjetaConfirmarTanda';
import { ConfirmacionRegistro, EnlaceAnaliticaCorreccion } from './ConfirmacionRegistro';
import { TarjetaConsulta } from './TarjetaConsulta';
import { TarjetaExplicacion, type ExplicacionMostrable } from './TarjetaExplicacion';
import { TarjetaAclarar, TarjetaDuplicados, TarjetaElegir } from './TarjetasInterpretacion';
import {
  MENSAJE_EXPLICANDO,
  MENSAJE_EXPLICAR_ERROR,
  MENSAJE_EXPLICAR_SIN_RED,
  MENSAJE_GUARDADA,
  MENSAJE_NO_ENCONTRE,
  MENSAJE_NO_ENTENDI,
  MENSAJE_NO_SOPORTADO,
  MENSAJE_SIN_DUPLICADOS,
  mensajeAnulado,
  mensajeConfigurado,
  mensajeCorregido,
  mensajeEsperandoConexion,
  mensajeFueraDeAlcance,
  mensajePasarAMeses,
  mensajeRegistrado,
} from './textos';
import { useAvisoRegistro } from './useAvisoRegistro';

/** Con el panel fijo al pie, las respuestas ocupan como máximo esta fracción de la pantalla (y se desplazan). */
const ALTO_MAX_RESPUESTAS = 0.35;

/** Resultados que se resuelven con una tarjeta en el panel. */
type ConTarjeta = Extract<
  ResultadoTexto,
  {
    resultado:
      | 'confirmar'
      | 'elegir'
      | 'duplicados'
      | 'aclarar'
      | 'confirmar_msi'
      | 'confirmar_division'
      | 'confirmar_compartido'
      | 'confirmar_tanda'
      | 'tarjeta_por_agregar'
      | 'tanda_por_crear';
  }
>;

/**
 * Registrar hablando o escribiendo (02-UX §5): "Toca para hablar" (otro toque, o callarte, termina; mantener
 * presionado y soltar también sirve) con transcripción en vivo y "Escribir". El nivel 0 responde al instante;
 * lo demás va a la nube (si hay red) y vuelve como registro con "Deshacer", tarjeta de confirmación, elección de
 * movimiento o pregunta. Sin red queda "por revisar" y un indicador discreto dice cuántas frases esperan
 * internet. Lo dictado que no se entiende vuelve al campo "Escribir" para corregirlo.
 */
export function PanelRegistrar({
  alVerMovimientos,
  alMasOpciones,
  alArqueo,
  alMeAlcanza,
  motor,
  abiertoAlInicio = false,
  fraseRevision,
  fijo = false,
}: {
  /** "Ver movimientos" de una consulta (`06 §6`): abre Movimientos con su filtro. */
  alVerMovimientos?: (filtro: FiltroMovimientos) => void;
  /** Abre el formulario completo de movimiento. */
  alMasOpciones?: () => void;
  /** "Traigo 300": abre el arqueo con esa cantidad (`02 §7`). */
  alArqueo?: (efectivoReal: number) => void;
  /** "¿Me alcanza para unos tenis de 1,500?": abre "¿Me alcanza?" con la consulta (en memoria, regla 9). */
  alMeAlcanza?: (consulta: ConsultaMeAlcanza) => void;
  /** Reconocedor de voz inyectable (pruebas). */
  motor?: MotorDictado;
  abiertoAlInicio?: boolean;
  /** Id de una frase de "Por revisar" que se abre para revisarla. */
  fraseRevision?: string;
  /** Al pie de Hoy: "Hablar" y "Escribir" siempre abajo; las respuestas encima, en un área desplazable. */
  fijo?: boolean;
}) {
  const { ctx, refrescar, nube } = useSesion();
  const { c } = useTema();
  const { height: altoVentana } = useWindowDimensions();
  const avisarRegistro = useAvisoRegistro();
  const esperando = useVista(contarEsperandoConexion);
  const plan = useVista(obtenerPlan).plan;
  const [escribiendo, setEscribiendo] = useState(abiertoAlInicio);
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Al abrir una frase para revisarla se empieza interpretando (la ruta vuelve a montar el panel por frase).
  const [interpretando, setInterpretando] = useState(fraseRevision !== undefined);
  const [tarjeta, setTarjeta] = useState<{ datos: ConTarjeta; origen: OrigenDictado } | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaConsulta | null>(null);
  const [explicacion, setExplicacion] = useState<ExplicacionMostrable | null>(null);
  const [explicando, setExplicando] = useState(false);
  /** Aviso preventivo de `02 §24` tras registrar salud en efectivo (CA-M12-04); se queda hasta "Entendido". */
  const [avisoDeducible, setAvisoDeducible] = useState(false);
  const enRevision = useRef<string | null>(null);
  /** Frase dictada que se está interpretando: si no se entiende, vuelve al campo para corregirla. */
  const dictadoEnCurso = useRef<string | null>(null);
  const registrarEvento = useAnalitica();
  /** Solo para la analítica (`03 §8`): cuándo empezó, qué nivel respondió y si hubo que preguntar. */
  const medicion = useRef<{ inicio: number; nivel: 'reglas' | 'nube'; pregunto: boolean } | null>(null);

  const contarRegistro = useCallback(
    (origen: OrigenDictado) => {
      const m = medicion.current;
      medicion.current = null;
      registrarEvento({
        nombre: 'movimiento_registrado',
        propiedades: {
          origen,
          pregunto: m?.pregunto ?? false,
          espacio: 'personal',
          ...(m ? { nivel_interprete: m.nivel } : {}),
          ...(m && !m.pregunto ? { latencia_bucket: bucketLatencia(Date.now() - m.inicio) } : {}),
        },
      });
    },
    [registrarEvento],
  );

  /** La frase en revisión ya no hace falta: se quitó de "Por revisar". */
  const terminarRevision = useCallback(() => {
    const id = enRevision.current;
    enRevision.current = null;
    if (id) {
      try {
        descartarPorInterpretar(ctx, id);
      } catch {
        // Ya no existe.
      }
    }
  }, [ctx]);

  /** "No te entendí": si se dictó, lo oído pasa al campo "Escribir" con "Esto oí: …" en vez de perderse. */
  const avisarNoEntendi = useCallback((oido: string | null, porQue: string) => {
    if (oido === null) {
      setMensaje(porQue);
      return;
    }
    setTexto(oido);
    setEscribiendo(true);
    setMensaje(porQue === MENSAJE_NO_ENTENDI ? mensajeEstoOi(oido) : porQue);
  }, []);

  const mostrar = useCallback(
    (r: ResultadoTexto, origen: OrigenDictado) => {
      const oido = dictadoEnCurso.current;
      dictadoEnCurso.current = null;
      setTarjeta(null);
      setRespuesta(null);
      setExplicacion(null);
      switch (r.resultado) {
        case 'registrado':
          terminarRevision();
          setTexto('');
          contarRegistro(origen);
          setAvisoDeducible(r.movimientos.some((m) => m.avisoDeducible));
          avisarRegistro(mensajeRegistrado(r.movimientos), r.deshacer);
          return;
        case 'corregido':
          terminarRevision();
          setTexto('');
          avisarRegistro(mensajeCorregido(r.antes, r.despues), r.deshacer);
          return;
        case 'anulado':
          terminarRevision();
          setTexto('');
          avisarRegistro(mensajeAnulado(r.movimiento), r.deshacer);
          return;
        case 'configurado':
          terminarRevision();
          setTexto('');
          avisarRegistro(mensajeConfigurado(r.compromiso), r.compromiso.deshacer);
          return;
        case 'pasar_a_meses':
          terminarRevision();
          setTexto('');
          avisarRegistro(mensajePasarAMeses(r.movimiento, r.meses), r.deshacer);
          return;
        case 'registrado_msi':
          terminarRevision();
          setTexto('');
          contarRegistro(origen);
          avisarRegistro(mensajeCompraMsi(r.compra), r.deshacer);
          return;
        case 'registrado_division':
          terminarRevision();
          setTexto('');
          contarRegistro(origen);
          avisarRegistro(
            mensajeCuentaDividida(r.descripcion, r.total, r.registro.reparto.porCobrarTotal),
            r.deshacer,
          );
          return;
        case 'registrado_tanda':
          terminarRevision();
          setTexto('');
          contarRegistro(origen);
          avisarRegistro(
            r.tipo === 'cobro_tanda' ? mensajeCobro(r.movimiento) : mensajeAportacion(r.movimiento),
            r.movimiento.deshacer,
          );
          return;
        case 'tarjeta_configurada':
          terminarRevision();
          setTexto('');
          avisarRegistro(mensajeTarjetaConfigurada(r.tarjeta, r.editada), r.deshacer ?? undefined);
          return;
        case 'confirmar':
        case 'elegir':
        case 'duplicados':
        case 'aclarar':
        case 'confirmar_msi':
        case 'confirmar_division':
        case 'confirmar_compartido':
        case 'confirmar_tanda':
        case 'tarjeta_por_agregar':
        case 'tanda_por_crear':
          if (medicion.current) medicion.current.pregunto = true;
          setTarjeta({ datos: r, origen });
          return;
        case 'sin_pareja':
          setMensaje(MENSAJE_SIN_PAREJA);
          return;
        case 'por_interpretar':
          setTexto('');
          setMensaje((r.limite ? mensajeLimite(r.limite, plan) : null) ?? MENSAJE_GUARDADA[r.motivo]);
          refrescar();
          return;
        case 'consulta':
          terminarRevision();
          setTexto('');
          setRespuesta(r.respuesta);
          return;
        case 'explicar':
          terminarRevision();
          setTexto('');
          // Modo explicar (`02 §22`): varias vueltas con la nube; las cifras ya vienen verificadas.
          setExplicando(true);
          explicar(ctx, r.pregunta, { nube, registrarEvento })
            .then((e) => {
              if (e.tipo === 'sin_red') setMensaje(MENSAJE_EXPLICAR_SIN_RED);
              else if (e.tipo === 'error') setMensaje(MENSAJE_EXPLICAR_ERROR);
              else if (e.tipo === 'limite')
                setMensaje(mensajeLimite(e.codigo, plan) ?? MENSAJE_EXPLICAR_ERROR);
              else setExplicacion(e);
            })
            .catch(() => setMensaje(MENSAJE_EXPLICAR_ERROR))
            .finally(() => setExplicando(false));
          return;
        case 'arqueo':
          terminarRevision();
          setTexto('');
          alArqueo?.(r.efectivoReal);
          return;
        case 'me_alcanza':
          terminarRevision();
          setTexto('');
          if (alMeAlcanza) alMeAlcanza(r.consulta);
          else setMensaje(MENSAJE_NO_SOPORTADO.consulta);
          return;
        case 'no_encontrado':
          setMensaje(r.accion === 'duplicados' ? MENSAJE_SIN_DUPLICADOS : MENSAJE_NO_ENCONTRE);
          return;
        case 'no_entendi':
          avisarNoEntendi(oido, MENSAJE_NO_ENTENDI);
          return;
        case 'no_soportado':
          setMensaje(MENSAJE_NO_SOPORTADO[r.motivo]);
          return;
        case 'fuera_de_alcance':
          setMensaje(mensajeFueraDeAlcance(r.motivo));
          return;
      }
    },
    [
      alArqueo,
      alMeAlcanza,
      avisarNoEntendi,
      avisarRegistro,
      contarRegistro,
      ctx,
      nube,
      plan,
      refrescar,
      registrarEvento,
      terminarRevision,
    ],
  );

  const enviar = (frase: string, origen: OrigenDictado) => {
    const limpio = frase.trim();
    if (limpio === '' || interpretando || explicando) return;
    setMensaje(null);
    setAvisoDeducible(false);
    setTarjeta(null);
    setRespuesta(null);
    setExplicacion(null);
    const oido = origen === 'voz' ? limpio : null;
    dictadoEnCurso.current = oido;
    medicion.current = { inicio: Date.now(), nivel: 'reglas', pregunto: false };
    let local: ResultadoTexto | null;
    try {
      local = registrarTextoLocal(ctx, limpio, origen);
    } catch (e) {
      dictadoEnCurso.current = null;
      avisarNoEntendi(oido, mensajeError(e, MENSAJE_NO_ENTENDI));
      return;
    }
    if (local) {
      mostrar(local, origen);
      return;
    }
    medicion.current.nivel = 'nube';
    setInterpretando(true);
    registrarTexto(ctx, limpio, origen, { nube })
      .then((r) => mostrar(r, origen))
      .catch((e: unknown) => {
        dictadoEnCurso.current = null;
        avisarNoEntendi(oido, mensajeError(e, MENSAJE_NO_ENTENDI));
      })
      .finally(() => setInterpretando(false));
  };

  // "Revisar" desde "Por revisar": se interpreta de nuevo con la fecha en que se dijo.
  useEffect(() => {
    if (!fraseRevision) return;
    let vigente = true;
    enRevision.current = fraseRevision;
    revisarPorInterpretar(ctx, fraseRevision, nube)
      .then((r) => {
        if (!vigente) return;
        if (r) mostrar(r, 'texto');
        refrescar();
      })
      .catch((e: unknown) => vigente && setMensaje(mensajeError(e, MENSAJE_NO_ENTENDI)))
      .finally(() => vigente && setInterpretando(false));
    return () => {
      vigente = false;
    };
    // Solo al abrir la frase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fraseRevision]);

  const dictado = useDictado({
    ...(motor ? { motor } : {}),
    alTerminar: (t) => enviar(t, 'voz'),
  });
  const escuchando = dictado.estado === 'escuchando' || dictado.estado === 'procesando';
  const boton = useBotonHablar({ escuchando, iniciar: dictado.iniciar, detener: dictado.detener });
  const errorVoz =
    dictado.estado === 'sin_permiso'
      ? MENSAJES_DICTADO.sin_permiso
      : dictado.error
        ? MENSAJES_DICTADO[dictado.error]
        : null;

  const respuestas = (
    <>
      {avisoDeducible ? (
        <Tarjeta testID="aviso-deducible">
          <Texto variante="cuerpo" accessibilityLiveRegion="polite">
            {AVISO_DEDUCIBLE_EFECTIVO}
          </Texto>
          <Boton
            etiqueta="Entendido"
            variante="texto"
            ancho="contenido"
            alPresionar={() => setAvisoDeducible(false)}
            testID="aviso-deducible-cerrar"
          />
        </Tarjeta>
      ) : null}
      {respuesta ? (
        <TarjetaConsulta
          respuesta={respuesta}
          {...(alVerMovimientos ? { alVerMovimientos } : {})}
          alCerrar={() => setRespuesta(null)}
        />
      ) : null}
      {explicacion ? (
        <TarjetaExplicacion
          respuesta={explicacion}
          {...(alVerMovimientos ? { alVerMovimientos } : {})}
          alCerrar={() => setExplicacion(null)}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'confirmar' ? (
        <ConfirmacionRegistro
          propuestas={tarjeta.datos.propuestas}
          motivo={tarjeta.datos.motivo}
          origen={tarjeta.origen}
          alGuardar={(r) => mostrar(r, tarjeta.origen)}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'elegir' ? (
        <TarjetaElegir
          datos={tarjeta.datos}
          origen={tarjeta.origen}
          alTerminar={(r) => mostrar(r, tarjeta.origen)}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'duplicados' ? (
        <TarjetaDuplicados
          datos={tarjeta.datos}
          origen={tarjeta.origen}
          alTerminar={(r) => mostrar(r, tarjeta.origen)}
          alCerrar={() => {
            terminarRevision();
            setTarjeta(null);
          }}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'confirmar_msi' ? (
        <TarjetaConfirmarMsi
          datos={tarjeta.datos}
          origen={tarjeta.origen}
          alGuardar={(r) => mostrar(r, tarjeta.origen)}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'confirmar_division' ? (
        <Tarjeta testID="confirmacion-division">
          <Texto variante="subtitulo">{TITULO_CONFIRMAR_DIVISION}</Texto>
          <FormularioCuentaDividida
            prellenado={tarjeta.datos.propuesta}
            origen={tarjeta.origen}
            alGuardar={(r) => mostrar(r, tarjeta.origen)}
            alCancelar={() => setTarjeta(null)}
          />
        </Tarjeta>
      ) : null}
      {tarjeta?.datos.resultado === 'confirmar_compartido' ? (
        <TarjetaConfirmarCompartido
          propuesta={tarjeta.datos.propuesta}
          alGuardar={() => {
            terminarRevision();
            setTarjeta(null);
            setTexto('');
            contarRegistro(tarjeta.origen);
            refrescar();
            avisarRegistro(MENSAJE_COMPARTIDO_GUARDADO);
          }}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'confirmar_tanda' ? (
        <TarjetaConfirmarTanda
          datos={tarjeta.datos}
          origen={tarjeta.origen}
          alGuardar={(r) => mostrar(r, tarjeta.origen)}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}
      {tarjeta?.datos.resultado === 'tarjeta_por_agregar' ? (
        <Tarjeta testID="tarjeta-por-agregar">
          <Texto variante="subtitulo">
            {tarjeta.datos.prellenado.alias
              ? `No tengo una tarjeta «${tarjeta.datos.prellenado.alias}». ¿La agrego?`
              : '¿Qué tarjeta es? Agrégala con sus datos.'}
          </Texto>
          <Texto variante="secundario" tono="secundario">
            Ya puse lo que me dijiste. Falta cuánto debes hoy: sin eso no la agrego.
          </Texto>
          <FormularioTarjetaNueva
            prellenado={tarjeta.datos.prellenado}
            alGuardar={() => {
              terminarRevision();
              setTarjeta(null);
              setTexto('');
              avisarRegistro('Listo: agregué tu tarjeta.');
            }}
            alCancelar={() => setTarjeta(null)}
          />
        </Tarjeta>
      ) : null}
      {tarjeta?.datos.resultado === 'tanda_por_crear' ? (
        <Tarjeta testID="tanda-por-crear">
          <Texto variante="subtitulo">Revisa tu tanda</Texto>
          <Texto variante="secundario" tono="secundario">
            Ya puse lo que me dijiste. Corrige la primera fecha si no es la que te dieron.
          </Texto>
          <FormularioTanda
            prellenado={tarjeta.datos.propuesta}
            alGuardar={() => {
              terminarRevision();
              setTarjeta(null);
              setTexto('');
              avisarRegistro('Listo: guardé tu tanda. Aparto cada aportación el día que toca.');
            }}
            alCancelar={() => setTarjeta(null)}
          />
        </Tarjeta>
      ) : null}
      {tarjeta?.datos.resultado === 'aclarar' ? (
        <TarjetaAclarar
          datos={tarjeta.datos}
          alElegir={(frase) => enviar(frase, tarjeta.origen)}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}

      {escuchando ? (
        <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="transcripcion-en-vivo">
          {dictado.parcial === '' ? TEXTO_TE_ESCUCHO : dictado.parcial}
        </Texto>
      ) : null}
      {errorVoz ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {errorVoz}
        </Texto>
      ) : null}
      {interpretando ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID="interpretando"
        >
          Déjame entenderlo…
        </Texto>
      ) : null}
      {explicando ? (
        <Texto variante="secundario" tono="secundario" accessibilityLiveRegion="polite" testID="explicando">
          {MENSAJE_EXPLICANDO}
        </Texto>
      ) : null}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID="mensaje-registro"
        >
          {mensaje}
        </Texto>
      ) : null}

      {escribiendo ? (
        <View style={{ gap: espacio.s }}>
          <CampoTexto
            etiqueta="¿Qué registro?"
            valor={texto}
            alCambiar={setTexto}
            ejemplo="tacos 80 en efectivo"
            autoFocus={!abiertoAlInicio}
            alEnviar={() => enviar(texto, 'texto')}
            nativo={{ returnKeyType: 'send', autoCorrect: false }}
            testID="campo-registrar"
          />
          <Boton
            etiqueta="Registrar"
            alPresionar={() => enviar(texto, 'texto')}
            deshabilitado={texto.trim() === ''}
            testID="boton-enviar-registro"
          />
        </View>
      ) : null}
    </>
  );

  const controles = (
    <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'center' }}>
      <Pressable
        testID="boton-hablar"
        onPressIn={boton.alPresionarDentro}
        onPressOut={boton.alSoltar}
        accessibilityActions={boton.accionesAccesibles}
        onAccessibilityAction={boton.alAccionAccesible}
        accessibilityRole="button"
        accessibilityLabel={escuchando ? ETIQUETA_ESCUCHANDO : TEXTO_HABLAR}
        accessibilityHint={escuchando ? PISTA_ESCUCHANDO : PISTA_HABLAR}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: OBJETIVO_TACTIL_MIN + espacio.s,
          borderRadius: radio.pastilla,
          backgroundColor: c.acento,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: espacio.s,
          paddingHorizontal: espacio.l,
        })}
      >
        <Microfono color={c.sobreAcento} />
        <Texto style={[tipo.etiqueta, { fontSize: 16, color: c.sobreAcento }]}>
          {escuchando ? TEXTO_TERMINAR : TEXTO_HABLAR}
        </Texto>
      </Pressable>
      <Boton
        etiqueta="Escribir"
        variante="secundario"
        ancho="contenido"
        alPresionar={() => setEscribiendo((v) => !v)}
        testID="boton-escribir"
      />
    </View>
  );

  const extras = (
    <>
      {esperando > 0 ? (
        <Texto variante="secundario" tono="secundario" testID="indicador-esperando-conexion">
          {mensajeEsperandoConexion(esperando)}
        </Texto>
      ) : null}
      {alMasOpciones && (!fijo || escribiendo) ? (
        <Boton
          etiqueta="Registrar con formulario"
          variante="texto"
          ancho="contenido"
          alPresionar={alMasOpciones}
          testID="boton-formulario"
        />
      ) : null}
    </>
  );

  if (fijo) {
    const hayRespuestas =
      avisoDeducible ||
      respuesta !== null ||
      explicacion !== null ||
      tarjeta !== null ||
      escuchando ||
      errorVoz !== null ||
      interpretando ||
      explicando ||
      mensaje !== null ||
      escribiendo ||
      esperando > 0;
    return (
      <View style={{ gap: espacio.s }} testID="panel-registrar">
        <EnlaceAnaliticaCorreccion />
        {hayRespuestas ? (
          <ScrollView
            style={{ maxHeight: altoVentana * ALTO_MAX_RESPUESTAS }}
            contentContainerStyle={{ gap: espacio.m }}
            keyboardShouldPersistTaps="handled"
            testID="panel-registrar-respuestas"
          >
            {respuestas}
            {extras}
          </ScrollView>
        ) : null}
        {controles}
      </View>
    );
  }

  return (
    <View style={{ gap: espacio.m }} testID="panel-registrar">
      <EnlaceAnaliticaCorreccion />
      {respuestas}
      {controles}
      {extras}
    </View>
  );
}

/** Ícono de micrófono dibujado con vistas (sin dependencias de íconos). */
function Microfono({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: 'center' }}
    >
      <View style={{ width: 10, height: 15, borderRadius: 5, backgroundColor: color }} />
      <View
        style={{
          width: 16,
          height: 8,
          marginTop: -4,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      <View style={{ width: 2, height: 3, backgroundColor: color }} />
    </View>
  );
}
