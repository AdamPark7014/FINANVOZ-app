import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  borrarCuentaRespaldo,
  fijarRespaldoAutomatico,
  obtenerRespaldoNube,
  respaldarEnNube,
  tieneContrasenaRespaldo,
  type NubeRespaldo,
} from '../../servicios';
import { useControlApp } from '../../sesion/ControlApp';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, Interruptor, Tarjeta, Texto } from '../../ui';
import { FlujoCorreo } from './FlujoCorreo';
import { FormularioContrasena } from './FormularioContrasena';
import { TarjetaRespaldo } from './TarjetaRespaldo';
import {
  ACCESIBILIDAD_VOLVER,
  AVISO_BORRAR_CUENTA,
  AVISO_PENDIENTE,
  BTN_BORRAR_CUENTA,
  BTN_BORRAR_CUENTA_CONFIRMAR,
  BTN_CANCELAR,
  BTN_RESPALDAR_AHORA,
  DESC_RESPALDO_AUTOMATICO,
  DESC_SOLO_WIFI,
  ETIQUETA_RESPALDO_AUTOMATICO,
  ETIQUETA_SOLO_WIFI,
  ETIQUETA_VOLVER,
  MENSAJE_BORRAR_CUENTA_OK,
  MENSAJE_CONTRASENA_GUARDADA,
  MENSAJE_CORREO_CUENTA_OK,
  MENSAJE_LISTO_NUBE,
  MENSAJE_NO_GUARDAR_AJUSTE,
  PISTA_BORRAR_CUENTA,
  PISTA_VOLVER,
  SUBTITULO_NUBE,
  TEXTO_ACTIVAR_NUBE,
  TEXTO_SESION_VENCIDA,
  TITULO_RESPALDO,
  mensajeErrorNube,
  textoCrearContrasenaTrasCorreo,
  textoRespaldasCon,
} from './textos';

/**
 * Ajustes → Respaldo (`02 §19`, RF-RES-01…04): último respaldo, "Respaldar ahora", respaldo automático semanal
 * con Wi-Fi, cuenta de respaldo (correo → código → contraseña), borrar la cuenta y, abajo, exportar el archivo,
 * cambiar la contraseña y restaurar.
 */
export function PantallaRespaldo({
  alVolver,
  alRestaurar,
}: {
  alVolver: () => void;
  alRestaurar: () => void;
}) {
  const nube = useControlApp().respaldo?.nube ?? null;
  // La contraseña se puede crear en cualquiera de las dos tarjetas: cada una relee la otra al cambiar.
  const [desdeNube, setDesdeNube] = useState(0);
  const [desdeArchivo, setDesdeArchivo] = useState(0);
  return (
    <>
      <Boton
        testID="respaldo-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        etiquetaAccesible={ACCESIBILIDAD_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={alVolver}
      />
      <Texto variante="titulo">{TITULO_RESPALDO}</Texto>
      {nube ? (
        <TarjetaNube
          nube={nube}
          generacion={desdeArchivo}
          alCrearContrasena={() => setDesdeNube((n) => n + 1)}
        />
      ) : null}
      <TarjetaRespaldo
        key={desdeNube}
        alRestaurar={alRestaurar}
        alCambiarContrasena={() => setDesdeArchivo((n) => n + 1)}
      />
    </>
  );
}

type EstadoCuenta = { tipo: 'cargando' } | { tipo: 'sin_correo' } | { tipo: 'con_correo'; correo: string };

function estadoCuenta(claims: { conCorreo: boolean; correo: string | null } | null): EstadoCuenta {
  return claims?.conCorreo && claims.correo
    ? { tipo: 'con_correo', correo: claims.correo }
    : { tipo: 'sin_correo' };
}

function TarjetaNube({
  nube,
  generacion,
  alCrearContrasena,
}: {
  nube: NubeRespaldo;
  /** Sube cuando la tarjeta del archivo crea o cambia la contraseña. */
  generacion: number;
  alCrearContrasena: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const control = useControlApp();
  const { reidentificar } = usePlanTienda();
  const vista = useVista(obtenerRespaldoNube);
  const deps = control.respaldo?.deps;
  const [cuenta, setCuenta] = useState<EstadoCuenta>({ tipo: 'cargando' });
  const [creada, setCreada] = useState(0);
  const conContrasena = useMemo(() => {
    try {
      return deps ? tieneContrasenaRespaldo(deps) : false;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `generacion` y `creada` fuerzan la relectura
  }, [deps, generacion, creada]);
  const [respaldando, setRespaldando] = useState(false);
  const [borrando, setBorrando] = useState<'no' | 'confirmar' | 'borrando'>('no');
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const leerCuenta = useCallback(async () => {
    setCuenta(estadoCuenta(await nube.cuenta.estado().catch(() => null)));
  }, [nube]);

  useEffect(() => {
    let vigente = true;
    nube.cuenta
      .estado()
      .catch(() => null)
      .then((claims) => vigente && setCuenta(estadoCuenta(claims)))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [nube]);

  const respaldar = async () => {
    if (!deps) return;
    setMensaje(null);
    setRespaldando(true);
    try {
      const r = await respaldarEnNube({ cifrado: deps, respaldos: nube.respaldos }, ctx);
      setMensaje(
        r.ok
          ? { texto: MENSAJE_LISTO_NUBE, error: false }
          : { texto: mensajeErrorNube(r.error), error: true },
      );
      refrescar();
      // Si la nube pidió el correo, la sesión ya no es de correo: se vuelve a leer para pedirlo.
      if (!r.ok) await leerCuenta();
    } finally {
      setRespaldando(false);
    }
  };

  const borrar = async () => {
    setMensaje(null);
    setBorrando('borrando');
    const r = await borrarCuentaRespaldo(nube, ctx);
    if (!r.ok) {
      setBorrando('confirmar');
      setMensaje({ texto: mensajeErrorNube(r.error), error: true });
      return;
    }
    setBorrando('no');
    refrescar();
    // El usuario del proxy cambió (anónimo nuevo): las compras de Plus pasan a él (pendiente 58).
    await reidentificar();
    await leerCuenta();
    setMensaje({ texto: MENSAJE_BORRAR_CUENTA_OK, error: false });
  };

  const fijar = (cambios: Parameters<typeof fijarRespaldoAutomatico>[1]) => {
    try {
      fijarRespaldoAutomatico(ctx, cambios);
      refrescar();
    } catch {
      setMensaje({ texto: MENSAJE_NO_GUARDAR_AJUSTE, error: true });
    }
  };

  const pedirCorreo = cuenta.tipo === 'sin_correo' || vista.pedirCorreo;

  return (
    <Tarjeta testID="respaldo-nube">
      <Texto variante="subtitulo">{SUBTITULO_NUBE}</Texto>
      <Texto variante="cuerpo" testID="respaldo-ultimo">
        {vista.textoUltimo}
      </Texto>
      {vista.pendiente ? (
        <Texto variante="secundario" tono="faltante" testID="respaldo-pendiente">
          {AVISO_PENDIENTE}
        </Texto>
      ) : null}
      {cuenta.tipo === 'cargando' ? null : pedirCorreo ? (
        <>
          <Texto variante="secundario" tono="secundario" testID="respaldo-pide-correo">
            {vista.pedirCorreo && cuenta.tipo === 'sin_correo' ? TEXTO_SESION_VENCIDA : TEXTO_ACTIVAR_NUBE}
          </Texto>
          <FlujoCorreo
            cuenta={nube.cuenta}
            alConfirmar={(r) => {
              if (r.cambioUsuario) void reidentificar();
              void leerCuenta();
              setMensaje({ texto: MENSAJE_CORREO_CUENTA_OK, error: false });
            }}
          />
        </>
      ) : !conContrasena && deps ? (
        <>
          <Texto variante="secundario" tono="secundario">
            {cuenta.tipo === 'con_correo' ? textoCrearContrasenaTrasCorreo(cuenta.correo) : TEXTO_ACTIVAR_NUBE}
          </Texto>
          <FormularioContrasena
            deps={deps}
            cambiando={false}
            alGuardar={() => {
              setCreada((n) => n + 1);
              alCrearContrasena();
              setMensaje({ texto: MENSAJE_CONTRASENA_GUARDADA, error: false });
            }}
            alCancelar={() => setMensaje(null)}
          />
        </>
      ) : (
        <>
          <Texto variante="secundario" tono="secundario" testID="respaldo-correo-actual">
            {cuenta.tipo === 'con_correo' ? textoRespaldasCon(cuenta.correo) : ''}
          </Texto>
          <Boton
            testID="respaldo-ahora"
            etiqueta={BTN_RESPALDAR_AHORA}
            cargando={respaldando}
            deshabilitado={respaldando || borrando !== 'no'}
            alPresionar={() => void respaldar()}
          />
          <Interruptor
            testID="respaldo-automatico"
            etiqueta={ETIQUETA_RESPALDO_AUTOMATICO}
            descripcion={DESC_RESPALDO_AUTOMATICO}
            valor={vista.automatico}
            alCambiar={(automatico) => fijar({ automatico })}
          />
          {vista.automatico ? (
            <Interruptor
              testID="respaldo-solo-wifi"
              etiqueta={ETIQUETA_SOLO_WIFI}
              descripcion={DESC_SOLO_WIFI}
              valor={vista.soloWifi}
              alCambiar={(soloWifi) => fijar({ soloWifi })}
            />
          ) : null}
          {borrando === 'no' ? (
            <Boton
              testID="respaldo-borrar-cuenta"
              variante="texto"
              ancho="contenido"
              etiqueta={BTN_BORRAR_CUENTA}
              pista={PISTA_BORRAR_CUENTA}
              alPresionar={() => {
                setMensaje(null);
                setBorrando('confirmar');
              }}
            />
          ) : (
            <>
              <Texto variante="cuerpo" tono="faltante" testID="respaldo-borrar-aviso">
                {AVISO_BORRAR_CUENTA}
              </Texto>
              <Boton
                testID="respaldo-borrar-confirmar"
                variante="secundario"
                etiqueta={BTN_BORRAR_CUENTA_CONFIRMAR}
                cargando={borrando === 'borrando'}
                deshabilitado={borrando === 'borrando'}
                alPresionar={() => void borrar()}
              />
              <Boton
                variante="texto"
                etiqueta={BTN_CANCELAR}
                deshabilitado={borrando === 'borrando'}
                alPresionar={() => setBorrando('no')}
              />
            </>
          )}
        </>
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono={mensaje.error ? 'faltante' : 'secundario'}
          accessibilityLiveRegion="polite"
          testID="respaldo-mensaje"
        >
          {mensaje.texto}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
