import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { registrarTexto, type OrigenDictado, type ResultadoTexto } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, OBJETIVO_TACTIL_MIN, radio, Texto, tipo, useTema } from '../../ui';
import { MENSAJES_DICTADO, useDictado, type MotorDictado } from '../../voz';
import { ConfirmacionRegistro } from './ConfirmacionRegistro';
import { MENSAJE_NO_ENTENDI, MENSAJE_POR_INTERPRETAR, mensajeRegistrado } from './textos';
import { useAvisoRegistro } from './useAvisoRegistro';

type Confirmar = Extract<ResultadoTexto, { resultado: 'confirmar' }>;

/**
 * Registrar hablando o escribiendo (02-UX §5): "Mantén para hablar" con transcripción en vivo y "Escribir".
 * Completo y seguro → se guarda y aparece "Deshacer"; necesita confirmación → tarjeta con chips; fuera del
 * nivel 0 → queda "por revisar"; "¿cuánto puedo gastar?" → Hoy.
 */
export function PanelRegistrar({
  alConsultarHoy,
  alMasOpciones,
  motor,
  abiertoAlInicio = false,
}: {
  /** "¿Cuánto puedo gastar hoy?": lleva a Hoy (o no hace nada si ya estás ahí). */
  alConsultarHoy?: () => void;
  /** Abre el formulario completo de movimiento. */
  alMasOpciones?: () => void;
  /** Reconocedor de voz inyectable (pruebas). */
  motor?: MotorDictado;
  abiertoAlInicio?: boolean;
}) {
  const { ctx, refrescar } = useSesion();
  const { c } = useTema();
  const avisarRegistro = useAvisoRegistro();
  const [escribiendo, setEscribiendo] = useState(abiertoAlInicio);
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ datos: Confirmar; origen: OrigenDictado } | null>(null);

  const enviar = (frase: string, origen: OrigenDictado) => {
    const limpio = frase.trim();
    if (limpio === '') return;
    setMensaje(null);
    setConfirmar(null);
    let r: ResultadoTexto;
    try {
      r = registrarTexto(ctx, limpio, origen);
    } catch {
      setMensaje(MENSAJE_NO_ENTENDI);
      return;
    }
    switch (r.resultado) {
      case 'registrado':
        setTexto('');
        avisarRegistro(mensajeRegistrado(r.movimientos), r.deshacer);
        return;
      case 'confirmar':
        setConfirmar({ datos: r, origen });
        return;
      case 'por_interpretar':
        setTexto('');
        setMensaje(MENSAJE_POR_INTERPRETAR);
        refrescar();
        return;
      case 'consulta':
        setTexto('');
        alConsultarHoy?.();
        return;
    }
  };

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
      {confirmar ? (
        <ConfirmacionRegistro
          propuestas={confirmar.datos.propuestas}
          motivo={confirmar.datos.motivo}
          origen={confirmar.origen}
          alGuardar={(r) => {
            setConfirmar(null);
            setTexto('');
            avisarRegistro(mensajeRegistrado(r.movimientos), r.deshacer);
          }}
          alCancelar={() => setConfirmar(null)}
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
