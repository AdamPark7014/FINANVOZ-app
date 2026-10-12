import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  etiquetaDiaMes,
  etiquetaFecha,
  marcarAvisoVisto,
  obtenerHoy,
  type Aviso,
  type ConceptoReservado,
  type VistaHoy,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, formatearCentavos, Pantalla, Tarjeta, Texto, useTema } from '../../ui';
import type { MotorDictado } from '../../voz';
import { PanelRegistrar } from './PanelRegistrar';
import { TarjetasAccion } from './TarjetasAccion';
import { encabezadoFecha } from './textos';

export interface NavegacionHoy {
  alVerMovimientos: () => void;
  alConfigurarIngreso: () => void;
  alAbrirFormulario: () => void;
  /** Consultas por voz de saldos, deudas y compromisos. */
  alVerCuentas?: () => void;
}

/** Hoy (02-UX §4): cifra principal, días al ingreso, desglose, tarjetas de acción, avisos y registro. */
export function PantallaHoy({ navegacion, motor }: { navegacion: NavegacionHoy; motor?: MotorDictado }) {
  const vista = useVista(obtenerHoy);
  const [verDesglose, setVerDesglose] = useState(false);
  return (
    <Pantalla testID="pantalla-hoy">
      <Texto variante="secundario" tono="secundario" testID="hoy-fecha">
        {encabezadoFecha(etiquetaFecha(vista.hoy), etiquetaDiaMes(vista.hoy))}
      </Texto>
      <Heroe vista={vista} alConfigurarIngreso={navegacion.alConfigurarIngreso} />
      {vista.estado !== 'sin_ingreso' ? (
        <>
          <Boton
            etiqueta={
              verDesglose
                ? 'Ocultar desglose'
                : vista.estado === 'libre_negativo'
                  ? 'Ver qué viene'
                  : 'Ver de dónde sale'
            }
            variante="texto"
            ancho="contenido"
            alPresionar={() => setVerDesglose((v) => !v)}
            testID="boton-desglose"
          />
          {verDesglose ? <Desglose vista={vista} /> : null}
        </>
      ) : null}
      <AvisosUnaVez avisos={vista.avisos} />
      <TarjetasAccion tarjetas={vista.tarjetasAccion} alVerMovimientos={navegacion.alVerMovimientos} />
      <PanelRegistrar
        alMasOpciones={navegacion.alAbrirFormulario}
        alVerMovimientos={navegacion.alVerMovimientos}
        {...(navegacion.alVerCuentas ? { alVerCuentas: navegacion.alVerCuentas } : {})}
        {...(motor ? { motor } : {})}
      />
      {/* Espacio para que el aviso inferior no tape el último botón. */}
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

function Heroe({ vista, alConfigurarIngreso }: { vista: VistaHoy; alConfigurarIngreso: () => void }) {
  if (vista.estado === 'sin_ingreso') {
    return (
      <View style={{ gap: espacio.m }}>
        <Texto variante="titulo">{vista.mensaje ?? 'Dime cada cuándo te pagan'}</Texto>
        <Texto variante="secundario" tono="secundario">
          Con eso reparto tu dinero libre hasta tu próximo pago.
        </Texto>
        <Boton
          etiqueta="Decir cada cuándo me pagan"
          alPresionar={alConfigurarIngreso}
          testID="boton-configurar-ingreso"
        />
      </View>
    );
  }
  if (vista.estado === 'libre_negativo') {
    const cuando = vista.proximoIngreso
      ? `antes del ${vista.proximoIngreso.etiqueta}`
      : 'en los próximos días';
    return (
      <View style={{ gap: espacio.xs }}>
        <Texto variante="subtitulo">Hoy:</Texto>
        <Cifra centavos={0} modo="pesos" tamano="heroe" contexto="Hoy puedes gastar" testID="hoy-puedes" />
        <Texto variante="cuerpo" tono="faltante" testID="hoy-secundario">
          {`Te faltan ${formatearCentavos(vista.faltante)} para cubrir lo que viene ${cuando}.`}
        </Texto>
      </View>
    );
  }
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto variante="subtitulo">Hoy puedes gastar</Texto>
      <Cifra
        centavos={vista.hoyPuedesCentavos}
        modo="pesos"
        tamano="heroe"
        contexto="Hoy puedes gastar"
        testID="hoy-puedes"
      />
      {(vista.textoDias ?? vista.mensaje) ? (
        <Texto variante="cuerpo" tono="secundario" testID="hoy-secundario">
          {vista.textoDias ?? vista.mensaje}
        </Texto>
      ) : null}
    </View>
  );
}

const ROTULO_RESERVADO: Record<ConceptoReservado['tipo'], string> = {
  tarjeta: 'tarjeta',
  compromiso: 'pago',
  msi: 'meses',
  persona: 'le debes',
};

function Fila({
  etiqueta,
  centavos,
  fuerte,
  testID,
}: {
  etiqueta: string;
  centavos: number;
  fuerte?: boolean;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
      <Texto variante={fuerte ? 'cuerpoFuerte' : 'cuerpo'} style={{ flex: 1 }}>
        {etiqueta}
      </Texto>
      <Cifra centavos={centavos} contexto={etiqueta} {...(testID ? { testID } : {})} />
    </View>
  );
}

/** "Efectivo y débito · Reservado (Nu, tanda, internet) · Colchón · Libre" (02-UX §4). */
function Desglose({ vista }: { vista: VistaHoy }) {
  const nombres = vista.reservadoDetalle.map((r) => r.concepto);
  return (
    <Tarjeta testID="desglose">
      <Fila etiqueta="Efectivo y débito" centavos={vista.liquidez} testID="desglose-liquidez" />
      <Fila
        etiqueta={nombres.length > 0 ? `Reservado (${nombres.join(', ')})` : 'Reservado'}
        centavos={-vista.reservado}
        testID="desglose-reservado"
      />
      {vista.reservadoDetalle.map((r, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: espacio.l }}
        >
          <Texto variante="secundario" tono="secundario" style={{ flex: 1 }}>
            {`${r.concepto} · ${ROTULO_RESERVADO[r.tipo]}${r.fecha ? ` · ${etiquetaFecha(r.fecha)}` : ''}`}
          </Texto>
          <Cifra centavos={r.monto} tamano="secundario" contexto={r.concepto} />
        </View>
      ))}
      <Fila etiqueta="Colchón" centavos={-vista.colchon} testID="desglose-colchon" />
      <Fila etiqueta="Libre" centavos={vista.libre} fuerte testID="desglose-libre" />
    </Tarjeta>
  );
}

/**
 * Avisos de una sola vez (02-UX §3.1: "Puede que esté contando dos veces tus meses…"). Al mostrarse se marcan
 * vistos; siguen en pantalla hasta que tocas "Entendido" o sales de Hoy.
 */
function AvisosUnaVez({ avisos }: { avisos: readonly Aviso[] }) {
  const { ctx } = useSesion();
  const { c } = useTema();
  const [mostrados, setMostrados] = useState<readonly Aviso[]>([]);
  const [cerrados, setCerrados] = useState<readonly string[]>([]);
  const nuevos = avisos.filter((a) => !mostrados.some((m) => m.id === a.id));
  if (nuevos.length > 0) setMostrados([...mostrados, ...nuevos]);

  useEffect(() => {
    for (const a of avisos) marcarAvisoVisto(ctx, a.id);
  }, [ctx, avisos]);

  const visibles = mostrados.filter((a) => !cerrados.includes(a.id));
  if (visibles.length === 0) return null;
  return (
    <View style={{ gap: espacio.m }}>
      {visibles.map((a) => (
        <Tarjeta key={a.id} testID="aviso-una-vez" style={{ borderColor: c.acentoTexto }}>
          <Texto variante="cuerpo">{a.texto}</Texto>
          <Boton
            etiqueta="Entendido"
            variante="texto"
            ancho="contenido"
            alPresionar={() => setCerrados((x) => [...x, a.id])}
            testID="boton-aviso-entendido"
          />
        </Tarjeta>
      ))}
    </View>
  );
}
