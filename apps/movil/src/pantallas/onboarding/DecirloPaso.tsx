import { interpretarPaso, type ContextoPaso, type LecturaPaso, type Paso } from '@cartera/nlu';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Linking, View } from 'react-native';
import { leerConfirmacion, useConfirmacionPorVoz } from '../../asistente/confirmacion-voz';
import {
  anunciar,
  Boton,
  espacio,
  etiquetaHablada,
  Tarjeta,
  TarjetaEntendi,
  Texto,
  useDictadoCampos,
  type AvisoDictadoCampo,
  type PropuestaEntendi,
} from '../../ui';
import { useVozAsistente } from '../../voz';
import { combinarLecturas, resumenEntendi } from './decirlo';
import {
  ejemploDecirlo,
  ERROR_GUARDAR_DICHO,
  pistaConfirmarVoz,
  textoCorreccionNoEntendida,
  textoDijiste,
  textoLlenado,
  textoNoEntendido,
  TEXTO_ESPERO_SI_PASO,
  TITULO_DECIRLO,
} from './textos';

export { TITULO_DECIRLO, textoNoEntendido } from './textos';

/** La tarjeta «Entendí» de un paso, con lo que dice la pantalla cuando «Sí» termina sin cambiar de pantalla. */
export interface PropuestaDecirlo extends PropuestaEntendi {
  /** «Listo: agregué BBVA.» Sin cifras: se muestra y se anuncia. */
  readonly hecho?: string;
}

export interface HerramientasDecirlo {
  /** Lo que se oyó (ya se mostró como «Dijiste…»); nunca va a logs. */
  readonly oido: string;
  /** Una fila tocada cambia la lectura y la tarjeta se vuelve a armar. */
  readonly actualizar: (lectura: LecturaPaso) => void;
}

interface PropsDecirlo {
  /** Pasos que se intentan, en orden: O4 lee cuentas y, si no, una tarjeta de crédito. */
  pasos: readonly Paso[];
  /** Frase de ejemplo, sin comillas: «gano 13 mil cada quincena». */
  ejemplo: string;
  contexto: ContextoPaso;
  /**
   * Arma la tarjeta con lo leído y lo que ya tiene la pantalla; `null` si la lectura no sirve aquí. Se llama en cada
   * render: las acciones ven el estado vigente de la pantalla.
   */
  proponer: (lectura: LecturaPaso, h: HerramientasDecirlo) => PropuestaDecirlo | null;
  /** Ejemplo de corrección para la pista: «no, son 12 mil». */
  correccion?: string;
  testID: string;
}

/** Solo llena campos, sin tarjeta: el «O dímelo» de `FormularioPagoFijo` en Cuentas › «Agregar pago fijo». */
interface PropsDecirloCampos<T> {
  ejemplo: string;
  interpretar: (texto: string) => T | null;
  alEntender: (resultado: T) => void;
  testID: string;
}

/**
 * «Dímelo» de un paso del onboarding (Ola 7 §7, maqueta «Onboarding por voz»): toca el micrófono, di el paso
 * completo y vuelve la tarjeta «Entendí» con lo que se leyó (`interpretarPaso`, nivel 0, sin red). La pantalla
 * decide qué hace «Sí» (guardar o llenar el formulario) y «Cambiar algo» (llenar el formulario). Con la tarjeta a
 * la vista, el micrófono acepta «sí», «no» o una corrección («no, son 12 mil»): al aparecer la tarjeta, la voz la
 * dice y, al terminar, el micrófono escucha **un** turno solo (`useConfirmacionPorVoz`, Ajustes › Voz «Confirmar por
 * voz»); cualquier toque deja de escuchar y calla la voz. Si no se entiende, una línea honesta y el formulario sigue
 * ahí. Sin dictado en el teléfono no aparece. Lo oído nunca va a logs (regla 9).
 */
export function DecirloPaso(props: PropsDecirlo): ReactElement | null;
/** Forma corta: lo leído llena los campos con `alEntender` y la persona revisa (sin «Entendí»). */
export function DecirloPaso<T>(props: PropsDecirloCampos<T>): ReactElement | null;
export function DecirloPaso<T>(props: PropsDecirlo | PropsDecirloCampos<T>): ReactElement | null {
  return 'interpretar' in props ? <DecirloCampos {...props} /> : <DecirloConEntendi {...props} />;
}

type Estado =
  | { tipo: 'nada' }
  | { tipo: 'no_entendi'; texto: string }
  | { tipo: 'entendi'; oido: string; lectura: LecturaPaso; nota: string | null }
  | { tipo: 'hecho'; texto: string };

const NADA: Estado = { tipo: 'nada' };

function DecirloConEntendi({ pasos, ejemplo, contexto, proponer, correccion, testID }: PropsDecirlo) {
  const dictado = useDictadoCampos();
  const [aviso, setAviso] = useState<AvisoDictadoCampo | null>(null);
  const [estado, setEstado] = useState<Estado>(NADA);
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const voz = useVozAsistente();
  /**
   * Escucha del «sí» tras decir la tarjeta: `clave` sube con cada «Entendí» nuevo (vuelve a escuchar un turno);
   * `null` mientras habla, tras contestar o tras un toque.
   */
  const [escucha, setEscucha] = useState<number | null>(null);
  const turnoVoz = useRef(0);

  const actualizar = useCallback((lectura: LecturaPaso) => {
    setEstado((e) => (e.tipo === 'entendi' ? { ...e, lectura, nota: null } : e));
  }, []);

  const terminar = useCallback((hecho?: string) => {
    setEstado(hecho ? { tipo: 'hecho', texto: hecho } : NADA);
    if (hecho) anunciar(hecho);
  }, []);

  const base = estado.tipo === 'entendi' ? proponer(estado.lectura, { oido: estado.oido, actualizar }) : null;
  const propuesta: PropuestaEntendi | null = base && {
    ...base,
    confirmar: {
      ...base.confirmar,
      accion: async () => {
        await base.confirmar.accion();
        terminar(base.hecho);
      },
    },
    ...(base.cambiar
      ? {
          cambiar: {
            etiqueta: base.cambiar.etiqueta,
            accion: async () => {
              terminar();
              await base.cambiar?.accion();
            },
          },
        }
      : {}),
    ...(correccion ? { pista: pistaConfirmarVoz(correccion) } : {}),
  };

  /** Primera lectura que la pantalla acepta, de los pasos en orden. */
  const leer = (texto: string): LecturaPaso | null => {
    for (const paso of pasos) {
      const l = interpretarPaso(paso, texto, contexto);
      if (l && proponer(l, { oido: texto, actualizar })) return l;
    }
    return null;
  };

  const mostrar = (oido: string, lectura: LecturaPaso) => {
    setEstado({ tipo: 'entendi', oido, lectura, nota: null });
    const p = proponer(lectura, { oido, actualizar });
    if (!p) return;
    anunciar(etiquetaHablada(resumenEntendi(p)));
    // La voz dice la tarjeta y, solo al terminar (no se graba a sí misma), se escucha un turno para el «sí».
    const turno = ++turnoVoz.current;
    setEscucha(null);
    const turnoEntendi = { de: 'asistente', clase: 'entendi', propuesta: p } as const;
    void voz.decirTurno(turnoEntendi).then((fin) => {
      if (fin !== 'cortada' && turnoVoz.current === turno) setEscucha(turno);
    });
  };

  /** Un toque (en la tarjeta, el micrófono o el formulario del paso) deja de escuchar y calla la voz. */
  const dejarDeEscuchar = () => {
    turnoVoz.current++;
    setEscucha(null);
  };

  const alOir = (oido: string) => {
    setErrorVoz(null);
    if (estado.tipo === 'entendi' && propuesta) {
      const c = leerConfirmacion(oido);
      if (c?.tipo === 'si') {
        // «Sí» inactivo (falta algo): un «sí» dicho no lo dispara.
        if (propuesta.confirmar.deshabilitado) return;
        void Promise.resolve()
          .then(() => propuesta.confirmar.accion())
          .catch(() => setErrorVoz(ERROR_GUARDAR_DICHO));
        return;
      }
      if (c?.tipo === 'no') {
        if (propuesta.cambiar) void propuesta.cambiar.accion();
        else terminar();
        return;
      }
      // Una corrección del mismo paso se junta con lo que ya estaba; una frase de otro paso empieza de nuevo.
      const texto = c?.tipo === 'cambio' ? c.texto : oido;
      const nueva = interpretarPaso(estado.lectura.paso, texto, contexto);
      const junta = nueva ? combinarLecturas(estado.lectura, nueva) : null;
      if (junta && proponer(junta, { oido, actualizar })) {
        mostrar(oido, junta);
        return;
      }
      const otra = leer(oido);
      if (otra) {
        mostrar(oido, otra);
        return;
      }
      setEstado({ ...estado, nota: textoCorreccionNoEntendida(oido) });
      return;
    }
    const lectura = leer(oido);
    if (lectura) mostrar(oido, lectura);
    else setEstado({ tipo: 'no_entendi', texto: textoNoEntendido(oido) });
  };
  // El micrófono puede guardar el callback del momento en que empezó a escuchar: siempre llama al vigente.
  const alOirVigente = useRef(alOir);
  useEffect(() => {
    alOirVigente.current = alOir;
  });
  const alOirEstable = useCallback((oido: string) => alOirVigente.current(oido), []);

  // Lo que se oye en ese turno se lee igual que lo dicho con el micrófono: «sí», «no» o una corrección.
  const porVoz = useConfirmacionPorVoz({
    activo: escucha !== null && estado.tipo === 'entendi' && propuesta !== null,
    clave: escucha ?? 0,
    alSi: () => {
      setEscucha(null);
      alOirVigente.current('sí');
    },
    alNo: () => {
      setEscucha(null);
      alOirVigente.current('no');
    },
    alCambio: ({ texto }) => {
      setEscucha(null);
      alOirVigente.current(texto);
    },
    alOtro: (texto) => {
      setEscucha(null);
      alOirVigente.current(texto);
    },
  });
  const cancelarEscucha = porVoz.cancelar;
  const alTocar = () => {
    if (escucha === null && !voz.hablando) return;
    cancelarEscucha();
    voz.callar();
    dejarDeEscuchar();
  };

  if (!dictado) return null;
  const { BotonDictar } = dictado;
  const linea =
    estado.tipo === 'entendi'
      ? (estado.nota ?? textoDijiste(estado.oido))
      : estado.tipo === 'no_entendi' || estado.tipo === 'hecho'
        ? estado.texto
        : null;
  return (
    <View style={{ gap: espacio.l }} testID={testID} onTouchStart={alTocar}>
      <Tarjeta style={{ gap: espacio.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.l }}>
          <View style={{ flex: 1, gap: espacio.s }}>
            <Texto variante="subtitulo">{TITULO_DECIRLO}</Texto>
            <Texto variante="secundario" tono="secundario">
              {ejemploDecirlo(ejemplo)}
            </Texto>
          </View>
          <BotonDictar
            etiquetaCampo="este paso"
            dicta="frase"
            testID={`${testID}-dictar`}
            alAviso={setAviso}
            alOir={alOirEstable}
          />
        </View>
        {aviso ? (
          <Texto variante="secundario" tono="secundario" accessibilityLiveRegion="polite">
            {aviso.texto}
          </Texto>
        ) : porVoz.escuchando ? (
          <Texto
            variante="secundario"
            tono="secundario"
            accessibilityLiveRegion="polite"
            testID={`${testID}-escuchando`}
          >
            {TEXTO_ESPERO_SI_PASO}
          </Texto>
        ) : linea ? (
          <Texto
            variante="secundario"
            tono="secundario"
            accessibilityLiveRegion="polite"
            // TalkBack lee la tarjeta completa al aparecer (VoiceOver la oye con `anunciar`).
            {...(propuesta && estado.tipo === 'entendi' && estado.nota === null
              ? { accessibilityLabel: etiquetaHablada(`${linea} ${resumenEntendi(propuesta)}`) }
              : {})}
            testID={`${testID}-resultado`}
          >
            {linea}
          </Texto>
        ) : null}
        {aviso?.sinPermiso ? <BotonAbrirAjustes /> : null}
      </Tarjeta>
      {propuesta ? (
        <TarjetaEntendi
          propuesta={propuesta}
          testID={`${testID}-entendi`}
          mensajeError={ERROR_GUARDAR_DICHO}
        />
      ) : null}
      {errorVoz ? (
        <Texto variante="secundario" tono="faltante" accessibilityRole="alert" testID={`${testID}-error`}>
          {errorVoz}
        </Texto>
      ) : null}
    </View>
  );
}

function BotonAbrirAjustes() {
  return (
    <Boton
      etiqueta="Abrir ajustes"
      variante="texto"
      ancho="contenido"
      pista="Abre los ajustes del teléfono para permitir el micrófono"
      alPresionar={() => void Linking.openSettings().catch(() => {})}
    />
  );
}

/** «O dímelo» que solo llena los campos de un formulario (sin tarjeta «Entendí»). */
function DecirloCampos<T>({ ejemplo, interpretar, alEntender, testID }: PropsDecirloCampos<T>) {
  const dictado = useDictadoCampos();
  const [aviso, setAviso] = useState<AvisoDictadoCampo | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  if (!dictado) return null;
  const { BotonDictar } = dictado;
  return (
    <Tarjeta testID={testID} style={{ gap: espacio.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.l }}>
        <View style={{ flex: 1, gap: espacio.s }}>
          <Texto variante="subtitulo">{TITULO_DECIRLO}</Texto>
          <Texto variante="secundario" tono="secundario">
            {ejemploDecirlo(ejemplo)}
          </Texto>
        </View>
        <BotonDictar
          etiquetaCampo="este paso"
          dicta="frase"
          testID={`${testID}-dictar`}
          alAviso={setAviso}
          alOir={(oido) => {
            const r = interpretar(oido);
            if (r === null) {
              setResultado(textoNoEntendido(oido));
              return;
            }
            alEntender(r);
            setResultado(textoLlenado(oido));
          }}
        />
      </View>
      {aviso ? (
        <Texto variante="secundario" tono="secundario" accessibilityLiveRegion="polite">
          {aviso.texto}
        </Texto>
      ) : resultado ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID={`${testID}-resultado`}
        >
          {resultado}
        </Texto>
      ) : null}
      {aviso?.sinPermiso ? <BotonAbrirAjustes /> : null}
    </Tarjeta>
  );
}
