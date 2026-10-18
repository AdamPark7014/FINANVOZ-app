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
import { Boton, CampoMonto, Cifra, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { useNotificaciones } from '../avisos/notificaciones';
import { GrupoChips } from '../principal/Chip';
import { mensajeError, NOMBRE_TIPO_LIBRO } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { FormularioDatosCobro } from './FormularioDatosCobro';
import {
  etiquetaSaldoPersona,
  MENSAJE_COMPARTIR_NO_DISPONIBLE,
  TEXTO_MOVIMIENTOS_PERSONA_VACIO,
  TEXTO_PERSONA_NO_ENCONTRADA,
} from './textos';

/** Abre la hoja de compartir del sistema con el mensaje (WhatsApp, SMS, lo que elijas). */
export type Compartir = (mensaje: string) => Promise<void>;

const compartirSistema: Compartir = async (mensaje) => {
  await Share.share({ message: mensaje });
};

const MENSAJE_SIN_AVISOS = 'No puedo programar avisos en este teléfono.';
const MENSAJE_PERMISO_AVISOS = 'Activa los avisos en los ajustes de tu teléfono para que te lo recuerde.';

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
        <Boton etiqueta="Volver" variante="texto" ancho="contenido" alPresionar={alVolver} />
        <Texto variante="cuerpo" tono="secundario" testID="persona-no-encontrada">
          {TEXTO_PERSONA_NO_ENCONTRADA}
        </Texto>
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
        etiqueta="Volver"
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
      />
      <Texto variante="titulo" testID="persona-nombre">
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
          <Texto variante="secundario" tono="secundario">
            Lo que te deben no cuenta como dinero libre hasta que te paguen.
          </Texto>
        ) : null}
      </Tarjeta>

      {d.saldo > 0 ? (
        <View style={{ gap: espacio.s }}>
          <Boton etiqueta="Cobrar" alPresionar={() => void cobrar()} testID="boton-cobrar" />
          <Boton
            etiqueta="Ya me pagó"
            variante="secundario"
            alPresionar={() => setPanel(panel === 'pago' ? null : 'pago')}
            testID="boton-ya-me-pago"
          />
        </View>
      ) : null}

      {mensaje ? (
        <Texto variante="secundario" tono="faltante" testID="persona-mensaje">
          {mensaje}
        </Texto>
      ) : null}

      {panel === 'datos' ? (
        <Tarjeta testID="persona-pedir-datos">
          <Texto variante="subtitulo">¿A dónde te pagan?</Texto>
          <Texto variante="secundario" tono="secundario">
            Para cobrar, primero dime tus datos. Solo te los pido una vez.
          </Texto>
          <FormularioDatosCobro
            etiquetaGuardar="Guardar y cobrar"
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
        <Texto variante="subtitulo">{TITULO_MOVIMIENTOS}</Texto>
        {d.movimientos.length === 0 ? (
          <Texto variante="cuerpo" tono="secundario" testID="persona-movimientos-vacio">
            {TEXTO_MOVIMIENTOS_PERSONA_VACIO}
          </Texto>
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
              <Cifra centavos={m.monto} contexto={m.descripcion ?? NOMBRE_TIPO_LIBRO[m.tipo] ?? m.tipo} />
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
      <Texto variante="subtitulo">{TITULO_YA_ME_PAGO}</Texto>
      <CampoMonto etiqueta={ETIQUETA_MONTO} valorInicial={saldo} alCambiar={setMonto} testID="pago-persona-monto" />
      <Texto variante="etiqueta">{ETIQUETA_A_DONDE_LLEGO}</Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={destinoId}
        alCambiar={setDestinoId}
        prefijoTestID="pago-persona-destino"
      />
      {intentado && faltante ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {faltante}
        </Texto>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar" alPresionar={guardar} testID="boton-guardar-pago-persona" />
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
      setMensaje('No pude programar el aviso. Intenta de nuevo.');
    }
  };

  return (
    <Tarjeta testID="persona-recordatorio">
      {fecha ? (
        <>
          <Texto variante="cuerpo" testID="persona-recordatorio-fecha">
            {`Te recuerdo cobrar el ${fecha.etiqueta}.`}
          </Texto>
          <Boton
            etiqueta="Quitar recordatorio"
            variante="texto"
            ancho="contenido"
            alPresionar={() => void fijar(null)}
            testID="boton-quitar-recordatorio"
          />
        </>
      ) : (
        <>
          <Texto variante="subtitulo">¿Te recuerdo cobrar?</Texto>
          <GrupoChips
            opciones={opciones.map((o) => ({ valor: o.fecha, etiqueta: o.etiqueta }))}
            valor={null}
            alCambiar={(f) => void fijar(f)}
            prefijoTestID="recordatorio-cobro"
          />
        </>
      )}
      {mensaje ? (
        <Texto variante="secundario" tono="faltante" testID="persona-recordatorio-mensaje">
          {mensaje}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
