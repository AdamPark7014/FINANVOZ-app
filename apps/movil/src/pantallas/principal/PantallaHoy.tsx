import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  etiquetaDiaMes,
  etiquetaFecha,
  funcionesPlan,
  marcarAvisoVisto,
  obtenerHoy,
  type Aviso,
  type ConceptoReservado,
  type ConsultaMeAlcanza,
  type FiltroMovimientos,
  type OpcionesBloques,
  type VistaHoy,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Boton,
  Cifra,
  cifraEnPalabras,
  espacio,
  formatearCentavos,
  Pantalla,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { useReservarEspacioAviso } from '../../ui/componentes/Aviso';
import type { MotorDictado } from '../../voz';
import { InvitacionAvisos } from '../avisos/InvitacionAvisos';
import { CandadoPlus } from '../plan/CandadoPlus';
import { OCULTAR_ETIQUETA_VISIBLE } from './Chip';
import { PanelRegistrar } from './PanelRegistrar';
import { ProbabilidadHoy } from './ProbabilidadHoy';
import { TarjetasAccion } from './TarjetasAccion';
import {
  CONTEXTO_CIFRA_HOY_PUEDES,
  CONTEXTO_CIFRA_LIBRE_NEGATIVO,
  encabezadoFecha,
  etiquetaTarjetaDelDia,
  SUBTITULO_SIN_INGRESO,
  TITULO_HOY_LIBRE_NEGATIVO,
  TITULO_HOY_PUEDES_GASTAR,
  TITULO_SIN_INGRESO,
  TITULO_TARJETA_DEL_DIA,
  PISTA_AVISO_ENTENDIDO,
  PISTA_CONFIGURAR_INGRESO_HOY,
  PISTA_CONTAR_EFECTIVO,
  PISTA_ME_ALCANZA_HOY,
  PISTA_OCULTAR_DESGLOSE,
  PISTA_VER_DESGLOSE,
  PISTA_VER_QUE_VIENE,
} from './textos';

export interface NavegacionHoy {
  /** Movimientos; con filtro desde "Ver movimientos" de una consulta (`06 §6`). */
  alVerMovimientos: (filtro?: FiltroMovimientos) => void;
  /** Detalle de un movimiento recién registrado (aviso "Registré…", `02 §5`). */
  alVerMovimiento?: (transaccionId: string) => void;
  alConfigurarIngreso: () => void;
  alAbrirFormulario: () => void;
  /** Arqueo de efectivo (`02 §7`): desde la tarjeta de Hoy, la insignia o "traigo 300". */
  alAbrirArqueo?: (efectivoReal?: number) => void;
  /** "¿Me alcanza?" (`02 §9`): con el botón de Hoy (sin consulta) o diciendo "¿me alcanza para…?". */
  alAbrirMeAlcanza?: (consulta?: ConsultaMeAlcanza) => void;
}

/** Hoy (02-UX §4): cifra principal, días al ingreso, desglose, tarjetas de acción, avisos y registro. */
export function PantallaHoy({
  navegacion,
  motor,
  bloques,
}: {
  navegacion: NavegacionHoy;
  motor?: MotorDictado;
  /** Opciones del cálculo por bloques de la probabilidad (pruebas). */
  bloques?: Omit<OpcionesBloques, 'senal'>;
}) {
  const vista = useVista(obtenerHoy);
  const plus = useVista(funcionesPlan);
  const [verDesglose, setVerDesglose] = useState(false);
  // "Hablar" y "Escribir" van fijos al pie (sobre las pestañas): el aviso de "Deshacer" sube para no taparlos.
  const [altoPie, setAltoPie] = useState(0);
  useReservarEspacioAviso(altoPie);
  return (
    <Pantalla
      testID="pantalla-hoy"
      pie={
        <View
          onLayout={(e) => setAltoPie(Math.round(e.nativeEvent.layout.height) + 2 * espacio.m)}
          testID="hoy-pie-registrar"
        >
          <PanelRegistrar
            fijo
            alMasOpciones={navegacion.alAbrirFormulario}
            alVerMovimientos={(filtro) => navegacion.alVerMovimientos(filtro)}
            {...(navegacion.alVerMovimiento ? { alVerMovimiento: navegacion.alVerMovimiento } : {})}
            {...(navegacion.alAbrirArqueo ? { alArqueo: navegacion.alAbrirArqueo } : {})}
            {...(navegacion.alAbrirMeAlcanza ? { alMeAlcanza: navegacion.alAbrirMeAlcanza } : {})}
            {...(motor ? { motor } : {})}
          />
        </View>
      }
    >
      <Texto variante="secundario" tono="secundario" testID="hoy-fecha">
        {encabezadoFecha(etiquetaFecha(vista.hoy), etiquetaDiaMes(vista.hoy))}
      </Texto>
      <Heroe vista={vista} alConfigurarIngreso={navegacion.alConfigurarIngreso} />
      {vista.estado !== 'sin_ingreso' ? (
        <>
          {/* Plus (`02 §4`): en Gratis, un candado discreto en lugar de la probabilidad. */}
          {plus.probabilidad ? (
            <ProbabilidadHoy {...(bloques ? { bloques } : {})} />
          ) : (
            <CandadoPlus texto="Ver probabilidad" testID="candado-probabilidad" />
          )}
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
            pista={
              verDesglose
                ? PISTA_OCULTAR_DESGLOSE
                : vista.estado === 'libre_negativo'
                  ? PISTA_VER_QUE_VIENE
                  : PISTA_VER_DESGLOSE
            }
            testID="boton-desglose"
          />
          {verDesglose ? <Desglose vista={vista} /> : null}
        </>
      ) : null}
      {vista.efectivoMenosPreciso ? (
        <Tarjeta testID="efectivo-menos-preciso">
          <Texto variante="secundario">
            Tu efectivo es menos preciso: hace más de una semana que no lo cuentas.
          </Texto>
          {navegacion.alAbrirArqueo ? (
            <Boton
              etiqueta="Contar mi efectivo"
              variante="texto"
              ancho="contenido"
              alPresionar={() => navegacion.alAbrirArqueo?.()}
              pista={PISTA_CONTAR_EFECTIVO}
              testID="boton-contar-efectivo"
            />
          ) : null}
        </Tarjeta>
      ) : null}
      <AvisosUnaVez avisos={vista.avisos} />
      <TarjetasAccion
        tarjetas={vista.tarjetasAccion}
        alVerMovimientos={() => navegacion.alVerMovimientos()}
        {...(navegacion.alAbrirArqueo ? { alAbrirArqueo: () => navegacion.alAbrirArqueo?.() } : {})}
      />
      {plus.tarjetaDelDia && vista.tarjetaDelDia ? (
        <Tarjeta testID="tarjeta-del-dia">
          <Texto variante="etiqueta" tono="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
            {TITULO_TARJETA_DEL_DIA}
          </Texto>
          <Texto
            variante="cuerpo"
            testID="tarjeta-del-dia-texto"
            accessibilityLabel={etiquetaTarjetaDelDia(vista.tarjetaDelDia.texto)}
          >
            {vista.tarjetaDelDia.texto}
          </Texto>
        </Tarjeta>
      ) : null}
      <InvitacionAvisos />
      {navegacion.alAbrirMeAlcanza ? (
        <Boton
          etiqueta="¿Me alcanza?"
          variante="secundario"
          pista={PISTA_ME_ALCANZA_HOY}
          alPresionar={() => navegacion.alAbrirMeAlcanza?.()}
          testID="boton-me-alcanza"
        />
      ) : null}
      {/* Espacio para que el aviso inferior (encima del pie) no tape el último botón. */}
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

function Heroe({ vista, alConfigurarIngreso }: { vista: VistaHoy; alConfigurarIngreso: () => void }) {
  if (vista.estado === 'sin_ingreso') {
    return (
      <View style={{ gap: espacio.m }} testID="hoy-sin-ingreso">
        <Texto variante="titulo" testID="hoy-sin-ingreso-titulo">
          {vista.mensaje ?? TITULO_SIN_INGRESO}
        </Texto>
        <Texto variante="secundario" tono="secundario" testID="hoy-sin-ingreso-subtitulo">
          {SUBTITULO_SIN_INGRESO}
        </Texto>
        <Boton
          etiqueta="Decir cada cuándo me pagan"
          alPresionar={alConfigurarIngreso}
          pista={PISTA_CONFIGURAR_INGRESO_HOY}
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
        <Texto variante="subtitulo" testID="hoy-libre-negativo-etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
          {TITULO_HOY_LIBRE_NEGATIVO}
        </Texto>
        <Cifra
          centavos={0}
          modo="pesos"
          tamano="heroe"
          contexto={CONTEXTO_CIFRA_LIBRE_NEGATIVO}
          testID="hoy-puedes"
        />
        <Texto variante="cuerpo" tono="faltante" testID="hoy-secundario">
          {`Te faltan ${formatearCentavos(vista.faltante)} para cubrir lo que viene ${cuando}.`}
        </Texto>
      </View>
    );
  }
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto variante="subtitulo" testID="hoy-puedes-etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
        {TITULO_HOY_PUEDES_GASTAR}
      </Texto>
      <Cifra
        centavos={vista.hoyPuedesCentavos}
        modo="pesos"
        tamano="heroe"
        contexto={CONTEXTO_CIFRA_HOY_PUEDES}
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
    <FilaCifra etiqueta={etiqueta} centavos={centavos}>
      <Texto variante={fuerte ? 'cuerpoFuerte' : 'cuerpo'} style={ESTILO_CONCEPTO}>
        {etiqueta}
      </Texto>
      <Cifra centavos={centavos} contexto={etiqueta} {...(testID ? { testID } : {})} />
    </FilaCifra>
  );
}

const ESTILO_CONCEPTO = { flexGrow: 1, flexShrink: 1 } as const;

/**
 * Concepto y monto como un solo elemento de TalkBack ("Libre: ochocientos cincuenta y seis pesos"). Con texto
 * grande (200 %) la cifra baja de renglón en vez de apretarse: la fila envuelve y la cifra no se encoge.
 */
function FilaCifra({
  etiqueta,
  centavos,
  sangria = false,
  children,
}: {
  etiqueta: string;
  centavos: number;
  sangria?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${cifraEnPalabras(centavos)}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        columnGap: espacio.s,
        ...(sangria ? { paddingLeft: espacio.l } : {}),
      }}
    >
      {children}
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
      {vista.reservadoDetalle.map((r, i) => {
        const concepto = `${r.concepto} · ${ROTULO_RESERVADO[r.tipo]}${r.fecha ? ` · ${etiquetaFecha(r.fecha)}` : ''}`;
        return (
          <FilaCifra key={i} etiqueta={concepto} centavos={r.monto} sangria>
            <Texto variante="secundario" tono="secundario" style={ESTILO_CONCEPTO}>
              {concepto}
            </Texto>
            <Cifra centavos={r.monto} tamano="secundario" contexto={r.concepto} />
          </FilaCifra>
        );
      })}
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
