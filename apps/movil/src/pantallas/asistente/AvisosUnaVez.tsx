import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { marcarAvisoVisto, type Aviso } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Tarjeta, Texto, useTema } from '../../ui';
import { useAnuncio } from '../principal/ProveedorAvisos';
import { PISTA_AVISO_ENTENDIDO } from '../principal/textos';

/**
 * Avisos de una sola vez (02-UX §3.1: «Puede que esté contando dos veces tus meses…»). Al mostrarse se marcan
 * vistos; siguen en pantalla hasta que tocas «Entendido» o sales del asistente.
 */
export function AvisosUnaVez({ avisos }: { avisos: readonly Aviso[] }) {
  const { ctx } = useSesion();
  const { c } = useTema();
  const [mostrados, setMostrados] = useState<readonly Aviso[]>([]);
  const [cerrados, setCerrados] = useState<readonly string[]>([]);
  const nuevos = avisos.filter((a) => !mostrados.some((m) => m.id === a.id));
  if (nuevos.length > 0) setMostrados([...mostrados, ...nuevos]);

  useEffect(() => {
    for (const a of avisos) {
      try {
        marcarAvisoVisto(ctx, a.id);
      } catch {
        // Si no se pudo guardar, el aviso vuelve a salir la próxima vez; el asistente no se cae por eso.
      }
    }
  }, [ctx, avisos]);

  const visibles = mostrados.filter((a) => !cerrados.includes(a.id));
  // VoiceOver: el aviso nuevo se anuncia como en TalkBack (`accessibilityRole="alert"`).
  useAnuncio(visibles[0]?.texto);
  if (visibles.length === 0) return null;
  return (
    <View style={{ gap: espacio.m }}>
      {visibles.map((a) => (
        <Tarjeta key={a.id} testID="aviso-una-vez" style={{ borderColor: c.acentoTexto }}>
          <Texto variante="cuerpo" accessibilityRole="alert" accessibilityLiveRegion="polite">
            {a.texto}
          </Texto>
          <Boton
            etiqueta="Entendido"
            variante="texto"
            ancho="contenido"
            alPresionar={() => setCerrados((x) => [...x, a.id])}
            pista={PISTA_AVISO_ENTENDIDO}
            testID="boton-aviso-entendido"
          />
        </Tarjeta>
      ))}
    </View>
  );
}
