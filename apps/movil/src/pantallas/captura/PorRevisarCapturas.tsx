import { useState } from 'react';
import { View } from 'react-native';
import { useCaptura } from '../../captura/ProveedorCaptura';
import {
  confirmarCaptura,
  etiquetaDiaMes,
  fueAMeses,
  listarCapturasPorRevisar,
  listarCategorias,
  marcarNoReconocidaRevisada,
  obtenerEstadoCaptura,
  type CapturaPorRevisar,
} from '../../servicios';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, EstadoVacio, Tarjeta, Texto } from '../../ui';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { mensajeCompraMsi } from '../tarjetas/textos';
import {
  AVISO_SIN_TEXTO,
  ETIQUETA_SIN_CATEGORIA,
  INTRO_CAPTURAS_POR_REVISAR,
  etiquetaMesesChip,
  etiquetaVacioCapturasPorRevisar,
  MESES_CAPTURA,
  TEXTO_CAPTURAS_POR_REVISAR_VACIO,
  TITULO_CAPTURAS_POR_REVISAR,
  TITULO_SIN_COMERCIO,
} from './textos';

const MOTIVO: Record<CapturaPorRevisar['motivos'][number], string> = {
  fue_a_meses: '¿Fue a meses?',
  sin_categoria: '¿Qué fue?',
  ingreso: '¿De qué es este dinero?',
  cobro: '¿Es un pago que te debían?',
  disposicion: 'Sacaste efectivo con tu tarjeta de crédito: suele cobrar comisión e intereses.',
  pregunta_24h: 'No supe a dónde fue este dinero.',
  no_reconocida: 'Llegó un aviso que no entendí.',
};

/**
 * Movimientos → "Por revisar" de las capturas (`02 §6`): confirmar o cambiar la categoría, "¿Fue a meses?" y las
 * notificaciones no reconocidas (su texto, guardado 30 días en el teléfono) con "Ya la registré".
 */
export function PorRevisarCapturas({ alRegistrar }: { alRegistrar: () => void }) {
  const { catalogo } = useCaptura();
  const { ctx } = useSesion();
  const lista = useVista((v) => listarCapturasPorRevisar(v, catalogo));
  const capturaActiva = obtenerEstadoCaptura(ctx).activada;

  if (lista.length === 0) {
    if (!capturaActiva) return null;
    return (
      <View style={{ gap: espacio.s }} testID="capturas-por-revisar">
        <Texto variante="subtitulo" accessibilityRole="header">
          {TITULO_CAPTURAS_POR_REVISAR}
        </Texto>
        <Texto variante="cuerpo" tono="secundario" testID="capturas-por-revisar-vacio">
          {TEXTO_CAPTURAS_POR_REVISAR_VACIO}
        </Texto>
      </View>
    );
  }

  return (
    <View style={{ gap: espacio.s }} testID="capturas-por-revisar">
      <Texto variante="subtitulo" accessibilityRole="header">
        {TITULO_CAPTURAS_POR_REVISAR}
      </Texto>
      <Texto variante="secundario" tono="secundario">
        {INTRO_CAPTURAS_POR_REVISAR}
      </Texto>
      {lista.map((c) => (
        <FilaCaptura key={c.capturaId} c={c} alRegistrar={alRegistrar} />
      ))}
    </View>
  );
}

function FilaCaptura({ c, alRegistrar }: { c: CapturaPorRevisar; alRegistrar: () => void }) {
  const { ctx, refrescar } = useSesion();
  const registrarEvento = useAnalitica();
  const mostrar = useMostrarAviso();
  const avisarRegistro = useAvisoRegistro();
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const testID = `captura-${c.capturaId}`;
  const ingreso = c.motivos.includes('ingreso') || c.motivos.includes('cobro');
  const categorias = useVista((x) => listarCategorias(x, ingreso ? 'ingreso' : 'gasto'));
  const nombreCategoria = categorias.find((k) => k.slug === c.categoria)?.nombre ?? null;

  const hacer = (accion: () => void, mensaje: string) => {
    setError(null);
    try {
      accion();
      refrescar();
      mostrar({ mensaje });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (c.motivos[0] === 'no_reconocida') {
    const texto = [c.texto?.titulo, c.texto?.texto].filter((t) => t).join(' · ');
    return (
      <Tarjeta testID={testID}>
        <Texto variante="cuerpoFuerte">{`${c.banco} mandó un aviso que no entendí`}</Texto>
        {texto ? (
          <Texto variante="cuerpo">{`«${texto}»`}</Texto>
        ) : (
          <Texto variante="secundario" tono="secundario">
            {AVISO_SIN_TEXTO}
          </Texto>
        )}
        <Texto variante="secundario" tono="secundario">
          {`${etiquetaDiaMes(c.fecha)} · si fue un movimiento, regístralo tú.`}
        </Texto>
        <View style={{ gap: espacio.s }}>
          <Boton
            etiqueta="Registrarlo"
            variante="secundario"
            alPresionar={() => {
              marcarNoReconocidaRevisada(ctx, c.capturaId);
              refrescar();
              alRegistrar();
            }}
            testID={`${testID}-registrar`}
          />
          <Boton
            etiqueta="Ya lo registré"
            variante="texto"
            alPresionar={() =>
              hacer(() => marcarNoReconocidaRevisada(ctx, c.capturaId), 'Listo, lo quité de la lista.')
            }
            testID={`${testID}-ya`}
          />
          <Boton
            etiqueta="Descartar"
            variante="texto"
            alPresionar={() =>
              hacer(() => marcarNoReconocidaRevisada(ctx, c.capturaId), 'Listo, lo descarté.')
            }
            testID={`${testID}-descartar`}
          />
        </View>
      </Tarjeta>
    );
  }

  const titulo = c.comercio ?? c.banco ?? TITULO_SIN_COMERCIO;
  const subtitulo = [c.cuenta, nombreCategoria ?? ETIQUETA_SIN_CATEGORIA, etiquetaDiaMes(c.fecha)]
    .filter((x) => x)
    .join(' · ');
  const preguntaCategoria = c.motivos.includes('sin_categoria') || cambiando;

  return (
    <Tarjeta testID={testID}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{titulo}</Texto>
          <Texto variante="secundario" tono="secundario">
            {subtitulo}
          </Texto>
        </View>
        {c.monto !== null ? <Cifra centavos={c.monto} contexto={titulo} /> : null}
      </View>
      {c.motivos.map((m) => (
        <Texto
          key={m}
          variante="secundario"
          {...(m === 'fue_a_meses' || (m === 'sin_categoria' && preguntaCategoria)
            ? OCULTAR_ETIQUETA_VISIBLE
            : {})}
        >
          {MOTIVO[m]}
        </Texto>
      ))}
      {c.motivos.includes('fue_a_meses') ? (
        <GrupoChips
          opciones={MESES_CAPTURA.map((n) => ({ valor: n as string, etiqueta: etiquetaMesesChip(n) }))}
          valor={null}
          alCambiar={(n) => {
            setError(null);
            try {
              const r = fueAMeses(ctx, c.capturaId, Number(n));
              avisarRegistro(mensajeCompraMsi(r), r.deshacer);
            } catch (e) {
              setError(mensajeError(e));
            }
          }}
          prefijoTestID={`${testID}-meses`}
          etiqueta={MOTIVO.fue_a_meses}
        />
      ) : null}
      {preguntaCategoria ? (
        <GrupoChips
          opciones={categorias.map((k) => ({ valor: k.slug, etiqueta: k.nombre }))}
          valor={c.categoria}
          alCambiar={(slug) =>
            hacer(() => {
              confirmarCaptura(ctx, c.capturaId, slug);
              // Corrección = cambiar la categoría que la captura ya había puesto; elegir una que faltaba no lo es.
              if (c.categoria !== null && slug !== c.categoria) {
                registrarEvento({ nombre: 'correccion', propiedades: { campo: 'categoria' } });
              }
            }, 'Listo. La próxima vez lo pongo así.')
          }
          prefijoTestID={`${testID}-categoria`}
          etiqueta={MOTIVO.sin_categoria}
        />
      ) : null}
      <View style={{ gap: espacio.s }}>
        {!c.motivos.includes('sin_categoria') ? (
          <Boton
            etiqueta={c.motivos.includes('fue_a_meses') ? 'No, fue de contado' : 'Está bien así'}
            alPresionar={() => hacer(() => confirmarCaptura(ctx, c.capturaId), 'Listo, revisado.')}
            testID={`${testID}-confirmar`}
          />
        ) : null}
        {!preguntaCategoria ? (
          <Boton
            etiqueta="Cambiar categoría"
            variante="texto"
            alPresionar={() => setCambiando(true)}
            testID={`${testID}-cambiar`}
          />
        ) : null}
      </View>
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
