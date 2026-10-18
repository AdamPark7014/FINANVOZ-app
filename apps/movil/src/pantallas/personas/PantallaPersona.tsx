import { useState } from 'react';
import { Share, View } from 'react-native';
import type { Centavos } from '@cartera/core';
import {
  detallePersona,
  etiquetaDiaMes,
  fijarRecordatorioCobro,
  horaDispositivo,
  listarCuentas,
  listarPersonas,
  opcionesRecordatorioCobro,
  prepararCobro,
  registrarPrestamo,
  sincronizarRecordatoriosCobro,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, Cifra, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { useNotificaciones } from '../avisos/notificaciones';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { mensajeError, NOMBRE_TIPO_LIBRO } from '../principal/textos';
import { EstadoVacio } from '../principal/EstadoVacio';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { FormularioDatosCobro } from './FormularioDatosCobro';
import {
  AYUDA_PEDIR_DATOS_COBRO,
  ERROR_MONTO_MAYOR_CERO,
  ETIQUETA_A_DONDE_LLEGO,
  ETIQUETA_COBRAR,
  PISTA_COBRAR,
  ETIQUETA_GUARDAR,
  PISTA_GUARDAR_PAGO,
  ETIQUETA_GUARDAR_Y_COBRAR,
  PISTA_GUARDAR_Y_COBRAR,
  ETIQUETA_MONTO,
  ETIQUETA_QUITAR_RECORDATORIO,
  PISTA_QUITAR_RECORDATORIO,
  ETIQUETA_VOLVER,
  PISTA_VOLVER,
  ETIQUETA_YA_ME_PAGO,
  PISTA_YA_ME_PAGO,
  etiquetaSaldoPersona,
  MENSAJE_COMPARTIR_NO_DISPONIBLE,
  MENSAJE_ERROR_RECORDATORIO,
  MENSAJE_PERMISO_AVISOS,
  MENSAJE_SIN_AVISOS,
  mensajeRecordatorioCobro,
  mensajeRegistroCobro,
  etiquetaVacioMovimientosPersona,
  TEXTO_MOVIMIENTOS_PERSONA_VACIO,
  TEXTO_PERSONA_NO_ENCONTRADA,
  TIP_SALDO_TE_DEBEN,
  TITULO_MOVIMIENTOS,
  TITULO_PEDIR_DATOS_COBRO,
  TITULO_RECORDATORIO_COBRO,
  TITULO_YA_ME_PAGO,
} from './textos';

/** Abre la hoja de compartir del sistema con el mensaje (WhatsApp, SMS, lo que elijas). */
export type Compartir = (mensaje: string) => Promise<void>;

const compartirSistema: Compartir = async (mensaje) => {
  await Share.share({ message: mensaje });
};

type Panel = 'datos' | 'pago' | null;

/**
 * Detalle de una persona (`02 §17`): cuánto te debe o le debes, sus movimientos y, si te debe, **Cobrar** (arma
 * el mensaje con tus datos y abre la hoja de compartir; sin datos, primero los pide), **Ya me pagó** (registra el
 * cobro, no es ingreso) y **Recuérdame cobrar** (aviso local).
 */
export function PantallaPersona({
  personaId,
  alVolver,
  compartir = compartirSistema,
}: {
  personaId: string;
  alVolver: () => void;
  compartir?: Compartir;
}) {
  const existe = useVista((ctx) => listarPersonas(ctx).some((p) => p.cuentaId === personaId));
  if (!existe) {
    return (
      <Pantalla testID="pantalla-persona" bordes={['top', 'left', 'right', 'bottom']}>
        <Boton
          testID="persona-volver"
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          alPresionar={alVolver}
          pista={PISTA_VOLVER}
        />
        <EstadoVacio texto={TEXTO_PERSONA_NO_ENCONTRADA} testID="persona-no-encontrada" />
      </Pantalla>
    );
  }
  return <Detalle personaId={personaId} alVolver={alVolver} compartir={compartir} />;
}

function Detalle({
  personaId,
  alVolver,
  compartir,
}: {
  personaId: string;
  alVolver: () => void;
  compartir: Compartir;
}) {
  const { ctx } = useSesion();
  const d = useVista((c) => detallePersona(c, personaId));
  const avisarRegistro = useAvisoRegistro();
  const [panel, setPanel] = useState<Panel>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cobrar = async () => {
    setMensaje(null);
    const r = prepararCobro(ctx, personaId);
    if (r.resultado === 'faltan_datos') return setPanel('datos');
    if (r.resultado === 'sin_saldo') return;
    setPanel(null);
    try {
      await compartir(r.texto);
    } catch {
      setMensaje(MENSAJE_COMPARTIR_NO_DISPONIBLE);
    }
  };

  return (
    <Pantalla testID="pantalla-persona" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="persona-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista={PISTA_VOLVER}
      />
      <Texto variante="titulo" testID="persona-nombre" accessibilityRole="header">
        {d.nombre}
      </Texto>
      <Tarjeta>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
          <Texto variante="cuerpoFuerte">{etiquetaSaldoPersona(d.saldo)}</Texto>
          {d.saldo !== 0 ? (
            <Cifra
              centavos={Math.abs(d.saldo)}
              contexto={etiquetaSaldoPersona(d.saldo)}
              testID="persona-saldo"
            />
          ) : null}
        </View>
        {d.saldo > 0 ? (
          <Texto variante="secundario" tono="secundario" testID="persona-tip-te-deben">
            {TIP_SALDO_TE_DEBEN}
          </Texto>
        ) : null}
      </Tarjeta>

      {d.saldo > 0 ? (
        <View style={{ gap: espacio.s }}>
          <Boton
            etiqueta={ETIQUETA_COBRAR}
            alPresionar={() => void cobrar()}
            pista={PISTA_COBRAR}
            testID="boton-cobrar"
          />
          <Boton
            etiqueta={ETIQUETA_YA_ME_PAGO}
            variante="secundario"
            alPresionar={() => setPanel(panel === 'pago' ? null : 'pago')}
            pista={PISTA_YA_ME_PAGO}
            testID="boton-ya-me-pago"
          />
        </View>
      ) : null}

      {mensaje ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="persona-mensaje"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {mensaje}
        </Texto>
      ) : null}

      {panel === 'datos' ? (
        <Tarjeta testID="persona-pedir-datos">
          <Texto variante="subtitulo" testID="persona-pedir-datos-titulo" accessibilityRole="header">
            {TITULO_PEDIR_DATOS_COBRO}
          </Texto>
          <Texto variante="secundario" tono="secundario">
            {AYUDA_PEDIR_DATOS_COBRO}
          </Texto>
          <FormularioDatosCobro
            etiquetaGuardar={ETIQUETA_GUARDAR_Y_COBRAR}
            pistaGuardar={PISTA_GUARDAR_Y_COBRAR}
            alGuardar={() => void cobrar()}
            alCancelar={() => setPanel(null)}
          />
        </Tarjeta>
      ) : null}

      {panel === 'pago' && d.saldo > 0 ? (
        <YaMePago
          personaId={personaId}
          saldo={d.saldo}
          alTerminar={(texto, token) => {
            setPanel(null);
            avisarRegistro(texto, token);
          }}
        />
      ) : null}

      {d.saldo > 0 ? <Recordatorio personaId={personaId} fecha={d.recordatorio} /> : null}

      <View style={{ gap: espacio.s }}>
        <Texto variante="subtitulo" testID="persona-movimientos-titulo" accessibilityRole="header">
          {TITULO_MOVIMIENTOS}
        </Texto>
        {d.movimientos.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_MOVIMIENTOS_PERSONA_VACIO}
            testID="persona-movimientos-vacio"
            etiquetaAccesible={etiquetaVacioMovimientosPersona()}
          />
        ) : null}
        {d.movimientos.map((m) => (
          <Tarjeta key={m.id} testID={`persona-mov-${m.id}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
              <View style={{ flex: 1, gap: espacio.xxs }}>
                <Texto variante="cuerpoFuerte">{m.descripcion ?? NOMBRE_TIPO_LIBRO[m.tipo] ?? m.tipo}</Texto>
                <Texto variante="secundario" tono="secundario">
                  {`${NOMBRE_TIPO_LIBRO[m.tipo] ?? m.tipo} · ${etiquetaDiaMes(m.fecha)}`}
                </Texto>
              </View>
              <Cifra
                centavos={m.monto}
                contexto={m.descripcion ?? NOMBRE_TIPO_LIBRO[m.tipo] ?? m.tipo}
                testID={`persona-mov-${m.id}-saldo`}
              />
            </View>
          </Tarjeta>
        ))}
      </View>
    </Pantalla>
  );
}

/** "Ya me pagó" (`02 §17`): registra el `cobro_prestamo` a la cuenta donde llegó; no es ingreso. */
function YaMePago({
  personaId,
  saldo,
  alTerminar,
}: {
  personaId: string;
  saldo: Centavos;
  alTerminar: (mensaje: string, deshacer: string) => void;
}) {
  const { ctx } = useSesion();
  const cuentas = useVista((c) => listarCuentas(c).tienes);
  const [monto, setMonto] = useState<Centavos | null>(saldo);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const faltante =
    monto === null || monto <= 0 ? ERROR_MONTO_MAYOR_CERO : !destinoId ? ETIQUETA_A_DONDE_LLEGO : null;

  const guardar = () => {
    setIntentado(true);
    if (faltante || monto === null || !destinoId) return;
    try {
      const r = registrarPrestamo(ctx, { tipo: 'cobro_prestamo', personaId, cuentaId: destinoId, monto });
      alTerminar(mensajeRegistroCobro(monto), r.deshacer);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Tarjeta testID="persona-ya-me-pago">
      <Texto variante="subtitulo" testID="persona-ya-me-pago-titulo" accessibilityRole="header">
        {TITULO_YA_ME_PAGO}
      </Texto>
      <CampoMonto etiqueta={ETIQUETA_MONTO} valorInicial={saldo} alCambiar={setMonto} testID="pago-persona-monto" />
      <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
        {ETIQUETA_A_DONDE_LLEGO}
      </Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={destinoId}
        alCambiar={setDestinoId}
        prefijoTestID="pago-persona-destino"
        etiqueta={ETIQUETA_A_DONDE_LLEGO}
      />
      {intentado && faltante ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="persona-ya-me-pago-faltante"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {faltante}
        </Texto>
      ) : null}
      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="persona-ya-me-pago-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={ETIQUETA_GUARDAR}
        alPresionar={guardar}
        pista={PISTA_GUARDAR_PAGO}
        testID="boton-guardar-pago-persona"
      />
    </Tarjeta>
  );
}

/** "Recuérdame cobrar" (RF-PER-03): un aviso local por persona; sin nombres ni montos en la notificación. */
function Recordatorio({
  personaId,
  fecha,
}: {
  personaId: string;
  fecha: { fecha: string; etiqueta: string } | null;
}) {
  const { ctx, refrescar } = useSesion();
  const notificaciones = useNotificaciones();
  const opciones = useVista(opcionesRecordatorioCobro);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const sincronizar = async () => {
    if (notificaciones) await sincronizarRecordatoriosCobro(ctx, notificaciones.puerto, horaDispositivo());
  };

  const fijar = async (nueva: string | null) => {
    setMensaje(null);
    try {
      if (nueva !== null) {
        if (!notificaciones) return setMensaje(MENSAJE_SIN_AVISOS);
        let permiso = await notificaciones.permiso();
        if (permiso === 'sin_preguntar') permiso = await notificaciones.pedirPermiso();
        if (permiso !== 'concedido') return setMensaje(MENSAJE_PERMISO_AVISOS);
      }
      fijarRecordatorioCobro(ctx, personaId, nueva);
      await sincronizar();
      refrescar();
    } catch {
      setMensaje(MENSAJE_ERROR_RECORDATORIO);
    }
  };

  return (
    <Tarjeta testID="persona-recordatorio">
      {fecha ? (
        <>
          <Texto variante="cuerpo" testID="persona-recordatorio-fecha">
            {mensajeRecordatorioCobro(fecha.etiqueta)}
          </Texto>
          <Boton
            etiqueta={ETIQUETA_QUITAR_RECORDATORIO}
            variante="texto"
            ancho="contenido"
            alPresionar={() => void fijar(null)}
            pista={PISTA_QUITAR_RECORDATORIO}
            testID="boton-quitar-recordatorio"
          />
        </>
      ) : (
        <>
          <Texto variante="subtitulo" {...OCULTAR_ETIQUETA_VISIBLE}>
            {TITULO_RECORDATORIO_COBRO}
          </Texto>
          <GrupoChips
            opciones={opciones.map((o) => ({ valor: o.fecha, etiqueta: o.etiqueta }))}
            valor={null}
            alCambiar={(f) => void fijar(f)}
            prefijoTestID="recordatorio-cobro"
            etiqueta={TITULO_RECORDATORIO_COBRO}
          />
        </>
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono="faltante"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="persona-recordatorio-mensaje"
        >
          {mensaje}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
