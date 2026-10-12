import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  contarEsperandoConexion,
  descartarPorInterpretar,
  registrarTexto,
  registrarTextoLocal,
  revisarPorInterpretar,
  type OrigenDictado,
  type ResultadoTexto,
} from '../../servicios';
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
import { MENSAJES_DICTADO, useDictado, type MotorDictado } from '../../voz';
import { FormularioTarjetaNueva } from '../tarjetas/FormularioTarjetaNueva';
import { TarjetaConfirmarMsi } from '../tarjetas/TarjetaConfirmarMsi';
import { mensajeCompraMsi, mensajeTarjetaConfigurada } from '../tarjetas/textos';
import { ConfirmacionRegistro } from './ConfirmacionRegistro';
import { TarjetaAclarar, TarjetaDuplicados, TarjetaElegir } from './TarjetasInterpretacion';
import {
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

/** Resultados que se resuelven con una tarjeta en el panel. */
type ConTarjeta = Extract<
  ResultadoTexto,
  {
    resultado: 'confirmar' | 'elegir' | 'duplicados' | 'aclarar' | 'confirmar_msi' | 'tarjeta_por_agregar';
  }
>;

/**
 * Registrar hablando o escribiendo (02-UX §5): "Mantén para hablar" con transcripción en vivo y "Escribir".
 * El nivel 0 responde al instante; lo demás va a la nube (si hay red) y vuelve como registro con "Deshacer",
 * tarjeta de confirmación, elección de movimiento o pregunta. Sin red queda "por revisar" y un indicador
 * discreto dice cuántas frases esperan internet.
 */
export function PanelRegistrar({
  alConsultarHoy,
  alVerMovimientos,
  alVerCuentas,
  alMasOpciones,
  motor,
  abiertoAlInicio = false,
  fraseRevision,
}: {
  /** "¿Cuánto puedo gastar hoy?": lleva a Hoy (o no hace nada si ya estás ahí). */
  alConsultarHoy?: () => void;
  /** Consultas de gasto: llevan a Movimientos. */
  alVerMovimientos?: () => void;
  /** Saldos, deudas y compromisos: llevan a Cuentas. */
  alVerCuentas?: () => void;
  /** Abre el formulario completo de movimiento. */
  alMasOpciones?: () => void;
  /** Reconocedor de voz inyectable (pruebas). */
  motor?: MotorDictado;
  abiertoAlInicio?: boolean;
  /** Id de una frase de "Por revisar" que se abre para revisarla. */
  fraseRevision?: string;
}) {
  const { ctx, refrescar, nube } = useSesion();
  const { c } = useTema();
  const avisarRegistro = useAvisoRegistro();
  const esperando = useVista(contarEsperandoConexion);
  const [escribiendo, setEscribiendo] = useState(abiertoAlInicio);
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Al abrir una frase para revisarla se empieza interpretando (la ruta vuelve a montar el panel por frase).
  const [interpretando, setInterpretando] = useState(fraseRevision !== undefined);
  const [tarjeta, setTarjeta] = useState<{ datos: ConTarjeta; origen: OrigenDictado } | null>(null);
  const enRevision = useRef<string | null>(null);

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

  const mostrar = useCallback(
    (r: ResultadoTexto, origen: OrigenDictado) => {
      setTarjeta(null);
      switch (r.resultado) {
        case 'registrado':
          terminarRevision();
          setTexto('');
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
          avisarRegistro(mensajeCompraMsi(r.compra), r.deshacer);
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
        case 'tarjeta_por_agregar':
          setTarjeta({ datos: r, origen });
          return;
        case 'por_interpretar':
          setTexto('');
          setMensaje(MENSAJE_GUARDADA[r.motivo]);
          refrescar();
          return;
        case 'consulta':
          terminarRevision();
          setTexto('');
          if (r.consulta === 'movimientos') alVerMovimientos?.();
          else if (r.consulta === 'cuentas') alVerCuentas?.();
          else alConsultarHoy?.();
          return;
        case 'no_encontrado':
          setMensaje(r.accion === 'duplicados' ? MENSAJE_SIN_DUPLICADOS : MENSAJE_NO_ENCONTRE);
          return;
        case 'no_entendi':
          setMensaje(MENSAJE_NO_ENTENDI);
          return;
        case 'no_soportado':
          setMensaje(MENSAJE_NO_SOPORTADO[r.motivo]);
          return;
        case 'fuera_de_alcance':
          setMensaje(mensajeFueraDeAlcance(r.motivo));
          return;
      }
    },
    [alConsultarHoy, alVerCuentas, alVerMovimientos, avisarRegistro, refrescar, terminarRevision],
  );

  const enviar = (frase: string, origen: OrigenDictado) => {
    const limpio = frase.trim();
    if (limpio === '' || interpretando) return;
    setMensaje(null);
    setTarjeta(null);
    let local: ResultadoTexto | null;
    try {
      local = registrarTextoLocal(ctx, limpio, origen);
    } catch {
      setMensaje(MENSAJE_NO_ENTENDI);
      return;
    }
    if (local) {
      mostrar(local, origen);
      return;
    }
    setInterpretando(true);
    registrarTexto(ctx, limpio, origen, { nube })
      .then((r) => mostrar(r, origen))
      .catch(() => setMensaje(MENSAJE_NO_ENTENDI))
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
      .catch(() => vigente && setMensaje(MENSAJE_NO_ENTENDI))
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
  const errorVoz =
    dictado.estado === 'sin_permiso'
      ? MENSAJES_DICTADO.sin_permiso
      : dictado.error
        ? MENSAJES_DICTADO[dictado.error]
        : null;

  return (
    <View style={{ gap: espacio.m }} testID="panel-registrar">
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
      {tarjeta?.datos.resultado === 'aclarar' ? (
        <TarjetaAclarar
          datos={tarjeta.datos}
          alElegir={(frase) => enviar(frase, tarjeta.origen)}
          alCancelar={() => setTarjeta(null)}
        />
      ) : null}

      {escuchando ? (
        <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="transcripcion-en-vivo">
          {dictado.parcial === '' ? 'Te escucho…' : dictado.parcial}
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

      <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'center' }}>
        <Pressable
          testID="boton-hablar"
          onPressIn={() => void dictado.iniciar()}
          onPressOut={dictado.detener}
          accessibilityRole="button"
          accessibilityLabel="Mantén para hablar"
          accessibilityHint="Mantén presionado, di tu gasto y suelta"
          accessibilityState={{ busy: escuchando }}
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
            {escuchando ? 'Suelta para registrar' : 'Mantén para hablar'}
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
      {esperando > 0 ? (
        <Texto variante="secundario" tono="secundario" testID="indicador-esperando-conexion">
          {mensajeEsperandoConexion(esperando)}
        </Texto>
      ) : null}
      {alMasOpciones ? (
        <Boton
          etiqueta="Registrar con formulario"
          variante="texto"
          ancho="contenido"
          alPresionar={alMasOpciones}
          testID="boton-formulario"
        />
      ) : null}
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
