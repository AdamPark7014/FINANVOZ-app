import type { Centavos } from '@cartera/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
// Archivos sueltos de voz/ (no su índice) para no cerrar un ciclo ui ⇄ voz.
import {
  BTN_ABRIR_AJUSTES_DICTADO,
  etiquetaMicrofonoCampo,
  MENSAJES_DICTADO_CAMPO,
  mensajeMontoAproximado,
  mensajeMontoNoEntendido,
  mensajeMontoOido,
  PISTA_ABRIR_AJUSTES_DICTADO,
  PISTA_CAMPO_ESCUCHANDO,
  PISTA_MICROFONO_CAMPO,
  textoOyendoCampo,
} from '../../voz/textos';
import { useDictador, type LectorMonto } from '../../voz/ProveedorDictado';
import { abrirAjustesDictado, useMicrofono } from '../../voz/useMicrofono';
import { anunciar } from '../anunciar';
import { etiquetaCampoMonto, formatearCentavos, leerPesos, pistaCampoMonto } from '../formato';
import { Boton } from './Boton';
import { BotonMicrofono } from './BotonMicrofono';
import { CampoTexto } from './CampoTexto';

export interface CampoMontoProps {
  etiqueta: string;
  /** Valor inicial en centavos; `null` = vacío. */
  valorInicial?: Centavos | null;
  /** Se llama en cada cambio con los centavos leídos, o `null` si está vacío o no es válido. */
  alCambiar: (centavos: Centavos | null) => void;
  ayuda?: string;
  /** Error del formulario (p. ej. "Escribe un monto mayor a $0"). */
  error?: string | null;
  deshabilitado?: boolean;
  autoFocus?: boolean;
  /**
   * Micrófono para decir la cifra (encendido por omisión). Solo aparece con `ProveedorDictado` arriba y si
   * el teléfono reconoce voz; la voz es alternativa, nunca la única vía (02-UX §15).
   */
  dictable?: boolean;
  /** $0 es una respuesta válida al dictar ("no debo nada"). */
  admiteCero?: boolean;
  testID?: string;
}

export const ERROR_FORMATO_MONTO = 'No entendí ese monto. Escríbelo así: 1,500.50';

type LecturaMonto = ReturnType<LectorMonto>;

/** Lo que el dictado deja en la ayuda del campo. */
type EstadoVoz =
  | { tipo: 'nada' }
  | { tipo: 'oyendo'; parcial: string }
  /** `ajustes`: se negó el micrófono y se ofrece "Abrir Ajustes" (iOS no vuelve a preguntar). */
  | { tipo: 'mensaje'; texto: string; ajustes?: boolean };

const SIN_VOZ: EstadoVoz = { tipo: 'nada' };

const sinSigno = (c: Centavos) => formatearCentavos(c, 'auto').replace('$', '');

/**
 * Campo de pesos con teclado numérico; convierte a centavos enteros sin flotantes
 * (`leerPesos`). No valida reglas de negocio: eso lo decide quien lo usa.
 *
 * Con micrófono, la cifra dicha ("ocho mil quinientos") se escribe en el campo como si se hubiera tecleado y
 * se dice qué se oyó. Mientras escucha, la transcripción solo se ve: el lector no lee cifras a medias, y
 * anuncia el resultado final (región viva en Android, `anunciar` en iPhone).
 */
export function CampoMonto({
  etiqueta,
  valorInicial = null,
  alCambiar,
  ayuda,
  error,
  deshabilitado,
  autoFocus,
  dictable = true,
  admiteCero = false,
  testID,
}: CampoMontoProps) {
  // No controlado: quien necesita reiniciarlo lo vuelve a montar con `key`; lo dictado se escribe aquí mismo.
  const [texto, setTexto] = useState(() => (valorInicial === null ? '' : sinSigno(valorInicial)));
  const [voz, setVoz] = useState<EstadoVoz>(SIN_VOZ);
  const dictador = useDictador();
  const reconoce = useMemo(() => dictador?.motor.disponible() ?? false, [dictador]);
  const conMicrofono = dictable && deshabilitado !== true && dictador !== null && reconoce;

  const alDictar = (frase: string, lectura: LecturaMonto) => {
    let mensaje: string;
    const valida =
      lectura !== null &&
      Number.isSafeInteger(lectura.centavos) &&
      (lectura.centavos > 0 || (admiteCero && lectura.centavos === 0));
    if (lectura === null || !valida) {
      mensaje = mensajeMontoNoEntendido(frase);
    } else {
      const centavos = lectura.centavos;
      setTexto(sinSigno(centavos));
      alCambiar(centavos);
      mensaje = lectura.aproximado
        ? mensajeMontoAproximado(frase)
        : mensajeMontoOido(frase, formatearCentavos(centavos, 'auto'));
    }
    setVoz({ tipo: 'mensaje', texto: mensaje });
    anunciar(pistaCampoMonto(mensaje));
  };
  const alOir = useCallback((parcial: string | null) => {
    setVoz((v) => (parcial !== null ? { tipo: 'oyendo', parcial } : v.tipo === 'oyendo' ? SIN_VOZ : v));
  }, []);
  const alAvisoVoz = useCallback((aviso: string, sinPermiso: boolean) => {
    setVoz({ tipo: 'mensaje', texto: aviso, ajustes: sinPermiso });
    anunciar(aviso);
  }, []);

  const invalido = texto.trim() !== '' && leerPesos(texto) === null;
  const mensajeError = error ?? (invalido ? ERROR_FORMATO_MONTO : null);
  const ayudaMostrada =
    voz.tipo === 'oyendo' ? textoOyendoCampo(voz.parcial) : voz.tipo === 'mensaje' ? voz.texto : ayuda;
  const pista = mensajeError ?? (voz.tipo === 'oyendo' ? PISTA_CAMPO_ESCUCHANDO : ayudaMostrada);
  return (
    <CampoTexto
      etiqueta={etiqueta}
      valor={texto}
      alCambiar={(nuevo) => {
        setTexto(nuevo);
        // Al teclear, lo que se oyó deja de ser la ayuda.
        setVoz((v) => (v.tipo === 'mensaje' ? SIN_VOZ : v));
        alCambiar(leerPesos(nuevo));
      }}
      ejemplo="0.00"
      teclado="decimal-pad"
      etiquetaAccesible={etiquetaCampoMonto(etiqueta, texto)}
      error={mensajeError}
      {...(pista === undefined ? {} : { nativo: { accessibilityHint: pistaCampoMonto(pista) } })}
      {...(ayudaMostrada === undefined ? {} : { ayuda: ayudaMostrada })}
      ayudaViva={voz.tipo === 'mensaje'}
      {...(voz.tipo === 'mensaje' && voz.ajustes === true
        ? {
            acciones: (
              <Boton
                etiqueta={BTN_ABRIR_AJUSTES_DICTADO}
                variante="texto"
                ancho="contenido"
                pista={PISTA_ABRIR_AJUSTES_DICTADO}
                alPresionar={abrirAjustesDictado}
                {...(testID === undefined ? {} : { testID: `${testID}-ajustes` })}
              />
            ),
          }
        : {})}
      {...(conMicrofono
        ? {
            accesorio: (
              <MicrofonoMonto
                etiqueta={etiqueta}
                admiteCero={admiteCero}
                alDictar={alDictar}
                alOir={alOir}
                alAviso={alAvisoVoz}
                {...(testID === undefined ? {} : { testID: `${testID}-microfono` })}
              />
            ),
          }
        : {})}
      {...(deshabilitado === undefined ? {} : { deshabilitado })}
      {...(autoFocus === undefined ? {} : { autoFocus })}
      {...(testID === undefined ? {} : { testID })}
    />
  );
}

/** El micrófono del campo; solo se monta si se ve (el hook se suscribe al reconocedor). */
function MicrofonoMonto({
  etiqueta,
  admiteCero,
  alDictar,
  alOir,
  alAviso,
  testID,
}: {
  etiqueta: string;
  admiteCero: boolean;
  alDictar: (frase: string, lectura: LecturaMonto) => void;
  /** Lo que se va oyendo; `null` al dejar de escuchar. */
  alOir: (parcial: string | null) => void;
  alAviso: (aviso: string, sinPermiso: boolean) => void;
  testID?: string;
}) {
  const dictador = useDictador();
  const mic = useMicrofono({
    mensajes: MENSAJES_DICTADO_CAMPO,
    alTerminar: (frase) => alDictar(frase, dictador ? dictador.leerMonto(frase, { admiteCero }) : null),
  });
  const { escuchando, parcial, aviso, sinPermiso } = mic;
  useEffect(() => {
    alOir(escuchando ? parcial : null);
  }, [alOir, escuchando, parcial]);
  useEffect(() => () => alOir(null), [alOir]);
  useEffect(() => {
    if (aviso !== null) alAviso(aviso, sinPermiso);
  }, [alAviso, aviso, sinPermiso]);
  if (!mic.disponible) return null;
  return (
    <BotonMicrofono
      forma="icono"
      escuchando={escuchando}
      boton={mic.boton}
      etiqueta={etiquetaMicrofonoCampo(etiqueta)}
      pista={PISTA_MICROFONO_CAMPO}
      {...(testID === undefined ? {} : { testID })}
    />
  );
}
