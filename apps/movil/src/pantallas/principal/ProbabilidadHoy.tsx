import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  horaDispositivo,
  leerProbabilidadHoy,
  obtenerProbabilidadHoy,
  sincronizarAvisoRiesgo,
  type OpcionesBloques,
  type VistaProbabilidadHoy,
} from '../../servicios';
import { UMBRAL_RIESGO } from '../../avisos/riesgo';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Barra, espacio, Tarjeta, Texto, useTema } from '../../ui';
import { OCULTAR_ETIQUETA_VISIBLE } from './Chip';
import {
  ETIQUETA_PROBABILIDAD_CALCULANDO,
  etiquetaAvisoRiesgo,
  FRASE_MARCA_PROBABILIDAD,
  TEXTO_AVISO_RIESGO_HOY,
} from './textos';
import { useNotificaciones } from '../avisos/notificaciones';

export { TEXTO_RIESGO } from './textos';

/** TalkBack: la barra lleva el dato, la marca del 50 % y la etiqueta; el pie visible queda oculto. */
export function etiquetaAccesibleProbabilidad(texto: string, etiqueta: string | null): string {
  const base = etiqueta ? `${texto}. ${etiqueta}` : texto;
  return `${base}. ${FRASE_MARCA_PROBABILIDAD}`;
}

/**
 * Probabilidad de llegar sin tocar el colchón (RF-HOY-02, `02 §4`) debajo de la cifra de Hoy. Si ya está
 * calculada para este libro se pinta al instante (`leerProbabilidadHoy`); si no, se calcula por bloques en
 * segundo plano (`obtenerProbabilidadHoy`) con un indicador discreto: la pantalla nunca espera. Al salir de Hoy
 * o al cambiar el libro, el cálculo en curso se cancela.
 */
export function ProbabilidadHoy({
  bloques,
  hora = horaDispositivo,
}: {
  bloques?: Omit<OpcionesBloques, 'senal'>;
  /** Hora local para programar el aviso de riesgo (pruebas). */
  hora?: () => string;
}) {
  const { ctx, version } = useSesion();
  const notificaciones = useNotificaciones();
  const { c } = useTema();
  const leida = useVista(leerProbabilidadHoy);
  const [calculada, setCalculada] = useState<{ version: number; vista: VistaProbabilidadHoy } | null>(null);

  useEffect(() => {
    if (leida) return;
    const senal = { aborted: false };
    obtenerProbabilidadHoy(ctx, { ...bloques, senal })
      .then((vista) => {
        if (!senal.aborted) setCalculada({ version, vista });
      })
      // Cancelado o fallido: Hoy sigue sin probabilidad (sin detalle en logs, regla 9).
      .catch(() => undefined);
    return () => {
      senal.aborted = true;
    };
    // `bloques` solo se inyecta en pruebas; no reinicia el cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, version, leida]);

  const vista = leida ?? (calculada?.version === version ? calculada.vista : null);
  const lista = vista !== null;

  // Con la probabilidad de hoy lista, replanea el aviso local de riesgo (1 por horizonte). Sin permiso, nada.
  useEffect(() => {
    if (!lista || !notificaciones) return;
    let vigente = true;
    notificaciones
      .permiso()
      .then((p) =>
        vigente && p === 'concedido' ? sincronizarAvisoRiesgo(ctx, notificaciones.puerto, hora()) : null,
      )
      // Sin detalle (regla 9): se reintenta con el siguiente cálculo.
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [ctx, version, lista, notificaciones, hora]);

  if (!vista) {
    return (
      <View
        accessible
        testID="probabilidad-calculando"
        accessibilityLiveRegion="polite"
        accessibilityLabel={ETIQUETA_PROBABILIDAD_CALCULANDO}
        style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}
      >
        <ActivityIndicator size="small" color={c.textoSecundario} importantForAccessibility="no" />
        <Texto variante="secundario" tono="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
          {ETIQUETA_PROBABILIDAD_CALCULANDO}
        </Texto>
      </View>
    );
  }
  if (vista.estado === 'sin_ingreso') return null;
  if (vista.estado === 'datos_insuficientes') {
    return (
      <Texto
        variante="secundario"
        tono="secundario"
        testID="probabilidad-mensaje"
        accessibilityLiveRegion="polite"
      >
        {vista.mensaje}
      </Texto>
    );
  }
  const hablado = etiquetaAccesibleProbabilidad(vista.texto, vista.etiqueta);
  return (
    <View style={{ gap: espacio.xs }} testID="probabilidad-hoy">
      <Barra
        llenoBp={Math.round(vista.probabilidad * 10000)}
        marcaBp={UMBRAL_RIESGO * 100}
        etiquetaAccesible={hablado}
        testID="probabilidad-barra"
      />
      <Texto variante="secundario" testID="probabilidad-texto" importantForAccessibility="no">
        {vista.texto}
      </Texto>
      {vista.etiqueta ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID="probabilidad-etiqueta"
          importantForAccessibility="no"
        >
          {vista.etiqueta}
        </Texto>
      ) : null}
      {vista.riesgo ? (
        <Tarjeta testID="aviso-riesgo">
          <Texto
            variante="secundario"
            tono="faltante"
            testID="aviso-riesgo-texto"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            importantForAccessibility="yes"
            accessibilityLabel={etiquetaAvisoRiesgo()}
          >
            {TEXTO_AVISO_RIESGO_HOY}
          </Texto>
        </Tarjeta>
      ) : null}
    </View>
  );
}
