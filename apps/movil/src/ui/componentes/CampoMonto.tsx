import type { Centavos } from '@cartera/core';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { anunciar } from '../anunciar';
import {
  etiquetaCampoMonto,
  formatearCentavos,
  formatearMontoTecleado,
  leerPesos,
  pistaCampoMonto,
} from '../formato';
import { Boton } from './Boton';
import { CampoTexto } from './CampoTexto';
import {
  BTN_ABRIR_AJUSTES_DICTADO,
  mensajeMontoAproximado,
  mensajeMontoNoEntendido,
  mensajeMontoOido,
  PISTA_ABRIR_AJUSTES_DICTADO,
  PISTA_CAMPO_ESCUCHANDO,
  useDictadoCampos,
  type AvisoDictadoCampo,
} from './dictado-campo';

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

/** Lo que el dictado deja en la ayuda del campo. */
type EstadoVoz =
  | { tipo: 'nada' }
  /** `texto`: lo que se va oyendo («Te escucho…», «ocho mil»), solo a la vista. */
  | { tipo: 'oyendo'; texto: string }
  /** `ajustes`: se negó el micrófono y se ofrece "Abrir Ajustes" (iOS no vuelve a preguntar). */
  | { tipo: 'mensaje'; texto: string; ajustes?: boolean };

const SIN_VOZ: EstadoVoz = { tipo: 'nada' };

const sinSigno = (c: Centavos) => formatearCentavos(c, 'auto').replace('$', '');

/** Ajustes de la app en el teléfono: con el permiso negado, iOS no vuelve a mostrar el diálogo. */
function abrirAjustes(): void {
  Linking.openSettings().catch(() => {});
}

/**
 * Campo de pesos con teclado numérico; convierte a centavos enteros sin flotantes
 * (`leerPesos`). No valida reglas de negocio: eso lo decide quien lo usa.
 *
 * Con micrófono (`BotonDictar` inyectado por `ProveedorDictado`), la cifra dicha ("ocho mil quinientos") se
 * escribe en el campo como si se hubiera tecleado y se dice qué se oyó; la voz nunca guarda sola. Mientras
 * escucha, la transcripción solo se ve: el lector no lee cifras a medias, y anuncia el resultado final (región
 * viva en Android, `anunciar` en iPhone).
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
  const dictado = useDictadoCampos();
  const conMicrofono = dictable && deshabilitado !== true && dictado !== null;

  const alOir = (frase: string) => {
    const lectura = dictado?.interpretarMonto(frase, { admiteCero }) ?? null;
    const valida =
      lectura !== null &&
      Number.isSafeInteger(lectura.centavos) &&
      (lectura.centavos > 0 || (admiteCero && lectura.centavos === 0));
    let mensaje: string;
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
  const alAviso = useCallback((aviso: AvisoDictadoCampo | null) => {
    if (aviso === null) {
      // Dejó de escuchar: se quita lo que se iba oyendo; lo que se oyó (o el error) se queda.
      setVoz((v) => (v.tipo === 'oyendo' ? SIN_VOZ : v));
    } else if (aviso.escuchando) {
      setVoz({ tipo: 'oyendo', texto: aviso.texto });
    } else {
      setVoz({ tipo: 'mensaje', texto: aviso.texto, ajustes: aviso.sinPermiso });
      anunciar(aviso.texto);
    }
  }, []);

  const invalido = texto.trim() !== '' && leerPesos(texto) === null;
  const mensajeError = error ?? (invalido ? ERROR_FORMATO_MONTO : null);
  const ayudaMostrada = voz.tipo === 'nada' ? ayuda : voz.texto;
  const pista = mensajeError ?? (voz.tipo === 'oyendo' ? PISTA_CAMPO_ESCUCHANDO : ayudaMostrada);
  const BotonDictar = conMicrofono ? dictado.BotonDictar : null;
  return (
    <CampoTexto
      etiqueta={etiqueta}
      valor={texto}
      alCambiar={(nuevo) => {
        // Miles separados mientras se teclea, igual que donde la app muestra montos («13000» → «13,000»).
        const formateado = formatearMontoTecleado(nuevo, texto);
        setTexto(formateado);
        // Al teclear, lo que se oyó deja de ser la ayuda.
        setVoz((v) => (v.tipo === 'mensaje' ? SIN_VOZ : v));
        alCambiar(leerPesos(formateado));
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
                alPresionar={abrirAjustes}
                {...(testID === undefined ? {} : { testID: `${testID}-ajustes` })}
              />
            ),
          }
        : {})}
      {...(BotonDictar
        ? {
            accesorio: (
              <BotonDictar
                etiquetaCampo={etiqueta}
                alOir={alOir}
                alAviso={alAviso}
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
