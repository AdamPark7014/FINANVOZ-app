import { useState } from 'react';
import {
  bajarUltimoRespaldo,
  mensajeErrorNube,
  mensajeErrorRespaldo,
  obtenerCentroPrivacidad,
  prepararRestauracion,
  resumenRespaldo,
  type RespaldoListo,
} from '../../servicios';
import { useControlApp } from '../../sesion/ControlApp';
import { useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, CampoTexto, Tarjeta, Texto } from '../../ui';
import { FlujoCorreo, type CuentaConfirmada } from './FlujoCorreo';

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'nube' }
  | { tipo: 'contrasena'; archivo: Uint8Array; deLaNube: boolean }
  | { tipo: 'confirmar'; listo: RespaldoListo };

/**
 * Restaurar (M9, `02 §19`): desde la nube (correo → código → el respaldo más reciente) o desde un archivo
 * `.cartera`; después contraseña → resumen → restaurar.
 * Antes de tocar la base, el respaldo se descifra, se valida y se ensaya en memoria; contraseña equivocada y
 * archivo dañado dan el mismo mensaje, a propósito.
 */
export function Restaurar({ alVolver }: { alVolver: () => void }) {
  const respaldo = useControlApp().respaldo;
  const nube = respaldo?.nube ?? null;
  const { reidentificar } = usePlanTienda();
  const tieneDatos = useVista((ctx) => {
    const g = obtenerCentroPrivacidad(ctx).guardado;
    return g.cuentas + g.movimientos > 0;
  });
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' });
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const elegir = async () => {
    if (!respaldo) return;
    setError(null);
    setTrabajando(true);
    try {
      const archivo = await respaldo.archivos.elegir();
      if (archivo) setPaso({ tipo: 'contrasena', archivo, deLaNube: false });
    } catch (e) {
      setError(mensajeErrorRespaldo(e));
    } finally {
      setTrabajando(false);
    }
  };

  /** Ya entró con el correo: baja el respaldo más reciente de esa cuenta. */
  const bajar = async (r: CuentaConfirmada) => {
    if (!nube) return;
    // Las compras de Plus siguen al usuario de ese correo (pendiente 58).
    if (r.cambioUsuario) void reidentificar();
    setError(null);
    setTrabajando(true);
    try {
      const bajado = await bajarUltimoRespaldo(nube.respaldos);
      if (bajado.ok) setPaso({ tipo: 'contrasena', archivo: bajado.bytes, deLaNube: true });
      else setError(mensajeErrorNube(bajado.error));
    } finally {
      setTrabajando(false);
    }
  };

  const abrir = async (archivo: Uint8Array) => {
    if (!respaldo) return;
    setError(null);
    setTrabajando(true);
    try {
      const listo = await prepararRestauracion(respaldo.deps, archivo, contrasena);
      setContrasena('');
      setPaso({ tipo: 'confirmar', listo });
    } catch (e) {
      setError(mensajeErrorRespaldo(e));
    } finally {
      setTrabajando(false);
    }
  };

  const restaurar = async (listo: RespaldoListo) => {
    if (!respaldo) return;
    setTrabajando(true);
    // La raíz reemplaza la sesión y vuelve al inicio con "Listo: recuperé…".
    await respaldo.restaurar(listo);
  };

  return (
    <>
      <Boton
        testID="restaurar-volver"
        variante="texto"
        ancho="contenido"
        etiqueta="Volver"
        deshabilitado={trabajando}
        alPresionar={alVolver}
      />
      <Texto variante="titulo">Restaurar un respaldo</Texto>
      <Texto variante="cuerpo" tono="secundario">
        {nube
          ? 'Recupera tus cuentas, movimientos y ajustes desde tu respaldo en la nube o desde un archivo .cartera.'
          : 'Recupera tus cuentas, movimientos y ajustes desde un archivo .cartera que exportaste antes.'}
      </Texto>
      {!respaldo ? (
        <Texto variante="cuerpo">Restaurar no está disponible en esta versión de la app.</Texto>
      ) : (
        <Tarjeta testID="restaurar-paso">
          {paso.tipo === 'elegir' ? (
            <>
              {nube ? (
                <Boton
                  testID="restaurar-nube"
                  etiqueta="Desde la nube"
                  deshabilitado={trabajando}
                  alPresionar={() => {
                    setError(null);
                    setPaso({ tipo: 'nube' });
                  }}
                />
              ) : null}
              <Boton
                testID="restaurar-elegir"
                variante={nube ? 'secundario' : 'primario'}
                etiqueta={nube ? 'Desde un archivo' : 'Elegir archivo'}
                cargando={trabajando}
                deshabilitado={trabajando}
                alPresionar={() => void elegir()}
              />
            </>
          ) : paso.tipo === 'nube' ? (
            <>
              <Texto variante="secundario" tono="secundario">
                Escribe el correo de tu cuenta de respaldo. Te mando un código para entrar.
              </Texto>
              {trabajando ? (
                <Texto variante="cuerpo" tono="secundario" testID="restaurar-bajando">
                  Bajando tu respaldo…
                </Texto>
              ) : nube ? (
                <FlujoCorreo cuenta={nube.cuenta} soloEntrar alConfirmar={(r) => void bajar(r)} />
              ) : null}
              <Boton
                variante="texto"
                etiqueta="Volver a elegir"
                deshabilitado={trabajando}
                alPresionar={() => {
                  setError(null);
                  setPaso({ tipo: 'elegir' });
                }}
              />
            </>
          ) : paso.tipo === 'contrasena' ? (
            <>
              {paso.deLaNube ? (
                <Texto variante="cuerpo" testID="restaurar-encontre">
                  Encontré tu respaldo más reciente. Escribe su contraseña.
                </Texto>
              ) : null}
              <CampoTexto
                testID="restaurar-contrasena"
                etiqueta="Contraseña del respaldo"
                valor={contrasena}
                alCambiar={setContrasena}
                autoFocus
                nativo={{ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false }}
                alEnviar={() => void abrir(paso.archivo)}
              />
              <Boton
                testID="restaurar-abrir"
                etiqueta="Abrir respaldo"
                cargando={trabajando}
                deshabilitado={trabajando || contrasena === ''}
                alPresionar={() => void abrir(paso.archivo)}
              />
              <Boton
                variante="texto"
                etiqueta={paso.deLaNube ? 'Volver a elegir' : 'Elegir otro archivo'}
                deshabilitado={trabajando}
                alPresionar={() => {
                  setError(null);
                  setContrasena('');
                  setPaso({ tipo: 'elegir' });
                }}
              />
            </>
          ) : (
            <>
              <Texto variante="cuerpo" testID="restaurar-resumen">
                {resumenRespaldo(paso.listo)}
              </Texto>
              {tieneDatos ? (
                <Texto variante="cuerpo" tono="faltante" testID="restaurar-reemplaza">
                  Se reemplaza todo lo que hay ahora en este teléfono. Si quieres conservarlo, primero exporta
                  un respaldo.
                </Texto>
              ) : null}
              <Boton
                testID="restaurar-confirmar"
                etiqueta="Restaurar"
                cargando={trabajando}
                deshabilitado={trabajando}
                alPresionar={() => void restaurar(paso.listo)}
              />
              <Boton
                variante="texto"
                etiqueta="Cancelar"
                deshabilitado={trabajando}
                alPresionar={() => setPaso({ tipo: 'elegir' })}
              />
            </>
          )}
          {error ? (
            <Texto
              variante="secundario"
              tono="faltante"
              accessibilityLiveRegion="polite"
              testID="restaurar-error"
            >
              {error}
            </Texto>
          ) : null}
        </Tarjeta>
      )}
    </>
  );
}
