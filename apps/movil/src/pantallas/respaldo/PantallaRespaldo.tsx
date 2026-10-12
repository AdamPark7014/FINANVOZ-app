import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  borrarCuentaRespaldo,
  fijarRespaldoAutomatico,
  mensajeErrorNube,
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
        etiqueta="Volver"
        alPresionar={alVolver}
      />
      <Texto variante="titulo">Respaldo</Texto>
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
          ? { texto: 'Listo: tu respaldo está en la nube.', error: false }
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
    setMensaje({ texto: 'Listo: borré tu cuenta de respaldo y tus respaldos de la nube.', error: false });
  };

  const fijar = (cambios: Parameters<typeof fijarRespaldoAutomatico>[1]) => {
    try {
      fijarRespaldoAutomatico(ctx, cambios);
      refrescar();
    } catch {
      setMensaje({ texto: 'No pude guardar el cambio. Intenta de nuevo.', error: true });
    }
  };

  const pedirCorreo = cuenta.tipo === 'sin_correo' || vista.pedirCorreo;

  return (
    <Tarjeta testID="respaldo-nube">
      <Texto variante="subtitulo">En la nube</Texto>
      <Texto variante="cuerpo" testID="respaldo-ultimo">
        {vista.textoUltimo}
      </Texto>
      {vista.pendiente ? (
        <Texto variante="secundario" tono="faltante" testID="respaldo-pendiente">
          Llevas más de 2 semanas sin respaldo.
        </Texto>
      ) : null}
      {cuenta.tipo === 'cargando' ? null : pedirCorreo ? (
        <>
          <Texto variante="secundario" tono="secundario" testID="respaldo-pide-correo">
            {vista.pedirCorreo && cuenta.tipo === 'sin_correo'
              ? 'Tu sesión de respaldo venció. Vuelve a entrar con tu correo y el código para seguir respaldando.'
              : 'Guarda tu respaldo cifrado en la nube con tu correo. Te mando un código para confirmarlo.'}
          </Texto>
          <FlujoCorreo
            cuenta={nube.cuenta}
            alConfirmar={(r) => {
              if (r.cambioUsuario) void reidentificar();
              void leerCuenta();
              setMensaje({ texto: 'Listo: tu correo quedó como cuenta de respaldo.', error: false });
            }}
          />
        </>
      ) : !conContrasena && deps ? (
        <>
          <Texto variante="secundario" tono="secundario">
            {`Respaldas con ${cuenta.tipo === 'con_correo' ? cuenta.correo : ''}. Ahora crea la contraseña que cifra tus respaldos.`}
          </Texto>
          <FormularioContrasena
            deps={deps}
            cambiando={false}
            alGuardar={() => {
              setCreada((n) => n + 1);
              alCrearContrasena();
              setMensaje({ texto: 'Listo: guardé tu contraseña de respaldo.', error: false });
            }}
            alCancelar={() => setMensaje(null)}
          />
        </>
      ) : (
        <>
          <Texto variante="secundario" tono="secundario" testID="respaldo-correo-actual">
            {`Respaldas con ${cuenta.tipo === 'con_correo' ? cuenta.correo : ''}.`}
          </Texto>
          <Boton
            testID="respaldo-ahora"
            etiqueta="Respaldar ahora"
            cargando={respaldando}
            deshabilitado={respaldando || borrando !== 'no'}
            alPresionar={() => void respaldar()}
          />
          <Interruptor
            testID="respaldo-automatico"
            etiqueta="Respaldo automático"
            descripcion="Cada semana, aunque no abras la app. No te pido la contraseña."
            valor={vista.automatico}
            alCambiar={(automatico) => fijar({ automatico })}
          />
          {vista.automatico ? (
            <Interruptor
              testID="respaldo-solo-wifi"
              etiqueta="Solo con Wi-Fi"
              descripcion="Así no gasta tus datos móviles."
              valor={vista.soloWifi}
              alCambiar={(soloWifi) => fijar({ soloWifi })}
            />
          ) : null}
          {borrando === 'no' ? (
            <Boton
              testID="respaldo-borrar-cuenta"
              variante="texto"
              ancho="contenido"
              etiqueta="Borrar cuenta de respaldo"
              alPresionar={() => {
                setMensaje(null);
                setBorrando('confirmar');
              }}
            />
          ) : (
            <>
              <Texto variante="cuerpo" tono="faltante" testID="respaldo-borrar-aviso">
                Se borran todos tus respaldos de la nube y tu correo. Lo que hay en este teléfono no cambia.
              </Texto>
              <Boton
                testID="respaldo-borrar-confirmar"
                variante="secundario"
                etiqueta="Borrar cuenta"
                cargando={borrando === 'borrando'}
                deshabilitado={borrando === 'borrando'}
                alPresionar={() => void borrar()}
              />
              <Boton
                variante="texto"
                etiqueta="Cancelar"
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
