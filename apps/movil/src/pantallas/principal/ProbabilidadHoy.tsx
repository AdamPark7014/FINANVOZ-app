import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  leerProbabilidadHoy,
  obtenerProbabilidadHoy,
  type OpcionesBloques,
  type VistaProbabilidadHoy,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Barra, espacio, Texto, useTema } from '../../ui';

/**
 * Probabilidad de llegar sin tocar el colchón (RF-HOY-02, `02 §4`) debajo de la cifra de Hoy. Si ya está
 * calculada para este libro se pinta al instante (`leerProbabilidadHoy`); si no, se calcula por bloques en
 * segundo plano (`obtenerProbabilidadHoy`) con un indicador discreto: la pantalla nunca espera. Al salir de Hoy
 * o al cambiar el libro, el cálculo en curso se cancela.
 */
export function ProbabilidadHoy({ bloques }: { bloques?: Omit<OpcionesBloques, 'senal'> }) {
  const { ctx, version } = useSesion();
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

  if (!vista) {
    return (
      <View
        testID="probabilidad-calculando"
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}
      >
        <ActivityIndicator size="small" color={c.textoSecundario} />
        <Texto variante="secundario" tono="secundario">
          Calculando si llegas…
        </Texto>
      </View>
    );
  }
  if (vista.estado === 'sin_ingreso') return null;
  if (vista.estado === 'datos_insuficientes') {
    return (
      <Texto variante="secundario" tono="secundario" testID="probabilidad-mensaje">
        {vista.mensaje}
      </Texto>
    );
  }
  return (
    <View style={{ gap: espacio.xs }} testID="probabilidad-hoy">
      <Barra
        llenoBp={Math.round(vista.probabilidad * 10000)}
        etiquetaAccesible={vista.texto}
        testID="probabilidad-barra"
      />
      <Texto variante="secundario" testID="probabilidad-texto">
        {vista.texto}
      </Texto>
      {vista.etiqueta ? (
        <Texto variante="secundario" tono="secundario" testID="probabilidad-etiqueta">
          {vista.etiqueta}
        </Texto>
      ) : null}
    </View>
  );
}
