import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { etiquetaCampoMonto, formatearCentavos, leerPesos, pistaCampoMonto } from '../formato';
import { espacio } from '../tokens';
import { Boton } from './Boton';
import { CampoTexto } from './CampoTexto';
import { useDictadoCampos, type AvisoDictadoCampo } from './dictado-campo';
import { Texto } from './Texto';

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
  /** `false` para no ofrecer el micrófono (por omisión se ofrece si la app lo inyecta). */
  dictable?: boolean;
  testID?: string;
}

export const ERROR_FORMATO_MONTO = 'No entendí ese monto. Escríbelo así: 1,500.50';

const sinSigno = (centavos: Centavos) => formatearCentavos(centavos, 'auto').replace('$', '');

/** Lo que se oyó y cómo quedó: la voz nunca guarda sola, la persona lo ve y lo confirma con el formulario. */
export function textoOidoMonto(
  transcripcion: string,
  centavos: Centavos | null,
  aproximado: boolean,
): string {
  if (centavos === null)
    return `Oí «${transcripcion}». No entendí el monto; dilo así: «mil quinientos» o escríbelo.`;
  const base = `Oí «${transcripcion}»: ${formatearCentavos(centavos, 'auto')}.`;
  return aproximado ? `${base} Dijiste un aproximado; pon la cifra exacta si la sabes.` : base;
}

/**
 * Campo de pesos con teclado numérico; convierte a centavos enteros sin flotantes
 * (`leerPesos`). No valida reglas de negocio: eso lo decide quien lo usa.
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
  testID,
}: CampoMontoProps) {
  const [texto, setTexto] = useState(() => (valorInicial === null ? '' : sinSigno(valorInicial)));
  const dictado = useDictadoCampos();
  const [oido, setOido] = useState<{ mensaje: string; anterior: string | null } | null>(null);
  const [avisoDictado, setAvisoDictado] = useState<AvisoDictadoCampo | null>(null);
  const cambiar = (nuevo: string) => {
    setTexto(nuevo);
    alCambiar(leerPesos(nuevo));
  };
  const alOir = (transcripcion: string) => {
    if (!dictado) return;
    const lectura = dictado.interpretarMonto(transcripcion);
    if (lectura === null) {
      setOido({ mensaje: textoOidoMonto(transcripcion, null, false), anterior: null });
      return;
    }
    setOido({ mensaje: textoOidoMonto(transcripcion, lectura.monto, lectura.aproximado), anterior: texto });
    cambiar(sinSigno(lectura.monto));
  };
  const BotonDictar = dictado && dictable && !deshabilitado ? dictado.BotonDictar : null;
  const invalido = texto.trim() !== '' && leerPesos(texto) === null;
  const mensajeError = error ?? (invalido ? ERROR_FORMATO_MONTO : null);
  const pista = mensajeError ?? ayuda;
  const campo = (
    <CampoTexto
      etiqueta={etiqueta}
      valor={texto}
      alCambiar={(nuevo) => {
        setOido(null);
        cambiar(nuevo);
      }}
      ejemplo="0.00"
      teclado="decimal-pad"
      etiquetaAccesible={etiquetaCampoMonto(etiqueta, texto)}
      error={mensajeError}
      {...(BotonDictar
        ? {
            accesorio: (
              <BotonDictar
                etiquetaCampo={etiqueta}
                alOir={alOir}
                alAviso={setAvisoDictado}
                {...(testID === undefined ? {} : { testID: `${testID}-dictar` })}
              />
            ),
          }
        : {})}
      {...(pista === undefined ? {} : { nativo: { accessibilityHint: pistaCampoMonto(pista) } })}
      {...(ayuda === undefined ? {} : { ayuda })}
      {...(deshabilitado === undefined ? {} : { deshabilitado })}
      {...(autoFocus === undefined ? {} : { autoFocus })}
      {...(testID === undefined ? {} : { testID })}
    />
  );
  // Siempre el mismo árbol: si el campo se remontara al mostrar el aviso, se cortaría el dictado en curso.
  if (!BotonDictar && !oido) return campo;
  return (
    <View style={{ gap: espacio.xs }}>
      {campo}
      {avisoDictado ? (
        <Texto variante="secundario" tono="secundario" accessibilityLiveRegion="polite">
          {avisoDictado.texto}
        </Texto>
      ) : null}
      {avisoDictado?.sinPermiso ? (
        <Boton
          etiqueta="Abrir ajustes"
          variante="texto"
          ancho="contenido"
          pista="Abre los ajustes del teléfono para permitir el micrófono"
          alPresionar={() => void Linking.openSettings().catch(() => {})}
        />
      ) : null}
      {oido && !avisoDictado ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          {...(testID === undefined ? {} : { testID: `${testID}-oido` })}
        >
          {oido.mensaje}
        </Texto>
      ) : null}
      {oido && !avisoDictado && oido.anterior !== null ? (
        <Boton
          etiqueta="Deshacer"
          variante="texto"
          ancho="contenido"
          pista="Regresa el monto que tenías antes de dictar"
          alPresionar={() => {
            const anterior = oido.anterior ?? '';
            setOido(null);
            cambiar(anterior);
          }}
          {...(testID === undefined ? {} : { testID: `${testID}-deshacer` })}
        />
      ) : null}
    </View>
  );
}
